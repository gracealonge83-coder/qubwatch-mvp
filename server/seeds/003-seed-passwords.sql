-- 003: Correct seed password hashes (Stage 4).
-- The 002 seed hashes were generated with the salt handled inconsistently
-- with the verifier convention, so password verification could never succeed.
-- This data-only migration replaces the three credential values with hashes
-- generated under the documented convention (scrypt N=16384, r=8, p=1 over
-- the raw salt bytes) for the documented demo password. No IDs, roles, or
-- other seed data change. No schema change.
UPDATE users SET password_hash = 'scrypt$16384$8$1$c79ea439e0fa199a3e855ea21f90981c$40b5be1577718b2c74e308adf60422a2571a71ec314c1976c41bde0e65df5fec836db8c4beeaf6e980b85b4d363c8ed1de93385c2fa1958db9ea7f874f3345c0' WHERE id = 'user-owner';
UPDATE users SET password_hash = 'scrypt$16384$8$1$b4752ddfb670e2f4b609dacda0301050$a0bbce120206fe553c6c41241074263403a6ea2a6405344a887efe9c6cf9ee653662e6942c03f23bc66c83d69dcfa14053ee8a76f8234bd146d4a026b597e25c' WHERE id = 'user-manager';
UPDATE users SET password_hash = 'scrypt$16384$8$1$6b8221657332f69129b21e559ac75b4c$1e2dabf7b4437a583e9d6c7f39b8b25add7c976c180f4ca461ed37e4200e270002c37ff3aab71cecfb37cb81f61dd5223fdf8a4392aa1b1cad6bf889bd67f876' WHERE id = 'user-staff';
