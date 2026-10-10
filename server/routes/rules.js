import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { validateRuleConfig, badRequest } from '../validate.js'
import { DEMO_THRESHOLDS } from '../../shared/rules.js'

function mapRules(row) {
  const source = row || {}
  const defaults = DEMO_THRESHOLDS
  return {
    LARGE_TRANSACTION_AMOUNT: Number(source.large_amount ?? defaults.LARGE_TRANSACTION_AMOUNT),
    REPEATED_REFUNDS_COUNT: Number(source.refund_count ?? defaults.REPEATED_REFUNDS_COUNT),
    REPEATED_REFUNDS_WINDOW_MINUTES: Number(
      source.refund_window_minutes ?? defaults.REPEATED_REFUNDS_WINDOW_MINUTES,
    ),
    EXCESSIVE_DISCOUNT_PCT: Number(source.discount_pct ?? defaults.EXCESSIVE_DISCOUNT_PCT),
    FREQUENCY_COUNT: Number(source.freq_count ?? defaults.FREQUENCY_COUNT),
    FREQUENCY_WINDOW_MINUTES: Number(source.freq_window_minutes ?? defaults.FREQUENCY_WINDOW_MINUTES),
  }
}

const router = Router()
router.use(requireAuth)

// Business identity always comes from the authenticated session
// (req.user.businessId). No client-supplied business_id is read anywhere
// in this router, so requests cannot address another business's rules.
const RULE_COLUMNS = `business_id, large_amount, refund_count, refund_window_minutes,
  discount_pct, freq_count, freq_window_minutes`

// Returns the caller's business row, inserting the shared defaults only
// when the business has no row yet. Existing customized values are never
// overwritten here.
async function ensureRuleConfig(db, businessId) {
  const d = DEMO_THRESHOLDS
  const values = [
    businessId,
    d.LARGE_TRANSACTION_AMOUNT,
    d.REPEATED_REFUNDS_COUNT,
    d.REPEATED_REFUNDS_WINDOW_MINUTES,
    d.EXCESSIVE_DISCOUNT_PCT,
    d.FREQUENCY_COUNT,
    d.FREQUENCY_WINDOW_MINUTES,
  ]
  if (PG_MODE) {
    await query(
      `INSERT INTO business_rule_config (${RULE_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (business_id) DO NOTHING`,
      values,
    )
    return (await query('SELECT * FROM business_rule_config WHERE business_id = $1', [businessId])).rows[0]
  }
  db.prepare(
    `INSERT INTO business_rule_config (${RULE_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id) DO NOTHING`,
  ).run(...values)
  return db.prepare('SELECT * FROM business_rule_config WHERE business_id = ?').get(businessId)
}

router.get('/rules', async (req, res) => {
  const row = await ensureRuleConfig(PG_MODE ? null : getDb(), req.user.businessId)
  res.json(mapRules(row))
})

router.put('/rules', requireRole('Business Owner'), async (req, res) => {
  const errors = validateRuleConfig(req.body)
  if (errors) {
    badRequest(res, errors)
    return
  }
  const values = [
    req.user.businessId,
    req.body.LARGE_TRANSACTION_AMOUNT,
    req.body.REPEATED_REFUNDS_COUNT,
    req.body.REPEATED_REFUNDS_WINDOW_MINUTES,
    req.body.EXCESSIVE_DISCOUNT_PCT,
    req.body.FREQUENCY_COUNT,
    req.body.FREQUENCY_WINDOW_MINUTES,
  ]
  const upsert = (placeholders) => `INSERT INTO business_rule_config (${RULE_COLUMNS})
    VALUES (${placeholders})
    ON CONFLICT (business_id) DO UPDATE SET
      large_amount = excluded.large_amount,
      refund_count = excluded.refund_count,
      refund_window_minutes = excluded.refund_window_minutes,
      discount_pct = excluded.discount_pct,
      freq_count = excluded.freq_count,
      freq_window_minutes = excluded.freq_window_minutes`
  if (PG_MODE) {
    const { rows } = await query(`${upsert('$1, $2, $3, $4, $5, $6, $7')} RETURNING *`, values)
    res.json(mapRules(rows[0]))
    return
  }
  const db = getDb()
  db.prepare(upsert('?, ?, ?, ?, ?, ?, ?')).run(...values)
  res.json(mapRules(db.prepare('SELECT * FROM business_rule_config WHERE business_id = ?').get(req.user.businessId)))
})

export default router
