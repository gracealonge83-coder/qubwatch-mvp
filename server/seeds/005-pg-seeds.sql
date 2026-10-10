-- 005: PostgreSQL seed data (mirrors 002-seed.sql + 003-seed-passwords.sql).
-- Same business, users (with corrected scrypt password hashes), products,
-- transactions, and rule defaults. ON CONFLICT DO NOTHING keeps reseeds safe.
-- Plaintext passwords are never stored.

INSERT INTO businesses (id, name, type, location, owner, contact, hours) VALUES
  ('biz-001', 'Caring Supermart', 'Supermarket', 'Lagos, Nigeria', 'Adaeze Okafor', '0803 000 1234', '8:00 AM - 9:00 PM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, role, business_id, password_hash) VALUES
  ('user-owner', 'Adaeze Okafor', 'Business Owner', 'biz-001', 'scrypt$16384$8$1$c79ea439e0fa199a3e855ea21f90981c$40b5be1577718b2c74e308adf60422a2571a71ec314c1976c41bde0e65df5fec836db8c4beeaf6e980b85b4d363c8ed1de93385c2fa1958db9ea7f874f3345c0'),
  ('user-manager', 'Tunde Bello', 'Authorized Manager', 'biz-001', 'scrypt$16384$8$1$b4752ddfb670e2f4b609dacda0301050$a0bbce120206fe553c6c41241074263403a6ea2a6405344a887efe9c6cf9ee653662e6942c03f23bc66c83d69dcfa14053ee8a76f8234bd146d4a026b597e25c'),
  ('user-staff', 'Chiamaka Eze', 'Staff User', 'biz-001', 'scrypt$16384$8$1$6b8221657332f69129b21e559ac75b4c$1e2dabf7b4437a583e9d6c7f39b8b25add7c976c180f4ca461ed37e4200e270002c37ff3aab71cecfb37cb81f61dd5223fdf8a4392aa1b1cad6bf889bd67f876')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category, price, stock, expected_stock, business_id) VALUES
  ('prod-rice', 'Rice', 'Grains', 85000, 42, 42, 'biz-001'),
  ('prod-oil', 'Cooking Oil', 'Grocery', 12000, 60, 60, 'biz-001'),
  ('prod-milk', 'Milk', 'Dairy', 3500, 80, 80, 'biz-001'),
  ('prod-bread', 'Bread', 'Bakery', 1500, 50, 48, 'biz-001'),
  ('prod-sugar', 'Sugar', 'Grocery', 5000, 70, 70, 'biz-001'),
  ('prod-detergent', 'Detergent', 'Household', 6500, 55, 55, 'biz-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES
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
  ('txn-012', '2026-09-19 12:05', 'sale', 'prod-milk', 6, 21000, 'user-staff', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_rule_config (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes) VALUES
  ('biz-001', 500000, 3, 120, 20, 5, 60)
ON CONFLICT (business_id) DO NOTHING;
