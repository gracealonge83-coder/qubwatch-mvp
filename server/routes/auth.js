import { Router } from 'express'
import { getDb, PG_MODE } from '../db.js'
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
  if (process.env.QUBWATCH_DEMO_LOGIN !== '1') {
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
