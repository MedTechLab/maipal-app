import type {
  ChatMessage,
  Clinic,
  HealthReport,
  Plan,
  Product,
  Task,
  User,
} from './types';

export type DB = D1Database;

const now = () => Date.now();

const parseJsonArray = (s: string | null | undefined): string[] => {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// ─── Users ───────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  height: number | null;
  weight: number | null;
  concerns: string;
  points: number;
  created_at: number;
  updated_at: number;
}

const rowToUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  gender: r.gender,
  age: r.age,
  height: r.height ?? undefined,
  weight: r.weight ?? undefined,
  concerns: parseJsonArray(r.concerns),
  points: r.points,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

export async function upsertUser(
  db: DB,
  u: {
    id: string;
    name: string;
    gender: 'male' | 'female';
    age: number;
    height?: number;
    weight?: number;
    concerns?: string[];
  },
): Promise<User> {
  const ts = now();
  await db
    .prepare(
      `INSERT INTO users (id, name, gender, age, height, weight, concerns, points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         gender = excluded.gender,
         age = excluded.age,
         height = excluded.height,
         weight = excluded.weight,
         concerns = excluded.concerns,
         updated_at = excluded.updated_at`,
    )
    .bind(
      u.id,
      u.name,
      u.gender,
      u.age,
      u.height ?? null,
      u.weight ?? null,
      JSON.stringify(u.concerns ?? []),
      ts,
      ts,
    )
    .run();
  return (await getUser(db, u.id))!;
}

export async function getUser(db: DB, id: string): Promise<User | null> {
  const r = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return r ? rowToUser(r) : null;
}

// ─── Messages ────────────────────────────────────────────────

interface ChatRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export async function listMessages(db: DB, userId: string): Promise<ChatMessage[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC',
    )
    .bind(userId)
    .all<ChatRow>();
  return results;
}

export async function appendMessage(
  db: DB,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<ChatMessage> {
  const id = crypto.randomUUID();
  const created_at = now();
  await db
    .prepare(
      'INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, userId, role, content, created_at)
    .run();
  return { id, user_id: userId, role, content, created_at };
}

// ─── Reports ─────────────────────────────────────────────────

interface ReportRow {
  id: string;
  user_id: string;
  date: string;
  face_analysis: string | null;
  voice_analysis: string | null;
  suggestions: string;
  created_at: number;
}

const rowToReport = (r: ReportRow): HealthReport => ({
  id: r.id,
  user_id: r.user_id,
  date: r.date,
  face_analysis: r.face_analysis,
  voice_analysis: r.voice_analysis,
  suggestions: parseJsonArray(r.suggestions),
  created_at: r.created_at,
});

export async function latestReport(db: DB, userId: string): Promise<HealthReport | null> {
  const r = await db
    .prepare(
      'SELECT * FROM health_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(userId)
    .first<ReportRow>();
  return r ? rowToReport(r) : null;
}

export async function insertReport(
  db: DB,
  userId: string,
  body: { date: string; face_analysis: string; voice_analysis: string; suggestions: string[] },
): Promise<HealthReport> {
  const id = crypto.randomUUID();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO health_reports (id, user_id, date, face_analysis, voice_analysis, suggestions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      body.date,
      body.face_analysis,
      body.voice_analysis,
      JSON.stringify(body.suggestions),
      created_at,
    )
    .run();
  return {
    id,
    user_id: userId,
    date: body.date,
    face_analysis: body.face_analysis,
    voice_analysis: body.voice_analysis,
    suggestions: body.suggestions,
    created_at,
  };
}

// ─── Plans + tasks ───────────────────────────────────────────

interface PlanRow {
  id: string;
  user_id: string;
  created_at: number;
  active: number;
}

interface TaskRow {
  id: string;
  plan_id: string;
  text: string;
  sort_order: number;
  completed: number;
  completed_at: number | null;
}

const rowToTask = (r: TaskRow): Task => ({
  id: r.id,
  plan_id: r.plan_id,
  text: r.text,
  sort_order: r.sort_order,
  completed: r.completed === 1,
  completed_at: r.completed_at,
});

export async function activePlan(db: DB, userId: string): Promise<Plan | null> {
  const planRow = await db
    .prepare(
      'SELECT * FROM plans WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1',
    )
    .bind(userId)
    .first<PlanRow>();
  if (!planRow) return null;
  const { results } = await db
    .prepare(
      'SELECT * FROM tasks WHERE plan_id = ? ORDER BY sort_order ASC',
    )
    .bind(planRow.id)
    .all<TaskRow>();
  return {
    id: planRow.id,
    user_id: planRow.user_id,
    created_at: planRow.created_at,
    active: planRow.active === 1,
    tasks: results.map(rowToTask),
  };
}

const DEFAULT_TASKS: { text: string }[] = [
  { text: '早上8点：枸杞红枣茶' },
  { text: '中午12点：午休30分钟' },
  { text: '下午5点：散步30分钟' },
  { text: '晚上9点：足浴泡脚20分钟' },
  { text: '晚上10:30：准备睡眠' },
];

export async function createPlan(db: DB, userId: string): Promise<Plan> {
  const planId = crypto.randomUUID();
  const created_at = now();

  // Deactivate prior plans, then insert the new one + tasks in a batch.
  const stmts: D1PreparedStatement[] = [
    db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').bind(userId),
    db
      .prepare(
        'INSERT INTO plans (id, user_id, created_at, active) VALUES (?, ?, ?, 1)',
      )
      .bind(planId, userId, created_at),
  ];
  DEFAULT_TASKS.forEach((t, i) => {
    stmts.push(
      db
        .prepare(
          'INSERT INTO tasks (id, plan_id, text, sort_order, completed) VALUES (?, ?, ?, ?, 0)',
        )
        .bind(crypto.randomUUID(), planId, t.text, i),
    );
  });
  await db.batch(stmts);
  return (await activePlan(db, userId))!;
}

export async function completeTask(db: DB, taskId: string): Promise<Task | null> {
  const ts = now();
  await db
    .prepare('UPDATE tasks SET completed = 1, completed_at = ? WHERE id = ?')
    .bind(ts, taskId)
    .run();
  const row = await db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(taskId)
    .first<TaskRow>();
  return row ? rowToTask(row) : null;
}

// ─── Points ──────────────────────────────────────────────────

export async function addPoints(
  db: DB,
  userId: string,
  delta: number,
  reason: string,
  taskId?: string,
): Promise<{ points: number }> {
  await db.batch([
    db.prepare('UPDATE users SET points = points + ?, updated_at = ? WHERE id = ?')
      .bind(delta, now(), userId),
    db.prepare(
      'INSERT INTO points_ledger (id, user_id, delta, reason, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), userId, delta, reason, taskId ?? null, now()),
  ]);
  const r = await db
    .prepare('SELECT points FROM users WHERE id = ?')
    .bind(userId)
    .first<{ points: number }>();
  return { points: r?.points ?? 0 };
}

// ─── Catalog ─────────────────────────────────────────────────

export async function listProducts(db: DB, category?: string): Promise<Product[]> {
  const stmt =
    category && category !== 'all'
      ? db.prepare('SELECT * FROM products WHERE category = ? ORDER BY price_hkd ASC').bind(category)
      : db.prepare('SELECT * FROM products ORDER BY price_hkd ASC');
  const { results } = await stmt.all<Product>();
  return results;
}

export async function listClinics(db: DB): Promise<Clinic[]> {
  const { results } = await db
    .prepare('SELECT * FROM clinics ORDER BY rating DESC')
    .all<Omit<Clinic, 'specialties'> & { specialties: string }>();
  return results.map((r) => ({ ...r, specialties: parseJsonArray(r.specialties) }));
}
