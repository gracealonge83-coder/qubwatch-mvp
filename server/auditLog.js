import { newId } from './ids.js'
import { nowStamp } from './validate.js'
import { query, PG_MODE } from './db.js'

// Shared audit writer. investigationId is null for non-investigation actions
// (transaction creation, alert review); the subject is embedded in the action
// string. Callers must invoke this only after the business write succeeds,
// ideally inside the same db.transaction() so the two stay atomic.
export async function addAudit(db, investigationId, userId, action) {
  if (PG_MODE) {
    const sql = 'INSERT INTO audit (id, investigation_id, user_id, action, date) VALUES ($1, $2, $3, $4, $5)'
    const params = [
      newId('audit'),
      investigationId,
      userId,
      action,
      new Date(),
    ]
    // When called inside withTransaction(), db is that transaction's client.
    // The INSERT must run through it so business write and audit row commit
    // or roll back together; the global pool must not be used in that case.
    if (db && typeof db.query === 'function') {
      await db.query(sql, params)
      return
    }
    await query(sql, params)
    return
  }
  db.prepare('INSERT INTO audit (id, investigation_id, user_id, action, date) VALUES (?, ?, ?, ?, ?)').run(
    newId('audit'),
    investigationId,
    userId,
    action,
    nowStamp(),
  )
}
