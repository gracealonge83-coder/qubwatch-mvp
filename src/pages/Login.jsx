import { useState } from 'react'

// Minimal QubWatch login screen (Stage 6). Uses the Stage 4 session API;
// the session cookie is HttpOnly and never visible to this code.
function Login({ onLogin, onShowRegister }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const message = await onLogin(identifier.trim(), password)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="brand">QubWatch</h1>
          <p className="tagline">See what deserves your utmost attention.</p>
        </div>
      </header>
      <main className="main">
        <div className="card">
          <h2>Log in</h2>
          <p className="muted">Use your QubWatch user name and password.</p>
          <form onSubmit={handleSubmit} className="form">
            <label>
              User name or ID
              <input name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p>{error}</p>}
            <button type="submit" className="primary-btn" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
            {onShowRegister && (
              <button type="button" className="secondary-btn" onClick={onShowRegister} disabled={busy}>
                New to QubWatch? Create an account
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}

export default Login
