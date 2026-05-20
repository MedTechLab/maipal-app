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
  ChatMessage,
  Clinic,
  CreateUserBody,
  HealthReport,
  Plan,
  PostMessageBody,
  PostReportBody,
  Product,
  User,
} from '../../worker/types';

export type { ChatMessage, Clinic, HealthReport, Plan, Product, User };

const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

class ApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `API ${status}`);
  }
}

async function req<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : (init.body as BodyInit | undefined),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  health: () => req<{ ok: boolean; ts: number }>('/api/health'),

  // Users
  upsertUser: (body: CreateUserBody) =>
    req<User>('/api/users', { method: 'POST', json: body }),
  getUser: (id: string) => req<User>(`/api/users/${id}`),

  // Chat
  listMessages: (userId: string) =>
    req<ChatMessage[]>(`/api/users/${userId}/messages`),
  postMessage: (userId: string, body: PostMessageBody) =>
    req<ChatMessage>(`/api/users/${userId}/messages`, {
      method: 'POST',
      json: body,
    }),

  // Reports
  latestReport: (userId: string) =>
    req<HealthReport | null>(`/api/users/${userId}/reports/latest`),
  postReport: (userId: string, body: PostReportBody) =>
    req<HealthReport>(`/api/users/${userId}/reports`, {
      method: 'POST',
      json: body,
    }),

  // Plan + tasks
  getPlan: (userId: string) => req<Plan | null>(`/api/users/${userId}/plan`),
  createPlan: (userId: string) =>
    req<Plan>(`/api/users/${userId}/plan`, { method: 'POST' }),
  completeTask: (taskId: string) =>
    req<{ id: string; completed: boolean }>(
      `/api/tasks/${taskId}/complete`,
      { method: 'PATCH' },
    ),

  // Points
  addPoints: (userId: string, delta: number, reason: string, task_id?: string) =>
    req<{ points: number }>(`/api/users/${userId}/points`, {
      method: 'POST',
      json: { delta, reason, task_id },
    }),

  // Catalog
  listProducts: (category?: string) =>
    req<Product[]>(
      `/api/products${category && category !== 'all' ? `?category=${category}` : ''}`,
    ),
  listClinics: () => req<Clinic[]>('/api/clinics'),
};

export { ApiError };

/**
 * Stable device ID. Uses @capacitor/preferences on native (so it survives app
 * relaunches) and localStorage in the browser. Created lazily on first call.
 */
export async function getDeviceId(): Promise<string> {
  // Lazy import to avoid pulling Preferences into the web bundle eagerly.
  const { Preferences } = await import('@capacitor/preferences');
  const KEY = 'maipal.deviceId';
  const cur = await Preferences.get({ key: KEY });
  if (cur.value) return cur.value;
  const id = crypto.randomUUID();
  await Preferences.set({ key: KEY, value: id });
  return id;
}
