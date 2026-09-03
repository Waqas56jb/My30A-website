import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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
const PORT = process.env.PORT || 4000

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.use((req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`)
  })
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
