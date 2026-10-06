import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { requiredText, positiveNumber, nonNegativeInt, badRequest, collect } from '../validate.js'
import { newId } from '../ids.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

function mapProduct(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    stock: Number(row.stock),
    expectedStock: Number(row.expected_stock),
  }
}

const router = Router()
router.use(requireAuth)

router.get('/products', async (req, res) => {
  const rows = PG_MODE
    ? (await query('SELECT * FROM products WHERE business_id = $1 ORDER BY created_at, id', [req.user.businessId])).rows
    : getDb().prepare('SELECT * FROM products WHERE business_id = ? ORDER BY rowid').all(req.user.businessId)
  res.json(rows.map(mapProduct))
})

router.post('/products', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const errors = collect({
    name: requiredText(body.name),
    category: requiredText(body.category),
    price: positiveNumber(body.price),
    stock: nonNegativeInt(body.stock),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const id = newId('prod')
  // New products start with expected stock equal to recorded stock,
  // exactly like the current frontend behavior.
  if (PG_MODE) {
    const { rows } = await query(
      'INSERT INTO products (id, name, category, price, stock, expected_stock, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, body.name.trim(), body.category.trim(), body.price, body.stock, body.stock, req.user.businessId],
    )
    res.status(201).json(mapProduct(rows[0]))
    return
  }
  db.prepare(
    'INSERT INTO products (id, name, category, price, stock, expected_stock, business_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, body.name.trim(), body.category.trim(), body.price, body.stock, body.stock, req.user.businessId)
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.status(201).json(mapProduct(created))
})

router.patch('/products/:id', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const updates = {}
  for (const key of ['name', 'category', 'price', 'stock']) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  const errors = collect({
    ...('name' in updates ? { name: requiredText(updates.name) } : {}),
    ...('category' in updates ? { category: requiredText(updates.category) } : {}),
    ...('price' in updates ? { price: positiveNumber(updates.price) } : {}),
    ...('stock' in updates ? { stock: nonNegativeInt(updates.stock) } : {}),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  if (Object.keys(updates).length === 0) {
    badRequest(res, { _body: 'Provide fields to update.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const current = PG_MODE
    ? (await query('SELECT * FROM products WHERE id = $1 AND business_id = $2', [req.params.id, req.user.businessId])).rows[0]
    : db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId)
  if (!current) {
    res.status(404).json({ error: 'Product not found' })
    return
  }
  const merged = { ...mapProduct(current), ...updates }
  if (merged.name) merged.name = merged.name.trim()
  if (merged.category) merged.category = merged.category.trim()
  // expectedStock intentionally untouched: editing stock can create an
  // inventory discrepancy, exactly like the current frontend behavior.
  if (PG_MODE) {
    const { rows } = await query(
      'UPDATE products SET name = $1, category = $2, price = $3, stock = $4 WHERE id = $5 RETURNING *',
      [merged.name, merged.category, merged.price, merged.stock, current.id],
    )
    res.json(mapProduct(rows[0]))
    return
  }
  db.prepare('UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE id = ?').run(
    merged.name,
    merged.category,
    merged.price,
    merged.stock,
    current.id,
  )
  res.json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(current.id)))
})

export default router
