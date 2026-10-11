import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qubwatch-sub-'))
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite')
process.env.DATABASE_URL = ''
process.env.NETLIFY_DB_URL = ''
process.env.PAYSTACK_SECRET_KEY = 'sk_test_subscription_gates'
process.env.APP_URL = 'http://localhost:5173'
process.env.NODE_ENV = 'development'
process.env.GROQ_API_KEY = 'gsk_test_not_used_when_subscription_blocks'

const { app, initialize } = await import('../index.js')
const { getDb, closePool } = await import('../db.js')
const { hashPassword } = await import('../routes/users.js')
const { businessHasActiveSubscription, getBusinessSubscription } = await import('../subscription.js')
const { newId } = await import('../ids.js')
const { nowStamp } = await import('../validate.js')

let server
let baseUrl
const originalFetch = globalThis.fetch

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() || []
  if (raw.length > 0) {
    return raw.map((entry) => entry.split(';')[0]).join('; ')
  }
  const single = res.headers.get('set-cookie')
  return single ? single.split(';')[0] : ''
}

async function api(pathname, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: 'http://localhost:5173',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, cookie: cookieFrom(res) || cookie || '' }
}

function seedBusiness({ businessId, ownerId, ownerName, managerId, managerName, staffId, staffName }) {
  const db = getDb()
  const password = hashPassword('password123')
  db.prepare('INSERT INTO businesses (id, name, owner) VALUES (?, ?, ?)').run(businessId, `${ownerName} Mart`, ownerName)
  db.prepare(
    "INSERT INTO users (id, name, role, business_id, password_hash) VALUES (?, ?, 'Business Owner', ?, ?)",
  ).run(ownerId, ownerName, businessId, password)
  if (managerId) {
    db.prepare(
      "INSERT INTO users (id, name, role, business_id, password_hash) VALUES (?, ?, 'Authorized Manager', ?, ?)",
    ).run(managerId, managerName, businessId, password)
  }
  if (staffId) {
    db.prepare(
      "INSERT INTO users (id, name, role, business_id, password_hash) VALUES (?, ?, 'Staff User', ?, ?)",
    ).run(staffId, staffName, businessId, password)
  }
  db.prepare(
    `INSERT INTO business_rule_config
      (business_id, large_amount, refund_count, refund_window_minutes, discount_pct, freq_count, freq_window_minutes)
     VALUES (?, 500000, 3, 60, 30, 5, 15)`,
  ).run(businessId)
}

function insertPayment({ id, userId, reference, status }) {
  getDb().prepare(
    `INSERT INTO billing_payments
     (id, user_id, plan, reference, amount, currency, status, verified_at, created_at)
     VALUES (?, ?, 'monthly', ?, 500000, 'NGN', ?, ?, ?)`,
  ).run(
    id,
    userId,
    reference,
    status,
    status === 'verified' ? nowStamp() : null,
    nowStamp(),
  )
}

before(async () => {
  await initialize()
  seedBusiness({
    businessId: 'biz-a',
    ownerId: 'user-owner-a',
    ownerName: 'Owner A',
    managerId: 'user-manager-a',
    managerName: 'Manager A',
    staffId: 'user-staff-a',
    staffName: 'Staff A',
  })
  seedBusiness({
    businessId: 'biz-b',
    ownerId: 'user-owner-b',
    ownerName: 'Owner B',
  })
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}/api`
})

after(async () => {
  globalThis.fetch = originalFetch
  await new Promise((resolve) => server.close(resolve))
  try {
    getDb().close()
  } catch {
    // ignore already-closed handles
  }
  await closePool()
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // Windows may keep a brief lock on the temp sqlite file
  }
})

test('free features remain available without a subscription', async () => {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner A', password: 'password123' },
  })
  assert.equal(login.status, 200)
  const cookie = login.cookie

  const me = await api('/auth/me', { cookie })
  assert.equal(me.status, 200)

  const business = await api('/business', { cookie })
  assert.equal(business.status, 200)

  const products = await api('/products', { cookie })
  assert.equal(products.status, 200)

  const transactions = await api('/transactions', { cookie })
  assert.equal(transactions.status, 200)

  const alerts = await api('/alerts', { cookie })
  assert.equal(alerts.status, 200)
  assert.ok(Array.isArray(alerts.data))

  const status = await api('/billing/status', { cookie })
  assert.equal(status.status, 200)
  assert.equal(status.data.active, false)
})

test('starting an investigation is blocked without a verified subscription', async () => {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner A', password: 'password123' },
  })
  const res = await api('/investigations', {
    method: 'POST',
    cookie: login.cookie,
    body: { alertId: 'alert-missing' },
  })
  assert.equal(res.status, 402)
  assert.equal(res.data.code, 'SUBSCRIPTION_REQUIRED')
  assert.match(res.data.error, /subscription/i)
})

test('AI assistant is blocked without a verified subscription', async () => {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Manager A', password: 'password123' },
  })
  const res = await api('/ai', {
    method: 'POST',
    cookie: login.cookie,
    body: { contextType: 'overview', question: 'summarize' },
  })
  assert.equal(res.status, 402)
  assert.equal(res.data.code, 'SUBSCRIPTION_REQUIRED')
})

test('staff users cannot obtain subscription access through billing routes', async () => {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Staff A', password: 'password123' },
  })
  const status = await api('/billing/status', { cookie: login.cookie })
  assert.equal(status.status, 403)

  const initialize = await api('/billing/initialize', {
    method: 'POST',
    cookie: login.cookie,
    body: { plan: 'monthly', email: 'staff@example.com' },
  })
  assert.equal(initialize.status, 403)

  const investigations = await api('/investigations', {
    method: 'POST',
    cookie: login.cookie,
    body: { alertId: 'alert-missing' },
  })
  assert.equal(investigations.status, 403)
})

test('failed payments do not unlock protected features', async () => {
  insertPayment({
    id: newId('bill'),
    userId: 'user-owner-a',
    reference: 'qbw-failed-1',
    status: 'failed',
  })
  assert.equal(await businessHasActiveSubscription('biz-a'), false)

  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner A', password: 'password123' },
  })
  const res = await api('/investigations', {
    method: 'POST',
    cookie: login.cookie,
    body: { alertId: 'alert-missing' },
  })
  assert.equal(res.status, 402)
})

test('verified payment unlocks the business and not another business', async () => {
  insertPayment({
    id: newId('bill'),
    userId: 'user-owner-a',
    reference: 'qbw-verified-a',
    status: 'verified',
  })

  assert.equal(await businessHasActiveSubscription('biz-a'), true)
  assert.equal(await businessHasActiveSubscription('biz-b'), false)

  const managerLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Manager A', password: 'password123' },
  })
  const managerStatus = await api('/billing/status', { cookie: managerLogin.cookie })
  assert.equal(managerStatus.status, 200)
  assert.equal(managerStatus.data.active, true)

  // Subscription gate passes; missing alert yields 404 (not 402).
  const start = await api('/investigations', {
    method: 'POST',
    cookie: managerLogin.cookie,
    body: { alertId: 'alert-missing' },
  })
  assert.equal(start.status, 404)

  const otherLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner B', password: 'password123' },
  })
  const otherStatus = await api('/billing/status', { cookie: otherLogin.cookie })
  assert.equal(otherStatus.data.active, false)
  const otherStart = await api('/investigations', {
    method: 'POST',
    cookie: otherLogin.cookie,
    body: { alertId: 'alert-missing' },
  })
  assert.equal(otherStart.status, 402)
})

function mockPaystack(handler) {
  globalThis.fetch = async (url, options) => {
    const href = String(url)
    if (href.startsWith('https://api.paystack.co/')) {
      return handler(href, options)
    }
    return originalFetch(url, options)
  }
}

test('Paystack verify grants access only after a successful provider confirmation', async () => {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner B', password: 'password123' },
  })
  const cookie = login.cookie
  const reference = 'qbw-verify-success-1'

  insertPayment({
    id: newId('bill'),
    userId: 'user-owner-b',
    reference,
    status: 'pending',
  })

  mockPaystack(async (url) => {
    assert.match(url, /\/transaction\/verify\//)
    return {
      ok: true,
      async json() {
        return {
          status: true,
          data: {
            status: 'success',
            reference,
            amount: 500000,
            currency: 'NGN',
          },
        }
      },
    }
  })

  const before = await getBusinessSubscription('biz-b')
  assert.equal(before.active, false)

  const verify = await api(`/billing/verify?reference=${encodeURIComponent(reference)}`, { cookie })
  assert.equal(verify.status, 200)
  assert.equal(verify.data.status, 'verified')
  assert.equal(await businessHasActiveSubscription('biz-b'), true)

  mockPaystack(async () => ({
    ok: true,
    async json() {
      return {
        status: true,
        data: {
          status: 'failed',
          reference: 'qbw-verify-fail-1',
          amount: 500000,
          currency: 'NGN',
        },
      }
    },
  }))

  insertPayment({
    id: newId('bill'),
    userId: 'user-owner-b',
    reference: 'qbw-verify-fail-1',
    status: 'pending',
  })
  const failedVerify = await api('/billing/verify?reference=qbw-verify-fail-1', { cookie })
  assert.equal(failedVerify.status, 409)
  const failedRow = getDb().prepare('SELECT status FROM billing_payments WHERE reference = ?').get('qbw-verify-fail-1')
  assert.equal(failedRow.status, 'failed')
  globalThis.fetch = originalFetch
})

test('browser callback alone cannot unlock another business payment', async () => {
  globalThis.fetch = originalFetch
  const login = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'Owner B', password: 'password123' },
  })
  const stolen = await api('/billing/verify?reference=qbw-verified-a', { cookie: login.cookie })
  assert.equal(stolen.status, 404)
})
