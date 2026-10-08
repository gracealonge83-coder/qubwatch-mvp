import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { migrate } from './db.js'
import { attachUser } from './auth.js'
import authRoutes from './routes/auth.js'
import businessRoutes from './routes/business.js'
import userRoutes from './routes/users.js'
import productRoutes from './routes/products.js'
import transactionRoutes from './routes/transactions.js'
import alertRoutes from './routes/alerts.js'
import investigationRoutes from './routes/investigations.js'
import auditRoutes from './routes/audit.js'
import ruleRoutes from './routes/rules.js'
import aiRoutes from './routes/ai.js'
import billingRoutes from './routes/billing.js'

// Shared Express application for the local server and Netlify Function.
export const app = express()

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'https://qubwatch.netlify.app'
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }
  next()
})

app.use(express.json())
app.use(attachUser())

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'qubwatch-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api', businessRoutes)
app.use('/api', userRoutes)
app.use('/api', productRoutes)
app.use('/api', transactionRoutes)
app.use('/api', alertRoutes)
app.use('/api', investigationRoutes)
app.use('/api', auditRoutes)
app.use('/api', ruleRoutes)
app.use('/api', aiRoutes)
app.use('/api', billingRoutes)

let initialization
export function initialize() {
  if (!initialization) {
    initialization = migrate().catch((err) => {
      initialization = null
      throw err
    })
  }
  return initialization
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await initialize()
  } catch (err) {
    console.error('[api] migration failed:', err.message)
    process.exit(1)
  }

  const port = Number(process.env.PORT) || 3001
  app.listen(port, () => {
    console.log(`qubwatch-api listening on ${port}`)
  })
}
