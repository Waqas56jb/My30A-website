import app from './app.js'
import { runJobs } from './routes/jobs.js'

const PORT = process.env.PORT || 4000

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })

  // Scheduled maintenance (24h auto-cancel of unauthorized holds). On Vercel a cron calls
  // POST /api/jobs/run instead — see routes/jobs.js.
  const every = Number(process.env.JOBS_INTERVAL_MS || 10 * 60 * 1000)
  if (every > 0) {
    const timer = setInterval(() => {
      runJobs().catch((error) => console.log('Scheduled jobs failed:', error.message))
    }, every)
    timer.unref()
  }
}

export default app
