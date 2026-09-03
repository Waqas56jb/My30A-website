import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ymdInTimeZone, startOfDay, addDays } from '../lib/timezone.js'
import { loadAdminSummary } from './earnings.js'
import { getOwedRows } from '../services/payouts.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

function vehicleLabel(vehicle) {
  if (!vehicle) return null
  return `${vehicle.make} ${vehicle.model} (${vehicle.plate})`
}

function mapTrip(row) {
  return {
    id: row.id,
    trip_number: row.trip_number,
    scheduled_at: row.scheduled_at,
    airport: row.airport,
    direction: row.direction,
    passengers: row.passengers,
    bags: row.bags,
    status: row.status,
    is_flagged: row.is_flagged,
    flag_reason: row.flag_reason,
    cash_expected: row.cash_expected,
    cash_reported: row.cash_reported,
    driver_name: row.driver?.name || null,
    vehicle_label: vehicleLabel(row.vehicle),
    community_name: row.community?.name || null,
  }
}

router.get('/', async (_req, res, next) => {
  try {
    const today = ymdInTimeZone()
    const dayStart = startOfDay(today).toISOString()
    const dayEnd = new Date(startOfDay(addDays(today, 1)).getTime() - 1).toISOString()

    const tripSelect = `
      id, trip_number, scheduled_at, airport, direction, passengers, bags, status,
      is_flagged, flag_reason, cash_expected, cash_reported,
      driver:profiles!driver_id(name),
      vehicle:vehicles!vehicle_id(make, model, plate),
      community:communities!community_id(name)
    `

    const [summary, owed, flaggedTransfers, flaggedGrocery, upcoming] = await Promise.all([
      loadAdminSummary(today, today),
      getOwedRows(),
      supabase.from('transfers').select(tripSelect).eq('is_flagged', true).order('scheduled_at', {
        ascending: false,
      }),
      supabase
        .from('grocery_orders')
        .select(
          'id, order_number, package, flag_reason, delivery_address, shopper:profiles!shopper_id(name)'
        )
        .eq('is_flagged', true),
      supabase
        .from('transfers')
        .select(tripSelect)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .in('status', ['assigned', 'started'])
        .order('scheduled_at', { ascending: true }),
    ])

    if (flaggedTransfers.error) {
      return res.status(400).json({ error: flaggedTransfers.error.message })
    }
    if (flaggedGrocery.error) {
      return res.status(400).json({ error: flaggedGrocery.error.message })
    }
    if (upcoming.error) {
      return res.status(400).json({ error: upcoming.error.message })
    }

    const flagged_transfers = (flaggedTransfers.data || []).map(mapTrip)
    const flagged_grocery = (flaggedGrocery.data || []).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      package: order.package,
      flag_reason: order.flag_reason,
      delivery_address: order.delivery_address,
      shopper_name: order.shopper?.name || null,
    }))

    res.json({
      summary,
      owed,
      flagged_transfers,
      flagged_grocery,
      upcoming: (upcoming.data || []).map(mapTrip),
      flagged_count: flagged_transfers.length,
    })
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    next(error)
  }
})

export default router
