import { Router } from 'express'
import { getDb, query, withTransaction, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { ALERT_STATUSES, badRequest, collect, nowStamp } from '../validate.js'
import { evaluateRules, DEMO_THRESHOLDS } from '../../shared/rules.js'
import { addAudit } from '../auditLog.js'
import { formatWireDate } from '../dates.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    stock: Number(row.stock),
    expectedStock: Number(row.expected_stock),
  }
}

function mapTransaction(row) {
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

async function loadThresholds(db) {
  const row = PG_MODE
    ? (await query('SELECT * FROM rule_config WHERE id = $1', [1])).rows[0]
    : db.prepare('SELECT * FROM rule_config WHERE id = 1').get()
  const source = row || {}
  const defaults = DEMO_THRESHOLDS
  return {
    LARGE_TRANSACTION_AMOUNT: Number(source.large_amount ?? defaults.LARGE_TRANSACTION_AMOUNT),
    REPEATED_REFUNDS_COUNT: Number(source.refund_count ?? defaults.REPEATED_REFUNDS_COUNT),
    REPEATED_REFUNDS_WINDOW_MINUTES: Number(
      source.refund_window_minutes ?? defaults.REPEATED_REFUNDS_WINDOW_MINUTES,
    ),
    EXCESSIVE_DISCOUNT_PCT: Number(source.discount_pct ?? defaults.EXCESSIVE_DISCOUNT_PCT),
    FREQUENCY_COUNT: Number(source.freq_count ?? defaults.FREQUENCY_COUNT),
    FREQUENCY_WINDOW_MINUTES: Number(source.freq_window_minutes ?? defaults.FREQUENCY_WINDOW_MINUTES),
  }
}

// Alerts stay derived: re-evaluated from stored transactions on every read,
// with persisted statuses joined in. Exported for the investigations routes.
export async function deriveAlerts(db) {
  const products = PG_MODE
    ? (await query('SELECT * FROM products ORDER BY created_at, id')).rows.map(mapProduct)
    : db.prepare('SELECT * FROM products ORDER BY rowid').all().map(mapProduct)
  const transactions = PG_MODE
    ? (await query('SELECT * FROM transactions ORDER BY created_at, id')).rows.map(mapTransaction)
    : db.prepare('SELECT * FROM transactions ORDER BY rowid').all().map(mapTransaction)
  const base = evaluateRules(products, transactions, await loadThresholds(db))
  const statusRows = PG_MODE
    ? (await query('SELECT alert_id, status FROM alert_statuses')).rows
    : db.prepare('SELECT alert_id, status FROM alert_statuses').all()
  const statuses = Object.fromEntries(statusRows.map((r) => [r.alert_id, r.status]))
  return base.map((a) => ({ ...a, status: statuses[a.id] || 'New' }))
}

const router = Router()
router.use(requireAuth)

router.get('/alerts', async (req, res) => {
  res.json(await deriveAlerts(PG_MODE ? null : getDb()))
})

router.patch('/alerts/:id/status', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const errors = collect({
    status: ALERT_STATUSES.includes(body.status) ? null : 'Invalid alert status.',
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const alert = (await deriveAlerts(db)).find((a) => a.id === req.params.id)
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  if (PG_MODE) {
    await withTransaction(async (t) => {
      await t.query(
        `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(alert_id) DO UPDATE SET status = excluded.status, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [req.params.id, body.status, req.user.id, nowStamp()],
      )
      await addAudit(t, null, req.user.id, `Alert reviewed: ${req.params.id} → ${body.status}`)
    })
    const updated = (await deriveAlerts(db)).find((a) => a.id === req.params.id)
    res.json(updated)
    return
  }
  db.transaction(() => {
    db.prepare(
      `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(alert_id) DO UPDATE SET status = excluded.status, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).run(req.params.id, body.status, req.user.id, nowStamp())
    addAudit(db, null, req.user.id, `Alert reviewed: ${req.params.id} → ${body.status}`)
  })()
  const updated = deriveAlerts(db).find((a) => a.id === req.params.id)
  res.json(updated)
})

export default router
