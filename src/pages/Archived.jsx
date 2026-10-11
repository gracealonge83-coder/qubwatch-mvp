import { useState } from 'react'
import { formatDateTime } from '../utils/formatDateTime.js'

// Archived records: soft-archived alerts and completed investigations.
// Nothing here is deleted; restoring returns a record to its active view.
function Archived({ alerts, investigations, users, onRestoreAlert, onRestoreInvestigation }) {
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  const q = query.trim().toLowerCase()

  const matchingAlerts = alerts.filter((a) => {
    if (!q) return true
    return [a.id, a.type, a.message, a.status, a.severity]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
  const matchingInvestigations = investigations.filter((inv) => {
    const investigator = userById[inv.investigatorId]
    if (!q) return true
    return [inv.id, inv.alertId, inv.alertType, inv.status, inv.finding, investigator ? investigator.name : '']
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })

  async function handleRestore(kind, id) {
    if (busyId) return
    setNotice(null)
    setBusyId(id)
    try {
      const ok = kind === 'alert'
        ? await onRestoreAlert(id)
        : await onRestoreInvestigation(id)
      if (ok) setNotice(`${kind === 'alert' ? 'Alert' : 'Investigation'} restored to its active view.`)
    } finally {
      setBusyId(null)
    }
  }

  function archivedLine(archivedAt, archivedBy) {
    const who = archivedBy && userById[archivedBy] ? userById[archivedBy].name : null
    const parts = []
    if (archivedAt) parts.push(formatDateTime(archivedAt))
    if (who) parts.push(`by ${who}`)
    return parts.length > 0 ? `Archived ${parts.join(' ')}` : 'Archived'
  }

  return (
    <div className="grid alerts-page">
      <div className="card">
        <h2>Archived ({matchingAlerts.length + matchingInvestigations.length})</h2>
        <p className="muted">Retained records that left the active views. Restoring returns them.</p>
        <div className="toolbar">
          <input
            type="search"
            aria-label="Search archived records"
            placeholder="Search archived records…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {notice && <p role="status">{notice}</p>}
        <h3>Archived alerts ({matchingAlerts.length})</h3>
        {matchingAlerts.length === 0 ? (
          <p className="muted">No archived alerts match.</p>
        ) : (
          <ul className="alert-list">
            {matchingAlerts.map((a) => (
              <li key={a.id}>
                <div className="alert-item">
                  <span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                  <span> {a.type} — {a.status}</span>
                </div>
                <p className="muted">{a.message}</p>
                <p className="muted">{archivedLine(a.archivedAt, a.archivedBy)}</p>
                <div className="form-row">
                  <button className="secondary-btn" disabled={busyId !== null} onClick={() => handleRestore('alert', a.id)}>
                    {busyId === a.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h3>Archived investigations ({matchingInvestigations.length})</h3>
        {matchingInvestigations.length === 0 ? (
          <p className="muted">No archived investigations match.</p>
        ) : (
          <ul className="alert-list">
            {matchingInvestigations.map((inv) => (
              <li key={inv.id}>
                <div className="alert-item">
                  <span>{inv.id} — {inv.alertType} — {inv.status}</span>
                </div>
                {inv.finding && <p className="muted">Finding: {inv.finding}</p>}
                <p className="muted">{archivedLine(inv.archivedAt, inv.archivedBy)}</p>
                <div className="form-row">
                  <button className="secondary-btn" disabled={busyId !== null} onClick={() => handleRestore('investigation', inv.id)}>
                    {busyId === inv.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Archived
