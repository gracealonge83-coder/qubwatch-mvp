// Stage 3 monitoring rules (PRD Sections 16-17). Rule-based only. No ML.
// Alerts flag activity that may require attention. They do not establish
// fraud, theft, or wrongdoing.

// PRD Section 17 gives exact demo values for some rules. Where the PRD does
// not fix a number, the value below is a configurable demonstration value
// (not a PRD requirement) and may be adjusted as the product is tested.
export const DEMO_THRESHOLDS = {
  // PRD Section 17: "Transaction amount is greater than 500,000."
  LARGE_TRANSACTION_AMOUNT: 500000,
  // PRD Section 17: "More than 3 refunds occur within 2 hours."
  REPEATED_REFUNDS_COUNT: 3,
  REPEATED_REFUNDS_WINDOW_MINUTES: 120,
  // Demonstration value: the PRD only says discounts exceeding "the defined
  // percentage threshold". Approved initial demo value: 20%.
  EXCESSIVE_DISCOUNT_PCT: 20,
  // Demonstration values: the PRD only says activity exceeding "the defined
  // frequency threshold within a specified period". Approved initial demo
  // values: more than 5 transactions within 60 minutes.
  FREQUENCY_COUNT: 5,
  FREQUENCY_WINDOW_MINUTES: 60,
}

function parseDate(value) {
  return new Date(String(value).replace(' ', 'T')).getTime()
}

function largeTransactionRule(transactions, thresholds = DEMO_THRESHOLDS) {
  return transactions
    .filter((t) => t.amount > thresholds.LARGE_TRANSACTION_AMOUNT)
    .map((t) => ({
      id: `large-${t.id}`,
      type: 'Large transaction',
      severity: 'High',
      message: `Transaction ${t.id} of ₦${t.amount.toLocaleString()} is above ₦${thresholds.LARGE_TRANSACTION_AMOUNT.toLocaleString()} and may require attention.`,
      date: t.date,
      relatedTransactionIds: [t.id],
      relatedProductIds: [t.productId],
      ruleValues: { largeTransactionAmount: thresholds.LARGE_TRANSACTION_AMOUNT },
    }))
}

function windowClusters(sorted, windowMinutes, moreThanCount) {
  const clusters = []
  let i = 0
  while (i < sorted.length) {
    const start = parseDate(sorted[i].date)
    const group = [sorted[i]]
    let j = i + 1
    while (j < sorted.length && parseDate(sorted[j].date) - start <= windowMinutes * 60 * 1000) {
      group.push(sorted[j])
      j += 1
    }
    if (group.length > moreThanCount) {
      clusters.push(group)
      i = j
    } else {
      i += 1
    }
  }
  return clusters
}

function repeatedRefundsRule(transactions, thresholds = DEMO_THRESHOLDS) {
  const refunds = transactions
    .filter((t) => t.type === 'refund')
    .sort((a, b) => parseDate(a.date) - parseDate(b.date))
  return windowClusters(
    refunds,
    thresholds.REPEATED_REFUNDS_WINDOW_MINUTES,
    thresholds.REPEATED_REFUNDS_COUNT,
  ).map((group) => ({
    id: `refunds-${group[0].id}`,
    type: 'Repeated refunds',
    severity: 'High',
    message: `${group.length} refunds occurred within ${thresholds.REPEATED_REFUNDS_WINDOW_MINUTES / 60} hours and may require attention.`,
    date: group[group.length - 1].date,
    relatedTransactionIds: group.map((t) => t.id),
    relatedProductIds: [...new Set(group.map((t) => t.productId))],
    ruleValues: {
      refundCount: thresholds.REPEATED_REFUNDS_COUNT,
      refundWindowMinutes: thresholds.REPEATED_REFUNDS_WINDOW_MINUTES,
    },
  }))
}

function excessiveDiscountRule(transactions, thresholds = DEMO_THRESHOLDS) {
  return transactions
    .filter((t) => Number(t.discount) >= thresholds.EXCESSIVE_DISCOUNT_PCT)
    .map((t) => ({
      id: `discount-${t.id}`,
      type: 'High discount',
      severity: 'Medium',
      message: `Transaction ${t.id} has a ${t.discount}% discount (threshold ${thresholds.EXCESSIVE_DISCOUNT_PCT}%) and may require attention.`,
      date: t.date,
      relatedTransactionIds: [t.id],
      relatedProductIds: [t.productId],
      ruleValues: { excessiveDiscountPct: thresholds.EXCESSIVE_DISCOUNT_PCT },
    }))
}

function frequencyRule(transactions, thresholds = DEMO_THRESHOLDS) {
  const sorted = [...transactions].sort((a, b) => parseDate(a.date) - parseDate(b.date))
  return windowClusters(
    sorted,
    thresholds.FREQUENCY_WINDOW_MINUTES,
    thresholds.FREQUENCY_COUNT,
  ).map((group) => ({
    id: `freq-${group[0].id}`,
    type: 'Unusual frequency',
    severity: 'Medium',
    message: `${group.length} transactions within ${thresholds.FREQUENCY_WINDOW_MINUTES} minutes may require attention.`,
    date: group[group.length - 1].date,
    relatedTransactionIds: group.map((t) => t.id),
    relatedProductIds: [...new Set(group.map((t) => t.productId))],
    ruleValues: {
      frequencyCount: thresholds.FREQUENCY_COUNT,
      frequencyWindowMinutes: thresholds.FREQUENCY_WINDOW_MINUTES,
    },
  }))
}

function inventoryRule(products) {
  return products
    .filter((p) => p.stock !== p.expectedStock)
    .map((p) => ({
      id: `inventory-${p.id}`,
      type: 'Inventory discrepancy',
      severity: 'Low',
      message: `${p.name} recorded stock (${p.stock}) differs from expected stock (${p.expectedStock}) and may require attention.`,
      date: 'Current stock',
      relatedTransactionIds: [],
      relatedProductIds: [p.id],
      ruleValues: { comparison: 'stock != expectedStock' },
    }))
}

// Runs all five rules and returns a combined alert list.
export function evaluateRules(products, transactions, thresholds = DEMO_THRESHOLDS) {
  return [
    ...largeTransactionRule(transactions, thresholds),
    ...repeatedRefundsRule(transactions, thresholds),
    ...excessiveDiscountRule(transactions, thresholds),
    ...frequencyRule(transactions, thresholds),
    ...inventoryRule(products),
  ]
}
