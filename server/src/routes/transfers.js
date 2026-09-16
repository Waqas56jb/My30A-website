import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getBasePrice } from '../services/pricing.js'
import {
  calculateTransferSplit,
  calculateCashReconciliation,
} from '../services/earnings.js'
import { notify } from '../services/notifications.js'
import {
  capturePaymentIntent,
  createCheckoutSession,
  refundPaymentIntent,
  retrieveCheckoutSession,
} from '../lib/stripe.js'
import { maskedCallNumber } from '../lib/sms.js'
import { addDays, monthRange as tzMonthRange, startOfDay } from '../lib/timezone.js'
import {
  ACTIVE_TRIP_STATUSES,
  TRIP_LABELS,
  cancelByHost,
  cancelForGuest,
  guestLinks,
  markNoShow,
  publicBaseUrl,
  requestTip,
  smsGuest,
  statusSms,
} from '../services/tripFlow.js'

const router = Router()
router.use(requireAuth)

const DRIVER_ROLES = ['driver', 'partner', 'admin']
const TRANSFER_SELECT = `
  *,
  driver:profiles!driver_id (id, name, email, roles, is_active),
  vehicle_owner:profiles!vehicle_owner_id (id, name, email, roles),
  guest:profiles!guest_id (id, name, email, phone),
  vehicle:vehicles!vehicle_id (id, make, model, year, plate, vehicle_type, owner_id, owner_fee_percent, capacity, show_name),
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

// Day/month windows are Chicago-local (the date the driver panel sends), not UTC — otherwise a
// 7 pm Central trip lands in the next UTC day and vanishes from "Today".
function monthRange(month) {
  const { start, end } = tzMonthRange(month)
  return { start: start.toISOString(), end: end.toISOString() }
}

function dayRange(date) {
  return { start: startOfDay(date).toISOString(), end: startOfDay(addDays(date, 1)).toISOString() }
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
    base_price: money(transfer.base_price),
    addons: transfer.addons || [],
    is_guest_request: Boolean(transfer.guest_id),
    status_label: TRIP_LABELS[transfer.status] || transfer.status,
    cancellation_fee: money(transfer.cancellation_fee) || 0,
    no_show_fee: money(transfer.no_show_fee) || 0,
    discount_percent: money(transfer.discount_percent) || 0,
    round_trip_group_id: transfer.round_trip_group_id || null,
    pay_link_url: transfer.pay_link_url || null,
    tip_paid_via: transfer.tip_paid_via || null,
    guest_links: transfer.guest_token ? guestLinks(transfer) : null,
    guest_account: transfer.guest
      ? {
          id: transfer.guest.id,
          name: transfer.guest.name,
          email: transfer.guest.email,
          phone: transfer.guest.phone,
        }
      : null,
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
    // The guest's number is never shown to the driver: calls go through the masked Twilio
    // number and coordination happens in the trip chat.
    guest_call_number: ACTIVE_TRIP_STATUSES.includes(transfer.status) ? maskedCallNumber() : null,
    status_label: TRIP_LABELS[transfer.status] || transfer.status,
    arrived_at: transfer.arrived_at,
    picked_up_at: transfer.picked_up_at,
    pay_link_url: transfer.pay_link_url || null,
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

async function notifyGuest(transfer, message) {
  if (!transfer?.guest_id) return
  await notify({ user_id: transfer.guest_id, transfer_id: transfer.id, message })
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

// Admin confirms a guest request (or re-assigns) by choosing the driver and vehicle.
router.post('/:id/assign', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['requested', 'assigned'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip can only be assigned while requested or assigned' })
    }

    const body = req.body || {}
    if (!body.driver_id || !body.vehicle_id) {
      return res.status(400).json({ error: 'driver_id and vehicle_id are required' })
    }

    const driver = await getDriver(body.driver_id)
    if (!driver || !driver.is_active || !canDrive(driver.roles)) {
      return res.status(400).json({ error: 'driver must be an active driver, partner, or admin' })
    }
    const vehicle = await getVehicle(body.vehicle_id)
    if (!vehicle) return res.status(400).json({ error: 'vehicle not found' })
    if (vehicle.vehicle_type !== transfer.vehicle_type) {
      return res.status(400).json({ error: 'vehicle_type must match the vehicle' })
    }

    const updates = {
      driver_id: body.driver_id,
      vehicle_id: body.vehicle_id,
      vehicle_owner_id: vehicle.owner_id,
      status: 'assigned',
    }
    if (body.custom_price !== undefined && body.custom_price !== null && body.custom_price !== '') {
      const customer_charge = money(body.custom_price)
      if (!Number.isFinite(customer_charge)) {
        return res.status(400).json({ error: 'custom_price must be a number' })
      }
      updates.customer_charge = customer_charge
      updates.cash_expected = customer_charge
      updates.is_custom_price = true
    }
    if (body.payment_method !== undefined) updates.payment_method = body.payment_method
    if (body.notes !== undefined) updates.notes = body.notes

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })

    await logStatus(transfer.id, 'assigned', req.user.id)
    await notify({
      user_id: data.driver_id,
      transfer_id: data.id,
      message: `New trip #${data.trip_number} assigned · ${formatWhen(data.scheduled_at)} · ${data.pickup_address} → ${data.dropoff_address}`,
    })
    await notifyGuest(
      data,
      `Your airport transfer #${data.trip_number} is confirmed · ${formatWhen(data.scheduled_at)} · Driver ${driver.name} · ${vehicleLabel(vehicle)}`
    )
    // Confirmation SMS carries the secret chat link (and the masked call number once Twilio is on).
    await smsGuest(data, statusSms(data, 'assigned'), 'assigned')

    res.json(adminView(data))
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
    await notifyGuest(
      data,
      `Your driver ${data.driver?.name || ''} is on the way · Trip #${data.trip_number}`.replace('  ', ' ')
    )
    await smsGuest(data, statusSms(data, 'started'), 'started')
    res.json(driverView(data))
  } catch (error) {
    next(error)
  }
})

// Driver is at the pickup point (airport curb / home address).
router.post('/:id/arrive', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (transfer.status !== 'started') {
      return res.status(400).json({ error: 'Tap "On the way" before "Arrived"' })
    }
    const { data, error: updateError } = await supabase
      .from('transfers')
      .update({ status: 'arrived', arrived_at: new Date().toISOString() })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'arrived', req.user.id)
    await notifyGuest(data, `${data.driver?.name || 'Your driver'} has arrived and is waiting at the pickup area · Trip #${data.trip_number}`)
    await smsGuest(data, statusSms(data, 'arrived'), 'arrived')
    res.json(driverView(data))
  } catch (error) {
    next(error)
  }
})

// Guest is in the vehicle.
router.post('/:id/pickup', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (!['started', 'arrived'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip must be on the way or arrived to pick up the guest' })
    }
    const { data, error: updateError } = await supabase
      .from('transfers')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(transfer.id, 'picked_up', req.user.id)
    await notifyGuest(data, `You're on your way! Enjoy the ride · Trip #${data.trip_number}`)
    await smsGuest(data, statusSms(data, 'picked_up'), 'picked_up')
    res.json(driverView(data))
  } catch (error) {
    next(error)
  }
})

// Admin declares a no-show (after the 90-minute rule): $75 captured, remainder released.
router.post('/:id/no-show', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['assigned', 'started', 'arrived'].includes(transfer.status)) {
      return res.status(400).json({ error: 'No-show can only be declared before the guest is picked up' })
    }
    const result = await markNoShow({ transfer, actorId: req.user.id, select: TRANSFER_SELECT })
    if (transfer.driver_id) {
      await notify({ user_id: transfer.driver_id, transfer_id: transfer.id, message: `Trip #${transfer.trip_number} marked as no-show by My30A Host. You may leave.` })
    }
    res.json(adminView(result.transfer, { stripe: result.settlement }))
  } catch (error) {
    next(error)
  }
})

// On-the-spot card payment: a hosted Stripe page the driver shows the guest (link / QR).
router.post('/:id/pay-link', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    const isAdmin = (req.user.roles || []).includes('admin')
    if (!isAdmin && transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (!ACTIVE_TRIP_STATUSES.includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip is not active' })
    }
    if (transfer.payment_status === 'captured' || transfer.payment_status === 'authorized') {
      return res.status(400).json({ error: 'This trip is already paid / authorized on a card.' })
    }

    if (transfer.stripe_checkout_session_id) {
      const existing = await retrieveCheckoutSession(transfer.stripe_checkout_session_id)
      if (existing && !existing.skipped) {
        if (existing.payment_status === 'paid') return res.json({ paid: true, url: null })
        if (existing.status === 'open') return res.json({ paid: false, url: existing.url, session_id: existing.id })
      }
    }

    const base = publicBaseUrl()
    const amount = money(transfer.customer_charge)
    const session = await createCheckoutSession({
      amount,
      description: `My30A Host airport transfer #${transfer.trip_number}`,
      metadata: { my30a_transfer_id: transfer.id, kind: 'on_the_spot' },
      successUrl: `${base}/trip/${transfer.guest_token}?paid=1`,
      cancelUrl: `${base}/trip/${transfer.guest_token}`,
      customerEmail: transfer.guest_email || undefined,
    })
    if (session?.skipped) return res.status(503).json({ error: 'Card payments are not configured' })

    await supabase
      .from('transfers')
      .update({ stripe_checkout_session_id: session.id, pay_link_url: session.url })
      .eq('id', transfer.id)
    res.status(201).json({ paid: false, url: session.url, session_id: session.id, amount })
  } catch (error) {
    next(error)
  }
})

// Per-trip chat (driver ↔ guest). Admin can read and post too.
router.get('/:id/messages', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    const isAdmin = (req.user.roles || []).includes('admin')
    if (!isAdmin && transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    const { data } = await supabase
      .from('trip_messages')
      .select('id, sender_role, sender_name, body, created_at')
      .eq('transfer_id', transfer.id)
      .order('created_at', { ascending: true })
      .limit(300)
    res.json({ messages: data || [], chat_open: ACTIVE_TRIP_STATUSES.includes(transfer.status), guest_first_name: String(transfer.guest_name || 'Guest').split(/\s+/)[0] })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/messages', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    const isAdmin = (req.user.roles || []).includes('admin')
    if (!isAdmin && transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (!ACTIVE_TRIP_STATUSES.includes(transfer.status)) {
      return res.status(410).json({ error: 'This trip has ended. Chat is closed.' })
    }
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'Message is empty' })
    if (body.length > 1000) return res.status(400).json({ error: 'Message is too long' })

    const senderRole = isAdmin && transfer.driver_id !== req.user.id ? 'admin' : 'driver'
    const { data, error: insertError } = await supabase
      .from('trip_messages')
      .insert({ transfer_id: transfer.id, sender_role: senderRole, sender_id: req.user.id, sender_name: req.user.name || senderRole, body })
      .select('id, sender_role, sender_name, body, created_at')
      .single()
    if (insertError) return res.status(400).json({ error: insertError.message })

    await notifyGuest(transfer, `${req.user.name || 'Your driver'}: ${body.slice(0, 140)}`)
    // Guests without the app only learn about a reply by SMS — throttled to one per 2 minutes.
    if (!transfer.guest_id) {
      const { data: recent } = await supabase
        .from('sms_log')
        .select('created_at')
        .eq('transfer_id', transfer.id)
        .eq('kind', 'chat')
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .limit(1)
      if (!recent?.length) {
        await smsGuest(transfer, `${req.user.name || 'Your driver'}: ${body.slice(0, 120)} — reply here: ${guestLinks(transfer).chat}`, 'chat')
      }
    }
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/complete', requireRole('driver', 'partner', 'admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.driver_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (!['started', 'arrived', 'picked_up'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip must be in progress (on the way / arrived / picked up) to complete' })
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
      let capture
      try {
        capture = await capturePaymentIntent(transfer.stripe_payment_intent_id)
      } catch (stripeError) {
        return res.status(400).json({
          error: `Card was not authorized (${stripeError.message}). Ask the guest to complete payment in the app before finishing this trip.`,
        })
      }
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
      // On-the-spot card: if a Stripe payment link was generated it must actually be paid.
      if (transfer.stripe_checkout_session_id) {
        const session = await retrieveCheckoutSession(transfer.stripe_checkout_session_id)
        if (session && !session.skipped) {
          if (session.payment_status !== 'paid') {
            return res.status(400).json({
              error: 'The guest has not completed the payment link yet. Ask them to finish paying, or choose another payment method.',
            })
          }
          if (session.payment_intent) updates.stripe_payment_intent_id = String(session.payment_intent)
        }
      }
      updates.payment_status = 'captured'
    } else if (payment_method === 'zelle') {
      // Guest paid My30A Host directly; flagged so admin verifies it in Zelle.
      updates.payment_status = 'captured'
      updates.notes = appendNote(transfer.notes, `Paid via Zelle — confirmed by ${req.user.name || 'driver'}, verify in Zelle`)
      reasons.push('ZELLE_REVIEW')
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
    // In-app tip prompt for app guests + SMS with the no-login tip link for everyone.
    await requestTip(data)

    const ownerRoles = owner.roles || []
    const ownerIsPartner = ownerRoles.includes('partner')
    const driverIsOwner = driver.id === owner.id
    const ownerIsAdmin = ownerRoles.includes('admin')
    const driverIsAdmin = (driver.roles || []).includes('admin')
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
    if (!ACTIVE_TRIP_STATUSES.includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip can only be cancelled while it is still active' })
    }

    // initiated_by 'host' (default): full release + $25 credit on the guest's next booking.
    // initiated_by 'guest' (admin cancelling on the guest's behalf): published fee windows apply.
    const initiatedBy = req.body?.initiated_by === 'guest' ? 'guest' : 'host'
    const result =
      initiatedBy === 'guest'
        ? await cancelForGuest({ transfer, actorId: req.user.id, select: TRANSFER_SELECT })
        : await cancelByHost({ transfer, actorId: req.user.id, select: TRANSFER_SELECT, reason: req.body?.reason })
    if (transfer.driver_id && initiatedBy === 'host') {
      await notify({ user_id: transfer.driver_id, transfer_id: transfer.id, message: `Trip #${transfer.trip_number} was cancelled by My30A Host.` })
    }
    res.json(adminView(result.transfer, { cancellation: { initiated_by: initiatedBy, fee: result.fee ?? 0, stripe: result.settlement } }))
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
    if (!['requested', 'assigned'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Trip can only be edited while requested or assigned' })
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

// Admin-only: guests can no longer self-select a holiday/peak-date surcharge in the app — only
// staff add it (after confirming the date actually qualifies), and it just shows up as a fee.
router.post('/:id/holiday-fee', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['requested', 'assigned'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Holiday fee can only be changed while requested or assigned' })
    }

    const apply = Boolean(req.body?.apply)
    const { data: addon, error: catalogError } = await supabase
      .from('service_catalog')
      .select('key, name, price')
      .eq('kind', 'transfer_addon')
      .eq('key', 'transfer-holiday')
      .eq('is_active', true)
      .maybeSingle()
    if (catalogError) return res.status(400).json({ error: catalogError.message })
    if (!addon) return res.status(400).json({ error: 'Holiday add-on is not configured' })

    const otherAddons = (transfer.addons || []).filter((row) => row.key !== addon.key)
    const addons = apply ? [...otherAddons, { key: addon.key, name: addon.name, price: Number(addon.price) }] : otherAddons

    // Recompute from the same stored inputs quoteTransfer used at booking time (base_price +
    // addons, then the round-trip discount) — matches existing custom_price behavior above in
    // not touching any Stripe hold the guest may have already authorized for the old amount.
    const basePrice = Number(transfer.base_price) || 0
    const addonsTotal = addons.reduce((sum, row) => sum + Number(row.price), 0)
    const discountPercent = Number(transfer.discount_percent) || 0
    const listTotal = Number((basePrice + addonsTotal).toFixed(2))
    const customerCharge = Number((listTotal * (1 - discountPercent / 100)).toFixed(2))

    const { data, error: updateError } = await supabase
      .from('transfers')
      .update({ addons, customer_charge: customerCharge, cash_expected: customerCharge })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })

    res.json(adminView(data))
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { transfer, error } = await loadTransfer(req.params.id)
    if (error || !transfer) return res.status(404).json({ error: 'Transfer not found' })
    const [status_log, messages, sms, calls] = await Promise.all([
      loadStatusLog(transfer.id),
      supabase.from('trip_messages').select('id, sender_role, sender_name, body, created_at').eq('transfer_id', transfer.id).order('created_at'),
      supabase.from('sms_log').select('id, to_phone, body, kind, status, error, created_at').eq('transfer_id', transfer.id).order('created_at'),
      supabase.from('call_log').select('id, direction, from_phone, to_phone, status, duration_seconds, created_at').eq('transfer_id', transfer.id).order('created_at'),
    ])
    res.json(
      adminView(transfer, {
        status_log,
        messages: messages.data || [],
        sms_log: sms.data || [],
        call_log: calls.data || [],
      })
    )
  } catch (error) {
    next(error)
  }
})

export default router
