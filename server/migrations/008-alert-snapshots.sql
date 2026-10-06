-- 008: immutable historical alert snapshots shared by SQLite and PostgreSQL.
CREATE TABLE IF NOT EXISTS alert_snapshots (
  alert_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  date TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  related_transaction_ids TEXT NOT NULL,
  related_product_ids TEXT NOT NULL,
  rule_values TEXT NOT NULL,
  evidence TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_snapshots_business_generated
  ON alert_snapshots(business_id, generated_at);
