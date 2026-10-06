import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { formatWireDate } from '../dates.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

const router = Router()
router.use(requireAuth)

router.get('/audit', requireRole(...MANAGERS), async (req, res) => {
  const businessId = req.user.businessId
  let rows
  if (req.query.investigationId) {
    const owned = PG_MODE
      ? (await query(
        `SELECT i.id FROM investigations i JOIN users u ON u.id = i.investigator_id
         WHERE i.id = $1 AND u.business_id = $2`,
        [req.query.investigationId, businessId],
      )).rows[0]
      : getDb().prepare(
        `SELECT i.id FROM investigations i JOIN users u ON u.id = i.investigator_id
         WHERE i.id = ? AND u.business_id = ?`,
      ).get(req.query.investigationId, businessId)
    if (!owned) {
      res.status(404).json({ error: 'Investigation not found' })
      return
    }
    rows = PG_MODE
      ? (await query(
        `SELECT a.* FROM audit a JOIN users u ON u.id = a.user_id
         WHERE a.investigation_id = $1 AND u.business_id = $2 ORDER BY a.created_at, a.id`,
        [req.query.investigationId, businessId],
      )).rows
      : getDb().prepare(
        `SELECT a.* FROM audit a JOIN users u ON u.id = a.user_id
         WHERE a.investigation_id = ? AND u.business_id = ? ORDER BY a.rowid`,
      ).all(req.query.investigationId, businessId)
  } else {
    rows = PG_MODE
      ? (await query(
        `SELECT a.* FROM audit a JOIN users u ON u.id = a.user_id
         WHERE u.business_id = $1 ORDER BY a.created_at, a.id`,
        [businessId],
      )).rows
      : getDb().prepare(
        `SELECT a.* FROM audit a JOIN users u ON u.id = a.user_id
         WHERE u.business_id = ? ORDER BY a.rowid`,
      ).all(businessId)
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
