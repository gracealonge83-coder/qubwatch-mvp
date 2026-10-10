-- 009: per-business monitoring rules (Stage 2).
-- Portable subset valid in both SQLite and PostgreSQL (like 006-008):
-- CREATE TABLE IF NOT EXISTS, TEXT/INTEGER/NUMERIC columns, inline
-- REFERENCES, CHECK constraints with literal DEFAULTs, INSERT..SELECT..WHERE
-- NOT EXISTS, DROP TABLE IF EXISTS.
-- Replaces the global rule_config(id = 1) singleton with one row per
-- business (business_id PRIMARY KEY REFERENCES businesses(id)). Existing
-- customized thresholds are copied to every existing business, never
-- discarded. Reruns insert nothing new and never overwrite customized
-- values; each migration file runs inside a transaction.
CREATE TABLE IF NOT EXISTS business_rule_config (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id),
  large_amount NUMERIC NOT NULL CHECK (large_amount > 0) DEFAULT 500000,
  refund_count INTEGER NOT NULL CHECK (refund_count >= 1) DEFAULT 3,
  refund_window_minutes INTEGER NOT NULL CHECK (refund_window_minutes >= 1) DEFAULT 120,
  discount_pct NUMERIC NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100) DEFAULT 20,
  freq_count INTEGER NOT NULL CHECK (freq_count >= 1) DEFAULT 5,
  freq_window_minutes INTEGER NOT NULL CHECK (freq_window_minutes >= 1) DEFAULT 60
);
INSERT INTO business_rule_config
  (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes)
  SELECT b.id, r.large_amount, r.refund_count, r.refund_window_minutes, r.discount_pct, r.freq_count, r.freq_window_minutes
  FROM businesses b, rule_config r
  WHERE NOT EXISTS (SELECT 1 FROM business_rule_config e WHERE e.business_id = b.id);
DROP TABLE IF EXISTS rule_config;
