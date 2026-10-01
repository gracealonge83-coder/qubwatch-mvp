import express from 'express'
import { migrate, getDb } from './db.js'
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

// QubWatch API (Stage 5): Express + SQLite with session authentication
// and resource routes. Frontend migration arrives in a later stage.
// No frontend changes here.
try {
  await migrate()
} catch (err) {
  console.error('[api] migration failed:', err.message)
  process.exit(1)
}

const app = express()
app.use(express.json())
app.use(attachUser(getDb()))

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

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`qubwatch-api listening on ${port}`)
})
