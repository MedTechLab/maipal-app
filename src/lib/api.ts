// Thin typed fetch wrapper around the Workers API.
//
// In Vite dev (`npm run dev`) the Cloudflare plugin runs the Worker inside
// Miniflare at the same origin, so relative URLs `/api/...` Just Work.
//
// In native Capacitor (iOS/Android) we don't share the origin, so set
// VITE_API_BASE to the deployed Worker URL at build time (e.g.
// `https://maipal-api.<your-subdomain>.workers.dev`). Capacitor bakes the
// env value into the bundled JS during `cap sync`.

import type {
  AuthLoginResponse,
  ChatMessage,
  Clinic,
  DiagnosisResult,
  HealthReport,
  Plan,
  PostMessageBody,
  PostReportBody,
  Product,
  UpdateUserProfileBody,
  User,
} from '../../worker/types';

export type {
  AuthLoginResponse,
  ChatMessage,
  Clinic,
  DiagnosisResult,
  HealthReport,
  Plan,
  Product,
  User,
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const TOKEN_KEY = 'maipal.session';

class ApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `API ${status}`);
  }
}

// ─── Session token storage ───────────────────────────────────
// Cached in-memory; persisted to @capacitor/preferences so it survives app
// relaunches on iOS/Android and to localStorage on web (Preferences proxies
// to localStorage in browsers).

let cachedToken: string | null = null;

async function preferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

export async function loadSessionToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  const Preferences = await preferences();
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  cachedToken = value ?? null;
  return cachedToken;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = token;
  const Preferences = await preferences();
  if (token) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  } else {
    await Preferences.remove({ key: TOKEN_KEY });
  }
}

// ─── Fetch helpers ───────────────────────────────────────────

async function req<T>(
  path: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { json, headers, auth = true, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string> | undefined) ?? {}),
  };
  if (auth) {
    const token = await loadSessionToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : (init.body as BodyInit | undefined),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// ─── Streaming chat (SSE) ────────────────────────────────────
// Bypasses req<T> because the response is an event stream, not JSON. Calls
// onDelta for each token; resolves on `data: [DONE]`.

async function chatStream(
  messages: ChatTurn[],
  onDelta: (text: string) => void,
  opts: { model?: string; signal?: AbortSignal } = {},
): Promise<void> {
  const token = await loadSessionToken();
  const res = await fetch(`${BASE}/api/me/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, model: opts.model }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || null, 'chat stream failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as { content?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) onDelta(parsed.content);
      } catch {
        // partial/non-JSON line — ignore
      }
    }
  }
}

// ─── TTS ─────────────────────────────────────────────────────

async function ttsBlob(text: string): Promise<Blob | null> {
  try {
    const token = await loadSessionToken();
    const res = await fetch(`${BASE}/api/me/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 200 ? blob : null;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────

export const api = {
  health: () => req<{ ok: boolean; ts: number }>('/api/health', { auth: false }),

  // Auth
  loginGoogle: (idToken: string) =>
    req<AuthLoginResponse>('/api/auth/google', {
      method: 'POST',
      json: { idToken },
      auth: false,
    }),
  loginApple: (idToken: string, name?: string) =>
    req<AuthLoginResponse>('/api/auth/apple', {
      method: 'POST',
      json: { idToken, name },
      auth: false,
    }),
  loginMicrosoft: (idToken: string) =>
    req<AuthLoginResponse>('/api/auth/microsoft', {
      method: 'POST',
      json: { idToken },
      auth: false,
    }),
  me: () => req<User>('/api/auth/me'),

  // Profile
  updateProfile: (body: UpdateUserProfileBody) =>
    req<User>('/api/me/profile', { method: 'POST', json: body }),

  // Opening line (public)
  getOpening: () => req<{ opening: string }>('/api/opening', { auth: false }),

  // Chat
  listMessages: () => req<ChatMessage[]>('/api/me/messages'),
  postMessage: (body: PostMessageBody) =>
    req<ChatMessage>('/api/me/messages', { method: 'POST', json: body }),
  chatStream,

  // 望诊 / 闻诊
  diagnose: (kind: 'face' | 'tongue' | 'voice', payload: { image?: string; transcript?: string }) =>
    req<DiagnosisResult>(`/api/me/diagnosis/${kind}`, { method: 'POST', json: payload }),

  // TTS — returns an MP3 blob, or null when synthesis is unavailable (client
  // then falls back to browser speechSynthesis).
  tts: ttsBlob,

  // Reports
  latestReport: () => req<HealthReport | null>('/api/me/reports/latest'),
  postReport: (body: PostReportBody) =>
    req<HealthReport>('/api/me/reports', { method: 'POST', json: body }),

  // Plan + tasks
  getPlan: () => req<Plan | null>('/api/me/plan'),
  createPlan: (tasks?: { text: string }[]) =>
    req<Plan>('/api/me/plan', {
      method: 'POST',
      json: tasks ? { tasks } : {},
    }),
  completeTask: (taskId: string) =>
    req<{ id: string; completed: boolean }>(`/api/tasks/${taskId}/complete`, {
      method: 'PATCH',
    }),

  // Points
  addPoints: (delta: number, reason: string, task_id?: string) =>
    req<{ points: number }>('/api/me/points', {
      method: 'POST',
      json: { delta, reason, task_id },
    }),

  // Catalog
  listProducts: (category?: string) =>
    req<Product[]>(
      `/api/products${category && category !== 'all' ? `?category=${category}` : ''}`,
      { auth: false },
    ),
  listClinics: () => req<Clinic[]>('/api/clinics', { auth: false }),
};

export { ApiError };
