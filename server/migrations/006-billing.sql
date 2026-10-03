-- 006: billing_payments for the Paystack Test Mode subscription demonstration
-- (PRD assessment exception; not operational payment processing).
-- Portable subset valid in both SQLite and PostgreSQL: no rowid, strftime,
-- OR IGNORE, or dialect-specific defaults. Timestamps are app-supplied
-- 'YYYY-MM-DD HH:MM' strings, like audit.date.
CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  verified_at TEXT,
  created_at TEXT NOT NULL
);
