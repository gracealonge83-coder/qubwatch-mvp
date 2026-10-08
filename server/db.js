import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import pg from 'pg'
import tls from 'node:tls'

// Dual-driver database layer (PG foundation stage).
//
// - SQLite mode (default locally): legacy better-sqlite3 file DB at DB_PATH
//   or data/qubwatch.sqlite. Existing routes keep using getDb().
// - PostgreSQL mode: DATABASE_URL locally, or NETLIFY_DB_URL on Netlify.
//   SQLite migrations 001-003 are skipped; PostgreSQL migrations 004+ run.
const IS_NETLIFY = process.env.NETLIFY === 'true'
const DATABASE_URL = IS_NETLIFY
  ? process.env.NETLIFY_DB_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL

if (IS_NETLIFY && !DATABASE_URL) {
  throw new Error('Netlify requires NETLIFY_DB_URL or DATABASE_URL; refusing to use ephemeral SQLite storage')
}

export const PG_MODE = Boolean(DATABASE_URL)

const SQLITE_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'qubwatch.sqlite')
const MIGRATIONS_DIR = path.join(process.cwd(), 'server', 'migrations')
// SQLite 001-003 predate PostgreSQL support and contain SQLite-only dialect.
// Migration 006 uses a portable subset and applies in both modes.
const LEGACY_SQLITE_MIGRATION = /^(001|002|003)-/
const SHARED_MIGRATION = /^006-|^007-|^008-/
const MIGRATION_LOCK_ID = '718462993401'

let sqliteDb = null
let pool = null

function postgresConnectionString() {
  const connectionString = DATABASE_URL
  if (process.env.NODE_ENV !== 'production') return connectionString

  const url = new URL(connectionString)
  const sslOptions = new Set([
    'ssl',
    'sslmode',
    'sslcert',
    'sslkey',
    'sslpassword',
    'sslrootcert',
    'sslcrl',
    'sslnegotiation',
    'uselibpqcompat',
  ])
  for (const key of [...url.searchParams.keys()]) {
    if (sslOptions.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  return url.toString()
}

function tlsRootCertificates() {
  return tls.rootCertificates
}

function postgresSslConfig() {
  const production = process.env.NODE_ENV === 'production'
  const enabled = production || process.env.PGSSL === '1'
  if (!enabled) return false

  const caFile = process.env.PGSSL_CA_FILE
  const ca = caFile ? fs.readFileSync(caFile, 'utf8') : undefined
  return {
    // Preserve verified TLS in production. When a provider CA is supplied,
    // append it to Node's normal trust store instead of replacing the default
    // public roots. This keeps Supabase's private CA trusted while preserving
    // compatibility with any public intermediates in the pooler's chain.
    rejectUnauthorized: production,
    ...(ca ? { ca: [ca, ...tlsRootCertificates()] } : {}),
  }
}

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
      connectionString: postgresConnectionString(),
      max: 10,
      // Pin session timezone so zoneless literals and now() behave
      // identically on every machine (API wire dates are UTC wall-clock).
      options: '-c TimeZone=UTC',
      ssl: postgresSslConfig(),
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
    .filter((f) => (PG_MODE
      ? !LEGACY_SQLITE_MIGRATION.test(f)
      : LEGACY_SQLITE_MIGRATION.test(f) || SHARED_MIGRATION.test(f)))
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

async function migratePostgresWithLock() {
  const client = await getPool().connect()
  let locked = false
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_ID])
    locked = true
    return await migratePostgres()
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_ID])
      }
    } finally {
      client.release()
    }
  }
}

export async function migrate() {
  if (PG_MODE) return migratePostgresWithLock()
  return migrateSqlite()
}
