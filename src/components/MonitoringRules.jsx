import { useState } from 'react'
import { DEMO_THRESHOLDS } from '../../shared/rules.js'

// Monitoring Rules editor (PRD Section 16, Configurable Rules).
// Only the Business Owner can edit; all other roles have a read-only view.
// Inventory Discrepancy is not configurable. In-memory + localStorage only.
const FIELDS = [
  { key: 'LARGE_TRANSACTION_AMOUNT', label: 'Large transaction amount (₦)', hint: 'Flag sales above this amount.' },
  { key: 'REPEATED_REFUNDS_COUNT', label: 'Repeated refunds: count', hint: 'Flag more than this many refunds.' },
  { key: 'REPEATED_REFUNDS_WINDOW_MINUTES', label: 'Repeated refunds: time window (minutes)', hint: 'Window the refunds must fall inside.' },
  { key: 'EXCESSIVE_DISCOUNT_PCT', label: 'Excessive discount (%)', hint: 'Flag discounts at or above this percent.' },
  { key: 'FREQUENCY_COUNT', label: 'Unusual frequency: transaction count', hint: 'Flag more than this many transactions.' },
  { key: 'FREQUENCY_WINDOW_MINUTES', label: 'Unusual frequency: time window (minutes)', hint: 'Window the transactions must fall inside.' },
]

function toStrings(config) {
  return Object.fromEntries(FIELDS.map((f) => [f.key, String(config[f.key])]))
}

function validate(values) {
  const errors = {}
  const positiveInt = (v) => /^\d+$/.test(v.trim()) && Number(v) > 0
  if (!(Number(values.LARGE_TRANSACTION_AMOUNT) > 0)) {
    errors.LARGE_TRANSACTION_AMOUNT = 'Enter an amount above 0.'
  }
  if (!positiveInt(values.REPEATED_REFUNDS_COUNT)) {
    errors.REPEATED_REFUNDS_COUNT = 'Enter a whole number of 1 or more.'
  }
  if (!positiveInt(values.REPEATED_REFUNDS_WINDOW_MINUTES)) {
    errors.REPEATED_REFUNDS_WINDOW_MINUTES = 'Enter a whole number of 1 or more minutes.'
  }
  const pct = Number(values.EXCESSIVE_DISCOUNT_PCT)
  if (!(pct > 0) || !(pct <= 100)) {
    errors.EXCESSIVE_DISCOUNT_PCT = 'Enter a percent above 0 and at most 100.'
  }
  if (!positiveInt(values.FREQUENCY_COUNT)) {
    errors.FREQUENCY_COUNT = 'Enter a whole number of 1 or more.'
  }
  if (!positiveInt(values.FREQUENCY_WINDOW_MINUTES)) {
    errors.FREQUENCY_WINDOW_MINUTES = 'Enter a whole number of 1 or more minutes.'
  }
  return errors
}

function MonitoringRules({ config, canEdit, onSave, onRestore }) {
  const [form, setForm] = useState(() => toStrings(config))
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(null)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setNotice('')
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!canEdit) return
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setNotice('')
    setBusy('save')
    let ok = false
    try {
      ok = await onSave({
        LARGE_TRANSACTION_AMOUNT: Number(form.LARGE_TRANSACTION_AMOUNT),
        REPEATED_REFUNDS_COUNT: Number(form.REPEATED_REFUNDS_COUNT),
        REPEATED_REFUNDS_WINDOW_MINUTES: Number(form.REPEATED_REFUNDS_WINDOW_MINUTES),
        EXCESSIVE_DISCOUNT_PCT: Number(form.EXCESSIVE_DISCOUNT_PCT),
        FREQUENCY_COUNT: Number(form.FREQUENCY_COUNT),
        FREQUENCY_WINDOW_MINUTES: Number(form.FREQUENCY_WINDOW_MINUTES),
      })
    } finally {
      setBusy(null)
    }
    if (!ok) return
    setNotice('Rules saved successfully.')
  }

  async function handleRestore() {
    if (!canEdit) return
    setNotice('')
    setBusy('restore')
    let ok = false
    try {
      ok = await onRestore()
    } finally {
      setBusy(null)
    }
    if (!ok) return
    setForm(toStrings({ ...DEMO_THRESHOLDS }))
    setErrors({})
    setNotice('Default rules restored.')
  }

  return (
    <div className="card">
      <h2>Monitoring Rules</h2>
      <p className="muted">
        {canEdit
          ? 'Changes apply immediately to all stored transactions.'
          : 'Only the Business Owner can change these rules.'}
      </p>
      <form onSubmit={handleSave} className="form">
        {FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              name={f.key}
              value={form[f.key]}
              onChange={handleChange}
              disabled={!canEdit}
              inputMode="numeric"
            />
            <span className="muted">{f.hint}</span>
            {errors[f.key] && <span className="muted">{errors[f.key]}</span>}
          </label>
        ))}
        <p className="muted">Inventory Discrepancy is based on recorded vs expected stock and is not configurable.</p>
        <div className="form-row">
          <button type="submit" className="primary-btn" disabled={!canEdit || busy !== null}>{busy === 'save' ? 'Saving…' : 'Save rules'}</button>
          <button type="button" className="secondary-btn" onClick={handleRestore} disabled={!canEdit || busy !== null}>
            {busy === 'restore' ? 'Restoring…' : 'Restore Default Rules'}
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </form>
    </div>
  )
}

export default MonitoringRules
