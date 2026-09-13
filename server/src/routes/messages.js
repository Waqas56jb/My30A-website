// Admin audit view of every trip conversation, SMS and masked call — searchable by trip number,
// guest name, driver and date (Part 4 of the comms spec). Nothing here is ever deleted.
import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const TRANSFER = 'transfer:transfers!transfer_id (id, trip_number, guest_name, scheduled_at, status, driver:profiles!driver_id (id, name))'

function matches(row, q) {
  if (!q) return true
  const hay = [
    row.transfer?.trip_number ? `#${row.transfer.trip_number}` : '',
    row.transfer?.trip_number,
    row.transfer?.guest_name,
    row.transfer?.driver?.name,
    row.sender_name,
    row.body,
    row.to_phone,
    row.from_phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q.toLowerCase())
}

function applyFilters(query, req) {
  if (req.query.transfer_id) query = query.eq('transfer_id', req.query.transfer_id)
  if (req.query.date_from) query = query.gte('created_at', req.query.date_from)
  if (req.query.date_to) query = query.lte('created_at', req.query.date_to)
  return query.order('created_at', { ascending: false }).limit(Number(req.query.limit) || 500)
}

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const driverId = req.query.driver_id || null
    const kind = req.query.kind || 'all' // all | chat | sms | calls

    const [chat, sms, calls] = await Promise.all([
      kind === 'all' || kind === 'chat'
        ? applyFilters(supabase.from('trip_messages').select(`id, transfer_id, sender_role, sender_name, body, created_at, ${TRANSFER}`), req)
        : { data: [] },
      kind === 'all' || kind === 'sms'
        ? applyFilters(supabase.from('sms_log').select(`id, transfer_id, to_phone, body, kind, status, error, created_at, ${TRANSFER}`), req)
        : { data: [] },
      kind === 'all' || kind === 'calls'
        ? applyFilters(supabase.from('call_log').select(`id, transfer_id, direction, from_phone, to_phone, status, duration_seconds, created_at, ${TRANSFER}`), req)
        : { data: [] },
    ])
    for (const result of [chat, sms, calls]) {
      if (result.error) return res.status(400).json({ error: result.error.message })
    }

    const byDriver = (row) => !driverId || row.transfer?.driver?.id === driverId
    res.json({
      messages: (chat.data || []).filter((row) => byDriver(row) && matches(row, q)),
      sms: (sms.data || []).filter((row) => byDriver(row) && matches(row, q)),
      calls: (calls.data || []).filter((row) => byDriver(row) && matches(row, q)),
    })
  } catch (error) {
    next(error)
  }
})

export default router
