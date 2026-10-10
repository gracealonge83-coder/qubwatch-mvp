// `npm run demo:seed` — explicit QubWatch demonstration-data setup (Stage 1).
//
// Server startup (`node server/index.js`, Netlify functions) applies schema
// migrations ONLY and never inserts demo records. This script is the single
// supported way to prepare a demonstration database.
//
// Target database (same resolution as the app, printed before anything runs):
// - DATABASE_URL is set (or NETLIFY_DB_URL on Netlify) -> that PostgreSQL.
// - otherwise -> SQLite at DB_PATH, defaulting to data/qubwatch.sqlite.
//
// Safety rules:
// - Requires QUBWATCH_SEED_DEMO=1 in the environment (explicit opt-in).
// - Refuses NODE_ENV=production unless --production-confirmed is passed.
// - Never deletes anything: seeds use INSERT OR IGNORE / ON CONFLICT DO
//   NOTHING, so reruns neither duplicate rows nor remove business activity.
// - The only UPDATEs touch the three documented demo accounts
//   (user-owner, user-manager, user-staff, SQLite path) to restore the
//   documented demo password. No other passwords are changed.
// - There is no destructive reset in this stage.
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate, getDb, query, withTransaction, closePool, PG_MODE } from '../server/db.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SEEDS_DIR = path.join(ROOT, 'server', 'seeds')
// SQLite needs the base seed plus the corrected demo password hashes;
// the PostgreSQL seed already contains the corrected hashes.
const SQLITE_SEEDS = ['002-seed.sql', '003-seed-passwords.sql']
const PG_SEEDS = ['005-pg-seeds.sql']

function usage() {
  console.log(`Usage: QUBWATCH_SEED_DEMO=1 npm run demo:seed [-- --production-confirmed]

Prepares a demonstration database (Caring Supermart demo business, demo
users, sample products/transactions, default monitoring rules).

  Target: DATABASE_URL (PostgreSQL) when set, else SQLite at DB_PATH
          (default data/qubwatch.sqlite). The resolved target is printed
          before anything runs.
  Safety: requires QUBWATCH_SEED_DEMO=1; refuses NODE_ENV=production
          without --production-confirmed; insert-only, safe to rerun.`)
}

function maskDatabaseUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname + (url.port ? `:${url.port}` : '')
    return `${url.protocol}//${host}${url.pathname}`
  } catch {
    return '(unparseable DATABASE_URL)'
  }
}

function describeTarget() {
  if (PG_MODE) {
    const raw = process.env.NETLIFY === 'true'
      ? (process.env.NETLIFY_DB_URL || process.env.DATABASE_URL)
      : process.env.DATABASE_URL
    return `PostgreSQL ${maskDatabaseUrl(raw)}`
  }
  const sqlitePath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'qubwatch.sqlite')
  return `SQLite ${sqlitePath}`
}

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.has('-h')) {
  usage()
  process.exit(0)
}
if (process.env.QUBWATCH_SEED_DEMO !== '1') {
  console.error('[demo:seed] Refusing to run: set QUBWATCH_SEED_DEMO=1 to confirm explicit demo seeding.')
  process.exit(2)
}
if (process.env.NODE_ENV === 'production' && !args.has('--production-confirmed')) {
  console.error('[demo:seed] Refusing to seed a production environment without --production-confirmed.')
  process.exit(2)
}

console.log(`[demo:seed] Target database: ${describeTarget()}`)

// Schema first (automatic migrations are schema-only since Stage 1).
const fresh = await migrate()
if (fresh.length > 0) console.log(`[demo:seed] Applied schema migrations: ${fresh.join(', ')}`)

const files = PG_MODE ? PG_SEEDS : SQLITE_SEEDS
for (const file of files) {
  const full = path.join(SEEDS_DIR, file)
  if (!fs.existsSync(full)) throw new Error(`[demo:seed] seed file missing: ${full}`)
}

if (PG_MODE) {
  await withTransaction(async (t) => {
    for (const file of files) {
      await t.query(fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8'))
    }
  })
} else {
  const db = getDb()
  const run = db.transaction(() => {
    for (const file of files) {
      db.exec(fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8'))
    }
  })
  run()
}

// Read-only verification summary.
let counts
if (PG_MODE) {
  const { rows } = await query(
    `SELECT (SELECT COUNT(*) FROM businesses) AS businesses,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM transactions) AS transactions,
            (SELECT COUNT(*) FROM business_rule_config) AS business_rule_config`,
  )
  counts = rows[0]
  await closePool()
} else {
  counts = getDb().prepare(
    `SELECT (SELECT COUNT(*) FROM businesses) AS businesses,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM transactions) AS transactions,
            (SELECT COUNT(*) FROM business_rule_config) AS business_rule_config`,
  ).get()
  getDb().close()
}
console.log(
  `[demo:seed] Done. businesses=${counts.businesses} users=${counts.users} `
  + `products=${counts.products} transactions=${counts.transactions} business_rule_config=${counts.business_rule_config}. `
  + 'Reruns are safe: existing rows are kept, nothing is deleted.',
)
