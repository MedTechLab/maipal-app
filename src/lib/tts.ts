import { api } from './api';

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

type Handlers = { onStart?: () => void; onEnd?: () => void };

// Browser speechSynthesis — the silent fallback when edge-tts is unavailable.
function fallbackSpeak(text: string, h: Handlers): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    h.onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.8;
  u.pitch = 0.4;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /Yunjian|Yunyang|云健|云扬/i.test(v.name)) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('zh'));
  if (preferred) u.voice = preferred;
  u.onstart = () => h.onStart?.();
  u.onend = () => h.onEnd?.();
  u.onerror = () => h.onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Speak `text`: prefer the server's edge-tts MP3, fall back to speechSynthesis. */
export async function speakText(text: string, handlers: Handlers = {}): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  stopSpeaking();

  const blob = await api.tts(clean);
  if (!blob) {
    fallbackSpeak(clean, handlers);
    return;
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onplay = () => handlers.onStart?.();
  audio.onended = () => {
    handlers.onEnd?.();
    cleanup();
  };
  audio.onerror = () => {
    cleanup();
    fallbackSpeak(clean, handlers);
  };
  try {
    await audio.play();
  } catch {
    cleanup();
    fallbackSpeak(clean, handlers);
  }
}
