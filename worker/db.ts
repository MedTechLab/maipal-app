import type {
  AuthProvider,
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
  auth_provider: AuthProvider | null;
  auth_subject: string | null;
  email: string | null;
  name: string | null;
  gender: 'male' | 'female' | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  concerns: string;
  points: number;
  created_at: number;
  updated_at: number;
}

const rowToUser = (r: UserRow): User => ({
  id: r.id,
  auth_provider: r.auth_provider,
  email: r.email,
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

/** Find or create the user row for a verified OAuth identity. */
export async function upsertAuthUser(
  db: DB,
  identity: {
    provider: AuthProvider;
    subject: string;
    email: string | null;
    name: string | null;
  },
): Promise<User> {
  const existing = await db
    .prepare(
      'SELECT * FROM users WHERE auth_provider = ? AND auth_subject = ?',
    )
    .bind(identity.provider, identity.subject)
    .first<UserRow>();
  if (existing) {
    // Refresh email/name if the provider gave us better data this time.
    const ts = now();
    await db
      .prepare(
        `UPDATE users SET
           email = COALESCE(?, email),
           name = COALESCE(name, ?),
           updated_at = ?
         WHERE id = ?`,
      )
      .bind(identity.email, identity.name, ts, existing.id)
      .run();
    return (await getUserById(db, existing.id))!;
  }
  const id = crypto.randomUUID();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO users (id, auth_provider, auth_subject, email, name, concerns, points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?)`,
    )
    .bind(id, identity.provider, identity.subject, identity.email, identity.name, ts, ts)
    .run();
  return (await getUserById(db, id))!;
}

/** Fill in the profile fields from /userinfo. */
export async function updateUserProfile(
  db: DB,
  id: string,
  p: {
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
      `UPDATE users SET
         name = ?,
         gender = ?,
         age = ?,
         height = ?,
         weight = ?,
         concerns = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      p.name,
      p.gender,
      p.age,
      p.height ?? null,
      p.weight ?? null,
      JSON.stringify(p.concerns ?? []),
      ts,
      id,
    )
    .run();
  return (await getUserById(db, id))!;
}

export async function getUserById(db: DB, id: string): Promise<User | null> {
  const r = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return r ? rowToUser(r) : null;
}

// Backwards-compatible alias for older callers.
export const getUser = getUserById;

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

/** Wipe the user's chat history (used by "start a new consultation"). */
export async function clearMessages(db: DB, userId: string): Promise<void> {
  await db.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(userId).run();
}

// ─── Reports ─────────────────────────────────────────────────

interface ReportRow {
  id: string;
  user_id: string;
  date: string;
  face_analysis: string | null;
  voice_analysis: string | null;
  suggestions: string;
  report_json: string | null;
  created_at: number;
}

const rowToReport = (r: ReportRow): HealthReport => ({
  id: r.id,
  user_id: r.user_id,
  date: r.date,
  face_analysis: r.face_analysis,
  voice_analysis: r.voice_analysis,
  suggestions: parseJsonArray(r.suggestions),
  report_json: r.report_json,
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
  body: {
    date: string;
    face_analysis: string;
    voice_analysis: string;
    suggestions: string[];
    report_json?: string;
  },
): Promise<HealthReport> {
  const id = crypto.randomUUID();
  const created_at = now();
  const report_json = body.report_json ?? null;
  await db
    .prepare(
      `INSERT INTO health_reports (id, user_id, date, face_analysis, voice_analysis, suggestions, report_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      body.date,
      body.face_analysis,
      body.voice_analysis,
      JSON.stringify(body.suggestions),
      report_json,
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
    report_json,
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

export async function createPlan(
  db: DB,
  userId: string,
  tasks?: { text: string }[],
): Promise<Plan> {
  const planId = crypto.randomUUID();
  const created_at = now();

  // Use report-derived tasks when supplied (clamped); otherwise the default set.
  const cleaned = (tasks ?? [])
    .map((t) => ({ text: String(t.text ?? '').trim() }))
    .filter((t) => t.text.length > 0)
    .slice(0, 8);
  const planTasks = cleaned.length > 0 ? cleaned : DEFAULT_TASKS;

  // Deactivate prior plans, then insert the new one + tasks in a batch.
  const stmts: D1PreparedStatement[] = [
    db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').bind(userId),
    db
      .prepare(
        'INSERT INTO plans (id, user_id, created_at, active) VALUES (?, ?, ?, 1)',
      )
      .bind(planId, userId, created_at),
  ];
  planTasks.forEach((t, i) => {
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
