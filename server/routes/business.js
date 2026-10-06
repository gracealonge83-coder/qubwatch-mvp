import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { requiredText, badRequest } from '../validate.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

function mapBusiness(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    owner: row.owner,
    contact: row.contact,
    hours: row.hours,
  }
}

const router = Router()
router.use(requireAuth)

router.get('/business', async (req, res) => {
  const row = PG_MODE
    ? (await query('SELECT * FROM businesses WHERE id = $1', [req.user.businessId])).rows[0]
    : getDb().prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId)
  if (!row) {
    res.status(404).json({ error: 'Business not found' })
    return
  }
  res.json(mapBusiness(row))
})

router.patch('/business', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const allowed = ['name', 'type', 'location', 'owner', 'contact', 'hours']
  const updates = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  const errors = {}
  if ('name' in updates && requiredText(updates.name)) errors.name = requiredText(updates.name)
  for (const key of ['type', 'location', 'owner', 'contact', 'hours']) {
    if (key in updates && typeof updates[key] !== 'string') errors[key] = 'Must be text.'
  }
  if (Object.keys(errors).length > 0) {
    badRequest(res, errors)
    return
  }
  if (Object.keys(updates).length === 0) {
    badRequest(res, { _body: 'No business fields provided.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const current = PG_MODE
    ? (await query('SELECT * FROM businesses WHERE id = $1', [req.user.businessId])).rows[0]
    : db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId)
  if (!current) {
    res.status(404).json({ error: 'Business not found' })
    return
  }
  const merged = { ...mapBusiness(current), ...updates }
  if (PG_MODE) {
    const { rows } = await query(
      'UPDATE businesses SET name = $1, type = $2, location = $3, owner = $4, contact = $5, hours = $6 WHERE id = $7 RETURNING *',
      [merged.name, merged.type, merged.location, merged.owner, merged.contact, merged.hours, current.id],
    )
    res.json(mapBusiness(rows[0]))
    return
  }
  db.prepare(
    'UPDATE businesses SET name = ?, type = ?, location = ?, owner = ?, contact = ?, hours = ? WHERE id = ?',
  ).run(merged.name, merged.type, merged.location, merged.owner, merged.contact, merged.hours, current.id)
  res.json(mapBusiness(db.prepare('SELECT * FROM businesses WHERE id = ?').get(current.id)))
})

export default router
