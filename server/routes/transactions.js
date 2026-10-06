import { Router } from 'express'
import { getDb, query, withTransaction, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { TXN_TYPES, discountPct, positiveInt, badRequest, collect, nowStamp } from '../validate.js'
import { newId } from '../ids.js'
import { addAudit } from '../auditLog.js'
import { formatWireDate } from '../dates.js'

const RECORDERS = ['Business Owner', 'Authorized Manager', 'Staff User']
const REVIEWERS = ['Business Owner', 'Authorized Manager', 'Administrator']

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
  const rows = !REVIEWERS.includes(req.user.role)
    ? (PG_MODE
      ? (await query('SELECT * FROM transactions WHERE staff_id = $1 ORDER BY created_at, id', [req.user.id])).rows
      : getDb().prepare('SELECT * FROM transactions WHERE staff_id = ? ORDER BY rowid').all(req.user.id))
    : (PG_MODE
      ? (await query(
        `SELECT t.* FROM transactions t
         JOIN products p ON p.id = t.product_id AND p.business_id = $1
         JOIN users u ON u.id = t.staff_id AND u.business_id = $1
         ORDER BY t.created_at, t.id`,
        [req.user.businessId],
      )).rows
      : getDb().prepare(
        `SELECT t.* FROM transactions t
         JOIN products p ON p.id = t.product_id AND p.business_id = ?
         JOIN users u ON u.id = t.staff_id AND u.business_id = ?
         ORDER BY t.rowid`,
      ).all(req.user.businessId, req.user.businessId))
  res.json(rows.map(mapTransaction))
})

router.post('/transactions', requireRole(...RECORDERS), async (req, res) => {
  const body = req.body || {}
  const errors = collect({
    productId: typeof body.productId === 'string' && body.productId !== '' ? null : 'Product is required.',
    type: TXN_TYPES.includes(body.type) ? null : 'Invalid transaction type.',
    quantity: positiveInt(body.quantity),
    discount: discountPct(body.discount),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const product = PG_MODE
    ? (await query('SELECT * FROM products WHERE id = $1 AND business_id = $2', [body.productId, req.user.businessId])).rows[0]
    : db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(body.productId, req.user.businessId)
  if (!product) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  const staffId = body.staffId || req.user.id
  if (req.user.role === 'Staff User' && staffId !== req.user.id) {
    res.status(403).json({ error: 'Staff users may only record transactions under their own account' })
    return
  }
  const staff = PG_MODE
    ? (await query('SELECT id, business_id FROM users WHERE id = $1', [staffId])).rows[0]
    : db.prepare('SELECT id, business_id FROM users WHERE id = ?').get(staffId)
  if (!staff) {
    badRequest(res, { staffId: 'Unknown staff user.' })
    return
  }
  if (staff.business_id !== req.user.businessId) {
    res.status(403).json({ error: 'Transactions may only be attributed to a user in your business' })
    return
  }
  // Amount is recomputed from the transaction's locked/current product row.
  const id = newId('txn')
  const date = nowStamp()
  if (PG_MODE) {
    let created = null
    const result = await withTransaction(async (t) => {
      const lockedProduct = (await t.query(
        'SELECT * FROM products WHERE id = $1 AND business_id = $2 FOR UPDATE',
        [body.productId, req.user.businessId],
      )).rows[0]
      if (!lockedProduct) return { missingProduct: true }
      if (body.type === 'sale' && Number(lockedProduct.stock) < body.quantity) {
        return { insufficientStock: true }
      }
      const transactionAmount = Math.round(
        Number(lockedProduct.price) * body.quantity * (1 - (body.discount || 0) / 100),
      )
      const inserted = await t.query(
        'INSERT INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [id, date, body.type, body.productId, body.quantity, transactionAmount, staffId, body.discount],
      )
      created = inserted.rows[0]
      if (body.type === 'sale' || body.type === 'refund') {
        const delta = body.type === 'sale' ? -body.quantity : body.quantity
        const updated = await t.query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2 AND business_id = $3 AND stock + $1 >= 0',
          [delta, body.productId, req.user.businessId],
        )
        if (updated.rowCount !== 1) throw new Error('Product stock update failed during transaction creation.')
      }
      await addAudit(t, null, req.user.id, `Transaction created: ${id}`)
      return { created: true }
    })
    if (result.missingProduct) {
      res.status(404).json({ error: 'Product not found' })
      return
    }
    if (result.insufficientStock) {
      res.status(400).json({ error: 'Insufficient stock for this sale.' })
      return
    }
    res.status(201).json(mapTransaction(created))
    return
  }
  const result = db.transaction(() => {
    const currentProduct = db.prepare(
      'SELECT * FROM products WHERE id = ? AND business_id = ?',
    ).get(body.productId, req.user.businessId)
    if (!currentProduct) return { missingProduct: true }
    if (body.type === 'sale' && Number(currentProduct.stock) < body.quantity) {
      return { insufficientStock: true }
    }
    const transactionAmount = Math.round(
      Number(currentProduct.price) * body.quantity * (1 - (body.discount || 0) / 100),
    )
    db.prepare(
      'INSERT INTO transactions (id, date, type, product_id, quantity, amount, staff_id, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, date, body.type, body.productId, body.quantity, transactionAmount, staffId, body.discount)
    if (body.type === 'sale' || body.type === 'refund') {
      const delta = body.type === 'sale' ? -body.quantity : body.quantity
      const updated = db.prepare(
        'UPDATE products SET stock = stock + ? WHERE id = ? AND business_id = ? AND stock + ? >= 0',
      ).run(delta, body.productId, req.user.businessId, delta)
      if (updated.changes !== 1) throw new Error('Product stock update failed during transaction creation.')
    }
    addAudit(db, null, req.user.id, `Transaction created: ${id}`)
    return { created: true }
  })()
  if (result.missingProduct) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  if (result.insufficientStock) {
    res.status(400).json({ error: 'Insufficient stock for this sale.' })
    return
  }
  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  res.status(201).json(mapTransaction(created))
})

export default router
