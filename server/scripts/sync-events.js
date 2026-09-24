// Full events sync from 30a.com/events (see src/services/events.js). The daily Vercel cron runs a
// time-boxed version of the same thing; run this for a complete refresh.
//   cd server && node scripts/sync-events.js [--days=45]
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const { syncEvents } = await import('../src/services/events.js')

const days = Number(process.argv.find((a) => a.startsWith('--days='))?.slice(7)) || 35
const result = await syncEvents({ days, detailLimit: 2000, budgetMs: 15 * 60 * 1000, log: (m) => console.log(' ', m) })
console.log(result)
process.exit(0)
