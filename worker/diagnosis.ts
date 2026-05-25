import type { Env } from './env';
import type { DiagnosisResult, VoiceMetricsPayload } from './types';
import { callCodeBuddyText, type LlmMessage } from './llm';

export type DiagnosisKind = 'face' | 'tongue' | 'voice';

const DEFAULT_VISION_MODEL = 'claude-sonnet-4.6-1m';

const FACE_PROMPT = `你是中医望诊视觉分析助手。请观察这张人脸照片，提取中医面诊信息。
只输出一个 JSON 对象，不要任何多余文字，键固定如下，值用简短中文：
{
  "面色主色": "白/红/黄/青/黑 之一或描述",
  "光泽": "明润/有光泽/晦暗/无光泽",
  "神态": "精神饱满/略显疲惫/萎靡",
  "眼睛": "明亮/暗淡/黑眼圈/眼袋 等",
  "浮肿": "无/轻度/明显",
  "皮肤": "正常/干燥/油腻/松弛",
  "辨证初判": "如 气血平和 / 气血偏虚 等简短判断"
}
若照片不清晰或非人脸，所有值填 "无法判断"。`;

const TONGUE_PROMPT = `你是中医舌诊视觉分析助手。请观察这张舌头照片，提取中医舌诊信息。
只输出一个 JSON 对象，不要任何多余文字，键固定如下，值用简短中文：
{
  "舌色": "淡白/淡红/红/绛/紫/青",
  "舌形": "正常/胖大/瘦薄",
  "齿痕": "无/轻/明显",
  "裂纹": "无/有",
  "舌苔颜色": "白/黄/灰/黑",
  "舌苔厚薄": "薄/厚/腻/腐",
  "舌下络脉": "正常/迂曲/色深",
  "辨证初判": "如 脾胃尚和 / 脾虚湿盛 等简短判断"
}
若照片不清晰或非舌头，所有值填 "无法判断"。`;

const VOICE_PROMPT = `你是中医闻诊辅助分析助手。下面是患者朗读一句话时的**真实声学分析数据**和语音转写文本。
请根据这些声学指标进行中医闻诊判断。

声学指标说明：
- intensity_db: 平均音量(dB)，50以下=极微，50-60=低微，60-70=正常，70+=洪亮
- f0_mean_hz: 基频均值(Hz)，男性100-160正常，女性170-260正常；低于下限=低沉，高于上限=高亢
- f0_sd_hz: 基频标准差(Hz)，>15Hz提示声颤
- voiced_ratio: 有声比率(0-1)，>0.75=语速偏快，<0.45=语速偏慢
- pause_count: 停顿次数(>=200ms)，归一化到5秒内>=2次=换气偏多
- spectral_tilt: 频谱倾斜度，>0.6=正常清晰，0.3-0.6=轻度沙哑，<0.3=明显嘶哑
- jitter_approx: 基频扰动(%)，>1.0%=轻度嘶哑，>1.5%=声颤明显

只输出一个 JSON 对象，不要任何多余文字：
{
  "音量": "洪亮/正常/低微/极微",
  "音调": "高亢/正常/低沉",
  "嘶哑": "无/轻度/中度/重度",
  "声颤": "无/有",
  "语速": "偏快/正常/偏慢",
  "流畅度": "流畅/断续/费力",
  "换气频率": "正常/偏多",
  "辨证初判": "如 气虚/肺系失调/声音平和 等"
}

声学数据：
`;

// The model may wrap JSON in prose or ```json fences — pull out the first object.
function parseJsonLoose(text: string): Record<string, unknown> | null {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text.trim());
  if (direct) return direct;
  const m = text.match(/\{[\s\S]*\}/);
  return m ? tryParse(m[0]) : null;
}

const v = (o: Record<string, unknown>, k: string, fallback = '未明') => {
  const val = o[k];
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
};

function formatFace(o: Record<string, unknown>): string {
  return (
    `[望诊·面部结果]\n` +
    `面色主色：${v(o, '面色主色')}；光泽：${v(o, '光泽')}；神态：${v(o, '神态')}\n` +
    `辨证初判：${v(o, '辨证初判', '—')}`
  );
}

function formatTongue(o: Record<string, unknown>): string {
  return (
    `[望诊·舌部结果]\n` +
    `舌色：${v(o, '舌色')}；舌苔：${v(o, '舌苔颜色')}${v(o, '舌苔厚薄', '')}；` +
    `齿痕：${v(o, '齿痕')}；裂纹：${v(o, '裂纹')}；舌下络脉：${v(o, '舌下络脉')}\n` +
    `辨证初判：${v(o, '辨证初判', '—')}`
  );
}

function formatVoice(o: Record<string, unknown>): string {
  return (
    `[闻诊·语声结果]\n` +
    `音量：${v(o, '音量')}；音调：${v(o, '音调')}；嘶哑：${v(o, '嘶哑')}；声颤：${v(o, '声颤')}\n` +
    `语速：${v(o, '语速')}；流畅度：${v(o, '流畅度')}；换气：${v(o, '换气频率')}\n` +
    `辨证初判：${v(o, '辨证初判', '—')}`
  );
}

async function analyzeImage(
  env: Env,
  prompt: string,
  imageDataUrl: string,
): Promise<Record<string, unknown> | null> {
  const messages: LlmMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
  const text = await callCodeBuddyText(env, messages, {
    model: env.VISION_MODEL || DEFAULT_VISION_MODEL,
    responseFormat: 'json_object',
  });
  return parseJsonLoose(text);
}

/**
 * Run a single 望/闻诊 step. Never throws — on any failure it returns the
 * persona's `[望诊·失败]` / `[闻诊·失败]` sentinel so the doctor can move on.
 */
export async function runDiagnosis(
  env: Env,
  kind: DiagnosisKind,
  payload: { image?: string; transcript?: string; voiceMetrics?: VoiceMetricsPayload },
): Promise<DiagnosisResult> {
  const failSummary = kind === 'voice' ? '[闻诊·失败]' : '[望诊·失败]';
  try {
    if (kind === 'face' || kind === 'tongue') {
      if (!payload.image) return { structured: null, summary: failSummary };
      const o = await analyzeImage(
        env,
        kind === 'face' ? FACE_PROMPT : TONGUE_PROMPT,
        payload.image,
      );
      if (!o) return { structured: null, summary: failSummary };
      return { structured: o, summary: kind === 'face' ? formatFace(o) : formatTongue(o) };
    }

    // voice — use real audio metrics + transcript for comprehensive analysis
    const transcript = (payload.transcript ?? '').trim();
    const metrics = payload.voiceMetrics;
    if (!transcript && !metrics) return { structured: null, summary: failSummary };

    // Build the prompt with real acoustic data
    let metricsStr = '';
    if (metrics) {
      metricsStr = JSON.stringify({
        duration_sec: metrics.duration_sec,
        intensity_db: metrics.intensity_db,
        f0_mean_hz: metrics.f0_mean_hz,
        f0_sd_hz: metrics.f0_sd_hz,
        voiced_ratio: metrics.voiced_ratio,
        pause_count: metrics.pause_count,
        spectral_tilt: metrics.spectral_tilt,
        jitter_approx: metrics.jitter_approx,
      }, null, 2);
    } else {
      metricsStr = '(无声学数据 — 仅有转写文本)';
    }

    const promptContent = VOICE_PROMPT + metricsStr + '\n\n转写文本：' + (transcript || '(无转写)');

    const text = await callCodeBuddyText(
      env,
      [{ role: 'user', content: promptContent }],
      { responseFormat: 'json_object' },
    );
    const o = parseJsonLoose(text);
    if (!o) return { structured: null, summary: failSummary };
    return { structured: o, summary: formatVoice(o) };
  } catch (e) {
    console.error(`[diagnosis:${kind}]`, (e as Error).message);
    return { structured: null, summary: failSummary };
  }
}
