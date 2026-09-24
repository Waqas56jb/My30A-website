// Scheduled maintenance. Locally index.js runs these on an interval. On Vercel (serverless — no
// timers) Vercel Cron calls GET /api/jobs/run daily with "Authorization: Bearer <CRON_SECRET>"
// (see vercel.json); POST with the JOBS_SECRET header or as a signed-in admin also works.
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { authorizeUpcomingHolds, expireUnauthorizedHolds } from '../services/tripFlow.js'
import { syncEvents } from '../services/events.js'

const router = Router()

export async function runJobs() {
  const started = Date.now()
  const holds = await expireUnauthorizedHolds()
  const upcoming_holds = await authorizeUpcomingHolds().catch((error) => ({ error: error.message }))
  // Events from 30a.com: next 3 weeks, time-boxed to fit the 60s serverless limit.
  const events = await syncEvents({ days: 21, detailLimit: 60, budgetMs: 40000 }).catch((error) => ({ ok: false, error: error.message }))
  return { ok: true, ms: Date.now() - started, expire_unauthorized_holds: holds, upcoming_holds, events }
}

function secretAllowed(req) {
  const cron = process.env.CRON_SECRET
  if (cron && req.headers.authorization === `Bearer ${cron}`) return true
  const secret = process.env.JOBS_SECRET
  if (!secret) return false
  const given = req.headers['x-jobs-secret'] || req.query.secret
  return typeof given === 'string' && given === secret
}

// Vercel Cron: GET with the CRON_SECRET bearer only (never public).
router.get('/run', async (req, res, next) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    res.json(await runJobs())
  } catch (error) {
    next(error)
  }
})

router.post(
  '/run',
  (req, res, next) => (secretAllowed(req) ? next() : requireAuth(req, res, () => requireRole('admin')(req, res, next))),
  async (_req, res, next) => {
    try {
      res.json(await runJobs())
    } catch (error) {
      next(error)
    }
  }
)

export default router
