import { Router } from 'express'
import { getDb, query, withTransaction, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { ALERT_STATUSES, badRequest, collect, nowStamp } from '../validate.js'
import { evaluateRules, DEMO_THRESHOLDS } from '../../shared/rules.js'
import { addAudit } from '../auditLog.js'
import { formatWireDate } from '../dates.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

// Valid alert status transitions. Terminal statuses (Resolved, Dismissed)
// accept no further changes. Same-status updates are allowed as no-ops.
const ALLOWED_TRANSITIONS = {
  New: ['Under Review', 'Resolved', 'Dismissed'],
  'Under Review': ['Resolved', 'Dismissed'],
  Investigating: ['Resolved', 'Dismissed'],
  Resolved: [],
  Dismissed: [],
}

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
    staffName: row.staff_name,
    staffRole: row.staff_role,
    discount: Number(row.discount),
  }
}

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapSnapshot(row) {
  return {
    id: row.alert_id,
    type: row.alert_type,
    severity: row.severity,
    message: row.message,
    date: row.date,
    generatedAt: formatWireDate(row.generated_at),
    relatedTransactionIds: parseJson(row.related_transaction_ids, []),
    relatedProductIds: parseJson(row.related_product_ids, []),
    ruleValues: parseJson(row.rule_values, {}),
    evidence: parseJson(row.evidence, { products: [], transactions: [] }),
    status: row.status,
  }
}

async function loadThresholds(db, businessId) {
  const row = PG_MODE
    ? (await query('SELECT * FROM business_rule_config WHERE business_id = $1', [businessId])).rows[0]
    : db.prepare('SELECT * FROM business_rule_config WHERE business_id = ?').get(businessId)
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

// Rules are evaluated for the caller's business on every read. New
// deterministic alert IDs are snapshotted once; existing snapshots are never
// rewritten when source data or rule values change.
export async function deriveAlerts(db, businessId, { persistSnapshots = true } = {}) {
  const products = PG_MODE
    ? (await query('SELECT * FROM products WHERE business_id = $1 ORDER BY created_at, id', [businessId])).rows.map(mapProduct)
    : db.prepare('SELECT * FROM products WHERE business_id = ? ORDER BY rowid').all(businessId).map(mapProduct)
  const transactions = PG_MODE
    ? (await query(
      `SELECT t.*, u.name AS staff_name, u.role AS staff_role FROM transactions t
       JOIN products p ON p.id = t.product_id AND p.business_id = $1
       JOIN users u ON u.id = t.staff_id AND u.business_id = $1
       WHERE p.business_id = $1 AND u.business_id = $1
       ORDER BY t.created_at, t.id`,
      [businessId],
    )).rows.map(mapTransaction)
    : db.prepare(
      `SELECT t.*, u.name AS staff_name, u.role AS staff_role FROM transactions t
       JOIN products p ON p.id = t.product_id AND p.business_id = ?
       JOIN users u ON u.id = t.staff_id AND u.business_id = ?
       WHERE p.business_id = ? AND u.business_id = ?
       ORDER BY t.rowid`,
    ).all(businessId, businessId, businessId, businessId).map(mapTransaction)
  const generated = evaluateRules(products, transactions, await loadThresholds(db, businessId))
  const productById = Object.fromEntries(products.map((p) => [p.id, p]))
  const transactionById = Object.fromEntries(transactions.map((t) => [t.id, t]))

  const snapshots = generated.map((alert) => {
    const evidence = {
      products: alert.relatedProductIds
       .map((id) => productById[id])
       .filter(Boolean),
      transactions: alert.relatedTransactionIds
       .map((id) => transactionById[id])
       .filter(Boolean)
       .map((t) => {
         const product = productById[t.productId]
         return {
           ...t,
           productName: product ? product.name : t.productId,
         }
       }),
    }
    return {
      ...alert,
      generatedAt: nowStamp(),
      businessId,
      evidence,
    }
  })

  if (PG_MODE) {
    if (persistSnapshots && snapshots.length > 0) {
      await withTransaction(async (t) => {
       for (const alert of snapshots) {
         await t.query(
           `INSERT INTO alert_snapshots
            (alert_id, business_id, alert_type, severity, message, date, generated_at,
             related_transaction_ids, related_product_ids, rule_values, evidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT(alert_id) DO NOTHING`,
           [
             alert.id, businessId, alert.type, alert.severity, alert.message, alert.date,
             alert.generatedAt, JSON.stringify(alert.relatedTransactionIds),
             JSON.stringify(alert.relatedProductIds), JSON.stringify(alert.ruleValues),
             JSON.stringify(alert.evidence),
           ],
         )
       }
      })
    }
    const { rows } = await query(
      `SELECT s.*, COALESCE(st.status, 'New') AS status
      FROM alert_snapshots s
      LEFT JOIN alert_statuses st ON st.alert_id = s.alert_id
      WHERE s.business_id = $1
      ORDER BY s.generated_at DESC, s.alert_id`,
      [businessId],
    )
    const persisted = rows.map(mapSnapshot)
    if (persistSnapshots) return persisted
    const existingIds = new Set(persisted.map((alert) => alert.id))
    const unsaved = snapshots.filter((alert) => !existingIds.has(alert.id))
    const statusRows = unsaved.length > 0
      ? (await query(
        'SELECT alert_id, status FROM alert_statuses WHERE alert_id = ANY($1::text[])',
        [unsaved.map((alert) => alert.id)],
      )).rows
      : []
    const statuses = Object.fromEntries(statusRows.map((row) => [row.alert_id, row.status]))
    return [
      ...persisted,
      ...unsaved.map((alert) => ({ ...alert, status: statuses[alert.id] || 'New' })),
    ]
  }

  if (persistSnapshots && snapshots.length > 0) {
    db.transaction(() => {
      const insert = db.prepare(
        `INSERT INTO alert_snapshots
         (alert_id, business_id, alert_type, severity, message, date, generated_at,
          related_transaction_ids, related_product_ids, rule_values, evidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(alert_id) DO NOTHING`,
      )
      for (const alert of snapshots) {
        insert.run(
          alert.id, businessId, alert.type, alert.severity, alert.message, alert.date,
          alert.generatedAt, JSON.stringify(alert.relatedTransactionIds),
          JSON.stringify(alert.relatedProductIds), JSON.stringify(alert.ruleValues),
          JSON.stringify(alert.evidence),
        )
      }
    })()
  }
  const persisted = db.prepare(
    `SELECT s.*, COALESCE(st.status, 'New') AS status
     FROM alert_snapshots s
     LEFT JOIN alert_statuses st ON st.alert_id = s.alert_id
     WHERE s.business_id = ?
     ORDER BY s.generated_at DESC, s.alert_id`,
  ).all(businessId).map(mapSnapshot)
  if (persistSnapshots) return persisted
  const existingIds = new Set(persisted.map((alert) => alert.id))
  const unsaved = snapshots.filter((alert) => !existingIds.has(alert.id))
  const statusRows = unsaved.length > 0
    ? db.prepare(
      `SELECT alert_id, status FROM alert_statuses
       WHERE alert_id IN (${unsaved.map(() => '?').join(', ')})`,
    ).all(...unsaved.map((alert) => alert.id))
    : []
  const statuses = Object.fromEntries(statusRows.map((row) => [row.alert_id, row.status]))
  return [
    ...persisted,
    ...unsaved.map((alert) => ({ ...alert, status: statuses[alert.id] || 'New' })),
  ]
}

const router = Router()
router.use(requireAuth)

router.get('/alerts', async (req, res) => {
  if (req.user.role === 'Staff User') {
    res.json([])
    return
  }
  res.json(await deriveAlerts(PG_MODE ? null : getDb(), req.user.businessId))
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
  const alert = (await deriveAlerts(db, req.user.businessId)).find((a) => a.id === req.params.id)
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  if (body.status !== alert.status && !(ALLOWED_TRANSITIONS[alert.status] || []).includes(body.status)) {
    res.status(409).json({ error: 'Invalid alert status transition.' })
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
    const updated = (await deriveAlerts(db, req.user.businessId)).find((a) => a.id === req.params.id)
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
  const updated = (await deriveAlerts(db, req.user.businessId)).find((a) => a.id === req.params.id)
  res.json(updated)
})

export default router
