-- 007: product business ownership for multi-business isolation.
-- Portable subset valid in both SQLite and PostgreSQL.
-- Existing products are attributed to the current business; every business
-- in a migrated database is expected to be that single business.
ALTER TABLE products ADD COLUMN business_id TEXT NOT NULL DEFAULT '';
UPDATE products SET business_id = (SELECT id FROM businesses LIMIT 1) WHERE business_id = '';
