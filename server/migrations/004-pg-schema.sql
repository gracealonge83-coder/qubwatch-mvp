-- 004: PostgreSQL schema for QubWatch (mirrors 001-schema.sql).
-- Same tables, relationships, seed-compatible IDs, and CHECK constraints.
-- PostgreSQL adaptations: TIMESTAMPTZ timestamps, NUMERIC money values,
-- JSONB investigation payloads, created_at ordering columns (replacing
-- SQLite rowid ordering), ON CONFLICT-friendly primary keys.
-- SQLite migrations 001-003 are skipped when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Business Owner', 'Authorized Manager', 'Staff User', 'Administrator')),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  expected_stock INTEGER NOT NULL CHECK (expected_stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'discount')),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount NUMERIC(12, 2) NOT NULL,
  staff_id TEXT NOT NULL REFERENCES users(id),
  discount NUMERIC NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff_id);

CREATE TABLE IF NOT EXISTS alert_statuses (
  alert_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('New', 'Under Review', 'Investigating', 'Resolved', 'Dismissed')),
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT '',
  alert_severity TEXT NOT NULL DEFAULT '',
  investigator_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('Open', 'Under Investigation', 'Resolved', 'Closed')),
  related_transaction_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  finding TEXT NOT NULL DEFAULT '',
  finding_other TEXT NOT NULL DEFAULT '',
  resolution_notes TEXT NOT NULL DEFAULT '',
  resolved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_investigations_alert ON investigations(alert_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);

-- investigation_id stays nullable with no foreign key by design: deleting an
-- investigation removes its scoped audit rows without ever being blocked.
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  investigation_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_investigation ON audit(investigation_id);

CREATE TABLE IF NOT EXISTS rule_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  large_amount NUMERIC NOT NULL CHECK (large_amount > 0),
  refund_count INTEGER NOT NULL CHECK (refund_count >= 1),
  refund_window_minutes INTEGER NOT NULL CHECK (refund_window_minutes >= 1),
  discount_pct NUMERIC NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
  freq_count INTEGER NOT NULL CHECK (freq_count >= 1),
  freq_window_minutes INTEGER NOT NULL CHECK (freq_window_minutes >= 1)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
