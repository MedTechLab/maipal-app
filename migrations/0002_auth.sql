-- OAuth authentication migration.
--
-- The pre-auth app keyed users by a client-generated device UUID. With OAuth,
-- the identity is `(auth_provider, auth_subject)` from the verified ID token.
-- Per the migration plan: existing device-ID rows are abandoned (deleted along
-- with their cascade-linked chat/plan/report/points rows). Going forward the
-- `users.id` is a server-generated UUID that maps 1:1 to a provider identity.

DELETE FROM points_ledger;
DELETE FROM tasks;
DELETE FROM plans;
DELETE FROM health_reports;
DELETE FROM chat_messages;
DELETE FROM users;

-- SQLite can't ALTER COLUMN, so we recreate the table to add the OAuth columns
-- and relax name/gender/age to nullable (they're filled in by /userinfo right
-- after sign-in, but the row is created at sign-in time before the user has
-- entered them).
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  auth_provider TEXT,
  auth_subject TEXT,
  email TEXT,
  name TEXT,
  gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female')),
  age INTEGER,
  height INTEGER,
  weight INTEGER,
  concerns TEXT NOT NULL DEFAULT '[]',
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_auth ON users(auth_provider, auth_subject)
  WHERE auth_provider IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
