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
  HealthReport,
  Plan,
  PostMessageBody,
  PostReportBody,
  Product,
  UpdateUserProfileBody,
  User,
} from '../../worker/types';

export type { AuthLoginResponse, ChatMessage, Clinic, HealthReport, Plan, Product, User };

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

  // Chat
  listMessages: () => req<ChatMessage[]>('/api/me/messages'),
  postMessage: (body: PostMessageBody) =>
    req<ChatMessage>('/api/me/messages', { method: 'POST', json: body }),

  // Reports
  latestReport: () => req<HealthReport | null>('/api/me/reports/latest'),
  postReport: (body: PostReportBody) =>
    req<HealthReport>('/api/me/reports', { method: 'POST', json: body }),

  // Plan + tasks
  getPlan: () => req<Plan | null>('/api/me/plan'),
  createPlan: () => req<Plan>('/api/me/plan', { method: 'POST' }),
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
