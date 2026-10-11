-- 011: soft-archive columns for alerts and completed investigations.
-- Portable subset valid in both SQLite and PostgreSQL (like 006-010):
-- plain ALTER TABLE ADD COLUMN only (nullable, no backfill needed:
-- pre-existing rows read as unarchived). Timestamps are app-supplied
-- 'YYYY-MM-DD HH:MM' strings, like audit.date. Each migration file runs
-- once inside a transaction and is recorded, so reruns never occur.
-- Nothing is deleted: archiving only stamps archived_at/archived_by, and
-- restoring clears them. Audit history, transactions, snapshots and
-- investigation evidence are retained in every case.
ALTER TABLE alert_statuses ADD COLUMN archived_at TEXT;
ALTER TABLE alert_statuses ADD COLUMN archived_by TEXT REFERENCES users(id);
ALTER TABLE investigations ADD COLUMN archived_at TEXT;
ALTER TABLE investigations ADD COLUMN archived_by TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_alert_statuses_archived ON alert_statuses(archived_at);
CREATE INDEX IF NOT EXISTS idx_investigations_archived ON investigations(archived_at);
