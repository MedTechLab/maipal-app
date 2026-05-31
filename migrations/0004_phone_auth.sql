-- Phone + password authentication: add phone and password_hash columns.

ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
