import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getBasePrice } from '../services/pricing.js'
import {
  calculateTransferSplit,
  calculateCashReconciliation,
} from '../services/earnings.js'
import { notify } from '../services/notifications.js'
import { capturePaymentIntent, refundPaymentIntent } from '../lib/stripe.js'

const router = Router()
router.use(requireAuth)

const DRIVER_ROLES = ['driver', 'partner', 'admin']
const TRANSFER_SELECT = `
  *,
  driver:profiles!driver_id (id, name, email, roles, is_active),
  vehicle_owner:profiles!vehicle_owner_id (id, name, email, roles),
  vehicle:vehicles!vehicle_id (id, make, model, year, plate, vehicle_type, owner_id, owner_fee_percent),
  community:communities!community_id (id, name)
`

function money(value) {
  if (value === null || value === undefined || value === '') return value
  return Number(value)
}

function vehicleLabel(vehicle) {
  if (!vehicle) return null
  return `${vehicle.make} ${vehicle.model} (${vehicle.plate})`
}

function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join('\n')
}

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

function dayRange(date) {
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

async function logStatus(transferId, status, userId) {
  await supabase.from('trip_status_log').insert({
    transfer_id: transferId,
    status,
    updated_by: userId,
  })
}

async function loadTransfer(id) {
  const { data, error } = await supabase
    .from('transfers')
    .select(TRANSFER_SELECT)
    .eq('id', id)
    .single()
  if (error) return { error }
  return { transfer: data }
}

async function loadStatusLog(transferId) {
  const { data } = await supabase
    .from('trip_status_log')
    .select('*')
    .eq('transfer_id', transferId)
    .order('created_at', { ascending: true })
  return data || []
}

function adminView(transfer, extra = {}) {
  return {
    ...transfer,
    customer_charge: money(transfer.customer_charge),
    cash_expected: money(transfer.cash_expected),
    cash_reported: money(transfer.cash_reported),
    driver_payout: money(transfer.driver_payout),
    tip_amount: money(transfer.tip_amount),
    owner_fee: money(transfer.owner_fee),
    my30ahost_amount: money(transfer.my30ahost_amount),
    owner_fee_percent_snapshot: money(transfer.owner_fee_percent_snapshot),
    driver_name: transfer.driver?.name || null,
    vehicle_label: vehicleLabel(transfer.vehicle),
    community_name: transfer.community?.name || null,
    ...extra,
  }
}

function driverView(transfer) {
  const driver_payout = money(transfer.driver_payout) || 0
  const tip_amount = money(transfer.tip_amount) || 0
  return {
    id: transfer.id,
    trip_number: transfer.trip_number,
    scheduled_at: transfer.scheduled_at,
    pickup_address: transfer.pickup_address,
    dropoff_address: transfer.dropoff_address,
    community: transfer.community?.name || null,
    airport: transfer.airport,
    direction: transfer.direction,
    passengers: transfer.passengers,
    bags: transfer.bags,
    flight_number: transfer.flight_number,
    guest_name: transfer.guest_name,
    guest_phone: transfer.guest_phone,
    vehicle_label: vehicleLabel(transfer.vehicle),
    status: transfer.status,
    driver_payout,
    tip_amount,
    total: Number((driver_payout + tip_amount).toFixed(2)),
    payment_method: transfer.payment_method,
    payment_status: transfer.payment_status,
    started_at: transfer.started_at,
    completed_at: transfer.completed_at,
  }
}

function partnerView(transfer) {
  return {
    trip_number: transfer.trip_number,
    scheduled_at: transfer.scheduled_at,
    community: transfer.community?.name || null,
    airport: transfer.airport,
    vehicle_label: vehicleLabel(transfer.vehicle),
    customer_charge: money(transfer.customer_charge),
    owner_fee: money(transfer.owner_fee),
    owner_fee_percent_snapshot: money(transfer.owner_fee_percent_snapshot),
  }
}

async function getDriver(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, roles, is_active')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getVehicle(id) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, owner:profiles!owner_id(id, name, email, roles, is_active)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getLatestAgreement(userId, onDate) {
  const { data, error } = await supabase
    .from('compensation_agreements')
    .select('type, value, effective_from')
    .eq('user_id', userId)
    .lte('effective_from', onDate)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { type: data.type, value: Number(data.value) }
}

async function notifyAdmins({ message, transfer_id, email }) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .contains('roles', ['admin'])
    .eq('is_active', true)

  for (const admin of admins || []) {
    await notify({ user_id: admin.id, message, transfer_id, email })
  }
}

function canDrive(roles) {
  return (roles || []).some((role) => DRIVER_ROLES.includes(role))
}

router.get('/mine', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    const { start, end } = dayRange(date)
    const { data, error } = await supabase
      .from('transfers')
      .select(TRANSFER_SELECT)
      .eq('driver_id', req.user.id)
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: true })

    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map(driverView))
  } catch (error) {
    next(error)
  }
})

router.get('/mine/history', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const { start, end } = monthRange(month)
    const { data, error } = await supabase
      .from('transfers')
      .select(TRANSFER_SELECT)
      .eq('driver_id', req.user.id)
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map(driverView))
  } catch (error) {
    next(error)
  }
})

router.get('/vehicle-owner', requireRole('partner'), async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const { start, end } = monthRange(month)
    const { data, error } = await supabase
      .from('transfers')
      .select(TRANSFER_SELECT)
      .eq('vehicle_owner_id', req.user.id)
      .eq('status', 'completed')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    const trips = (data || []).map(partnerView)
    const total_owner_fee = Number(
      trips.reduce((sum, trip) => sum + (trip.owner_fee || 0), 0).toFixed(2)
    )
    res.json({ trips, total_owner_fee })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {}
    const required = [
      'guest_name',
      'guest_phone',
      'pickup_address',
      'dropoff_address',
      'community_id',
      'airport',
      'direction',
      'vehicle_type',
      'passengers',
      'bags',
      'scheduled_at',
      'driver_id',
      'vehicle_id',
      'payment_method',
    ]
    const missing = required.filter((field) => body[field] === undefined || body[field] === '')
    if (missing.length) {
      return res.status(400).json({ error: `Missing: ${missing.join(', ')}` })
    }

    const driver = await getDriver(body.driver_id)
    if (!driver || !driver.is_active || !canDrive(driver.roles)) {
      return res.status(400).json({ error: 'driver must be an active driver, partner, or admin' })
    }

    const vehicle = await getVehicle(body.vehicle_id)
    if (!vehicle) {
      return res.status(400).json({ error: 'vehicle not found' })
    }
    if (vehicle.vehicle_type !== body.vehicle_type) {
      return res.status(400).json({ error: 'vehicle_type must match the vehicle' })
    }

    let customer_charge
    let is_custom_price = false
    if (body.custom_price !== undefined && body.custom_price !== null && body.custom_price !== '') {
      customer_charge = money(body.custom_price)
      is_custom_price = true
      if (!Number.isFinite(customer_charge)) {
        return res.status(400).json({ error: 'custom_price must be a number' })
      }
    } else {
      const priced = await getBasePrice({
        community_id: body.community_id,
        airport: body.airport,
        vehicle_type: body.vehicle_type,
      })
      customer_charge = money(priced.base_price)
    }

    const insert = {
      guest_name: body.guest_name,
      guest_phone: body.guest_phone,
      guest_email: body.guest_email || null,
      pickup_address: body.pickup_address,
      dropoff_address: body.dropoff_address,
      community_id: body.community_id,
      airport: body.airport,
      direction: body.direction,
      vehicle_type: body.vehicle_type,
      passengers: Number(body.passengers),
      bags: Number(body.bags),
      flight_number: body.flight_number || null,
      scheduled_at: body.scheduled_at,
      driver_id: body.driver_id,
      vehicle_id: body.vehicle_id,
      vehicle_owner_id: vehicle.owner_id,
      payment_method: body.payment_method,
      customer_charge,
      is_custom_price,
      cash_expected: customer_charge,
      status: 'assigned',
      notes: body.notes || null,
      created_by: req.user.id,
    }

    const { data, error } = await supabase
      .from('transfers')
      .insert(insert)
      .select(TRANSFER_SELECT)
      .single()

    if (error) return res.status(400).json({ error: error.message })

    await logStatus(data.id, 'assigned', req.user.id)
    await notify({
      user_id: data.driver_id,
      transfer_id: data.id,
      message: `New trip #${data.trip_number} assigned · ${formatWhen(data.scheduled_at)} · ${data.pickup_address} → ${data.dropoff_address}`,
    })

    res.status(201).json(adminView(data))
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    let query = supabase.from('transfers').select(TRANSFER_SELECT).order('scheduled_at', {
      ascending: false,
    })

    if (req.query.status) query = query.eq('status', req.query.status)
    if (req.query.driver_id) query = query.eq('driver_id', req.query.driver_id)
    if (req.query.vehicle_owner_id) query = query.eq('vehicle_owner_id', req.query.vehicle_owner_id)
    if (req.query.is_flagged === 'true') query = query.eq('is_flagged', true)
    if (req.query.is_flagged === 'false') query = query.eq('is_flagged', false)
    if (req.query.date_from) query = query.gte('scheduled_at', req.query.date_from)
    if (req.query.date_to) query = query.lte('scheduled_at', req.query.date_to)

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map((row) => adminView(row)))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/start', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (transfer.status !== 'assigned') {
      return res.status(400).json({ error: 'Trip must be assigned to start' })
    }

    const started_at = new Date().toISOString()
    const { data, error: updateError } = await supabase
      .from('transfers')
      .update({ status: 'started', started_at })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'started', req.user.id)
    res.json(driverView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/complete', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (transfer.status !== 'started') {
      return res.status(400).json({ error: 'Trip must be started to complete' })
    }

    const { payment_method, cash_reported, tip_amount } = req.body || {}
    if (!payment_method) {
      return res.status(400).json({ error: 'payment_method is required' })
    }

    const completed_at = new Date().toISOString()
    const duration_minutes = Math.max(
      0,
      Math.round((new Date(completed_at) - new Date(transfer.started_at)) / 60000)
    )
    const completedDate = completed_at.slice(0, 10)

    const vehicle = await getVehicle(transfer.vehicle_id)
    const owner = vehicle?.owner
    if (!vehicle || !owner) {
      return res.status(400).json({ error: 'vehicle owner not found' })
    }

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('platform_fee_percent')
      .eq('id', 1)
      .single()
    if (settingsError) return res.status(400).json({ error: settingsError.message })

    const driver = transfer.driver
    let agreement = await getLatestAgreement(driver.id, completedDate)

    const split = calculateTransferSplit({
      customer_charge: money(transfer.customer_charge),
      driver: { id: driver.id, roles: driver.roles || [] },
      vehicle_owner: { id: owner.id, roles: owner.roles || [] },
      owner_fee_percent: Number(vehicle.owner_fee_percent),
      platform_fee_percent: Number(settings.platform_fee_percent),
      agreement,
      duration_minutes,
    })

    const tip = money(tip_amount) || 0
    const updates = {
      status: 'completed',
      completed_at,
      payment_method,
      driver_payout: split.driver_payout,
      owner_fee: split.owner_fee,
      my30ahost_amount: split.my30ahost_amount,
      comp_snapshot: split.snapshot,
      owner_fee_percent_snapshot: Number(vehicle.owner_fee_percent),
      tip_amount: tip,
      is_flagged: false,
      flag_reason: null,
    }

    const reasons = []
    if (split.warnings.includes('NEGATIVE_PLATFORM_AMOUNT')) {
      reasons.push('NEGATIVE_PLATFORM_AMOUNT')
    }

    if (payment_method === 'card_on_file') {
      const capture = await capturePaymentIntent(transfer.stripe_payment_intent_id)
      if (capture?.skipped) {
        updates.payment_status = 'pending'
        updates.notes = appendNote(
          transfer.notes,
          `Stripe capture skipped: ${capture.reason}`
        )
      } else {
        updates.payment_status = 'captured'
      }
    } else if (['card', 'apple_pay', 'google_pay'].includes(payment_method)) {
      updates.payment_status = 'captured'
    } else if (payment_method === 'cash') {
      if (cash_reported === undefined || cash_reported === null || cash_reported === '') {
        return res.status(400).json({ error: 'cash_reported is required for cash payments' })
      }
      updates.cash_reported = money(cash_reported)
      const recon = calculateCashReconciliation({
        customer_charge: money(transfer.customer_charge),
        cash_reported: updates.cash_reported,
        tip_amount: tip,
        driver_payout: split.driver_payout,
      })
      if (recon.mismatch) reasons.push('CASH_MISMATCH')
      updates.payment_status = 'captured'
    } else {
      return res.status(400).json({ error: 'invalid payment_method' })
    }

    if (reasons.length) {
      updates.is_flagged = true
      updates.flag_reason = reasons.join(', ')
    }

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'completed', req.user.id)

    const ownerRoles = owner.roles || []
    const ownerIsPartner = ownerRoles.includes('partner')
    const driverIsOwner = driver.id === owner.id
    const ownerIsAdmin = ownerRoles.includes('admin')
    const tripNo = data.trip_number

    if (ownerIsPartner && !driverIsOwner) {
      await notify({
        user_id: owner.id,
        transfer_id: data.id,
        email: true,
        message: `Trip #${tripNo} completed · Your vehicle fee: $${split.owner_fee} (${vehicle.owner_fee_percent}%)`,
      })
    }

    if (driverIsOwner && (driver.roles || []).includes('partner')) {
      await notifyAdmins({
        transfer_id: data.id,
        email: true,
        message: `Trip #${tripNo} completed · My30A Host fee: $${split.my30ahost_amount} (${settings.platform_fee_percent}%)`,
      })
    }

    if (!driverIsAdmin && ownerIsAdmin) {
      await notifyAdmins({
        transfer_id: data.id,
        email: false,
        message: `Trip #${tripNo} completed · hired driver on admin vehicle`,
      })
    }

    res.json(driverView(data))
  } catch (error) {
    if (error.message === 'Agreement is required') {
      return res.status(400).json({ error: error.message })
    }
    next(error)
  }
})

router.post('/:id/tip', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    const isAdmin = (req.user.roles || []).includes('admin')
    if (!isAdmin && transfer.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (transfer.status !== 'completed') {
      return res.status(400).json({ error: 'Trip must be completed to add a tip' })
    }

    const tip = money(req.body?.tip_amount)
    if (!Number.isFinite(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip_amount must be a number >= 0' })
    }

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update({ tip_amount: tip })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    res.json(isAdmin ? adminView(data) : driverView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/cancel', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['assigned', 'started'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip can only be cancelled if assigned or started' })
    }

    const updates = { status: 'cancelled' }
    if (transfer.status === 'started') {
      updates.is_flagged = true
      updates.flag_reason = 'CANCELLED_AFTER_START'
    }

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'cancelled', req.user.id)
    res.json(adminView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/refund', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.status !== 'completed') {
      return res.status(400).json({ error: 'Trip can only be refunded if completed' })
    }

    const updates = {
      status: 'refunded',
      payment_status: 'refunded',
    }

    if (transfer.stripe_payment_intent_id) {
      const refund = await refundPaymentIntent(transfer.stripe_payment_intent_id)
      if (refund?.skipped) {
        updates.notes = appendNote(transfer.notes, `Stripe refund skipped: ${refund.reason}`)
      }
    }

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'refunded', req.user.id)
    res.json(adminView(data, { status_log: await loadStatusLog(data.id) }))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/flag', requireRole('admin'), async (req, res, next) => {
  try {
    const reason = req.body?.reason
    if (!reason) return res.status(400).json({ error: 'reason is required' })
    const { data, error } = await supabase
      .from('transfers')
      .update({ is_flagged: true, flag_reason: reason })
      .eq('id', req.params.id)
      .select(TRANSFER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(adminView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/unflag', requireRole('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transfers')
      .update({ is_flagged: false, flag_reason: null })
      .eq('id', req.params.id)
      .select(TRANSFER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(adminView(data))
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.status !== 'assigned') {
      return res.status(400).json({ error: 'Trip can only be edited while assigned' })
    }

    const body = req.body || {}
    const updates = {}
    const guestFields = [
      'guest_name',
      'guest_phone',
      'guest_email',
      'pickup_address',
      'dropoff_address',
      'scheduled_at',
      'passengers',
      'bags',
      'flight_number',
      'notes',
    ]
    for (const field of guestFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (body.driver_id !== undefined) {
      const driver = await getDriver(body.driver_id)
      if (!driver || !driver.is_active || !canDrive(driver.roles)) {
        return res.status(400).json({ error: 'driver must be an active driver, partner, or admin' })
      }
      updates.driver_id = body.driver_id
    }

    if (body.vehicle_id !== undefined) {
      const vehicle = await getVehicle(body.vehicle_id)
      if (!vehicle) return res.status(400).json({ error: 'vehicle not found' })
      if (vehicle.vehicle_type !== transfer.vehicle_type) {
        return res.status(400).json({ error: 'vehicle_type must match the vehicle' })
      }
      updates.vehicle_id = body.vehicle_id
      updates.vehicle_owner_id = vehicle.owner_id
    }

    if (body.custom_price !== undefined) {
      const customer_charge = money(body.custom_price)
      if (!Number.isFinite(customer_charge)) {
        return res.status(400).json({ error: 'custom_price must be a number' })
      }
      updates.customer_charge = customer_charge
      updates.cash_expected = customer_charge
      updates.is_custom_price = true
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })

    if (updates.driver_id && updates.driver_id !== transfer.driver_id) {
      await notify({
        user_id: updates.driver_id,
        transfer_id: data.id,
        message: `New trip #${data.trip_number} assigned · ${formatWhen(data.scheduled_at)} · ${data.pickup_address} → ${data.dropoff_address}`,
      })
    }

    res.json(adminView(data))
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    res.json(adminView(transfer, { status_log: await loadStatusLog(transfer.id) }))
  } catch (error) {
    next(error)
  }
})

export default router
