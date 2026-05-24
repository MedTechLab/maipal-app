import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
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
  PostMessageBody,
  PostReportBody,
  UpdateUserProfileBody,
  User,
} from './types';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_TENANT?: string;
}

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

// ─── Auth: provider sign-in ──────────────────────────────────

async function handleProviderLogin(c: Context<AppEnv>, verified: VerifiedIdentity) {
  const user = await db.upsertAuthUser(c.env.DB, verified);
  const token = await signSession(user.id, c.env.SESSION_SECRET);
  return c.json({ token, user }, 200);
}

app.post('/api/auth/google', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  try {
    const id = await verifyGoogle(body.idToken, c.env);
    return handleProviderLogin(c, id);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
});

app.post('/api/auth/apple', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  try {
    const id = await verifyApple(body.idToken, c.env);
    // Apple only sends name on first sign-in, and not in the JWT — the client
    // forwards it in the request body.
    if (!id.name && body.name) id.name = body.name;
    return handleProviderLogin(c, id);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
});

app.post('/api/auth/microsoft', async (c) => {
  const body = await c.req.json<AuthLoginBody>().catch(() => null);
  if (!body?.idToken) return c.json({ error: 'idToken required' }, 400);
  try {
    const id = await verifyMicrosoft(body.idToken, c.env);
    return handleProviderLogin(c, id);
  } catch (e) {
    return c.json({ error: 'invalid token', detail: (e as Error).message }, 401);
  }
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
  const p = await db.createPlan(c.env.DB, c.get('userId'));
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
