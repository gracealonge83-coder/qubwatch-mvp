-- 010: enforce globally unique login names (Stage 4).
-- Login resolves users by exact name or id across all businesses, so two
-- accounts sharing a name would make sign-in ambiguous and let a concurrent
-- registration slip past the application-level duplicate check.
-- Portable subset valid in both SQLite and PostgreSQL. Reruns are no-ops.
-- If this fails on an existing database, a duplicate name must be renamed
-- manually first; this migration never deletes or renames users by itself.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique ON users(name);
