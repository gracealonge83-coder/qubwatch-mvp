const STORAGE_KEY = 'qubwatch.pendingSubscriptionAction'

export function savePendingSubscriptionAction(action) {
  if (!action || typeof action !== 'object') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...action,
      savedAt: Date.now(),
    }))
  } catch {
    // Ignore quota / private-mode failures; payment can still verify.
  }
}

export function readPendingSubscriptionAction() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function clearPendingSubscriptionAction() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
