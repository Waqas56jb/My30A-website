// Scheduled maintenance. Locally index.js runs these on an interval; on Vercel point a cron at
// POST /api/jobs/run with the JOBS_SECRET header (or call it as a signed-in admin).
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { expireUnauthorizedHolds } from '../services/tripFlow.js'

const router = Router()

export async function runJobs() {
  const started = Date.now()
  const holds = await expireUnauthorizedHolds()
  return { ok: true, ms: Date.now() - started, expire_unauthorized_holds: holds }
}

function secretAllowed(req) {
  const secret = process.env.JOBS_SECRET
  if (!secret) return false
  const given = req.headers['x-jobs-secret'] || req.query.secret
  return typeof given === 'string' && given === secret
}

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
