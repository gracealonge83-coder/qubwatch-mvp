-- 002: QubWatch demo seed data (Stage 3).
-- Source of truth: src/data/mockData.js plus the approved rule defaults.
-- All inserts are OR IGNORE so reopening the database never duplicates rows.
-- User password hashes are scrypt (N=16384, r=8, p=1) of the documented
-- demo password. Plaintext passwords are never stored.

INSERT OR IGNORE INTO businesses (id, name, type, location, owner, contact, hours) VALUES
  ('biz-001', 'Caring Supermart', 'Supermarket', 'Lagos, Nigeria', 'Adaeze Okafor', '0803 000 1234', '8:00 AM - 9:00 PM');

INSERT OR IGNORE INTO users (id, name, role, business_id, password_hash) VALUES
  ('user-owner', 'Adaeze Okafor', 'Business Owner', 'biz-001', 'scrypt$16384$8$1$0465bac9a48730a493e5c953d6ca1b6f$64cc006b64acce5241b83517b01484a6a4b545dc5cbd1736e7917218af4d9c059cb9fc22dc189aad0d4f8772de3b8ccae75541729453c1ff504c0c0c3113e3fb'),
  ('user-manager', 'Tunde Bello', 'Authorized Manager', 'biz-001', 'scrypt$16384$8$1$de0a6e058e274ee16b9b1c1cfa09a35f$d68748be35af3b8ec9f13082ef251f31315f50996a835463bdcd00a9fda0485a8fe33e07c32a2925778392ff6b2e01d5a6ee3f66d5378503fe616c78916aeea1'),
  ('user-staff', 'Chiamaka Eze', 'Staff User', 'biz-001', 'scrypt$16384$8$1$e90b7ea77f96a6c07adda3e3b61f5a7f$e887880faa6d8c1aad8f0045d0a0d46bd62c9c4c36bd41ad5d59db57f7a304de136b4d78b61919c559296924eb94b0a9abe99277c60b7647f7d94544a4274215');

INSERT OR IGNORE INTO products (id, name, category, price, stock, expected_stock, business_id) VALUES
  ('prod-rice', 'Rice', 'Grains', 85000, 42, 42, 'biz-001'),
  ('prod-oil', 'Cooking Oil', 'Grocery', 12000, 60, 60, 'biz-001'),
  ('prod-milk', 'Milk', 'Dairy', 3500, 80, 80, 'biz-001'),
  ('prod-bread', 'Bread', 'Bakery', 1500, 50, 48, 'biz-001'),
  ('prod-sugar', 'Sugar', 'Grocery', 5000, 70, 70, 'biz-001'),
  ('prod-detergent', 'Detergent', 'Household', 6500, 55, 55, 'biz-001');

INSERT OR IGNORE INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES
  ('txn-001', '2026-09-18 09:12', 'sale', 'prod-bread', 2, 3000, 'user-staff', 0),
  ('txn-002', '2026-09-18 10:05', 'sale', 'prod-milk', 4, 14000, 'user-staff', 0),
  ('txn-003', '2026-09-18 11:20', 'sale', 'prod-rice', 1, 85000, 'user-manager', 0),
  ('txn-004', '2026-09-18 12:15', 'discount', 'prod-oil', 2, 21600, 'user-staff', 10),
  ('txn-005', '2026-09-18 13:40', 'sale', 'prod-sugar', 3, 15000, 'user-staff', 0),
  ('txn-006', '2026-09-18 14:02', 'refund', 'prod-milk', 1, 3500, 'user-manager', 0),
  ('txn-007', '2026-09-18 14:20', 'refund', 'prod-bread', 2, 3000, 'user-manager', 0),
  ('txn-008', '2026-09-19 09:30', 'sale', 'prod-detergent', 5, 32500, 'user-staff', 0),
  ('txn-009', '2026-09-19 10:12', 'sale', 'prod-rice', 7, 595000, 'user-staff', 0),
  ('txn-010', '2026-09-19 11:00', 'sale', 'prod-oil', 1, 12000, 'user-staff', 0),
  ('txn-011', '2026-09-19 11:25', 'discount', 'prod-sugar', 4, 16000, 'user-manager', 20),
  ('txn-012', '2026-09-19 12:05', 'sale', 'prod-milk', 6, 21000, 'user-staff', 0);

INSERT OR IGNORE INTO business_rule_config (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes) VALUES
  ('biz-001', 500000, 3, 120, 20, 5, 60);
