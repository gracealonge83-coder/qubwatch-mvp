import { useEffect, useState } from 'react'
import BusinessSetup from '../components/BusinessSetup.jsx'
import TeamSetup from '../components/TeamSetup.jsx'
import MonitoringRules from '../components/MonitoringRules.jsx'
import { api } from '../api/client.js'

function SubscriptionSettings() {
  const [email, setEmail] = useState('owner@qubwatch.demo')
  const [payment, setPayment] = useState({ active: false, plan: null, reference: null, status: 'none' })
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function verifyPayment(reference) {
    setVerifying(true)
    setError('')
    setNotice('')
    try {
      const result = await api.get(`/billing/verify?reference=${encodeURIComponent(reference)}`)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      if (result.data.status !== 'verified') {
        setError('Paystack has not confirmed a successful payment. You can try again.')
        return false
      }
      setPayment((current) => ({
        ...current,
        active: true,
        plan: result.data.plan,
        reference,
        status: 'verified',
      }))
      setNotice('Payment verified successfully. Your QubWatch subscription demonstration is active.')
      return true
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      const url = new URL(window.location.href)
      const params = url.searchParams
      const callback = params.get('billing') === 'callback'
      const reference = params.get('reference') || params.get('trxref')
      if (callback || reference) {
        for (const name of ['billing', 'reference', 'trxref', 'status']) params.delete(name)
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      }

      let verified = false
      if (reference) {
        setVerifying(true)
        const result = await api.get(`/billing/verify?reference=${encodeURIComponent(reference)}`)
        if (!mounted) return
        if (result.ok && result.data.status === 'verified') {
          verified = true
          setNotice('Payment verified successfully. Your QubWatch subscription demonstration is active.')
        } else {
          setError(result.error || 'Paystack has not confirmed a successful payment.')
        }
        setVerifying(false)
      } else if (callback) {
        setError('Payment was cancelled or not completed. No successful payment was recorded.')
      }

      const result = await api.get('/billing/status')
      if (!mounted) return
      if (result.ok) {
        const current = result.data
        setPayment({
          active: current.active,
          plan: current.plan,
          reference: current.reference,
          status: current.status,
        })
      } else if (!reference) {
        setError(result.error)
      }
      if (verified) {
        setPayment((current) => ({ ...current, active: true, status: 'verified' }))
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  async function startPayment(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setInitializing(true)
    try {
      const result = await api.post('/billing/initialize', { plan: 'monthly', email })
      if (!result.ok) {
        setError(result.error)
        return
      }
      let checkout
      try {
        checkout = new URL(result.data.authorization_url)
      } catch {
        checkout = null
      }
      if (!checkout
        || checkout.protocol !== 'https:'
        || checkout.hostname !== 'checkout.paystack.com'
        || checkout.username !== ''
        || checkout.password !== '') {
        setError('The payment provider returned an invalid checkout link. Please try again.')
        return
      }
      window.location.assign(checkout.toString())
    } finally {
      setInitializing(false)
    }
  }

  return (
    <section className="card subscription-card">
      <h2>QubWatch subscription</h2>
      <p className="muted">Paystack Test Mode demonstration only. This does not accept payments from supermarket customers.</p>
      {loading ? (
        <p role="status">Checking subscription status…</p>
      ) : (
        <>
          {payment.active && (
            <p role="status" className="billing-success">
              Your QubWatch monthly subscription demonstration is active.
            </p>
          )}
          {!payment.active && payment.status === 'pending' && (
            <div className="billing-pending">
              <p>A payment attempt is awaiting confirmation.</p>
              <button type="button" className="secondary-btn" onClick={() => verifyPayment(payment.reference)} disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify latest payment'}
              </button>
            </div>
          )}
          {verifying && <p role="status">Verifying payment with Paystack…</p>}
          {error && <p role="alert" className="billing-error">{error}</p>}
          {notice && <p role="status" className="billing-success">{notice}</p>}
          {!payment.active && (
            <form className="form" onSubmit={startPayment}>
              <p><strong>Monthly plan — ₦5,000</strong> (50,000 kobo)</p>
              <label>
                Paystack Test Mode email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button type="submit" className="primary-btn" disabled={initializing || verifying}>
                {initializing ? 'Connecting to Paystack…' : 'Continue to Paystack Test Mode'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

function Settings({ business, onSaveBusiness, users, onAddUser, onUpdateUser, ruleConfig, canEditRules, onSaveRules, onRestoreRules, newCredentials, onClearCredentials, currentUser }) {
  return (
    <div className="grid">
      <BusinessSetup business={business} onSave={onSaveBusiness} />
      <TeamSetup users={users} onAdd={onAddUser} onUpdate={onUpdateUser} newCredentials={newCredentials} onClearCredentials={onClearCredentials} />
      <MonitoringRules config={ruleConfig} canEdit={canEditRules} onSave={onSaveRules} onRestore={onRestoreRules} />
      {currentUser && currentUser.role === 'Business Owner' && <SubscriptionSettings />}
    </div>
  )
}

export default Settings
