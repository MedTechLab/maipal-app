// Thin wrapper over the Web Speech API for the 闻诊 read-aloud step.

export interface SttController {
  stop: () => void;
}

interface SttHandlers {
  onPartial: (text: string) => void;
  onEnd: (finalText: string) => void;
  onError: () => void;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

/** Start recognition. Returns null if the browser has no Web Speech support. */
export function startRecognition(h: SttHandlers): SttController | null {
  const Ctor: SpeechRecognitionCtor | undefined =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = '';

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) finalText += t;
      else interim += t;
    }
    h.onPartial((finalText + interim).trim());
  };
  rec.onerror = () => h.onError();
  rec.onend = () => h.onEnd(finalText.trim());

  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}
