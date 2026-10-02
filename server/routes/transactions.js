import { Router } from 'express'
import { getDb, query, withTransaction, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { TXN_TYPES, discountPct, badRequest, collect, nowStamp } from '../validate.js'
import { newId } from '../ids.js'
import { addAudit } from '../auditLog.js'
import { formatWireDate } from '../dates.js'

const RECORDERS = ['Business Owner', 'Authorized Manager', 'Staff User']

function mapTransaction(row) {
  if (!row) return null
  return {
    id: row.id,
    date: formatWireDate(row.date),
    type: row.type,
    productId: row.product_id,
    quantity: Number(row.quantity),
    amount: Number(row.amount),
    staffId: row.staff_id,
    discount: Number(row.discount),
  }
}

const router = Router()
router.use(requireAuth)

router.get('/transactions', async (req, res) => {
  const rows = PG_MODE
    ? (await query('SELECT * FROM transactions ORDER BY created_at, id')).rows
    : getDb().prepare('SELECT * FROM transactions ORDER BY rowid').all()
  res.json(rows.map(mapTransaction))
})

router.post('/transactions', requireRole(...RECORDERS), async (req, res) => {
  const body = req.body || {}
  const quantityOk = typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity > 0
    ? null
    : 'Must be a number above 0.'
  const errors = collect({
    productId: typeof body.productId === 'string' && body.productId !== '' ? null : 'Product is required.',
    type: TXN_TYPES.includes(body.type) ? null : 'Invalid transaction type.',
    quantity: quantityOk,
    discount: discountPct(body.discount),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const product = PG_MODE
    ? (await query('SELECT * FROM products WHERE id = $1', [body.productId])).rows[0]
    : db.prepare('SELECT * FROM products WHERE id = ?').get(body.productId)
  if (!product) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  const staffId = body.staffId || req.user.id
  const staff = PG_MODE
    ? (await query('SELECT id FROM users WHERE id = $1', [staffId])).rows[0]
    : db.prepare('SELECT id FROM users WHERE id = ?').get(staffId)
  if (!staff) {
    badRequest(res, { staffId: 'Unknown staff user.' })
    return
  }
  // Amount is always recomputed server-side; client previews are not trusted.
  const amount = Math.round(Number(product.price) * body.quantity * (1 - (body.discount || 0) / 100))
  const id = newId('txn')
  const date = nowStamp()
  if (PG_MODE) {
    let created = null
    await withTransaction(async (t) => {
      const inserted = await t.query(
        'INSERT INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [id, date, body.type, body.productId, body.quantity, amount, staffId, body.discount],
      )
      created = inserted.rows[0]
      await addAudit(t, null, req.user.id, `Transaction created: ${id}`)
    })
    res.status(201).json(mapTransaction(created))
    return
  }
  db.transaction(() => {
    db.prepare(
      'INSERT INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, date, body.type, body.productId, body.quantity, amount, staffId, body.discount)
    addAudit(db, null, req.user.id, `Transaction created: ${id}`)
  })()
  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  res.status(201).json(mapTransaction(created))
})

export default router
