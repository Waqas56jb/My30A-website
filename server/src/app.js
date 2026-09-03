import './lib/env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import usersRouter from './routes/users.js'
import settingsRouter from './routes/settings.js'
import vehiclesRouter from './routes/vehicles.js'
import compensationRouter from './routes/compensation.js'
import communitiesRouter from './routes/communities.js'
import transfersRouter from './routes/transfers.js'
import groceryRouter from './routes/grocery.js'
import payoutsRouter from './routes/payouts.js'
import earningsRouter from './routes/earnings.js'
import notificationsRouter from './routes/notifications.js'
import dashboardRouter from './routes/dashboard.js'
import authRouter from './routes/auth.js'
import { ensureBucket } from './lib/storage.js'

const app = express()

app.set('trust proxy', 1)

const listedOrigins = [
  ...(process.env.CLIENT_URL || '').split(','),
  process.env.ADMIN_APP_URL,
  process.env.CLIENT_APP_URL,
  'https://my30-a-website-admin.vercel.app',
  'https://my30-a-website-client.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]
  .map((origin) => (origin || '').trim().replace(/\/$/, ''))
  .filter(Boolean)
const uniqueOrigins = new Set(listedOrigins)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (uniqueOrigins.has(origin)) return true
  try {
    const { hostname } = new URL(origin)
    if (!hostname.endsWith('.vercel.app')) return false
    return hostname.includes('my30-a-website-admin') || hostname.includes('my30-a-website-client')
  } catch {
    return false
  }
}

function isHealth(req) {
  const path = req.path || ''
  return path === '/health' || path === '/api/health'
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)
app.use(compression())
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
  })
)
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
    skip: isHealth,
  })
)
app.use(express.json({ limit: '2mb' }))

app.use((req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`)
  })
  next()
})

function health(_req, res) {
  res.json({ ok: true })
}

app.get('/health', health)
app.get('/api/health', health)

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/vehicles', vehiclesRouter)
app.use('/api/compensation', compensationRouter)
app.use('/api/communities', communitiesRouter)
app.use('/api/transfers', transfersRouter)
app.use('/api/grocery', groceryRouter)
app.use('/api/payouts', payoutsRouter)
app.use('/api/earnings', earningsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/dashboard', dashboardRouter)

ensureBucket().catch((error) => {
  console.log('Storage bucket setup skipped:', error.message)
})

export default app
