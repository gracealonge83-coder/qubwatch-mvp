import { getDb, query, PG_MODE } from './db.js'

// Business-scoped subscription access for Investigations and AI Assistant.
// A verified Paystack Test Mode payment by any user in the business unlocks
// those features for authorized roles in that business only.

export async function getBusinessSubscription(businessId) {
  if (!businessId) {
    return { active: false, plan: null, reference: null, status: 'none' }
  }
  const row = PG_MODE
    ? (await query(
      `SELECT b.plan, b.reference, b.status FROM billing_payments b
       JOIN users u ON u.id = b.user_id
       WHERE u.business_id = $1
       ORDER BY CASE b.status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                b.created_at DESC, b.id DESC
       LIMIT 1`,
      [businessId],
    )).rows[0]
    : getDb().prepare(
      `SELECT b.plan, b.reference, b.status FROM billing_payments b
       JOIN users u ON u.id = b.user_id
       WHERE u.business_id = ?
       ORDER BY CASE b.status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                b.created_at DESC, b.id DESC
       LIMIT 1`,
    ).get(businessId)

  if (!row) {
    return { active: false, plan: null, reference: null, status: 'none' }
  }
  return {
    active: row.status === 'verified',
    plan: row.plan,
    reference: row.reference,
    status: row.status,
  }
}

export async function businessHasActiveSubscription(businessId) {
  const current = await getBusinessSubscription(businessId)
  return current.active
}

export function requireActiveSubscription() {
  return async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    try {
      const active = await businessHasActiveSubscription(req.user.businessId)
      if (!active) {
        res.status(402).json({
          error: 'An active subscription is required for Investigations and the AI Assistant.',
          code: 'SUBSCRIPTION_REQUIRED',
        })
        return
      }
      next()
    } catch (error) {
      console.error('[subscription] status check failed')
      res.status(500).json({ error: 'Could not verify subscription status.' })
    }
  }
}
