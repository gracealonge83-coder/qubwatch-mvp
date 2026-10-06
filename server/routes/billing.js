import { Router } from 'express'
import crypto from 'node:crypto'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { badRequest, nowStamp } from '../validate.js'
import { newId } from '../ids.js'

const PAYSTACK_URL = 'https://api.paystack.co'
const PAYSTACK_TIMEOUT_MS = 20000
const OWNERS = ['Business Owner']

const PLANS = {
  monthly: { amount: 500000, currency: 'NGN' },
}

function hasTestSecret() {
  return typeof process.env.PAYSTACK_SECRET_KEY === 'string'
    && /^sk_test_.+/.test(process.env.PAYSTACK_SECRET_KEY)
}

async function paystackRequest(path, { method = 'GET', body } = {}) {
  if (!hasTestSecret()) return { error: 'NOT_CONFIGURED' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)
  try {
    const response = await fetch(`${PAYSTACK_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      console.error(`[billing] Paystack request failed with status ${response.status}`)
      return { error: 'PROVIDER_FAILED' }
    }
    const payload = await response.json().catch(() => null)
    if (!payload || payload.status !== true || !payload.data) {
      console.error('[billing] Paystack returned an unusable response')
      return { error: 'INVALID_RESPONSE' }
    }
    return { data: payload.data }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      console.error('[billing] Paystack request timed out')
      return { error: 'TIMEOUT' }
    }
    console.error('[billing] Paystack request errored')
    return { error: 'PROVIDER_FAILED' }
  } finally {
    clearTimeout(timer)
  }
}

function database() {
  return PG_MODE ? null : getDb()
}

function findPayment(db, userId, businessId, reference) {
  if (PG_MODE) {
    return query(
      `SELECT b.* FROM billing_payments b JOIN users u ON u.id = b.user_id
       WHERE b.user_id = $1 AND u.business_id = $2 AND b.reference = $3`,
      [userId, businessId, reference],
    ).then(({ rows }) => rows[0] || null)
  }
  return Promise.resolve(
    db.prepare(
      `SELECT b.* FROM billing_payments b JOIN users u ON u.id = b.user_id
       WHERE b.user_id = ? AND u.business_id = ? AND b.reference = ?`,
    ).get(userId, businessId, reference) || null,
  )
}

function latestPayment(db, userId, businessId) {
  if (PG_MODE) {
    return query(
      `SELECT b.* FROM billing_payments b JOIN users u ON u.id = b.user_id
       WHERE b.user_id = $1 AND u.business_id = $2 ORDER BY b.created_at DESC, b.id DESC LIMIT 1`,
      [userId, businessId],
    ).then(({ rows }) => rows[0] || null)
  }
  return Promise.resolve(
    db.prepare(
      `SELECT b.* FROM billing_payments b JOIN users u ON u.id = b.user_id
       WHERE b.user_id = ? AND u.business_id = ? ORDER BY b.created_at DESC, b.id DESC LIMIT 1`,
    ).get(userId, businessId) || null,
  )
}

function insertPayment(db, payment) {
  const values = [
    payment.id,
    payment.userId,
    payment.plan,
    payment.reference,
    payment.amount,
    payment.currency,
    payment.status,
    payment.createdAt,
  ]
  if (PG_MODE) {
    return query(
      `INSERT INTO billing_payments
       (id, user_id, plan, reference, amount, currency, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      values,
    )
  }
  db.prepare(
    `INSERT INTO billing_payments
     (id, user_id, plan, reference, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(...values)
  return Promise.resolve()
}

function updatePaymentStatus(db, userId, businessId, reference, status, verifiedAt = null) {
  if (PG_MODE) {
    return query(
      `UPDATE billing_payments SET status = $1, verified_at = $2 WHERE reference = $3
       AND user_id = $4 AND EXISTS (SELECT 1 FROM users u WHERE u.id = $4 AND u.business_id = $5)`,
      [status, verifiedAt, reference, userId, businessId],
    )
  }
  db.prepare(
    `UPDATE billing_payments SET status = ?, verified_at = ? WHERE reference = ?
     AND user_id = ? AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.business_id = ?)`,
  ).run(status, verifiedAt, reference, userId, userId, businessId)
  return Promise.resolve()
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function callbackOrigin(req) {
  const configured = process.env.APP_URL
  const requestOrigin = req.headers.origin
  const origin = configured || (
    process.env.NODE_ENV !== 'production'
      && typeof requestOrigin === 'string'
      && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)
      ? requestOrigin
      : ''
  )
  if (!origin) return null

  try {
    const parsed = new URL(origin)
    const localHttp = parsed.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(parsed.hostname)
      && process.env.NODE_ENV !== 'production'
    if ((parsed.protocol !== 'https:' && !localHttp)
      || parsed.origin !== origin.replace(/\/$/, '')) return null
    return parsed.origin
  } catch {
    return null
  }
}

const router = Router()
router.use(requireAuth)

router.get('/billing/status', requireRole(...OWNERS), async (req, res) => {
  const row = await latestPayment(database(), req.user.id, req.user.businessId)
  res.json({
    active: !!row && row.status === 'verified',
    plan: row ? row.plan : null,
    reference: row ? row.reference : null,
    status: row ? row.status : 'none',
  })
})

router.post('/billing/initialize', requireRole(...OWNERS), async (req, res) => {
  const body = req.body || {}
  const plan = body.plan === undefined ? 'monthly' : body.plan
  if (typeof plan !== 'string' || !Object.prototype.hasOwnProperty.call(PLANS, plan)) {
    badRequest(res, { plan: 'Unknown plan.' })
    return
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!validEmail(email)) {
    badRequest(res, { email: 'A valid email address is required.' })
    return
  }
  if (!hasTestSecret()) {
    res.status(503).json({ error: 'Billing is not configured with a Paystack Test Mode key.' })
    return
  }
  const origin = callbackOrigin(req)
  if (!origin) {
    res.status(500).json({ error: 'Billing callback is not configured for this application.' })
    return
  }

  const selectedPlan = PLANS[plan]
  const reference = `qbw-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
  const db = database()
  await insertPayment(db, {
    id: newId('bill'),
    userId: req.user.id,
    plan,
    reference,
    amount: selectedPlan.amount,
    currency: selectedPlan.currency,
    status: 'pending',
    createdAt: nowStamp(),
  })

  const result = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: selectedPlan.amount,
      reference,
      callback_url: `${origin}/?billing=callback`,
      metadata: { plan, user_id: req.user.id },
    },
  })
  if (result.error) {
    await updatePaymentStatus(db, req.user.id, req.user.businessId, reference, 'failed')
    if (result.error === 'NOT_CONFIGURED') {
      res.status(503).json({ error: 'Billing is not configured on the server.' })
      return
    }
    res.status(502).json({ error: 'Billing could not start the payment. Please try again.' })
    return
  }

  let checkoutUrl
  try {
    checkoutUrl = new URL(result.data.authorization_url)
  } catch {
    checkoutUrl = null
  }
  if (!checkoutUrl
    || checkoutUrl.protocol !== 'https:'
    || checkoutUrl.hostname !== 'checkout.paystack.com'
    || checkoutUrl.username !== ''
    || checkoutUrl.password !== '') {
    await updatePaymentStatus(db, req.user.id, req.user.businessId, reference, 'failed')
    res.status(502).json({ error: 'Billing could not start the payment. Please try again.' })
    return
  }
  res.json({ authorization_url: checkoutUrl.toString(), reference, plan })
})

router.get('/billing/verify', requireRole(...OWNERS), async (req, res) => {
  const { reference } = req.query
  if (typeof reference !== 'string' || !/^[A-Za-z0-9.=~-]{1,100}$/.test(reference)) {
    badRequest(res, { reference: 'A valid payment reference is required.' })
    return
  }

  const db = database()
  const payment = await findPayment(db, req.user.id, req.user.businessId, reference)
  if (!payment) {
    res.status(404).json({ error: 'Payment not found.' })
    return
  }
  if (payment.status === 'verified') {
    res.json({ status: 'verified', plan: payment.plan })
    return
  }
  if (!hasTestSecret()) {
    res.status(503).json({ error: 'Billing is not configured with a Paystack Test Mode key.' })
    return
  }

  const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`)
  if (result.error) {
    if (result.error === 'NOT_CONFIGURED') {
      res.status(503).json({ error: 'Billing is not configured on the server.' })
      return
    }
    res.status(502).json({ error: 'Billing could not verify the payment. Please try again.' })
    return
  }

  const transaction = result.data
  const expectedPlan = PLANS[payment.plan]
  const validPayment = expectedPlan
    && payment.status !== 'failed'
    && transaction.status === 'success'
    && transaction.reference === payment.reference
    && transaction.currency === payment.currency
    && Number(transaction.amount) === Number(payment.amount)
    && Number(payment.amount) === expectedPlan.amount
    && payment.currency === expectedPlan.currency

  if (!validPayment) {
    if (transaction.status === 'failed' || transaction.status === 'abandoned') {
      await updatePaymentStatus(db, req.user.id, req.user.businessId, reference, 'failed')
    }
    res.status(409).json({ error: 'Payment was not successful.', status: payment.status })
    return
  }

  await updatePaymentStatus(db, req.user.id, req.user.businessId, reference, 'verified', nowStamp())
  res.json({ status: 'verified', plan: payment.plan })
})

export default router
