import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { monthRange, rangeFor } from '../lib/timezone.js'

const router = Router()
router.use(requireAuth)

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Unknown vehicle'
  return `${vehicle.make} ${vehicle.model} (${vehicle.plate})`
}

function inRange(value, start, end) {
  if (!value) return false
  const time = new Date(value).getTime()
  return time >= start.getTime() && time < end.getTime()
}

router.get('/mine', requireRole('driver', 'shopper'), async (req, res, next) => {
  try {
    const range = req.query.range || 'today'
    const { start, end } = rangeFor(range, req.query.date_from, req.query.date_to)
    const roles = req.user.roles || []
    const activeRole = req.query.activeRole
    const asDriver = activeRole ? activeRole === 'driver' : roles.includes('driver')
    const asShopper = activeRole ? activeRole === 'shopper' : roles.includes('shopper')

    let trip_earnings = 0
    let tips = 0
    let trips_count = 0

    if (asDriver && roles.includes('driver')) {
      const { data, error } = await supabase
        .from('transfers')
        .select('driver_payout, tip_amount, completed_at')
        .eq('driver_id', req.user.id)
        .eq('status', 'completed')
      if (error) return res.status(400).json({ error: error.message })
      const rows = (data || []).filter((row) => inRange(row.completed_at, start, end))
      trip_earnings += rows.reduce((sum, row) => sum + Number(row.driver_payout || 0), 0)
      tips += rows.reduce((sum, row) => sum + Number(row.tip_amount || 0), 0)
      trips_count += rows.length
    }

    if (asShopper && roles.includes('shopper')) {
      const { data, error } = await supabase
        .from('grocery_orders')
        .select('shopper_payout, tip_amount, delivered_at')
        .eq('shopper_id', req.user.id)
        .eq('status', 'delivered')
      if (error) return res.status(400).json({ error: error.message })
      const rows = (data || []).filter((row) => inRange(row.delivered_at, start, end))
      trip_earnings += rows.reduce((sum, row) => sum + Number(row.shopper_payout || 0), 0)
      tips += rows.reduce((sum, row) => sum + Number(row.tip_amount || 0), 0)
      trips_count += rows.length
    }

    res.json({
      trip_earnings: money(trip_earnings),
      tips: money(tips),
      total: money(trip_earnings + tips),
      trips_count,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/vehicle-owner', requireRole('partner'), async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const { start, end } = monthRange(month)

    const { data: ownerTrips, error } = await supabase
      .from('transfers')
      .select(
        'id, owner_fee, completed_at, vehicle_id, vehicle:vehicles!vehicle_id(id, make, model, plate)'
      )
      .eq('vehicle_owner_id', req.user.id)
      .eq('status', 'completed')

    if (error) return res.status(400).json({ error: error.message })

    const inMonth = (ownerTrips || []).filter((row) => inRange(row.completed_at, start, end))
    const byVehicle = new Map()
    for (const trip of inMonth) {
      const id = trip.vehicle_id || 'unknown'
      const current = byVehicle.get(id) || {
        vehicle_label: vehicleLabel(trip.vehicle),
        trips_count: 0,
        owner_fee_total: 0,
      }
      current.trips_count += 1
      current.owner_fee_total = money(current.owner_fee_total + Number(trip.owner_fee || 0))
      byVehicle.set(id, current)
    }

    const vehicles = [...byVehicle.values()]
    const month_total = money(vehicles.reduce((sum, row) => sum + row.owner_fee_total, 0))

    const { data: driven, error: drivenError } = await supabase
      .from('transfers')
      .select('driver_payout, tip_amount, completed_at')
      .eq('driver_id', req.user.id)
      .eq('status', 'completed')

    if (drivenError) return res.status(400).json({ error: drivenError.message })
    const drivenInMonth = (driven || []).filter((row) => inRange(row.completed_at, start, end))

    res.json({
      vehicles,
      month_total,
      driver_earnings: money(
        drivenInMonth.reduce((sum, row) => sum + Number(row.driver_payout || 0), 0)
      ),
      driver_tips: money(
        drivenInMonth.reduce((sum, row) => sum + Number(row.tip_amount || 0), 0)
      ),
      driver_trips_count: drivenInMonth.length,
    })
  } catch (error) {
    next(error)
  }
})

export async function loadAdminSummary(dateFrom, dateTo) {
  const range = dateFrom && dateTo ? 'custom' : 'month'
  const { start, end } = rangeFor(range, dateFrom, dateTo)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const [transfersResult, ordersResult] = await Promise.all([
    supabase
      .from('transfers')
      .select(
        'id, customer_charge, driver_payout, tip_amount, owner_fee, my30ahost_amount, completed_at, driver_id, vehicle_owner_id, vehicle_id, driver:profiles!driver_id(id, name), vehicle_owner:profiles!vehicle_owner_id(id, name, roles), vehicle:vehicles!vehicle_id(id, make, model, plate)'
      )
      .eq('status', 'completed')
      .gte('completed_at', startIso)
      .lt('completed_at', endIso),
    supabase
      .from('grocery_orders')
      .select(
        'id, service_fee, grocery_total, shopper_payout, tip_amount, my30ahost_amount, delivered_at, shopper_id, shopper:profiles!shopper_id(id, name)'
      )
      .eq('status', 'delivered')
      .gte('delivered_at', startIso)
      .lt('delivered_at', endIso),
  ])

  if (transfersResult.error) {
    const error = new Error(transfersResult.error.message)
    error.status = 400
    throw error
  }
  if (ordersResult.error) {
    const error = new Error(ordersResult.error.message)
    error.status = 400
    throw error
  }

  const trips = transfersResult.data || []
  const groceries = ordersResult.data || []

    const perDriver = new Map()
    const perPartner = new Map()
    const perVehicle = new Map()
    const perShopper = new Map()

    let customer_charge = 0
    let driver_payouts = 0
    let tips = 0
    let owner_fees = 0
    let my30ahost_amount = 0

    for (const trip of trips) {
      customer_charge += Number(trip.customer_charge || 0)
      driver_payouts += Number(trip.driver_payout || 0)
      tips += Number(trip.tip_amount || 0)
      owner_fees += Number(trip.owner_fee || 0)
      my30ahost_amount += Number(trip.my30ahost_amount || 0)

      if (trip.driver_id) {
        const current = perDriver.get(trip.driver_id) || {
          user: { id: trip.driver_id, name: trip.driver?.name },
          trip_earnings: 0,
          tips: 0,
          trips: 0,
        }
        current.trip_earnings = money(current.trip_earnings + Number(trip.driver_payout || 0))
        current.tips = money(current.tips + Number(trip.tip_amount || 0))
        current.trips += 1
        perDriver.set(trip.driver_id, current)
      }

      const ownerRoles = trip.vehicle_owner?.roles || []
      if (trip.vehicle_owner_id && !ownerRoles.includes('admin')) {
        const current = perPartner.get(trip.vehicle_owner_id) || {
          user: { id: trip.vehicle_owner_id, name: trip.vehicle_owner?.name },
          owner_fees: 0,
          trips: 0,
        }
        current.owner_fees = money(current.owner_fees + Number(trip.owner_fee || 0))
        current.trips += 1
        perPartner.set(trip.vehicle_owner_id, current)
      }

      const vehicleId = trip.vehicle_id || 'unknown'
      const currentVehicle = perVehicle.get(vehicleId) || {
        vehicle: vehicleLabel(trip.vehicle),
        trips: 0,
        owner_fees: 0,
        customer_charge: 0,
      }
      currentVehicle.trips += 1
      currentVehicle.owner_fees = money(currentVehicle.owner_fees + Number(trip.owner_fee || 0))
      currentVehicle.customer_charge = money(
        currentVehicle.customer_charge + Number(trip.customer_charge || 0)
      )
      perVehicle.set(vehicleId, currentVehicle)
    }

    let grocery_service_fee = 0
    let grocery_total = 0
    let shopper_payouts = 0

    for (const order of groceries) {
      grocery_service_fee += Number(order.service_fee || 0)
      grocery_total += Number(order.grocery_total || 0)
      shopper_payouts += Number(order.shopper_payout || 0)
      tips += Number(order.tip_amount || 0)
      my30ahost_amount += Number(order.my30ahost_amount || 0)

      if (order.shopper_id) {
        const current = perShopper.get(order.shopper_id) || {
          user: { id: order.shopper_id, name: order.shopper?.name },
          earnings: 0,
          tips: 0,
          orders: 0,
        }
        current.earnings = money(current.earnings + Number(order.shopper_payout || 0))
        current.tips = money(current.tips + Number(order.tip_amount || 0))
        current.orders += 1
        perShopper.set(order.shopper_id, current)
      }
    }

    return {
      customer_charge: money(customer_charge),
      driver_payouts: money(driver_payouts),
      tips: money(tips),
      owner_fees: money(owner_fees),
      my30ahost_amount: money(my30ahost_amount),
      grocery_service_fee: money(grocery_service_fee),
      grocery_total: money(grocery_total),
      shopper_payouts: money(shopper_payouts),
      transfer_count: trips.length,
      grocery_count: groceries.length,
      per_driver: [...perDriver.values()],
      per_partner: [...perPartner.values()],
      per_vehicle: [...perVehicle.values()],
      per_shopper: [...perShopper.values()],
    }
}

router.get('/admin/summary', requireRole('admin'), async (req, res, next) => {
  try {
    res.json(await loadAdminSummary(req.query.date_from, req.query.date_to))
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    next(error)
  }
})

export default router
