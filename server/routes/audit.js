import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { formatWireDate } from '../dates.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

const router = Router()
router.use(requireAuth)

router.get('/audit', requireRole(...MANAGERS), async (req, res) => {
  let rows
  if (PG_MODE) {
    rows = req.query.investigationId
      ? (await query('SELECT * FROM audit WHERE investigation_id = $1 ORDER BY created_at, id', [req.query.investigationId])).rows
      : (await query('SELECT * FROM audit ORDER BY created_at, id')).rows
  } else {
    const db = getDb()
    if (req.query.investigationId) {
      rows = db
        .prepare('SELECT * FROM audit WHERE investigation_id = ? ORDER BY rowid')
        .all(req.query.investigationId)
    } else {
      rows = db.prepare('SELECT * FROM audit ORDER BY rowid').all()
    }
  }
  res.json(
    rows.map((r) => ({
      id: r.id,
      investigationId: r.investigation_id,
      userId: r.user_id,
      action: r.action,
      date: formatWireDate(r.date),
    })),
  )
})

export default router
