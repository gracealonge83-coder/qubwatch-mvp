import { useState } from 'react'
import { api } from '../api/client.js'
import {
  clearPendingSubscriptionAction,
  savePendingSubscriptionAction,
} from '../subscription/pendingAction.js'

function SubscriptionModal({
  open,
  currentUser,
  pendingAction,
  onClose,
  paymentMessage,
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const isOwner = currentUser?.role === 'Business Owner'

  function dismiss() {
    clearPendingSubscriptionAction()
    onClose()
  }

  async function subscribe() {
    setError('')
    if (!isOwner) {
      setError('Only the Business Owner can subscribe. Ask them to unlock this in Settings.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid Paystack Test Mode email to continue.')
      return
    }
    setBusy(true)
    try {
      if (pendingAction) savePendingSubscriptionAction(pendingAction)
      const result = await api.post('/billing/initialize', { plan: 'monthly', email: email.trim() })
      if (!result.ok) {
        setError(result.error || 'Could not start payment. Please try again.')
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
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={dismiss}>
      <div
        className="modal-card subscription-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="subscription-modal-title">Unlock Investigations and AI Assistant</h2>
        <p>Monthly subscription: ₦5,000</p>
        <p className="muted">Paystack Test Mode only. Access unlocks after the server verifies payment for this business.</p>
        {paymentMessage && <p role="status" className="billing-error">{paymentMessage}</p>}
        {isOwner && (
          <label>
            Paystack Test Mode email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
          </label>
        )}
        {error && <p role="alert" className="billing-error">{error}</p>}
        <div className="form-row">
          <button type="button" className="primary-btn" disabled={busy} onClick={subscribe}>
            {busy ? 'Connecting…' : 'Subscribe with Paystack'}
          </button>
          <button type="button" className="secondary-btn" disabled={busy} onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionModal
