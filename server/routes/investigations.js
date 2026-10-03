import { Router } from 'express'
import { getDb, query, withTransaction, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { FINDINGS, badRequest, collect, requiredText, nowStamp } from '../validate.js'
import { newId } from '../ids.js'
import { deriveAlerts } from './alerts.js'
import { addAudit } from '../auditLog.js'
import { formatWireDate } from '../dates.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']
const REVIEWERS = [...MANAGERS, 'Administrator']
const OPEN_STATES = ['Open', 'Under Investigation']

function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapInvestigation(row) {
  if (!row) return null
  return {
    id: row.id,
    alertId: row.alert_id,
    alertType: row.alert_type,
    alertSeverity: row.alert_severity,
    investigatorId: row.investigator_id,
    status: row.status,
    relatedTransactionIds: parseJsonArray(row.related_transaction_ids),
    relatedProductIds: parseJsonArray(row.related_product_ids),
    notes: parseJsonArray(row.notes),
    finding: row.finding,
    findingOther: row.finding_other,
    resolutionNotes: row.resolution_notes,
    resolvedById: row.resolved_by,
    createdAt: formatWireDate(row.created_at),
    resolvedAt: formatWireDate(row.resolved_at) || '',
  }
}

const router = Router()
router.use(requireAuth)

router.get('/investigations', async (req, res) => {
  if (!REVIEWERS.includes(req.user.role)) {
    res.json([])
    return
  }
  const rows = PG_MODE
    ? (await query('SELECT * FROM investigations ORDER BY created_at, id')).rows
    : getDb().prepare('SELECT * FROM investigations ORDER BY rowid').all()
  res.json(rows.map(mapInvestigation))
})

router.get('/investigations/:id', requireRole(...REVIEWERS), async (req, res) => {
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : getDb().prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  res.json(mapInvestigation(row))
})

router.post('/investigations', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  if (typeof body.alertId !== 'string' || body.alertId === '') {
    badRequest(res, { alertId: 'Alert is required.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const alert = (await deriveAlerts(db)).find((a) => a.id === body.alertId)
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  if (alert.status !== 'New' && alert.status !== 'Under Review') {
    res.status(409).json({ error: 'Investigations start from New or Under Review alerts.' })
    return
  }
  const existing = PG_MODE
    ? (await query("SELECT id FROM investigations WHERE alert_id = $1 AND status != 'Closed'", [body.alertId])).rows[0]
    : db
      .prepare("SELECT id FROM investigations WHERE alert_id = ? AND status != 'Closed'")
      .get(body.alertId)
  if (existing) {
    res.status(409).json({ error: 'An open investigation already exists for this alert.', id: existing.id })
    return
  }
  const id = newId('inv')
  const date = nowStamp()
  if (PG_MODE) {
    let created = null
    await withTransaction(async (t) => {
      const inserted = await t.query(
        `INSERT INTO investigations (id, alert_id, alert_type, alert_severity, investigator_id, status,
         related_transaction_ids, related_product_ids, notes, finding, finding_other,
         resolution_notes, resolved_by, created_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, 'Open', $6, $7, '[]'::jsonb, '', '', '', NULL, $8, NULL) RETURNING *`,
        [
          id,
          body.alertId,
          alert.type,
          alert.severity,
          req.user.id,
          alert.relatedTransactionIds,
          alert.relatedProductIds,
          date,
        ],
      )
      created = inserted.rows[0]
      await t.query(
        `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
         VALUES ($1, 'Investigating', $2, $3)
         ON CONFLICT(alert_id) DO UPDATE SET status = 'Investigating', updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [body.alertId, req.user.id, date],
      )
      await addAudit(t, id, req.user.id, 'Investigation opened')
    })
    res.status(201).json(mapInvestigation(created))
    return
  }
  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO investigations (id, alert_id, alert_type, alert_severity, investigator_id, status,
       related_transaction_ids, related_product_ids, notes, finding, finding_other,
       resolution_notes, resolved_by, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, '[]', '', '', '', NULL, ?, '')`,
    ).run(
      id,
      body.alertId,
      alert.type,
      alert.severity,
      req.user.id,
      JSON.stringify(alert.relatedTransactionIds),
      JSON.stringify(alert.relatedProductIds),
      date,
    )
    db.prepare(
      `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
       VALUES (?, 'Investigating', ?, ?)
       ON CONFLICT(alert_id) DO UPDATE SET status = 'Investigating', updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).run(body.alertId, req.user.id, date)
    addAudit(db, id, req.user.id, 'Investigation opened')
  })
  create()
  res.status(201).json(mapInvestigation(db.prepare('SELECT * FROM investigations WHERE id = ?').get(id)))
})

router.post('/investigations/:id/notes', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  if (requiredText(body.content)) {
    badRequest(res, { content: requiredText(body.content) })
    return
  }
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const inv = mapInvestigation(row)
  if (!OPEN_STATES.includes(inv.status)) {
    res.status(409).json({ error: 'Notes can only be added to open investigations.' })
    return
  }
  const note = {
    id: newId('note'),
    authorId: req.user.id,
    content: body.content.trim(),
    date: nowStamp(),
  }
  if (PG_MODE) {
    await withTransaction(async (t) => {
      const next = [...inv.notes, note]
      await t.query('UPDATE investigations SET notes = $1, status = $2 WHERE id = $3', [
        next,
        inv.status === 'Open' ? 'Under Investigation' : inv.status,
        inv.id,
      ])
      await addAudit(t, inv.id, req.user.id, 'Note added')
    })
    res.status(201).json(note)
    return
  }
  const update = db.transaction(() => {
    const next = [...inv.notes, note]
    db.prepare('UPDATE investigations SET notes = ?, status = ? WHERE id = ?').run(
      JSON.stringify(next),
      inv.status === 'Open' ? 'Under Investigation' : inv.status,
      inv.id,
    )
    addAudit(db, inv.id, req.user.id, 'Note added')
  })
  update()
  res.status(201).json(note)
})

router.patch('/investigations/:id', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  if (body.investigatorId === undefined) {
    badRequest(res, { investigatorId: 'Investigator is required.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const investigator = PG_MODE
    ? (await query('SELECT id FROM users WHERE id = $1', [body.investigatorId])).rows[0]
    : db.prepare('SELECT id FROM users WHERE id = ?').get(body.investigatorId)
  if (!investigator) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (PG_MODE) {
    const { rows } = await query('UPDATE investigations SET investigator_id = $1 WHERE id = $2 RETURNING *', [
      body.investigatorId,
      row.id,
    ])
    res.json(mapInvestigation(rows[0]))
    return
  }
  db.prepare('UPDATE investigations SET investigator_id = ? WHERE id = ?').run(body.investigatorId, row.id)
  res.json(mapInvestigation(db.prepare('SELECT * FROM investigations WHERE id = ?').get(row.id)))
})

router.post('/investigations/:id/finding', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const errors = collect({
    finding: FINDINGS.includes(body.finding) ? null : 'Invalid finding.',
    ...(body.finding === 'Other'
      ? { findingOther: requiredText(body.findingOther) }
      : {}),
  })
  if (errors) {
    badRequest(res, errors)
    return
  }
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const inv = mapInvestigation(row)
  if (!OPEN_STATES.includes(inv.status)) {
    res.status(409).json({ error: 'Findings can only be recorded on open investigations.' })
    return
  }
  if (PG_MODE) {
    const { rows } = await withTransaction(async (t) => {
      const updated = await t.query('UPDATE investigations SET finding = $1, finding_other = $2 WHERE id = $3 RETURNING *', [
        body.finding,
        body.finding === 'Other' ? body.findingOther.trim() : '',
        inv.id,
      ])
      await addAudit(t, inv.id, req.user.id, 'Finding recorded')
      return updated
    })
    res.json(mapInvestigation(rows[0]))
    return
  }
  const update = db.transaction(() => {
    db.prepare('UPDATE investigations SET finding = ?, finding_other = ? WHERE id = ?').run(
      body.finding,
      body.finding === 'Other' ? body.findingOther.trim() : '',
      inv.id,
    )
    addAudit(db, inv.id, req.user.id, 'Finding recorded')
  })
  update()
  res.json(mapInvestigation(db.prepare('SELECT * FROM investigations WHERE id = ?').get(inv.id)))
})

router.post('/investigations/:id/resolve', requireRole(...MANAGERS), async (req, res) => {
  const body = req.body || {}
  const resolutionNotes = typeof body.resolutionNotes === 'string' ? body.resolutionNotes.trim() : ''
  if (resolutionNotes === '') {
    badRequest(res, { resolutionNotes: 'Resolution notes are required.' })
    return
  }
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const inv = mapInvestigation(row)
  if (!OPEN_STATES.includes(inv.status) || !inv.finding) {
    res.status(409).json({ error: 'Resolution needs a recorded finding on an open investigation.' })
    return
  }
  const date = nowStamp()
  if (PG_MODE) {
    const { rows } = await withTransaction(async (t) => {
      const updated = await t.query(
        'UPDATE investigations SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = $4 WHERE id = $5 RETURNING *',
        ['Resolved', resolutionNotes, req.user.id, date, inv.id],
      )
      await t.query(
        `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
         VALUES ($1, 'Resolved', $2, $3)
         ON CONFLICT(alert_id) DO UPDATE SET status = 'Resolved', updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [inv.alertId, req.user.id, date],
      )
      await addAudit(t, inv.id, req.user.id, 'Investigation resolved')
      return updated
    })
    res.json(mapInvestigation(rows[0]))
    return
  }
  const update = db.transaction(() => {
    db.prepare(
      'UPDATE investigations SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
    ).run('Resolved', resolutionNotes, req.user.id, date, inv.id)
    db.prepare(
      `INSERT INTO alert_statuses (alert_id, status, updated_by, updated_at)
       VALUES (?, 'Resolved', ?, ?)
       ON CONFLICT(alert_id) DO UPDATE SET status = 'Resolved', updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).run(inv.alertId, req.user.id, date)
    addAudit(db, inv.id, req.user.id, 'Investigation resolved')
  })
  update()
  res.json(mapInvestigation(db.prepare('SELECT * FROM investigations WHERE id = ?').get(inv.id)))
})

router.post('/investigations/:id/close', requireRole(...MANAGERS), async (req, res) => {
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const inv = mapInvestigation(row)
  if (inv.status !== 'Resolved') {
    res.status(409).json({ error: 'Only resolved investigations can be closed.' })
    return
  }
  if (PG_MODE) {
    const { rows } = await withTransaction(async (t) => {
      const updated = await t.query('UPDATE investigations SET status = $1 WHERE id = $2 RETURNING *', [
        'Closed',
        inv.id,
      ])
      await addAudit(t, inv.id, req.user.id, 'Investigation closed')
      return updated
    })
    res.json(mapInvestigation(rows[0]))
    return
  }
  const update = db.transaction(() => {
    db.prepare('UPDATE investigations SET status = ? WHERE id = ?').run('Closed', inv.id)
    addAudit(db, inv.id, req.user.id, 'Investigation closed')
  })
  update()
  res.json(mapInvestigation(db.prepare('SELECT * FROM investigations WHERE id = ?').get(inv.id)))
})

router.delete('/investigations/:id', requireRole(...MANAGERS), async (req, res) => {
  const db = PG_MODE ? null : getDb()
  const row = PG_MODE
    ? (await query('SELECT * FROM investigations WHERE id = $1', [req.params.id])).rows[0]
    : db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  const inv = mapInvestigation(row)
  if (inv.status !== 'Resolved' && inv.status !== 'Closed') {
    res.status(409).json({ error: 'Only resolved or closed investigations can be deleted.' })
    return
  }
  if (PG_MODE) {
    await withTransaction(async (t) => {
      await t.query('DELETE FROM audit WHERE investigation_id = $1', [inv.id])
      await t.query('DELETE FROM investigations WHERE id = $1', [inv.id])
    })
    res.json({ ok: true, id: inv.id })
    return
  }
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM audit WHERE investigation_id = ?').run(inv.id)
    db.prepare('DELETE FROM investigations WHERE id = ?').run(inv.id)
  })
  remove()
  res.json({ ok: true, id: inv.id })
})

export default router
