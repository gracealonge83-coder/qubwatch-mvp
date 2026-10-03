import { useState } from 'react'
import { FAIRNESS_NOTE } from '../ai/mockAssistant.js'
import { api } from '../api/client.js'

// AI Assistant (PRD Sections 28-29). Responses come from the backend
// (/api/ai), which reads authorized QubWatch records and calls the
// configured AI service. Read-only: this page never records findings
// or resolves anything.
const ALERT_QUESTIONS = [
  { id: 'summarize', label: 'Summarize this alert' },
  { id: 'why', label: 'Why was this alert generated?' },
  { id: 'transactions', label: 'Summarize related transactions' },
  { id: 'questions', label: 'Suggest investigation questions' },
]

function AiAssistant({
  business, alerts, investigations, products, transactions, users,
  initialContext, thresholds, onOpenAlert, onOpenInvestigation,
}) {
  const [contextType, setContextType] = useState(initialContext.type)
  const [contextId, setContextId] = useState(initialContext.id)
  const [response, setResponse] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const alertById = Object.fromEntries(alerts.map((a) => [a.id, a]))
  const invById = Object.fromEntries(investigations.map((i) => [i.id, i]))

  async function ask(question) {
    if (busy) return
    if (contextType === 'alert' && !alertById[contextId]) return
    if (contextType === 'investigation' && !invById[contextId]) return
    setError('')
    setBusy(true)
    try {
      const res = await api.post('/ai', { contextType, contextId, question })
      if (!res.ok) {
        setError(res.error)
        setResponse(null)
        return
      }
      setResponse(res.data)
    } finally {
      setBusy(false)
    }
  }

  function changeContext(type) {
    setContextType(type)
    setContextId(null)
    setResponse(null)
    setError('')
  }

  function changeSelection(id) {
    setContextId(id || null)
    setResponse(null)
    setError('')
  }

  const questions = contextType === 'investigation'
    ? [
      { id: 'summarize', label: 'Summarize this investigation' },
      { id: 'questions', label: 'Suggest investigation questions' },
    ]
    : ALERT_QUESTIONS

  return (
    <div className="grid ai-assistant-page">
      <div className="card ai-controls">
        <h2>AI Assistant</h2>
        <p className="muted">Explanations based on your business records. The assistant supports you; you decide.</p>
        <div className="form">
          <label>
            Context
            <select
              value={contextType}
              onChange={(e) => changeContext(e.target.value)}
            >
              <option value="overview">Business overview</option>
              <option value="alert">Alert</option>
              <option value="investigation">Investigation</option>
            </select>
          </label>
          {contextType === 'alert' && (
            <label>
              Alert
              <select
                value={contextId || ''}
                onChange={(e) => changeSelection(e.target.value)}
              >
                <option value="">Select an alert</option>
                {alerts.map((a) => (
                  <option key={a.id} value={a.id}>{a.type} — {a.severity} — {a.status}</option>
                ))}
              </select>
            </label>
          )}
          {contextType === 'investigation' && (
            <label>
              Investigation
              <select
                value={contextId || ''}
                onChange={(e) => changeSelection(e.target.value)}
              >
                <option value="">Select an investigation</option>
                {investigations.map((i) => (
                  <option key={i.id} value={i.id}>{i.id} — {i.status}</option>
                ))}
              </select>
            </label>
          )}
          {contextType === 'overview' && (
            <button type="button" className="primary-btn" disabled={busy} onClick={() => ask('summarize')}>
              {busy ? 'Thinking…' : 'Summarize business activity'}
            </button>
          )}
          {(contextType !== 'overview' && contextId) && (
            <div className="form-row">
              {questions.map((q) => (
                <button key={q.id} type="button" className="secondary-btn" disabled={busy} onClick={() => ask(q.id)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card ai-response">
        <h2>Response</h2>
        <p className="ai-disclaimer">This assistant explains records; it does not decide, judge staff or prove wrongdoing.</p>
        {busy && <p role="status">Thinking…</p>}
        {error && <p>{error}</p>}
        {!response ? (
          <p className="muted">Choose a context and a question to receive a response.</p>
        ) : (
          <div>
            <h3>{response.title}</h3>
            <div className="ai-section">
              <h3>Known Information</h3>
              <ul>
                {response.knownInformation.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="ai-section">
              <h3>Analysis</h3>
              <ul>
                {response.analysis.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="ai-section">
              <h3>Possible Explanations</h3>
              <ul>
                {response.possibleExplanations.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="ai-section">
              <h3>Suggested Next Steps</h3>
              <ul>
                {response.suggestedNextSteps.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <p className="muted">{FAIRNESS_NOTE}</p>
            <div className="form-row">
              {response.kind === 'alert' && (
                <button className="secondary-btn" onClick={() => onOpenAlert(response.id)}>View alert</button>
              )}
              {response.kind === 'investigation' && (
                <button className="secondary-btn" onClick={() => onOpenInvestigation(response.id)}>View investigation</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AiAssistant
