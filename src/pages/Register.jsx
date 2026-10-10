import { useState } from 'react'

// Minimal customer sign-up screen (Stage 3). Creates a new business and its
// Business Owner account via POST /api/auth/register, then signs in.
// Same card/form styling as Login; no redesign.
function Register({ onRegister, onShowLogin }) {
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const found = {}
    if (name.trim() === '') found.name = 'Required.'
    if (businessName.trim() === '') found.businessName = 'Required.'
    if (password === '') found.password = 'Required.'
    else if (password.length < 8) found.password = 'Use at least 8 characters.'
    if (confirm !== password) found.confirm = 'Passwords do not match.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setError('')
    setBusy(true)
    const result = await onRegister({ name: name.trim(), businessName: businessName.trim(), password })
    setBusy(false)
    if (!result) return
    if (result.fields) setErrors(result.fields)
    setError(result.message)
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
          <h2>Create your account</h2>
          <p className="muted">Set up your business and sign in as its Business Owner.</p>
          <form onSubmit={handleSubmit} className="form">
            <label>
              Your name
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              {errors.name && <span className="muted">{errors.name}</span>}
            </label>
            <label>
              Business name
              <input name="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              {errors.businessName && <span className="muted">{errors.businessName}</span>}
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {errors.password && <span className="muted">{errors.password}</span>}
            </label>
            <label>
              Confirm password
              <input
                type="password"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {errors.confirm && <span className="muted">{errors.confirm}</span>}
            </label>
            {error && <p>{error}</p>}
            <button type="submit" className="primary-btn" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
            <button type="button" className="secondary-btn" onClick={onShowLogin} disabled={busy}>
              Back to log in
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default Register
