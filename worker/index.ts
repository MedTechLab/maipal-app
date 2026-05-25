import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import * as db from './db';
import { signSession, verifySession } from './auth/jwt';
import {
  verifyApple,
  verifyGoogle,
  verifyMicrosoft,
  type VerifiedIdentity,
} from './auth/providers';
import type {
  AddPointsBody,
  AuthLoginBody,
  ChatRequestBody,
  CreatePlanBody,
  DiagnosisRequestBody,
  PostMessageBody,
  PostReportBody,
  TtsRequestBody,
  UpdateUserProfileBody,
  User,
} from './types';
import type { Env } from './env';
import { buildSystemPrompt, extractOpeningMessage } from './persona-prompt';
import { callCodeBuddy, type LlmMessage } from './llm';
import { synthesizeSpeech } from './tts';
import { runDiagnosis } from './diagnosis';

type Vars = { userId: string; user: User };
type AppEnv = { Bindings: Env; Variables: Vars };

const app = new Hono<AppEnv>();

app.use('*', logger());

// CORS — allow the Capacitor mobile shells and any browser at the same origin.
// iOS uses capacitor://localhost, Android uses https://localhost or http://localhost.
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (
        origin === 'http://localhost:5173' ||
        origin === 'capacitor://localhost' ||
        origin === 'https://localhost' ||
        origin === 'http://localhost'
      )
        return origin;
      if (origin.endsWith('.workers.dev') || origin.endsWith('.pages.dev')) return origin;
      if (origin === 'https://maipal.org' || origin.endsWith('.maipal.org')) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }),
);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// Never leak a plain-text "Internal Server Error" — the client expects JSON and
// would otherwise throw an opaque JSON-parse error. Surface the real message.
app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json(
    { error: 'server error', detail: err instanceof Error ? err.message : String(err) },
    500,
  );
});

// Doctor's opening line (public — shown before sign-in / on a fresh session).
app.get('/api/opening', (c) => c.json({ opening: extractOpeningMessage() }));

// ─── Auth: provider sign-in ──────────────────────────────────

async function handleProviderLogin(c: Context<AppEnv>, verified: VerifiedIdentity) {
  const user = await db.upsertAuthUser(c.env.DB, verified);
  const token = await signSession(user.id, c.env.SESSION_SECRET);
  return c.json({ token, user }, 200);
}

app.post('/api/auth/google', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  let id: VerifiedIdentity;
  try {
    id = await verifyGoogle(body.idToken, c.env);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
  // Session creation (DB write + signing) errors are server faults → 500 via onError.
  return await handleProviderLogin(c, id);
});

app.post('/api/auth/apple', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  let id: VerifiedIdentity;
  try {
    id = await verifyApple(body.idToken, c.env);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
  // Apple only sends name on first sign-in, and not in the JWT — the client
  // forwards it in the request body.
  if (!id.name && body.name) id.name = body.name;
  return await handleProviderLogin(c, id);
});

app.post('/api/auth/microsoft', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  let id: VerifiedIdentity;
  try {
    id = await verifyMicrosoft(body.idToken, c.env);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
  return await handleProviderLogin(c, id);
});

// ─── Auth middleware ─────────────────────────────────────────

const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return c.json({ error: 'unauthorized' }, 401);
  try {
    const session = await verifySession(m[1], c.env.SESSION_SECRET);
    const user = await db.getUserById(c.env.DB, session.sub);
    if (!user) return c.json({ error: 'user not found' }, 401);
    c.set('userId', user.id);
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'invalid session' }, 401);
  }
};

app.use('/api/auth/me', requireAuth);
app.use('/api/me/*', requireAuth);
app.use('/api/tasks/*', requireAuth);

app.get('/api/auth/me', (c) => c.json(c.get('user')));

// ─── Profile (replaces device-ID upsert) ────────────────────

app.post('/api/me/profile', async (c) => {
  const body = await c.req.json<UpdateUserProfileBody>();
  if (!body.name || !body.gender || !body.age) {
    return c.json({ error: 'name, gender, age required' }, 400);
  }
  const u = await db.updateUserProfile(c.env.DB, c.get('userId'), body);
  return c.json(u);
});

// ─── Chat ────────────────────────────────────────────────────

app.get('/api/me/messages', async (c) => {
  const messages = await db.listMessages(c.env.DB, c.get('userId'));
  return c.json(messages);
});

app.post('/api/me/messages', async (c) => {
  const body = await c.req.json<PostMessageBody>();
  if (!body.role || !body.content) {
    return c.json({ error: 'role, content required' }, 400);
  }
  const m = await db.appendMessage(c.env.DB, c.get('userId'), body.role, body.content);
  return c.json(m, 201);
});

app.delete('/api/me/messages', async (c) => {
  await db.clearMessages(c.env.DB, c.get('userId'));
  return c.json({ ok: true });
});

// ─── AI chat (streaming) ─────────────────────────────────────
// Prepends the persona system prompt and pipes CodeBuddy's SSE through, re-emitting
// the v5 wire format: `data: {"content":"…"}` … `data: [DONE]`. We don't persist
// here — the client writes each turn via POST /api/me/messages.

app.post('/api/me/chat', async (c) => {
  const body = await c.req.json<ChatRequestBody>().catch(() => null);
  if (!body?.messages?.length) {
    return c.json({ error: 'messages required' }, 400);
  }
  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...body.messages,
  ];

  let upstream: Response;
  try {
    upstream = await callCodeBuddy(c.env, messages, { stream: true, model: body.model });
  } catch (e) {
    return c.json({ error: 'chat upstream unreachable', detail: (e as Error).message }, 502);
  }
  if (!upstream.ok || !upstream.body) {
    const detail = upstream.body ? (await upstream.text()).slice(0, 300) : '';
    return c.json({ error: 'chat upstream error', status: upstream.status, detail }, 502);
  }

  return streamSSE(c, async (stream) => {
    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
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
          if (data === '[DONE]') continue; // we emit our own terminator below
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) await stream.writeSSE({ data: JSON.stringify({ content }) });
          } catch {
            // partial JSON or keepalive — ignore
          }
        }
      }
    } catch (e) {
      await stream.writeSSE({ data: JSON.stringify({ error: (e as Error).message }) });
    } finally {
      await stream.writeSSE({ data: '[DONE]' });
    }
  });
});

// ─── TTS (edge-tts → MP3) ────────────────────────────────────
// On any failure returns 5xx so the client falls back to browser speechSynthesis.

app.post('/api/me/tts', async (c) => {
  const body = await c.req.json<TtsRequestBody>().catch(() => null);
  if (!body?.text?.trim()) return c.json({ error: 'text required' }, 400);
  try {
    const audio = await synthesizeSpeech(c.env, body.text);
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return c.json({ error: 'tts unavailable', detail: (e as Error).message }, 502);
  }
});

// ─── 望诊 / 闻诊 (LLM vision + transcript) ───────────────────
// Returns { structured, summary }; `summary` is the text block the client
// re-injects as a user message so the doctor can read it back.

app.post('/api/me/diagnosis/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (kind !== 'face' && kind !== 'tongue' && kind !== 'voice') {
    return c.json({ error: 'unknown diagnosis kind' }, 400);
  }
  const body = await c.req
    .json<DiagnosisRequestBody>()
    .catch(() => ({}) as DiagnosisRequestBody);
  const result = await runDiagnosis(c.env, kind, {
    image: body.image,
    transcript: body.transcript,
    voiceMetrics: body.voiceMetrics,
  });
  return c.json(result);
});

// ─── Reports ─────────────────────────────────────────────────

app.get('/api/me/reports/latest', async (c) => {
  const r = await db.latestReport(c.env.DB, c.get('userId'));
  if (!r) return c.json(null);
  return c.json(r);
});

app.post('/api/me/reports', async (c) => {
  const body = await c.req.json<PostReportBody>();
  const r = await db.insertReport(c.env.DB, c.get('userId'), body);
  return c.json(r, 201);
});

// ─── Plan + tasks ────────────────────────────────────────────

app.get('/api/me/plan', async (c) => {
  const p = await db.activePlan(c.env.DB, c.get('userId'));
  if (!p) return c.json(null);
  return c.json(p);
});

app.post('/api/me/plan', async (c) => {
  const body = await c.req.json<CreatePlanBody>().catch(() => ({}) as CreatePlanBody);
  const p = await db.createPlan(c.env.DB, c.get('userId'), body.tasks);
  return c.json(p, 201);
});

app.patch('/api/tasks/:taskId/complete', async (c) => {
  const t = await db.completeTask(c.env.DB, c.req.param('taskId'));
  if (!t) return c.json({ error: 'not found' }, 404);
  return c.json(t);
});

// ─── Points ──────────────────────────────────────────────────

app.post('/api/me/points', async (c) => {
  const body = await c.req.json<AddPointsBody>();
  if (typeof body.delta !== 'number' || !body.reason) {
    return c.json({ error: 'delta (number), reason required' }, 400);
  }
  const r = await db.addPoints(
    c.env.DB,
    c.get('userId'),
    body.delta,
    body.reason,
    body.task_id,
  );
  return c.json(r);
});

// ─── Catalog (public) ────────────────────────────────────────

app.get('/api/products', async (c) => {
  const cat = c.req.query('category');
  return c.json(await db.listProducts(c.env.DB, cat));
});

app.get('/api/clinics', async (c) => {
  return c.json(await db.listClinics(c.env.DB));
});

// ─── 404 for unknown /api routes ─────────────────────────────

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else falls through to the static asset binding (the React build).
export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(req, env, ctx);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
