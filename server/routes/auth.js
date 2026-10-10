import { Router } from 'express'
import { getDb, query, withTransaction, isUniqueViolation, PG_MODE } from '../db.js'
import { registerLimiter } from '../rateLimit.js'
import {
  verifyPassword,
  safeUser,
  findUserByIdentifier,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
  requireAuth,
  SESSION_COOKIE,
} from '../auth.js'
import { requiredText, badRequest, collect } from '../validate.js'
import { newId } from '../ids.js'
import { hashPassword } from './users.js'
import { DEMO_THRESHOLDS } from '../../shared/rules.js'

// Stage 4 auth endpoints. Safe user objects only: password hashes and
// raw session tokens never appear in JSON responses.
const router = Router()

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {}
  if (typeof identifier !== 'string' || identifier === '' || typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'Identifier and password are required' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const user = await findUserByIdentifier(db, identifier)
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid login credentials' })
    return
  }
  const token = await createSession(db, user.id)
  setSessionCookie(res, token)
  res.json({ user: safeUser(user) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// Public customer registration (Stage 3). Creates a new business and its
// Business Owner account atomically, plus the business's default monitoring
// rules. No demo records are created. The role is always Business Owner:
// any client-supplied role is ignored, and this route never touches an
// existing business, so it cannot escalate managers or staff. New owners
// are signed in immediately using the standard session mechanism.
router.post('/register', registerLimiter, async (req, res) => {
  const body = req.body || {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors = collect({
    name: requiredText(name),
    businessName: requiredText(businessName),
    password: password === ''
      ? 'Required.'
      : (password.length < 8 ? 'Use at least 8 characters.' : null),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  // Login identifiers are global (users are found by name or id), so a new
  // name must be unused by any existing account in any business.
  const existing = PG_MODE
    ? (await query('SELECT id FROM users WHERE name = $1', [name])).rows[0]
    : db.prepare('SELECT id FROM users WHERE name = ?').get(name)
  if (existing) {
    res.status(409).json({ error: 'That user name is already taken.' })
    return
  }
  const businessId = newId('biz')
  const userId = newId('user')
  const passwordHash = hashPassword(password)
  const d = DEMO_THRESHOLDS
  const ruleValues = [
    d.LARGE_TRANSACTION_AMOUNT,
    d.REPEATED_REFUNDS_COUNT,
    d.REPEATED_REFUNDS_WINDOW_MINUTES,
    d.EXCESSIVE_DISCOUNT_PCT,
    d.FREQUENCY_COUNT,
    d.FREQUENCY_WINDOW_MINUTES,
  ]
  // Atomic business + owner + rules creation: any failure rolls everything
  // back, so failed registration cannot leave orphaned records. A concurrent
  // duplicate name surfaces here as a unique violation and becomes a 409.
  try {
    if (PG_MODE) {
      await withTransaction(async (t) => {
        await t.query('INSERT INTO businesses (id, name, owner) VALUES ($1, $2, $3)', [businessId, businessName, name])
        await t.query(
          "INSERT INTO users (id, name, role, business_id, password_hash) VALUES ($1, $2, 'Business Owner', $3, $4)",
          [userId, name, businessId, passwordHash],
        )
        await t.query(
          `INSERT INTO business_rule_config
            (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [businessId, ...ruleValues],
        )
      })
    } else {
      const create = db.transaction(() => {
        db.prepare('INSERT INTO businesses (id, name, owner) VALUES (?, ?, ?)').run(businessId, businessName, name)
        db.prepare(
          "INSERT INTO users (id, name, role, business_id, password_hash) VALUES (?, ?, 'Business Owner', ?, ?)",
        ).run(userId, name, businessId, passwordHash)
        db.prepare(
          `INSERT INTO business_rule_config
            (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(businessId, ...ruleValues)
      })
      create()
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'That user name is already taken.' })
      return
    }
    throw err
  }
  const token = await createSession(db, userId)
  setSessionCookie(res, token)
  res.status(201).json({ user: { id: userId, name, role: 'Business Owner', businessId } })
})

router.post('/logout', async (req, res) => {
  const cookies = parseCookies(req)
  await destroySession(PG_MODE ? null : getDb(), cookies[SESSION_COOKIE])
  clearSessionCookie(res)
  res.json({ ok: true })
})

// LOCAL DEMO ONLY: passwordless demo session for the seeded Business Owner.
// Active only when QUBWATCH_DEMO_LOGIN=1 is set in the backend environment
// (local assessment runs; never production). Without the flag this route
// behaves as if absent. Uses the existing session + HttpOnly cookie
// mechanism; no credential is accepted or returned here.
router.post('/demo', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.QUBWATCH_DEMO_LOGIN !== '1') {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const user = await findUserByIdentifier(db, 'user-owner')
  if (!user) {
    res.status(404).json({ error: 'Demo user not available' })
    return
  }
  const token = await createSession(db, user.id)
  setSessionCookie(res, token)
  res.json({ user: safeUser(user) })
})

export default router
