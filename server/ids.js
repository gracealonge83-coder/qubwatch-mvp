import crypto from 'node:crypto'

// Centralized server-side ID generation (Stage 5).
// '<prefix>-<base36 milliseconds>-<12 hex random chars>': keeps the existing
// prefix convention and plain-TEXT primary keys in both databases, while 48
// bits of randomness make same-millisecond collisions across concurrent
// requests, instances, and hosts practically impossible. Existing stored IDs
// are never changed; only newly generated IDs use this shape. Callers treat
// IDs as opaque strings (ordering uses created_at/rowid, never IDs).
export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`
}
