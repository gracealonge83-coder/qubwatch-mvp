import crypto from 'node:crypto'
import { newId } from './ids.js'
import { getDb, query, PG_MODE } from './db.js'

// Stage 4 authentication + session foundation (PRD full-stack scope).
// Passwords: scrypt hashes only (format "scrypt$N$r$p$saltHex$keyHex").
// Sessions: random tokens in an HttpOnly cookie; only SHA-256 hashes in the database.
// No JWT, no localStorage tokens, no MFA/SSO/recovery.

export const SESSION_COOKIE = 'qubwatch_session'
export const SESSION_TTL_HOURS = 12

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function nowStamp() {
  return formatStamp(new Date())
}

function expiryStamp() {
  return formatStamp(new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000))
}

function parseHash(stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null
  return { N, r, p, salt: parts[4], key: parts[5] }
}

export function verifyPassword(password, storedHash) {
  const parsed = parseHash(storedHash)
  if (!parsed) return false
  let derived
  try {
    derived = crypto.scryptSync(String(password || ''), Buffer.from(parsed.salt, 'hex'), 64, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    })
  } catch {
    return false
  }
  const expected = Buffer.from(parsed.key, 'hex')
  if (derived.length !== expected.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

export function safeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    businessId: row.business_id,
  }
}

export function findUserByIdentifier(db, identifier) {
  const byId = db.prepare('SELECT * FROM users WHERE id = ?').get(identifier)
  if (byId) return byId
  return db.prepare('SELECT * FROM users WHERE name = ?').get(identifier) || null
}

export function createSession(db, userId) {
  purgeExpired(db)
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  ).run(newId('sess'), userId, hashToken(token), expiryStamp())
  return token
}

export function getSessionUser(db, token) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT sessions.expires_at AS expires_at, users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(hashToken(token))
  if (!row) return null
  if (row.expires_at <= nowStamp()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
    return null
  }
  return safeUser(row)
}

export function destroySession(db, token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function purgeExpired(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowStamp())
}

function cookieAttributes(maxAge) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : ''
  return `Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; ${cookieAttributes(SESSION_TTL_HOURS * 60 * 60)}`,
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(0)}`)
}

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const name = part.slice(0, index).trim()
    if (name) out[name] = part.slice(index + 1).trim()
  }
  return out
}

export function getSessionUserPg(token) {
  if (!token) return null
  return query(
    `SELECT sessions.expires_at AS expires_at, users.* FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1`,
    [hashToken(token)],
  ).then(({ rows }) => {
    const row = rows[0]
    if (!row) return null
    if (row.expires_at <= new Date()) {
      return query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]).then(() => null)
    }
    return safeUser(row)
  })
}

export function attachUser() {
  return async (req, res, next) => {
    const cookies = parseCookies(req)
    const token = cookies[SESSION_COOKIE]
    if (PG_MODE) {
      req.user = (await getSessionUserPg(token)) || null
    } else {
      req.user = getSessionUser(getDb(), token) || null
    }
    next()
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
