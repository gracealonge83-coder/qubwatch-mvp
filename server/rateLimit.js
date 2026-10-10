// Minimal in-memory sliding-window rate limiter for public endpoints.
// Proportionate protection for customer registration: abuse is low-volume
// by nature, so a per-process memory table is sufficient. On serverless
// platforms each instance enforces its own budget (best-effort); edge rate
// limiting remains the recommended hardening for production.
// Never logs request bodies, credentials, cookies, or secrets.
const buckets = new Map()
const MAX_BUCKETS = 5000

function clientKey(req) {
  // req.ip is computed by Express from X-Forwarded-For using the app's
  // 'trust proxy' setting (exactly 1 hop on Render), so client-supplied
  // header entries cannot be used to spoof it. Direct connections fall back
  // to the socket address. Raw X-Forwarded-For is never trusted here.
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown'
}

export function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now()
    const key = clientKey(req)
    let hits = buckets.get(key)
    if (!hits) {
      hits = []
      buckets.set(key, hits)
    }
    while (hits.length > 0 && hits[0] <= now - windowMs) hits.shift()
    if (hits.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
      res.status(429).json({ error: message })
      return
    }
    hits.push(now)
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (v.length === 0 || v[v.length - 1] <= now - windowMs) buckets.delete(k)
        if (buckets.size <= MAX_BUCKETS) break
      }
    }
    next()
  }
}

// Public registration: 10 attempts per 15 minutes per client. Genuine
// sign-ups are rare; this only bites automated abuse.
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
})
