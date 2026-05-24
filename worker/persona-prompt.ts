import personaData from './persona.json';

const PERSONA: string = personaData.text;

const FALLBACK_OPENING =
  '您好，欢迎来找我聊聊。我是脉大夫。先问一下，怎么称呼您呢？';

/** The doctor's first message, lifted verbatim from the persona's 问诊开场 section. */
export function extractOpeningMessage(): string {
  const match = PERSONA.match(/\*\*脉大夫\*\*：[\s\S]*?(?=---|$)/);
  if (match) return match[0].replace(/\*\*脉大夫\*\*：/, '').trim();
  return FALLBACK_OPENING;
}

/**
 * Build the chat system prompt from the persona document.
 *
 * Mirrors the v5 server: we don't ship the whole 17KB document to the model —
 * we slice out the five sections the doctor actually needs (role, the tool_call
 * signal protocol, the knowledge-base capability list, the inquiry flow, and the
 * report template), then append the runtime footer.
 */
export function buildSystemPrompt(): string {
  const slice = (re: RegExp) => PERSONA.match(re)?.[0] ?? '';

  const role = slice(/## 一、AI角色设定[\s\S]*?(?=## 一·附|$)/);
  const protocol = slice(/## 一·附：系统信号协议[\s\S]*?(?=## 二、|$)/);
  const knowledge = slice(/### 知识库核心能力清单[\s\S]*?(?=## 三、|$)/);
  const flow = slice(/### 3\.1 问诊总体流程[\s\S]*?(?=### 3\.2|$)/);
  const report = slice(/## 四、诊断报告模板[\s\S]*?(?=## 五、|$)/);

  return `${role}

${protocol}

${knowledge}

${flow}

${report}

【重要提示】
- 你正在使用网页端与患者对话
- **必须在需要望诊/闻诊时，严格按照「系统信号协议」格式输出 tool_call 代码块**
- 严格遵循"一次只问一个问题"的原则
- 问诊从问称呼开始，逐步深入
- 最终需要出具完整的中医健康调理报告
- 养生为主，治未病理念
- 主要面向45-65岁中老年人

【当前状态】
- 这是全新的问诊会话
- 你应该以脉大夫的身份，用开场白开始对话
- 等待患者回复后，根据回答继续问诊流程`;
}
