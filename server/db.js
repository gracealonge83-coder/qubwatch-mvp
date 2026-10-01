import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import pg from 'pg'

// Dual-driver database layer (PG foundation stage).
//
// - SQLite mode (default, no DATABASE_URL): legacy better-sqlite3 file DB at
//   DB_PATH or data/qubwatch.sqlite. Existing routes keep using getDb().
// - PostgreSQL mode (DATABASE_URL set): pg.Pool. SQLite migrations 001-003
//   are skipped; PostgreSQL migrations 004+ are applied. Routes use query()
//   and withTransaction() once converted (later stage); getDb() refuses in
//   PG mode so a half-migrated route fails loudly instead of silently.
export const PG_MODE = !!process.env.DATABASE_URL

const SQLITE_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'qubwatch.sqlite')
const MIGRATIONS_DIR = path.join(process.cwd(), 'server', 'migrations')
// SQLite 001-003 predate PostgreSQL support and contain SQLite-only dialect.
const LEGACY_SQLITE_MIGRATION = /^(001|002|003)-/

let sqliteDb = null
let pool = null

export function getDb() {
  if (PG_MODE) {
    throw new Error('getDb() is SQLite-only; use query()/withTransaction() in PostgreSQL mode')
  }
  if (!sqliteDb) {
    fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true })
    sqliteDb = new Database(SQLITE_PATH)
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('foreign_keys = ON')
  }
  return sqliteDb
}

export function getPool() {
  if (!PG_MODE) {
    throw new Error('getPool() requires DATABASE_URL (PostgreSQL mode)')
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
    })
    pool.on('error', (err) => {
      console.error('[db] pg pool error:', err.message)
    })
  }
  return pool
}

export async function query(text, params) {
  return getPool().query(text, params)
}

// Runs fn inside a single PostgreSQL transaction. fn receives a minimal
// client surface ({ query }) bound to the transaction's connection.
export async function withTransaction(fn) {
  const client = await getPool().connect()
  const t = { query: (text, params) => client.query(text, params) }
  try {
    await client.query('BEGIN')
    const result = await fn(t)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Rollback failure must not mask the original error.
    }
    throw err
  } finally {
    client.release()
  }
}

export async function closePool() {
  if (pool) {
    const closing = pool
    pool = null
    await closing.end()
  }
}

function shutdown() {
  closePool()
    .catch(() => {})
    .finally(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => (PG_MODE ? !LEGACY_SQLITE_MIGRATION.test(f) : LEGACY_SQLITE_MIGRATION.test(f)))
}

function migrateSqlite() {
  const database = getDb()
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    );
  `)
  const applied = new Set(
    database.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version),
  )
  const insert = database.prepare('INSERT INTO schema_migrations (version) VALUES (?)')
  const fresh = []
  for (const file of migrationFiles()) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const run = database.transaction(() => {
      database.exec(sql)
      insert.run(file)
    })
    run()
    fresh.push(file)
  }
  return fresh
}

async function migratePostgres() {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
  const { rows } = await db.query('SELECT version FROM schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  const fresh = []
  for (const file of migrationFiles()) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Rollback failure must not mask the original error.
      }
      throw err
    } finally {
      client.release()
    }
    fresh.push(file)
  }
  return fresh
}

export async function migrate() {
  if (PG_MODE) return migratePostgres()
  return migrateSqlite()
}
