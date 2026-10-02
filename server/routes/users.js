import crypto from 'node:crypto'
import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { ROLES, requiredText, inList, badRequest, collect } from '../validate.js'
import { newId } from '../ids.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

function mapUser(row) {
  if (!row) return null
  return { id: row.id, name: row.name, role: row.role, businessId: row.business_id }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 64, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString('hex')
  return `scrypt$16384$8$1$${salt}$${key}`
}

const router = Router()
router.use(requireAuth)

router.get('/users', async (req, res) => {
  const rows = PG_MODE
    ? (await query('SELECT * FROM users ORDER BY created_at, id')).rows
    : getDb().prepare('SELECT * FROM users ORDER BY rowid').all()
  res.json(rows.map(mapUser))
})

router.post('/users', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const errors = collect({
    name: requiredText(body.name),
    role: inList(body.role, ROLES),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const business = PG_MODE
    ? (await query('SELECT id FROM businesses LIMIT 1')).rows[0]
    : db.prepare('SELECT id FROM businesses LIMIT 1').get()
  if (!business) {
    res.status(500).json({ error: 'No business is set up yet' })
    return
  }
  // Temporary credential: generated here, hashed immediately, returned once
  // in this response only. Never stored, logged, or audited as plaintext.
  const temporaryPassword = crypto.randomBytes(12).toString('base64url')
  const id = newId('user')
  if (PG_MODE) {
    const { rows } = await query(
      'INSERT INTO users (id, name, role, business_id, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, body.name.trim(), body.role, business.id, hashPassword(temporaryPassword)],
    )
    res.status(201).json({ user: mapUser(rows[0]), temporaryPassword })
    return
  }
  db.prepare(
    'INSERT INTO users (id, name, role, business_id, password_hash) VALUES (?, ?, ?, ?, ?)',
  ).run(id, body.name.trim(), body.role, business.id, hashPassword(temporaryPassword))
  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  res.status(201).json({ user: mapUser(created), temporaryPassword })
})

router.patch('/users/:id', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const updates = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.role !== undefined) updates.role = body.role
  const errors = collect({
    ...( 'name' in updates ? { name: requiredText(updates.name) } : {}),
    ...('role' in updates ? { role: inList(updates.role, ROLES) } : {}),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  if (Object.keys(updates).length === 0) {
    badRequest(res, { _body: 'Provide a name and/or role to update.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const current = PG_MODE
    ? (await query('SELECT * FROM users WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!current) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  const merged = { ...mapUser(current), ...updates }
  if (merged.name) merged.name = merged.name.trim()
  if (PG_MODE) {
    const { rows } = await query('UPDATE users SET name = $1, role = $2 WHERE id = $3 RETURNING *', [
      merged.name,
      merged.role,
      current.id,
    ])
    res.json(mapUser(rows[0]))
    return
  }
  db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(
    merged.name,
    merged.role,
    current.id,
  )
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(current.id)))
})

export default router
