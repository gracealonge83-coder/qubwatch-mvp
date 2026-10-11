import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qubwatch-archive-'))
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite')
process.env.DATABASE_URL = ''
process.env.NETLIFY_DB_URL = ''
process.env.NODE_ENV = 'development'

const { app, initialize } = await import('../index.js')
const { getDb, closePool } = await import('../db.js')
const { hashPassword } = await import('../routes/users.js')
const { nowStamp } = await import('../validate.js')
const { newId } = await import('../ids.js')

let server
let baseUrl

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

async function loginAs(identifier) {
  const res = await api('/auth/login', {
    method: 'POST',
    body: { identifier, password: 'password123' },
  })
  assert.equal(res.status, 200)
  return res.cookie
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

function insertSnapshot(alertId, businessId, type = 'Large transaction') {
  getDb().prepare(
    `INSERT INTO alert_snapshots
      (alert_id, business_id, alert_type, severity, message, date, generated_at,
       related_transaction_ids, related_product_ids, rule_values, evidence)
     VALUES (?, ?, ?, 'High', ?, ?, ?, '[]', '[]', '{}', ?)`,
  ).run(alertId, businessId, type, `${type} needs review`, nowStamp(), nowStamp(), JSON.stringify({ products: [], transactions: [] }))
}

function insertInvestigation({ id, alertId, investigatorId, status }) {
  getDb().prepare(
    `INSERT INTO investigations
      (id, alert_id, alert_type, alert_severity, investigator_id, status,
       related_transaction_ids, related_product_ids, notes, finding, finding_other,
       resolution_notes, resolved_by, created_at, resolved_at)
     VALUES (?, ?, 'Large transaction', 'High', ?, ?, '[]', '[]', '[]', '', '', '', NULL, ?, '')`,
  ).run(id, alertId, investigatorId, status, nowStamp())
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
  insertSnapshot('alert-1', 'biz-a')
  insertSnapshot('alert-2', 'biz-a', 'Repeated refunds')
  insertSnapshot('alert-b1', 'biz-b')
  insertInvestigation({ id: 'inv-open', alertId: 'alert-1', investigatorId: 'user-owner-a', status: 'Open' })
  insertInvestigation({ id: 'inv-done', alertId: 'alert-2', investigatorId: 'user-manager-a', status: 'Resolved' })
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}/api`
})

after(async () => {
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

test('active alert lists exclude archived alerts; archived view returns them', async () => {
  const cookie = await loginAs('Manager A')
  const active = await api('/alerts', { cookie })
  assert.equal(active.status, 200)
  assert.ok(active.data.some((a) => a.id === 'alert-1'))

  const archived = await api('/alerts?archived=true', { cookie })
  assert.equal(archived.status, 200)
  assert.deepEqual(archived.data, [])

  const done = await api('/alerts/alert-2/archive', { method: 'POST', cookie })
  assert.equal(done.status, 200)
  assert.equal(done.data.id, 'alert-2')
  assert.ok(done.data.archivedAt)
  assert.equal(done.data.archivedBy, 'user-manager-a')

  const activeAfter = await api('/alerts', { cookie })
  assert.ok(!activeAfter.data.some((a) => a.id === 'alert-2'))
  assert.ok(activeAfter.data.some((a) => a.id === 'alert-1'))

  const archivedAfter = await api('/alerts?archived=true', { cookie })
  assert.equal(archivedAfter.data.length, 1)
  assert.equal(archivedAfter.data[0].id, 'alert-2')

  const audit = getDb().prepare("SELECT * FROM audit WHERE action = 'Alert archived: alert-2'").get()
  assert.ok(audit)
  assert.equal(audit.user_id, 'user-manager-a')

  const restored = await api('/alerts/alert-2/restore', { method: 'POST', cookie })
  assert.equal(restored.status, 200)
  assert.equal(restored.data.archivedAt, '')

  const activeFinal = await api('/alerts', { cookie })
  assert.ok(activeFinal.data.some((a) => a.id === 'alert-2'))
})

test('archiving an already-archived alert, or restoring an active one, is a 409', async () => {
  const cookie = await loginAs('Owner A')
  assert.equal((await api('/alerts/alert-1/archive', { method: 'POST', cookie })).status, 200)
  assert.equal((await api('/alerts/alert-1/archive', { method: 'POST', cookie })).status, 409)
  assert.equal((await api('/alerts/alert-2/restore', { method: 'POST', cookie })).status, 409)
  assert.equal((await api('/alerts/alert-missing/archive', { method: 'POST', cookie })).status, 404)
  assert.equal((await api('/alerts/alert-1/restore', { method: 'POST', cookie })).status, 200)
})

test('only completed investigations can be archived; evidence is retained', async () => {
  const cookie = await loginAs('Owner A')
  assert.equal((await api('/investigations/inv-open/archive', { method: 'POST', cookie })).status, 409)

  const done = await api('/investigations/inv-done/archive', { method: 'POST', cookie })
  assert.equal(done.status, 200)
  assert.ok(done.data.archivedAt)
  assert.deepEqual(done.data.relatedTransactionIds, [])
  assert.equal(done.data.status, 'Resolved')

  const active = await api('/investigations', { cookie })
  assert.ok(!active.data.some((i) => i.id === 'inv-done'))
  assert.ok(active.data.some((i) => i.id === 'inv-open'))

  const archived = await api('/investigations?archived=true', { cookie })
  assert.equal(archived.data.length, 1)
  assert.equal(archived.data[0].id, 'inv-done')
  assert.deepEqual(archived.data[0].notes, [])

  const audit = getDb().prepare("SELECT * FROM audit WHERE action = 'Investigation archived' AND investigation_id = 'inv-done'").get()
  assert.ok(audit)

  const restored = await api('/investigations/inv-done/restore', { method: 'POST', cookie })
  assert.equal(restored.status, 200)
  assert.equal(restored.data.status, 'Resolved')
  assert.equal(restored.data.archivedAt, '')
})

test('staff cannot archive or view archived records', async () => {
  const cookie = await loginAs('Staff A')
  assert.equal((await api('/alerts/alert-1/archive', { method: 'POST', cookie })).status, 403)
  assert.equal((await api('/investigations/inv-done/archive', { method: 'POST', cookie })).status, 403)
  const archivedAlerts = await api('/alerts?archived=true', { cookie })
  assert.equal(archivedAlerts.status, 200)
  assert.deepEqual(archivedAlerts.data, [])
  const archivedInv = await api('/investigations?archived=true', { cookie })
  assert.equal(archivedInv.status, 200)
  assert.deepEqual(archivedInv.data, [])
})

test('archived records stay isolated per business', async () => {
  const cookieA = await loginAs('Owner A')
  await api('/alerts/alert-1/archive', { method: 'POST', cookie: cookieA })

  const cookieB = await loginAs('Owner B')
  assert.equal((await api('/alerts/alert-1/archive', { method: 'POST', cookie: cookieB })).status, 404)
  assert.equal((await api('/alerts/alert-1/restore', { method: 'POST', cookie: cookieB })).status, 404)
  const archivedB = await api('/alerts?archived=true', { cookie: cookieB })
  assert.deepEqual(archivedB.data, [])
  const invB = await api('/investigations?archived=true', { cookie: cookieB })
  assert.deepEqual(invB.data, [])

  await api('/alerts/alert-1/restore', { method: 'POST', cookie: cookieA })
})

test('unauthenticated archive requests are rejected', async () => {
  assert.equal((await api('/alerts/alert-1/archive', { method: 'POST' })).status, 401)
  assert.equal((await api('/investigations/inv-done/restore', { method: 'POST' })).status, 401)
})
