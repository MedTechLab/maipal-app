import type { Env } from './env';
import type { DiagnosisResult } from './types';
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

const VOICE_PROMPT = `你是中医闻诊辅助助手。下面是患者朗读一句话的「语音转写文本」。
你只能依据文本推断语速与流畅度，无法听到真实声学特征（音量/音调/嘶哑/声颤），这些请标记为"未测"。
只输出一个 JSON 对象，不要任何多余文字：
{
  "语速": "偏慢/正常/偏快/未测",
  "流畅度": "流畅/可/断续/未测",
  "辨证初判": "简短判断，或 '需结合其他四诊'"
}
转写文本：`;

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
    `音量：未测；音调：未测；嘶哑：未测；声颤：未测\n` +
    `语速：${v(o, '语速', '未测')}；流畅度：${v(o, '流畅度', '未测')}\n` +
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
  payload: { image?: string; transcript?: string },
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

    // voice — derive from the speech-to-text transcript only.
    const transcript = (payload.transcript ?? '').trim();
    if (!transcript) return { structured: null, summary: failSummary };
    const text = await callCodeBuddyText(
      env,
      [{ role: 'user', content: VOICE_PROMPT + transcript }],
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
