import { Router } from 'express'
import { getDb, query, PG_MODE } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { validateRuleConfig, badRequest } from '../validate.js'
import { DEMO_THRESHOLDS } from '../../shared/rules.js'

const MANAGERS = ['Business Owner', 'Authorized Manager']

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

router.get('/rules', async (req, res) => {
  const row = PG_MODE
    ? (await query('SELECT * FROM rule_config WHERE id = 1')).rows[0]
    : getDb().prepare('SELECT * FROM rule_config WHERE id = 1').get()
  res.json(mapRules(row))
})

router.put('/rules', requireRole(...MANAGERS), async (req, res) => {
  const errors = validateRuleConfig(req.body)
  if (errors) {
    badRequest(res, errors)
    return
  }
  if (PG_MODE) {
    const { rows } = await query(
      `UPDATE rule_config SET large_amount = $1, refund_count = $2, refund_window_minutes = $3,
       discount_pct = $4, freq_count = $5, freq_window_minutes = $6 WHERE id = 1 RETURNING *`,
      [
        req.body.LARGE_TRANSACTION_AMOUNT,
        req.body.REPEATED_REFUNDS_COUNT,
        req.body.REPEATED_REFUNDS_WINDOW_MINUTES,
        req.body.EXCESSIVE_DISCOUNT_PCT,
        req.body.FREQUENCY_COUNT,
        req.body.FREQUENCY_WINDOW_MINUTES,
      ],
    )
    res.json(mapRules(rows[0]))
    return
  }
  const db = getDb()
  db.prepare(
    `UPDATE rule_config SET large_amount = ?, refund_count = ?, refund_window_minutes = ?,
     discount_pct = ?, freq_count = ?, freq_window_minutes = ? WHERE id = 1`,
  ).run(
    req.body.LARGE_TRANSACTION_AMOUNT,
    req.body.REPEATED_REFUNDS_COUNT,
    req.body.REPEATED_REFUNDS_WINDOW_MINUTES,
    req.body.EXCESSIVE_DISCOUNT_PCT,
    req.body.FREQUENCY_COUNT,
    req.body.FREQUENCY_WINDOW_MINUTES,
  )
  res.json(mapRules(db.prepare('SELECT * FROM rule_config WHERE id = 1').get()))
})

export default router
