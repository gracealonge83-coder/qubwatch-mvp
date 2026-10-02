import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth } from '../auth.js'
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

function rowsOf(result) {
  return result && Array.isArray(result.rows) ? result.rows : []
}

async function fetchUsers() {
  if (PG_MODE) {
    const { rows } = await query('SELECT id, name, role FROM users ORDER BY created_at, id')
    return rows
  }
  return getDb().prepare('SELECT id, name, role FROM users ORDER BY rowid').all()
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

async function ruleLine(alert) {
  const row = PG_MODE
    ? (await query('SELECT * FROM rule_config WHERE id = 1')).rows[0]
    : getDb().prepare('SELECT * FROM rule_config WHERE id = 1').get()
  const n = (v) => Number(v)
  if (alert.type === 'Large transaction') {
    return `Rule: flag transactions above ${n(row.large_amount)}.`
  }
  if (alert.type === 'Repeated refunds') {
    return `Rule: flag more than ${n(row.refund_count)} refunds within ${n(row.refund_window_minutes)} minutes.`
  }
  if (alert.type === 'High discount') {
    return `Rule: flag discounts at or above ${n(row.discount_pct)}%.`
  }
  if (alert.type === 'Unusual frequency') {
    return `Rule: flag more than ${n(row.freq_count)} transactions within ${n(row.freq_window_minutes)} minutes.`
  }
  return 'Rule: flag products whose recorded stock differs from expected stock.'
}

async function alertRecords(alertId) {
  const alerts = await deriveAlerts(PG_MODE ? null : getDb())
  const alert = alerts.find((a) => a.id === alertId)
  if (!alert) return null
  const users = await fetchUsers()
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  const productById = {}
  const txnById = {}
  if (PG_MODE) {
    for (const t of alert.relatedTransactionIds) {
      const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [t])
      if (rows[0]) txnById[t] = rows[0]
    }
    const productIds = [...new Set(Object.values(txnById).map((t) => t.product_id))]
    for (const p of productIds) {
      const { rows } = await query('SELECT * FROM products WHERE id = $1', [p])
      if (rows[0]) productById[p] = rows[0]
    }
  } else {
    const db = getDb()
    for (const t of alert.relatedTransactionIds) {
      const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(t)
      if (row) txnById[t] = row
    }
    const productIds = [...new Set(Object.values(txnById).map((t) => t.product_id))]
    for (const p of productIds) {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(p)
      if (row) productById[p] = row
    }
  }
  return { alert, txnById, productById, userById, rule: await ruleLine(alert) }
}

async function investigationRecords(invId) {
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [invId])).rows[0]
    : getDb().prepare('SELECT * FROM investigations WHERE id = ?').get(invId)
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
    relatedTransactionIds: parse(row.related_transaction_ids),
    relatedProductIds: parse(row.related_product_ids),
    notes: parse(row.notes),
  }
  const alerts = await deriveAlerts(PG_MODE ? null : getDb())
  const alert = alerts.find((a) => a.id === inv.alertId) || null
  const users = await fetchUsers()
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  return { inv, alert, userById }
}

async function overviewRecords() {
  const db = PG_MODE ? null : getDb()
  const get = async (sql, params) => (PG_MODE ? rowsOf(await query(sql, params)) : db.prepare(sql).all(...(params || [])))
  const one = async (sql, params) => (await get(sql, params))[0] || null
  const business = PG_MODE
    ? (await query('SELECT * FROM businesses LIMIT 1')).rows[0]
    : db.prepare('SELECT * FROM businesses LIMIT 1').get()
  const counts = await one('SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM transactions) AS transactions, (SELECT COUNT(*) FROM investigations) AS investigations')
  const totals = await one("SELECT COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS sales, COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS refunds, COALESCE(SUM(CASE WHEN type = 'discount' THEN amount ELSE 0 END), 0) AS discounts FROM transactions")
  const alerts = await deriveAlerts(db)
  const open = alerts.filter((a) => a.status === 'New' || a.status === 'Under Review').slice(0, 8)
  return { business, counts, totals, open, alertTotal: alerts.length }
}

function buildPrompt(contextType, question, records) {
  const guide = QUESTION_GUIDE[question] || QUESTION_GUIDE.summarize
  let recordsText = ''
  if (contextType === 'alert') {
    const { alert, txnById, productById, userById, rule } = records
    const txns = alert.relatedTransactionIds.map((id) => txnById[id]).filter(Boolean).map(normTxn)
    const products = [...new Set(txns.map((t) => t.productId))]
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
    const { inv, alert, userById } = records
    const investigator = userById[inv.investigatorId]
    recordsText = [
      `Investigation: ${inv.id} — status ${inv.status} — investigator ${investigator ? userLine(investigator) : inv.investigatorId}.`,
      alert ? `Linked alert: ${alert.type} — severity ${alert.severity} — status ${alert.status}. Reason: ${alert.message}` : 'Linked alert is no longer present.',
      `Related transaction IDs: ${inv.relatedTransactionIds.join(', ') || 'none'}.`,
      `Related product IDs: ${inv.relatedProductIds.join(', ') || 'none'}.`,
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

router.post('/ai', async (req, res) => {
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
    records = await alertRecords(contextId)
    if (!records) {
      res.status(404).json({ error: 'Alert not found' })
      return
    }
    fallbackTitle = `Summary: ${records.alert.type}`
  } else if (contextType === 'investigation') {
    records = await investigationRecords(contextId)
    if (!records) {
      res.status(404).json({ error: 'Investigation not found' })
      return
    }
    fallbackTitle = `Investigation ${records.inv.id}`
  } else {
    records = await overviewRecords()
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
