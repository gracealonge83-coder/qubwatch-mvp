import { useState } from 'react'
import { formatDateTime } from '../utils/formatDateTime.js'

// Stage 4 investigations (PRD Sections 22-27 + 32). Human review only.
// No AI, no automation: the user records every note, finding, and resolution.
const STATUSES = ['all', 'Open', 'Under Investigation', 'Resolved', 'Closed']

// Exact PRD Section 26 finding options.
const FINDINGS = [
  'No Issue Identified',
  'Legitimate Business Activity',
  'Process Error',
  'Policy Violation',
  'Further Review Required',
  'Confirmed Business Loss',
  'Other',
]

function Investigations({
  investigations, alerts, products, transactions, users, currentUser,
  selectedId, onSelect, onAddNote, onAssignInvestigator, onRecordFinding,
  onResolve, onClose, onDelete, onOpenAlert, onAskAiAboutInvestigation, auditLog,
}) {
  const [statusFilter, setStatusFilter] = useState('all')

  const alertById = Object.fromEntries(alerts.map((a) => [a.id, a]))
  const visible = investigations.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    return true
  })
  const selected = investigations.find((i) => i.id === selectedId) || null

  return (
    <div className="grid investigations-page">
      <div className="card">
        <h2>Investigations ({visible.length})</h2>
        <p className="muted">Human review only. Start an investigation from an alert.</p>
        <div className="toolbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
            ))}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="muted">No investigations yet. Start one from an alert.</p>
        ) : (
          <ul className="alert-list">
            {visible.map((inv) => {
              const alert = alertById[inv.alertId]
              return (
                <li key={inv.id}>
                  <button
                    className={inv.id === selectedId ? 'alert-item selected' : 'alert-item'}
                    onClick={() => onSelect(inv.id)}
                  >
                    <span>{inv.id} — {alert ? alert.type : inv.alertType} — {inv.status}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Investigation detail</h2>
        {!selected ? (
          <p className="muted">Select an investigation to review it.</p>
        ) : (
          <InvestigationDetail
            key={selected.id}
            investigation={selected}
            alert={alertById[selected.alertId] || null}
            products={products}
            transactions={transactions}
            users={users}
            currentUser={currentUser}
            auditLog={auditLog.filter((e) => e.investigationId === selected.id)}
            onAddNote={onAddNote}
            onAssignInvestigator={onAssignInvestigator}
            onRecordFinding={onRecordFinding}
            onResolve={onResolve}
            onClose={onClose}
            onDelete={onDelete}
            onOpenAlert={onOpenAlert}
            onAskAiAboutInvestigation={onAskAiAboutInvestigation}
          />
        )}
      </div>
    </div>
  )
}

function InvestigationDetail({
  investigation, alert, products, transactions, users, currentUser,
  auditLog, onAddNote, onAssignInvestigator, onRecordFinding,
  onResolve, onClose, onDelete, onOpenAlert, onAskAiAboutInvestigation,
}) {
  const [noteContent, setNoteContent] = useState('')
  const [findingChoice, setFindingChoice] = useState(investigation.finding || '')
  const [findingOther, setFindingOther] = useState(investigation.findingOther || '')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [notice, setNotice] = useState(null)
  const [busyOp, setBusyOp] = useState(null)

  const productById = Object.fromEntries(products.map((p) => [p.id, p]))
  const txnById = Object.fromEntries(transactions.map((t) => [t.id, t]))
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  const investigator = userById[investigation.investigatorId]
  const isOpen = investigation.status === 'Open' || investigation.status === 'Under Investigation'

  // Evidence is read-only: looked up live from business records, never edited here.
  const evidenceTxns = investigation.relatedTransactionIds.map((id) => txnById[id]).filter(Boolean)
  const evidenceProducts = investigation.relatedProductIds.map((id) => productById[id]).filter(Boolean)

  const findingValid = findingChoice && (findingChoice !== 'Other' || findingOther.trim())
  const canResolve = isOpen && findingValid && resolutionNotes.trim()
  const shownNotice = notice && notice.id === investigation.id ? notice.text : null

  async function submitNote(event) {
    event.preventDefault()
    if (!noteContent.trim() || busyOp) return
    setNotice(null)
    setBusyOp('note')
    let ok = false
    try {
      ok = await onAddNote(investigation.id, noteContent.trim())
    } finally {
      setBusyOp(null)
    }
    if (!ok) return
    setNoteContent('')
    setNotice({ id: investigation.id, text: 'Note added.' })
  }

  async function submitFinding() {
    if (!findingValid || busyOp) return
    setNotice(null)
    setBusyOp('finding')
    let ok = false
    try {
      ok = await onRecordFinding(investigation.id, findingChoice, findingChoice === 'Other' ? findingOther.trim() : '')
    } finally {
      setBusyOp(null)
    }
    if (ok) setNotice({ id: investigation.id, text: 'Finding recorded.' })
  }

  async function submitResolve() {
    if (!canResolve || busyOp) return
    setNotice(null)
    setBusyOp('resolve')
    let ok = false
    try {
      ok = await onResolve(investigation.id, resolutionNotes.trim())
    } finally {
      setBusyOp(null)
    }
    if (!ok) return
    setResolutionNotes('')
    setNotice({ id: investigation.id, text: 'Investigation resolved.' })
  }

  async function handleClose() {
    if (busyOp) return
    setNotice(null)
    setBusyOp('close')
    let ok = false
    try {
      ok = await onClose(investigation.id)
    } finally {
      setBusyOp(null)
    }
    if (ok) setNotice({ id: investigation.id, text: 'Investigation closed.' })
  }

  async function handleAssign(event) {
    if (busyOp) return
    setNotice(null)
    setBusyOp('assign')
    let ok = false
    try {
      ok = await onAssignInvestigator(investigation.id, event.target.value)
    } finally {
      setBusyOp(null)
    }
    if (ok) setNotice({ id: investigation.id, text: 'Investigator updated.' })
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete this completed investigation? This removes its details, notes, finding, resolution and activity records. This cannot be undone.',
    )
    if (!confirmed || busyOp) return
    setNotice(null)
    setBusyOp('delete')
    try {
      await onDelete(investigation.id)
    } finally {
      setBusyOp(null)
    }
  }

  return (
    <div className="investigation-detail">
      <p><strong>{investigation.id}</strong></p>
      {shownNotice && <p role="status">{shownNotice}</p>}
      <p>Related alert: {alert ? alert.type : investigation.alertType} ({alert ? alert.severity : investigation.alertSeverity})</p>
      {alert && (
        <button className="secondary-btn" onClick={() => onOpenAlert(alert.id)}>View alert</button>
      )}
      <div className="form-row">
        <button className="secondary-btn" onClick={() => onAskAiAboutInvestigation(investigation.id)}>Ask AI about this investigation</button>
      </div>
      <p>
        Investigator:{' '}
        <select
          value={investigation.investigatorId}
          onChange={handleAssign}
          disabled={!isOpen || busyOp !== null}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
          ))}
        </select>
      </p>
      <p>Status: {investigation.status}</p>
      <p>Opened: {formatDateTime(investigation.createdAt)}{investigator ? ` by ${investigator.name}` : ''}</p>
      {investigation.resolvedAt && <p>Resolved: {formatDateTime(investigation.resolvedAt)}</p>}

      <h3>Evidence (read-only business records)</h3>
      {evidenceTxns.length === 0 && evidenceProducts.length === 0 ? (
        <p className="muted">No related records.</p>
      ) : (
        <div>
          {evidenceTxns.length > 0 && (
            <ul>
              {evidenceTxns.map((t) => (
                <li key={t.id}>
                  {formatDateTime(t.date)} — {t.type} — {productById[t.productId] ? productById[t.productId].name : t.productId} — qty {t.quantity} — ₦{t.amount.toLocaleString()} — discount {t.discount}% — {userById[t.staffId] ? userById[t.staffId].name : t.staffId}
                </li>
              ))}
            </ul>
          )}
          {evidenceProducts.length > 0 && (
            <ul>
              {evidenceProducts.map((p) => (
                <li key={p.id}>
                  {p.name} ({p.category}) — ₦{p.price.toLocaleString()} — stock {p.stock}, expected {p.expectedStock}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h3>Notes</h3>
      {investigation.notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="note-list">
          {investigation.notes.map((n) => (
            <li key={n.id}>
              {formatDateTime(n.date)} — {userById[n.authorId] ? userById[n.authorId].name : n.authorId}: {n.content}
            </li>
          ))}
        </ul>
      )}
      {isOpen && (
        <form onSubmit={submitNote} className="form">
          <label>
            Add note (as {currentUser.name})
            <textarea value={noteContent} onChange={(e) => { setNoteContent(e.target.value); setNotice(null) }} rows={3} />
          </label>
          <button type="submit" className="primary-btn" disabled={busyOp !== null}>{busyOp === 'note' ? 'Adding…' : 'Add note'}</button>
        </form>
      )}

      <h3>Finding</h3>
      {investigation.finding ? (
        <p>Recorded: {investigation.finding}{investigation.finding === 'Other' ? ` — ${investigation.findingOther}` : ''}</p>
      ) : (
        <p className="muted">No finding recorded yet.</p>
      )}
      {isOpen && (
        <div className="form">
          <label>
            Finding
            <select value={findingChoice} onChange={(e) => { setFindingChoice(e.target.value); setNotice(null) }}>
              <option value="">Select a finding</option>
              {FINDINGS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          {findingChoice === 'Other' && (
            <label>
              Describe (Other)
              <input value={findingOther} onChange={(e) => { setFindingOther(e.target.value); setNotice(null) }} />
            </label>
          )}
          <button type="button" className="secondary-btn" onClick={submitFinding} disabled={!findingValid || busyOp !== null}>
            {busyOp === 'finding' ? 'Saving…' : 'Record finding'}
          </button>
        </div>
      )}

      <h3>Resolution</h3>
      {investigation.status === 'Resolved' || investigation.status === 'Closed' ? (
        <div>
          <p>Finding: {investigation.finding}{investigation.finding === 'Other' ? ` — ${investigation.findingOther}` : ''}</p>
          <p>Notes: {investigation.resolutionNotes}</p>
          <p>Resolved by: {userById[investigation.resolvedById] ? userById[investigation.resolvedById].name : ''} on {formatDateTime(investigation.resolvedAt)}</p>
          <p>Final status: {investigation.status}</p>
          {investigation.status === 'Resolved' && (
            <button className="secondary-btn" onClick={handleClose} disabled={busyOp !== null}>{busyOp === 'close' ? 'Closing…' : 'Close investigation'}</button>
          )}
          {(investigation.status === 'Resolved' || investigation.status === 'Closed') && (
            <button className="secondary-btn destructive-btn" onClick={handleDelete} disabled={busyOp !== null}>{busyOp === 'delete' ? 'Deleting…' : 'Delete investigation'}</button>
          )}
        </div>
      ) : (
        <div className="form">
          <label>
            Resolution notes
            <textarea value={resolutionNotes} onChange={(e) => { setResolutionNotes(e.target.value); setNotice(null) }} rows={3} />
          </label>
          <button type="button" className="primary-btn" onClick={submitResolve} disabled={!canResolve || busyOp !== null}>
            {busyOp === 'resolve' ? 'Resolving…' : 'Resolve investigation'}
          </button>
          <p className="muted">Resolving needs a recorded finding plus resolution notes. The linked alert is set to Resolved.</p>
        </div>
      )}

      <h3>Activity</h3>
      {auditLog.length === 0 ? (
        <p className="muted">No activity recorded.</p>
      ) : (
        <ul className="note-list">
          {auditLog.map((e) => (
            <li key={e.id}>
              {formatDateTime(e.date)} — {userById[e.userId] ? userById[e.userId].name : e.userId}: {e.action}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Investigations
