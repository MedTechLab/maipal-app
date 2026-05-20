-- MaiPal D1 schema — applied via `npm run db:apply:local` / `db:apply:remote`

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age INTEGER NOT NULL,
  height INTEGER,
  weight INTEGER,
  concerns TEXT NOT NULL DEFAULT '[]',
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_chat_user_created ON chat_messages(user_id, created_at);

CREATE TABLE health_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  face_analysis TEXT,
  voice_analysis TEXT,
  suggestions TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_reports_user_created ON health_reports(user_id, created_at);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
CREATE INDEX idx_tasks_plan ON tasks(plan_id, sort_order);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_hkd INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tea', 'soup', 'paste')),
  source TEXT NOT NULL,
  image_url TEXT
);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  specialties TEXT NOT NULL DEFAULT '[]',
  rating REAL,
  distance TEXT,
  image_url TEXT
);

CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_points_user_created ON points_ledger(user_id, created_at);
