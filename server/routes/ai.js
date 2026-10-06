import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { badRequest } from '../validate.js'
import { deriveAlerts } from './alerts.js'

// Groq-backed AI Assistant (reads QubWatch records, explains them to the
// reviewer). The API key never leaves the server: it is read from
// process.env.GROQ_API_KEY and is never sent to the frontend, logged,
// or included in any response. Responses are never stored in the database.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Current Production model with access on this deployment (verified via
// Groq models API; llama-3.3-70b-versatile returned model_not_found here).
const GROQ_MODEL = 'openai/gpt-oss-120b'
const GROQ_TIMEOUT_MS = 30000
const MAX_ITEMS = 8
const MAX_ITEM_CHARS = 500

const CONTEXTS = ['overview', 'alert', 'investigation']
const AI_REVIEWERS = ['Business Owner', 'Authorized Manager', 'Administrator']

const QUESTION_GUIDE = {
  summarize: 'Summarize the supplied records plainly.',
  why: 'Explain which recorded facts triggered the monitoring rule.',
  transactions: 'Summarize the related transactions: amounts, types, staff, and timing.',
  questions: 'Suggest neutral questions the human reviewer could ask next.',
}

const SYSTEM_RULES = [
  'You assist a business owner reviewing QubWatch monitoring records.',
  'Use ONLY the supplied QubWatch records. Do not invent facts, people, amounts, or dates.',
  'Clearly distinguish recorded information (Known Information) from interpretation (Analysis) and possibilities (Possible Explanations).',
  'Never accuse anyone of fraud, theft, dishonesty, or wrongdoing.',
  'An alert is a signal for review, not proof of wrongdoing.',
  'The human reviewer makes the final decision; you only explain and suggest.',
  'Reply with JSON ONLY, no other text, using exactly these keys: knownInformation, analysis, possibleExplanations, suggestedNextSteps. Each value is an array of short strings.',
]

async function fetchUsers(businessId) {
  if (PG_MODE) {
    const { rows } = await query('SELECT id, name, role FROM users WHERE business_id = $1 ORDER BY created_at, id', [businessId])
    return rows
  }
  return getDb().prepare('SELECT id, name, role FROM users WHERE business_id = ? ORDER BY rowid').all(businessId)
}

function userLine(u) {
  return `${u.name} (${u.role})`
}

function normTxn(t) {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    productId: t.product_id ?? t.productId,
    quantity: Number(t.quantity),
    amount: Number(t.amount),
    staffId: t.staff_id ?? t.staffId,
    discount: Number(t.discount),
  }
}

function normProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    stock: Number(p.stock),
    expectedStock: Number(p.expected_stock ?? p.expectedStock),
  }
}

function txnLine(t, productById, userById) {
  const product = productById[t.productId]
  const staff = userById[t.staffId]
  return `${t.date} — ${t.type} — ${product ? product.name : t.productId} — qty ${t.quantity} — amount ${t.amount} — discount ${t.discount}% — ${staff ? staff.name : t.staffId}`
}

function ruleLine(alert) {
  const values = alert.ruleValues || {}
  if (alert.type === 'Large transaction') {
    return `Rule at generation: flag transactions above ${Number(values.largeTransactionAmount)}.`
  }
  if (alert.type === 'Repeated refunds') {
    return `Rule at generation: flag more than ${Number(values.refundCount)} refunds within ${Number(values.refundWindowMinutes)} minutes.`
  }
  if (alert.type === 'High discount') {
    return `Rule at generation: flag discounts at or above ${Number(values.excessiveDiscountPct)}%.`
  }
  if (alert.type === 'Unusual frequency') {
    return `Rule at generation: flag more than ${Number(values.frequencyCount)} transactions within ${Number(values.frequencyWindowMinutes)} minutes.`
  }
  return 'Rule at generation: flag products whose recorded stock differs from expected stock.'
}

async function alertRecords(alertId, businessId) {
  const alerts = await deriveAlerts(
    PG_MODE ? null : getDb(),
    businessId,
    { persistSnapshots: false },
  )
  const alert = alerts.find((a) => a.id === alertId)
  if (!alert) return null
  const users = await fetchUsers(businessId)
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  const productById = Object.fromEntries(
    alert.evidence.products.map((p) => [p.id, p]),
  )
  const txnById = Object.fromEntries(
    alert.evidence.transactions
      .filter((t) => productById[t.productId] && userById[t.staffId])
      .map((t) => [t.id, t]),
  )
  return { alert, txnById, productById, userById, rule: ruleLine(alert) }
}

async function scopedInvestigationEvidence(transactionIds, productIds, businessId, db) {
  let transactions = []
  let products = []
  if (transactionIds.length > 0) {
    transactions = PG_MODE
      ? (await query(
        `SELECT t.* FROM transactions t
         JOIN products p ON p.id = t.product_id AND p.business_id = $2
         JOIN users u ON u.id = t.staff_id AND u.business_id = $2
         WHERE t.id = ANY($1::text[])`,
        [transactionIds, businessId],
      )).rows
      : db.prepare(
        `SELECT t.* FROM transactions t
         JOIN products p ON p.id = t.product_id AND p.business_id = ?
         JOIN users u ON u.id = t.staff_id AND u.business_id = ?
         WHERE t.id IN (${transactionIds.map(() => '?').join(', ')})`,
      ).all(businessId, businessId, ...transactionIds)
  }
  if (productIds.length > 0) {
    products = PG_MODE
      ? (await query(
        'SELECT * FROM products WHERE id = ANY($1::text[]) AND business_id = $2',
        [productIds, businessId],
      )).rows
      : db.prepare(
        `SELECT * FROM products WHERE business_id = ?
         AND id IN (${productIds.map(() => '?').join(', ')})`,
      ).all(businessId, ...productIds)
  }
  return {
    transactions: Object.fromEntries(transactions.map((t) => [t.id, t])),
    products: Object.fromEntries(products.map((p) => [p.id, p])),
  }
}

async function investigationRecords(invId, businessId) {
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query(
      `SELECT i.* FROM investigations i
       JOIN users u ON u.id = i.investigator_id AND u.business_id = $2
       WHERE i.id = $1`,
      [invId, businessId],
    )).rows[0]
    : db.prepare(
      `SELECT i.* FROM investigations i
       JOIN users u ON u.id = i.investigator_id AND u.business_id = ?
       WHERE i.id = ?`,
    ).get(businessId, invId)
  if (!row) return null
  const parse = (v) => {
    if (Array.isArray(v)) return v
    try {
      const parsed = JSON.parse(v || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  const inv = {
    id: row.id,
    alertId: row.alert_id,
    status: row.status,
    investigatorId: row.investigator_id,
    finding: row.finding,
    findingOther: row.finding_other,
    resolutionNotes: row.resolution_notes,
    relatedTransactionIds: parse(row.related_transaction_ids).filter((id) => typeof id === 'string'),
    relatedProductIds: parse(row.related_product_ids).filter((id) => typeof id === 'string'),
    notes: parse(row.notes),
    alertType: row.alert_type,
    alertSeverity: row.alert_severity,
  }
  const linked = await alertRecords(inv.alertId, businessId)
  const users = await fetchUsers(businessId)
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  let txnById
  let productById
  if (linked) {
    const relatedTransactionIds = new Set(inv.relatedTransactionIds)
    const relatedProductIds = new Set(inv.relatedProductIds)
    txnById = Object.fromEntries(
      linked.alert.evidence.transactions
        .filter((t) => relatedTransactionIds.has(t.id) && userById[t.staffId])
        .map((t) => [t.id, t]),
    )
    productById = Object.fromEntries(
      linked.alert.evidence.products
        .filter((p) => relatedProductIds.has(p.id))
        .map((p) => [p.id, p]),
    )
  } else {
    const evidence = await scopedInvestigationEvidence(
      inv.relatedTransactionIds,
      inv.relatedProductIds,
      businessId,
      db,
    )
    txnById = evidence.transactions
    productById = evidence.products
    inv.relatedTransactionIds = Object.keys(txnById)
    inv.relatedProductIds = Object.keys(productById)
  }
  return { inv, alert: linked ? linked.alert : null, userById, txnById, productById }
}

async function overviewRecords(businessId) {
  const db = PG_MODE ? null : getDb()
  const business = PG_MODE
    ? (await query('SELECT * FROM businesses WHERE id = $1', [businessId])).rows[0]
    : db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId)
  const alerts = await deriveAlerts(db, businessId, { persistSnapshots: false })
  const counts = PG_MODE
    ? (await query(
      `SELECT (SELECT COUNT(*) FROM products WHERE business_id = $1) AS products,
              (SELECT COUNT(*) FROM transactions t
               JOIN products p ON p.id = t.product_id AND p.business_id = $1
               JOIN users u ON u.id = t.staff_id AND u.business_id = $1) AS transactions,
              (SELECT COUNT(*) FROM investigations i
               JOIN users u ON u.id = i.investigator_id AND u.business_id = $1) AS investigations`,
      [businessId],
    )).rows[0]
    : db.prepare(
      `SELECT (SELECT COUNT(*) FROM products WHERE business_id = ?) AS products,
              (SELECT COUNT(*) FROM transactions t
               JOIN products p ON p.id = t.product_id AND p.business_id = ?
               JOIN users u ON u.id = t.staff_id AND u.business_id = ?) AS transactions,
              (SELECT COUNT(*) FROM investigations i
               JOIN users u ON u.id = i.investigator_id AND u.business_id = ?) AS investigations`,
    ).get(businessId, businessId, businessId, businessId)
  const totals = PG_MODE
    ? (await query(
      `SELECT COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.amount ELSE 0 END), 0) AS sales,
              COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount ELSE 0 END), 0) AS refunds,
              COALESCE(SUM(CASE WHEN t.type = 'discount' THEN t.amount ELSE 0 END), 0) AS discounts
       FROM transactions t
       JOIN products p ON p.id = t.product_id AND p.business_id = $1
       JOIN users u ON u.id = t.staff_id AND u.business_id = $1`,
      [businessId],
    )).rows[0]
    : db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.amount ELSE 0 END), 0) AS sales,
              COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount ELSE 0 END), 0) AS refunds,
              COALESCE(SUM(CASE WHEN t.type = 'discount' THEN t.amount ELSE 0 END), 0) AS discounts
       FROM transactions t
       JOIN products p ON p.id = t.product_id AND p.business_id = ?
       JOIN users u ON u.id = t.staff_id AND u.business_id = ?`,
    ).get(businessId, businessId)
  const open = alerts.filter((a) => a.status === 'New' || a.status === 'Under Review').slice(0, 8)
  return { business, counts, totals, open, alertTotal: alerts.length }
}

function buildPrompt(contextType, question, records) {
  const guide = QUESTION_GUIDE[question] || QUESTION_GUIDE.summarize
  let recordsText = ''
  if (contextType === 'alert') {
    const { alert, txnById, productById, userById, rule } = records
    const txns = alert.relatedTransactionIds.map((id) => txnById[id]).filter(Boolean).map(normTxn)
    const products = alert.relatedProductIds
      .map((id) => productById[id])
      .filter(Boolean)
      .map(normProduct)
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]))
    recordsText = [
      `Alert: ${alert.type} — severity ${alert.severity} — status ${alert.status} — date ${alert.date}.`,
      `Reason recorded by the monitor: ${alert.message}`,
      rule,
      ...txns.map((t) => txnLine(t, productsById, userById)),
      ...products.map(
        (p) => `Product: ${p.name} (${p.category}) — price ${p.price} — stock ${p.stock}, expected ${p.expectedStock}.`,
      ),
      ...Object.values(userById)
        .filter((u) => txns.some((t) => t.staffId === u.id))
        .map((u) => `Staff on related transactions: ${userLine(u)}.`),
    ].join('\n')
  } else if (contextType === 'investigation') {
    const { inv, alert, userById, txnById, productById } = records
    const investigator = userById[inv.investigatorId]
    const txns = inv.relatedTransactionIds.map((id) => txnById[id]).filter(Boolean).map(normTxn)
    const products = inv.relatedProductIds.map((id) => productById[id]).filter(Boolean).map(normProduct)
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]))
    recordsText = [
      `Investigation: ${inv.id} — status ${inv.status} — investigator ${investigator ? userLine(investigator) : inv.investigatorId}.`,
      alert
        ? `Linked alert: ${alert.type} — severity ${alert.severity} — status ${alert.status}. Reason: ${alert.message}`
        : `Linked alert snapshot is unavailable; stored alert type is ${inv.alertType} with severity ${inv.alertSeverity}.`,
      ...(alert ? [ruleLine(alert)] : []),
      `Related transaction IDs: ${inv.relatedTransactionIds.join(', ') || 'none'}.`,
      `Related product IDs: ${inv.relatedProductIds.join(', ') || 'none'}.`,
      ...txns.map((t) => txnLine(t, productsById, userById)),
      ...products.map(
        (p) => `Product at alert generation: ${p.name} (${p.category}) — price ${p.price} — stock ${p.stock}, expected ${p.expectedStock}.`,
      ),
      ...inv.notes.map((n) => `Note by ${userById[n.authorId] ? userById[n.authorId].name : n.authorId} on ${n.date}: ${n.content}`),
      inv.finding ? `Recorded finding: ${inv.finding}${inv.finding === 'Other' ? ` — ${inv.findingOther}` : ''}.` : 'No finding recorded yet.',
      inv.resolutionNotes ? `Resolution notes: ${inv.resolutionNotes}.` : 'No resolution recorded yet.',
    ].join('\n')
  } else {
    const { business, counts, totals, open, alertTotal } = records
    recordsText = [
      `Business: ${business ? `${business.name} (${business.type}, ${business.location})` : 'not set up'}.`,
      `Counts: ${counts.products} products, ${counts.transactions} transactions, ${counts.investigations} investigations, ${alertTotal} alerts derived.`,
      `Totals: sales ${totals.sales}, refunds ${totals.refunds}, discounts ${totals.discounts} (recorded amounts).`,
      ...open.map((a) => `Open alert: ${a.type} — severity ${a.severity} — status ${a.status}. Reason: ${a.message}`),
    ].join('\n')
  }
  return { guide, recordsText }
}

function cleanList(value) {
  if (!Array.isArray(value)) return null
  const lines = value.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
  if (lines.length === 0) return null
  return lines.slice(0, MAX_ITEMS).map((v) => v.slice(0, MAX_ITEM_CHARS))
}

function sanitizeResponse(data, fallbackTitle) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const knownInformation = cleanList(data.knownInformation)
  const analysis = cleanList(data.analysis)
  const possibleExplanations = cleanList(data.possibleExplanations)
  const suggestedNextSteps = cleanList(data.suggestedNextSteps)
  if (!knownInformation || !analysis || !possibleExplanations || !suggestedNextSteps) return null
  const title = typeof data.title === 'string' && data.title.trim() !== ''
    ? data.title.trim().slice(0, 120)
    : fallbackTitle
  return { title, knownInformation, analysis, possibleExplanations, suggestedNextSteps }
}

async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { error: 'NOT_CONFIGURED' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!res.ok) {
      console.error(`[ai] groq request failed with status ${res.status}`)
      return { error: 'PROVIDER_FAILED' }
    }
    const data = await res.json().catch(() => null)
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null
    if (typeof content !== 'string' || content.trim() === '') {
      console.error('[ai] groq returned an empty completion')
      return { error: 'INVALID_RESPONSE' }
    }
    const parsed = JSON.parse(content.trim())
    return { data: parsed }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      console.error('[ai] groq request timed out')
      return { error: 'TIMEOUT' }
    }
    console.error('[ai] groq request errored')
    return { error: 'PROVIDER_FAILED' }
  } finally {
    clearTimeout(timer)
  }
}

const router = Router()
router.use(requireAuth)

router.post('/ai', requireRole(...AI_REVIEWERS), async (req, res) => {
  const body = req.body || {}
  const { contextType, contextId, question } = body
  if (!CONTEXTS.includes(contextType)) {
    res.status(400).json({ error: 'Invalid request', fields: { contextType: 'Unknown context.' } })
    return
  }
  if (typeof question !== 'string' || question.trim() === '' || question.length > 500) {
    res.status(400).json({ error: 'Invalid request', fields: { question: 'A question is required.' } })
    return
  }
  if ((contextType === 'alert' || contextType === 'investigation') && (typeof contextId !== 'string' || contextId === '')) {
    res.status(400).json({ error: 'Invalid request', fields: { contextId: 'A record must be selected.' } })
    return
  }
  let records = null
  let fallbackTitle = 'Business overview'
  if (contextType === 'alert') {
    records = await alertRecords(contextId, req.user.businessId)
    if (!records) {
      res.status(404).json({ error: 'Alert not found' })
      return
    }
    fallbackTitle = `Summary: ${records.alert.type}`
  } else if (contextType === 'investigation') {
    records = await investigationRecords(contextId, req.user.businessId)
    if (!records) {
      res.status(404).json({ error: 'Investigation not found' })
      return
    }
    fallbackTitle = `Investigation ${records.inv.id}`
  } else {
    records = await overviewRecords(req.user.businessId)
  }
  const { guide, recordsText } = buildPrompt(contextType, question, records)
  const systemPrompt = `${SYSTEM_RULES.join('\n')}`
  const userPrompt = `Question focus: ${guide}\n\nQubWatch records:\n${recordsText}`
  const result = await callGroq(systemPrompt, userPrompt)
  if (result.error === 'NOT_CONFIGURED') {
    res.status(503).json({ error: 'The AI assistant is not configured on the server.' })
    return
  }
  if (result.error === 'TIMEOUT') {
    res.status(504).json({ error: 'The AI assistant took too long. Please try again.' })
    return
  }
  if (result.error) {
    res.status(502).json({ error: 'The AI assistant could not respond. Please try again.' })
    return
  }
  let responseJson = result.data
  if (typeof responseJson === 'string') {
    try {
      responseJson = JSON.parse(responseJson)
    } catch {
      responseJson = null
    }
  }
  const clean = sanitizeResponse(responseJson, fallbackTitle)
  if (!clean) {
    console.error('[ai] groq returned an unusable response shape')
    res.status(502).json({ error: 'The AI assistant could not respond. Please try again.' })
    return
  }
  res.json({ ...clean, kind: contextType, id: contextType === 'overview' ? null : contextId })
})

export default router
