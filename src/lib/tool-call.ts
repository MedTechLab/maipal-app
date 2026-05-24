import type { DoctorReport } from '../../worker/types';

export interface ToolCallSignal {
  action: 'CAPTURE_FACE' | 'CAPTURE_TONGUE' | 'RECORD_VOICE' | 'GENERATE_REPORT' | string;
  reason?: string;
  guidance?: string;
  report?: DoctorReport;
}

const TOOL_CALL_RE = /```tool_call\s*([\s\S]*?)```/i;

/** Split a doctor message into its visible text and the trailing tool_call signal. */
export function extractToolCall(text: string): {
  cleaned: string;
  signal: ToolCallSignal | null;
} {
  const m = text.match(TOOL_CALL_RE);
  if (!m) return { cleaned: text.trim(), signal: null };
  const cleaned = text.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim();
  let signal: ToolCallSignal | null = null;
  try {
    signal = JSON.parse(m[1].trim());
  } catch {
    signal = null;
  }
  return { cleaned, signal };
}

/** While streaming, hide anything from the first code fence on (the tool_call). */
export function stripForDisplay(text: string): string {
  const i = text.indexOf('```');
  return (i >= 0 ? text.slice(0, i) : text).trimEnd();
}

/** Strip markdown / emoji / *stage directions* so TTS reads only spoken words. */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*[^*]+\*/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#>`_~]/g, '')
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}]/gu,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
