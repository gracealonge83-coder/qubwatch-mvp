// Minimal API client for the QubWatch backend (Stage 6).
// Native fetch only. The HttpOnly session cookie is sent automatically
// (credentials: 'include'); tokens and passwords never touch localStorage.
// Every call resolves to { ok, status, data, error, fields } — never throws.
const API_BASE_URL = import.meta.env.PROD
  ? 'https://qubwatch.onrender.com/api'
  : '/api'

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Cannot reach the server. Check your connection and try again.',
      fields: null,
    }
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (res.ok) {
    return { ok: true, status: res.status, data, error: null, fields: null }
  }
  if (res.status === 401) {
    return { ok: false, status: res.status, data: null, error: 'Your session has ended. Please log in again.', fields: null }
  }
  if (res.status === 403) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: (data && data.error) || 'You do not have permission to do that.',
      fields: null,
    }
  }
  if (res.status === 404) {
    return { ok: false, status: res.status, data: null, error: (data && data.error) || 'Not found.', fields: null }
  }
  if (res.status === 409) {
    return { ok: false, status: res.status, data: null, error: (data && data.error) || 'That conflicts with the current state.', fields: null }
  }
  return {
    ok: false,
    status: res.status,
    data: null,
    error: (data && data.error) || 'Something went wrong. Please try again.',
    fields: data && data.fields ? data.fields : null,
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}
