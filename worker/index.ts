import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as db from './db';
import type {
  AddPointsBody,
  CreateUserBody,
  PostMessageBody,
  PostReportBody,
} from './types';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

// CORS — allow the Capacitor mobile shells and any browser at the same origin.
// iOS uses capacitor://localhost, Android uses https://localhost or http://localhost.
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // Native shells / curl / same-origin: no Origin header. Allow.
      if (!origin) return '*';
      // Local Vite dev.
      if (
        origin === 'http://localhost:5173' ||
        origin === 'capacitor://localhost' ||
        origin === 'https://localhost' ||
        origin === 'http://localhost'
      )
        return origin;
      // Cloudflare-managed subdomains (workers.dev preview, pages.dev preview).
      if (origin.endsWith('.workers.dev') || origin.endsWith('.pages.dev')) return origin;
      // Production custom domains.
      if (origin === 'https://maipal.org' || origin.endsWith('.maipal.org')) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Device-Id'],
    credentials: false,
  }),
);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// ─── Users ───────────────────────────────────────────────────

app.post('/api/users', async (c) => {
  const body = await c.req.json<CreateUserBody>();
  if (!body.name || !body.gender || !body.age) {
    return c.json({ error: 'name, gender, age required' }, 400);
  }
  const id = body.id ?? crypto.randomUUID();
  const user = await db.upsertUser(c.env.DB, {
    id,
    name: body.name,
    gender: body.gender,
    age: body.age,
    height: body.height,
    weight: body.weight,
    concerns: body.concerns,
  });
  return c.json(user, 201);
});

app.get('/api/users/:id', async (c) => {
  const u = await db.getUser(c.env.DB, c.req.param('id'));
  if (!u) return c.json({ error: 'not found' }, 404);
  return c.json(u);
});

// ─── Chat ────────────────────────────────────────────────────

app.get('/api/users/:id/messages', async (c) => {
  const messages = await db.listMessages(c.env.DB, c.req.param('id'));
  return c.json(messages);
});

app.post('/api/users/:id/messages', async (c) => {
  const body = await c.req.json<PostMessageBody>();
  if (!body.role || !body.content) {
    return c.json({ error: 'role, content required' }, 400);
  }
  const m = await db.appendMessage(c.env.DB, c.req.param('id'), body.role, body.content);
  return c.json(m, 201);
});

// ─── Reports ─────────────────────────────────────────────────

app.get('/api/users/:id/reports/latest', async (c) => {
  const r = await db.latestReport(c.env.DB, c.req.param('id'));
  if (!r) return c.json(null);
  return c.json(r);
});

app.post('/api/users/:id/reports', async (c) => {
  const body = await c.req.json<PostReportBody>();
  const r = await db.insertReport(c.env.DB, c.req.param('id'), body);
  return c.json(r, 201);
});

// ─── Plan + tasks ────────────────────────────────────────────

app.get('/api/users/:id/plan', async (c) => {
  const p = await db.activePlan(c.env.DB, c.req.param('id'));
  if (!p) return c.json(null);
  return c.json(p);
});

app.post('/api/users/:id/plan', async (c) => {
  const p = await db.createPlan(c.env.DB, c.req.param('id'));
  return c.json(p, 201);
});

app.patch('/api/tasks/:taskId/complete', async (c) => {
  const t = await db.completeTask(c.env.DB, c.req.param('taskId'));
  if (!t) return c.json({ error: 'not found' }, 404);
  return c.json(t);
});

// ─── Points ──────────────────────────────────────────────────

app.post('/api/users/:id/points', async (c) => {
  const body = await c.req.json<AddPointsBody>();
  if (typeof body.delta !== 'number' || !body.reason) {
    return c.json({ error: 'delta (number), reason required' }, 400);
  }
  const r = await db.addPoints(
    c.env.DB,
    c.req.param('id'),
    body.delta,
    body.reason,
    body.task_id,
  );
  return c.json(r);
});

// ─── Catalog ─────────────────────────────────────────────────

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
// `not_found_handling: "single-page-application"` in wrangler.toml makes the
// asset binding serve index.html for unknown paths, so client-side routes work.
export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(req, env, ctx);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
