import { useState } from 'react'
import { formatDateTime } from '../utils/formatDateTime.js'

// Stage 3 alert review (PRD Sections 18-21 + 31). Review only.
// No investigations, no automated decisions. "Start investigation" arrives in Stage 4.
const SEVERITIES = ['all', 'Low', 'Medium', 'High', 'Critical']
const STATUSES = ['all', 'New', 'Under Review', 'Investigating', 'Resolved', 'Dismissed']

function Alerts({ alerts, products, transactions, users, selectedId, onSelect, onStatusChange, investigations, onStartInvestigation, onOpenInvestigation, onAskAiAboutAlert }) {
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [notice, setNotice] = useState(null)
  const [busyAction, setBusyAction] = useState(null)

  const types = ['all', ...new Set(alerts.map((a) => a.type))]
  const productById = Object.fromEntries(products.map((p) => [p.id, p]))
  const txnById = Object.fromEntries(transactions.map((t) => [t.id, t]))
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))

  const visible = alerts.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false
    if (status !== 'all' && a.status !== status) return false
    if (type !== 'all' && a.type !== type) return false
    return true
  })

  const selected = alerts.find((a) => a.id === selectedId) || null
  const snapshotTransactions = selected?.evidence?.transactions || []
  const snapshotProducts = selected?.evidence?.products || []
  const snapshotTxnById = Object.fromEntries(snapshotTransactions.map((t) => [t.id, t]))
  const snapshotProductById = Object.fromEntries(snapshotProducts.map((p) => [p.id, p]))
  const existingInvestigation = selected
    ? investigations.find((i) => i.alertId === selected.id && i.status !== 'Closed') || null
    : null
  const canStart = selected && (selected.status === 'New' || selected.status === 'Under Review')
  const shownNotice = notice && selected && notice.id === selected.id ? notice.text : null

  async function handleStatusChange(newStatus) {
    if (!selected || busyAction) return
    setNotice(null)
    setBusyAction(newStatus)
    let ok = false
    try {
      ok = await onStatusChange(selected.id, newStatus)
    } finally {
      setBusyAction(null)
    }
    if (ok) setNotice({ id: selected.id, text: `Alert marked as ${newStatus}.` })
  }

  async function handleStartInvestigation() {
    if (!selected || busyAction) return
    setNotice(null)
    setBusyAction('investigation')
    try {
      await onStartInvestigation(selected.id)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="grid alerts-page">
      <div className="card">
        <h2>Alerts ({visible.length})</h2>
        <p className="muted">Signals for review. Not proof of wrongdoing.</p>
        <div className="toolbar">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All severities' : s}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>
            ))}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="muted">No alerts match.</p>
        ) : (
          <ul className="alert-list">
            {visible.map((a) => (
              <li key={a.id}>
                <button
                  className={a.id === selectedId ? 'alert-item selected' : 'alert-item'}
                  onClick={() => onSelect(a.id)}
                >
                  <span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                  <span> {a.type} — {a.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Alert review</h2>
        {!selected ? (
          <p className="muted">Select an alert to review it.</p>
        ) : (
          <div>
            <p><strong>{selected.type}</strong></p>
            <p>Severity: <span className={`badge badge-${selected.severity.toLowerCase()}`}>{selected.severity}</span></p>
            <p>Date: {formatDateTime(selected.date)}</p>
            <p>Generated: {formatDateTime(selected.generatedAt)}</p>
            <p>Reason: {selected.message}</p>
            <p>Status: {selected.status}</p>

            {selected.relatedTransactionIds.length > 0 && (
              <div>
                <h3>Related transactions</h3>
                <ul>
                  {selected.relatedTransactionIds.map((id) => {
                    const t = snapshotTxnById[id] || txnById[id]
                    if (!t) return <li key={id}>{id}</li>
                    const productName = t.productName || (productById[t.productId] ? productById[t.productId].name : t.productId)
                    const staffName = t.staffName || (userById[t.staffId] ? userById[t.staffId].name : t.staffId)
                    return (
                      <li key={id}>
                        {formatDateTime(t.date)} — {t.type} — {productName} — ₦{Number(t.amount).toLocaleString()} ({staffName})
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {selected.relatedProductIds.length > 0 && (
              <div>
                <h3>Related products</h3>
                <ul>
                  {selected.relatedProductIds.map((id) => {
                    const p = snapshotProductById[id] || productById[id]
                    if (!p) return <li key={id}>{id}</li>
                    return <li key={id}>{p.name} — ₦{Number(p.price).toLocaleString()} (stock {p.stock}, expected {p.expectedStock})</li>
                  })}
                </ul>
              </div>
            )}

            <div className="form-row">
              <button className="secondary-btn" disabled={busyAction !== null} onClick={() => handleStatusChange('Under Review')}>{busyAction === 'Under Review' ? 'Updating…' : 'Review'}</button>
              <button className="secondary-btn" disabled={busyAction !== null} onClick={() => handleStatusChange('Resolved')}>{busyAction === 'Resolved' ? 'Updating…' : 'Resolve'}</button>
              <button className="secondary-btn" disabled={busyAction !== null} onClick={() => handleStatusChange('Dismissed')}>{busyAction === 'Dismissed' ? 'Updating…' : 'Dismiss'}</button>
            </div>
            {shownNotice && <p role="status">{shownNotice}</p>}
            <div className="form-row">
              {existingInvestigation ? (
                <button className="secondary-btn" onClick={() => onOpenInvestigation(existingInvestigation.id)}>Open investigation</button>
              ) : canStart ? (
                <button className="secondary-btn" disabled={busyAction !== null} onClick={handleStartInvestigation}>{busyAction === 'investigation' ? 'Starting…' : 'Start investigation'}</button>
              ) : (
                <p className="muted">Investigations start from New, Under Review or Investigating alerts.</p>
              )}
            </div>
            <div className="form-row">
              <button className="secondary-btn" onClick={() => onAskAiAboutAlert(selected.id)}>Ask AI about this alert</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Alerts
