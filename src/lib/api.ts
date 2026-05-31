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

async function nativeGetSessionToken() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences.get({ key: TOKEN_KEY });
}

async function nativeSetSessionToken(token: string) {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences.set({ key: TOKEN_KEY, value: token });
}

async function nativeRemoveSessionToken() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences.remove({ key: TOKEN_KEY });
}

export async function loadSessionToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;

  if (typeof window !== 'undefined') {
    const webToken = localStorage.getItem(TOKEN_KEY);
    cachedToken = webToken ?? null;
    return cachedToken;
  }

  const { value } = await nativeGetSessionToken();
  cachedToken = value ?? null;
  return cachedToken;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = token;

  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return;
  }

  if (token) {
    await nativeSetSessionToken(token);
  } else {
    await nativeRemoveSessionToken();
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
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. a plain-text 5xx) — keep the raw text.
      body = text;
    }
  }
  if (!res.ok) {
    let msg: string | undefined;
    if (typeof body === 'string') msg = body;
    else if (body && typeof body === 'object') {
      const b = body as { error?: string; detail?: string };
      msg = [b.error, b.detail].filter(Boolean).join(': ') || undefined;
    }
    throw new ApiError(res.status, body, msg);
  }
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
  // Dev-bypass mode: call CodeBuddy API directly (same as v5 server.js)
  if (localStorage.getItem('maipal.dev-bypass') === 'true') {
    return devChatStream(messages, onDelta, opts);
  }

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

// Dev-bypass: direct LLM call (same API as v5 server.js)
const DEV_SYSTEM_PROMPT = `你是脉大夫，一位资深、亲切的中医师。
角色特征：温和亲切，像真正的中医面诊一样和患者对话。目标人群是45-65岁中老年人，以养生调理为主。
对话方式：一次只问一个问题，不要一次性抛出大量问题，像真人面对面对话。
问诊流程：遵循望闻问切四诊合参，按中医十问歌系统问诊。
核心原则：先问称呼建立信任，问诊一次只问一个问题，养生为主治未病理念。
语言风格：使用"呀"作为句末语气词，温暖不刻板，不使用"您好"开头。`;

async function devChatStream(
  messages: ChatTurn[],
  onDelta: (text: string) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  const apiKey = 'ck_fi5qn7671o8w.S0XOPduaPm1QzIEWjGgUEEqTMyBGqcH6lKWYwNcSmrI';
  const body = {
    model: 'claude-sonnet-4-20250514',
    stream: true,
    messages: [
      { role: 'system', content: DEV_SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  };
  const res = await fetch('https://copilot.tencent.com/v2/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`LLM API error: ${res.status}`);
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
        const parsed = JSON.parse(data);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        // ignore
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
  devLogin: (email?: string) =>
    req<AuthLoginResponse>('/api/auth/dev-login', {
      method: 'POST',
      json: { email: email || 'dev@maipal.local' },
      auth: false,
    }),
  phoneSendCode: (phone: string) =>
    req<{ ok: boolean; message: string }>('/api/auth/phone/send-code', {
      method: 'POST',
      json: { phone },
      auth: false,
    }),
  phoneVerify: (phone: string, code: string) =>
    req<AuthLoginResponse>('/api/auth/phone/verify', {
      method: 'POST',
      json: { phone, code },
      auth: false,
    }),
  phoneRegister: (phone: string, password: string) =>
    req<AuthLoginResponse>('/api/auth/phone/register', {
      method: 'POST',
      json: { phone, password },
      auth: false,
    }),
  phoneLogin: (phone: string, password: string) =>
    req<AuthLoginResponse>('/api/auth/phone/login', {
      method: 'POST',
      json: { phone, password },
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
  clearMessages: () => req<{ ok: boolean }>('/api/me/messages', { method: 'DELETE' }),
  chatStream,

  // 望诊 / 闻诊
  diagnose: (kind: 'face' | 'tongue' | 'voice', payload: { image?: string; transcript?: string; voiceMetrics?: unknown }) =>
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
