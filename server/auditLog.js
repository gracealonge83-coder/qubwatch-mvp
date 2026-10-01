import { newId } from './ids.js'
import { nowStamp } from './validate.js'
import { query, PG_MODE } from './db.js'

// Shared audit writer. investigationId is null for non-investigation actions
// (transaction creation, alert review); the subject is embedded in the action
// string. Callers must invoke this only after the business write succeeds,
// ideally inside the same db.transaction() so the two stay atomic.
export async function addAudit(db, investigationId, userId, action) {
  if (PG_MODE) {
    await query('INSERT INTO audit (id, investigation_id, user_id, action, date) VALUES ($1, $2, $3, $4, $5)', [
      newId('audit'),
      investigationId,
      userId,
      action,
      new Date(),
    ])
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
