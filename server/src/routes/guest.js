// Guest mobile app API: signup/login, profile + stay, home feed, Explore 30A, saved places,
// Vitoria concierge chat, and guest-originated airport transfer / grocery requests.
// Requests are inserted into the same transfers / grocery_orders tables the admin, driver and
// shopper panels already use, with status 'requested' until an admin assigns staff.
import crypto from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getBasePrice } from '../services/pricing.js'
import { notify } from '../services/notifications.js'
import { getSignedUrl, uploadFile } from '../lib/storage.js'
import { chatCompletion } from '../lib/openai.js'
import { cleanConciergeText } from '../lib/textFormat.js'
import {
  createPaymentIntent,
  createSetupIntent,
  ensureStripeCustomer,
  getPublishableKey,
  mapIntentStatus,
  releasePaymentHold,
  retrievePaymentIntent,
} from '../lib/stripe.js'
import { maskedCallNumber } from '../lib/sms.js'
import { geocodeQuery } from '../lib/nominatim.js'
import { checkAddressAgainstCommunity } from '../services/geocoding.js'
import {
  ROUND_TRIP_DISCOUNT_PERCENT,
  availableCredit,
  cancelForGuest,
  consumeCredits,
  firstName as tripFirstName,
  guestLinks,
  vehicleGuestLabel,
} from '../services/tripFlow.js'

const router = Router()
const guestOnly = requireRole('guest')

const TIME_ZONE = 'America/Chicago'
const AIRPORTS = {
  ECP: 'ECP · Northwest Florida Beaches International Airport',
  VPS: 'VPS · Destin–Fort Walton Beach Airport',
  PNS: 'PNS · Pensacola International Airport',
}
const VEHICLE_TYPES = ['4pax', '6pax', '14pax']
const VEHICLE_LABELS = {
  '4pax': '4 Passenger Vehicle',
  '6pax': '6 Passenger Vehicle',
  '14pax': '14 Passenger Vehicle',
}
const PAYMENT_METHODS = ['card_on_file', 'card', 'apple_pay', 'google_pay', 'cash']
const ACTIVE_TRIP = ['requested', 'assigned', 'started', 'arrived', 'picked_up']
const ACTIVE_ORDER = ['requested', 'assigned', 'shopping', 'on_the_way']
const TRIP_LABELS = {
  requested: 'Requested',
  assigned: 'Confirmed',
  started: 'Driver on the way',
  arrived: 'Driver arrived',
  picked_up: 'On your way',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  no_show: 'No-show',
}
const ORDER_LABELS = {
  requested: 'Requested',
  assigned: 'Confirmed',
  shopping: 'Shopping at Publix',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TRANSFER_SELECT = `
  *,
  driver:profiles!driver_id (id, name),
  vehicle:vehicles!vehicle_id (id, make, model, plate, vehicle_type, capacity, show_name),
  community:communities!community_id (id, name)
`
const ORDER_SELECT = `
  *,
  shopper:profiles!shopper_id (id, name),
  community:communities!community_id (id, name)
`

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Images only'))
      return
    }
    cb(null, true)
  },
})

// ---------- helpers ----------

function money(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2))
}

function isUuid(value) {
  return UUID_RE.test(String(value || ''))
}

function firstName(name, email) {
  const clean = String(name || '').trim()
  if (clean) return clean.split(/\s+/)[0]
  return String(email || '').split('@')[0] || 'there'
}

function greeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE })
      .format(date)
      .replace(/\D/g, '')
  )
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE })
}

function vehicleLabel(vehicle) {
  if (!vehicle) return null
  return `${vehicle.make} ${vehicle.model} (${vehicle.plate})`
}

function extensionFor(mimetype) {
  if (mimetype === 'image/png') return 'png'
  if (mimetype === 'image/webp') return 'webp'
  if (mimetype === 'image/gif') return 'gif'
  return 'jpg'
}

function anonClient() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function passwordSession(email, password) {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password })
  if (error) return { error }
  const session = data.session
  return {
    userId: data.user?.id,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
    },
  }
}

function profileView(profile) {
  return {
    id: profile.id,
    name: profile.name,
    first_name: firstName(profile.name, profile.email),
    email: profile.email,
    phone: profile.phone || null,
    avatar_url: profile.avatar_url || null,
    roles: profile.roles || [],
  }
}

async function loadProfile(id) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, phone, avatar_url, roles, is_active')
    .eq('id', id)
    .maybeSingle()
  return data || null
}

async function loadBooking(guestId) {
  const { data } = await supabase
    .from('guest_bookings')
    .select('*, community:communities!community_id (id, name, zone, default_airport, lat, lng, radius_miles)')
    .eq('guest_id', guestId)
    .eq('is_active', true)
    .maybeSingle()
  return data || null
}

function bookingView(booking) {
  if (!booking) return null
  const name = booking.community?.name || null
  return {
    id: booking.id,
    community_id: booking.community_id,
    community_name: name,
    default_airport: booking.community?.default_airport || null,
    location_label: name ? `${name}, FL` : null,
    property_address: booking.property_address,
    check_in: booking.check_in,
    check_out: booking.check_out,
    guests_count: booking.guests_count,
    updated_at: booking.updated_at,
  }
}

function stayLabel(booking) {
  if (!booking?.check_in) return null
  const today = new Date().toISOString().slice(0, 10)
  if (booking.check_out && booking.check_out < today) return 'Past Stay'
  if (booking.check_in <= today) return 'Current Stay'
  return 'Upcoming Stay'
}

async function resolveCommunity({ community_id, community }) {
  let query = supabase
    .from('communities')
    .select('id, name, zone, default_airport, lat, lng, radius_miles')
    .eq('is_active', true)
  if (community_id) query = query.eq('id', community_id)
  else if (community) query = query.ilike('name', String(community).trim())
  else return null
  const { data } = await query.maybeSingle()
  return data || null
}

async function loadCatalog() {
  const { data, error } = await supabase
    .from('service_catalog')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  const rows = (data || []).map((row) => ({ ...row, price: round2(row.price) }))
  const ofKind = (kind) => rows.filter((row) => row.kind === kind)
  return {
    grocery: {
      packages: ofKind('grocery_package'),
      addons: ofKind('grocery_addon'),
      stocking: ofKind('grocery_stocking'),
    },
    transfer: { addons: ofKind('transfer_addon') },
  }
}

async function notifyAdmins({ message, transfer_id = null, grocery_order_id = null }) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .contains('roles', ['admin'])
    .eq('is_active', true)
  for (const admin of admins || []) {
    await notify({ user_id: admin.id, message, transfer_id, grocery_order_id })
  }
}

async function logTrip(transferId, status, userId) {
  await supabase.from('trip_status_log').insert({ transfer_id: transferId, status, updated_by: userId })
}

async function logOrder(orderId, status, userId) {
  await supabase.from('grocery_status_log').insert({ order_id: orderId, status, updated_by: userId })
}

function guidePath(guide) {
  if (guide.kind === 'restaurant') return `/app/explore/restaurant/${guide.detail_slug || guide.slug}`
  if (guide.kind === 'beach') return `/app/explore/beach/${guide.detail_slug || guide.slug}`
  return `/app/explore/vendors/${guide.slug}`
}

function guideView(guide, extra = {}) {
  return {
    id: guide.id,
    key: guide.slug,
    slug: guide.slug,
    title: guide.title,
    kind: guide.kind,
    detail_slug: guide.detail_slug,
    image: guide.image_url,
    from: guide.price_from,
    vendors: guide.vendor_count,
    place: guide.place,
    filters: guide.filters || [],
    is_pick: guide.is_pick,
    to: guidePath(guide),
    ...extra,
  }
}

function vendorPath(vendor) {
  if (vendor.kind === 'restaurant') return `/app/explore/restaurant/${vendor.slug}`
  if (vendor.kind === 'beach') return `/app/explore/beach/${vendor.slug}`
  return `/app/explore/vendor/${vendor.slug}`
}

function vendorView(vendor, extra = {}) {
  return {
    id: vendor.id,
    slug: vendor.slug,
    kind: vendor.kind,
    guide_slug: vendor.guide_slug,
    name: vendor.name,
    subtitle: vendor.subtitle,
    place: vendor.place,
    community: vendor.community,
    cuisine: vendor.cuisine,
    rating: vendor.rating === null || vendor.rating === undefined ? null : Number(vendor.rating),
    reviews: vendor.review_count,
    desc: vendor.description,
    about: vendor.about,
    services: vendor.services || [],
    tags: vendor.tags || [],
    amenities: vendor.amenities || [],
    rules: vendor.rules || [],
    hours: vendor.hours,
    hours_today: vendor.hours_today,
    map: vendor.map_name
      ? { name: vendor.map_name, line1: vendor.map_line1, line2: vendor.map_line2 }
      : null,
    phone: vendor.phone,
    website_url: vendor.website_url,
    booking_url: vendor.booking_url,
    directions_url: vendor.directions_url,
    image: vendor.image_url,
    from: money(vendor.price_from),
    to: vendorPath(vendor),
    ...extra,
  }
}

async function findVendor(key) {
  let query = supabase.from('explore_vendors').select('*').eq('is_active', true)
  query = isUuid(key) ? query.eq('id', key) : query.eq('slug', key)
  const { data } = await query.maybeSingle()
  return data || null
}

function transferView(transfer, extra = {}) {
  const airport = transfer.airport
  const isArrival = transfer.direction === 'from_airport'
  const total = money(transfer.customer_charge) || 0
  return {
    id: transfer.id,
    trip_number: transfer.trip_number,
    status: transfer.status,
    status_label: TRIP_LABELS[transfer.status] || transfer.status,
    trip_type: isArrival ? 'arrival' : 'departure',
    direction: transfer.direction,
    airport,
    airport_label: AIRPORTS[airport] || airport,
    community: transfer.community?.name || null,
    community_id: transfer.community_id,
    address: isArrival ? transfer.dropoff_address : transfer.pickup_address,
    pickup_address: transfer.pickup_address,
    dropoff_address: transfer.dropoff_address,
    scheduled_at: transfer.scheduled_at,
    date_label: formatDate(transfer.scheduled_at),
    time_label: formatTime(transfer.scheduled_at),
    passengers: transfer.passengers,
    bags: transfer.bags,
    flight_number: transfer.flight_number,
    vehicle_type: transfer.vehicle_type,
    vehicle: VEHICLE_LABELS[transfer.vehicle_type] || transfer.vehicle_type,
    base_price: money(transfer.base_price),
    addons: transfer.addons || [],
    total,
    tip_amount: money(transfer.tip_amount) || 0,
    payment_method: transfer.payment_method,
    payment_status: transfer.payment_status,
    driver: transfer.driver ? { id: transfer.driver.id, name: tripFirstName(transfer.driver.name) } : null,
    vehicle_label: vehicleGuestLabel(transfer.vehicle),
    call_number: transfer.driver_id && ACTIVE_TRIP.includes(transfer.status) ? maskedCallNumber() : null,
    arrived_at: transfer.arrived_at,
    picked_up_at: transfer.picked_up_at,
    cancellation_fee: money(transfer.cancellation_fee) || 0,
    no_show_fee: money(transfer.no_show_fee) || 0,
    discount_percent: money(transfer.discount_percent) || 0,
    round_trip_group_id: transfer.round_trip_group_id || null,
    links: transfer.guest_token ? guestLinks(transfer) : null,
    notes: transfer.notes,
    started_at: transfer.started_at,
    completed_at: transfer.completed_at,
    created_at: transfer.created_at,
    ...extra,
  }
}

function orderView(order, extra = {}) {
  const addons = order.addons || []
  const addonsTotal = round2(addons.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0))
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    status_label: ORDER_LABELS[order.status] || order.status,
    package: order.package,
    stocking: order.stocking,
    addons,
    addons_total: addonsTotal,
    service_fee: money(order.service_fee) || 0,
    grocery_total: money(order.grocery_total) || 0,
    total: money(order.customer_charge) || 0,
    tip_amount: money(order.tip_amount) || 0,
    items: order.items || [],
    delivery_address: order.delivery_address,
    community: order.community?.name || null,
    delivery_time: order.delivery_time,
    date_label: formatDate(order.delivery_time),
    time_label: formatTime(order.delivery_time),
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    grocery_payment_status: order.grocery_payment_status,
    card_saved: Boolean(order.card_saved_at),
    shopper: order.shopper ? { id: order.shopper.id, name: order.shopper.name } : null,
    notes: order.notes,
    list_file_url: order.list_file_url,
    started_at: order.started_at,
    delivered_at: order.delivered_at,
    created_at: order.created_at,
    ...extra,
  }
}

async function loadTransfer(id, guestId) {
  const { data } = await supabase
    .from('transfers')
    .select(TRANSFER_SELECT)
    .eq('id', id)
    .eq('guest_id', guestId)
    .maybeSingle()
  return data || null
}

async function loadOrder(id, guestId) {
  const { data } = await supabase
    .from('grocery_orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .eq('guest_id', guestId)
    .maybeSingle()
  return data || null
}

async function quoteTransfer(body, booking) {
  const direction =
    body.direction || (body.trip_type === 'departure' ? 'to_airport' : 'from_airport')
  if (!['to_airport', 'from_airport'].includes(direction)) {
    throw httpError(400, 'direction must be to_airport or from_airport')
  }
  const airport = String(body.airport || booking?.community?.default_airport || '').toUpperCase()
  if (!AIRPORTS[airport]) throw httpError(400, 'airport must be ECP, VPS, or PNS')
  const vehicle_type = body.vehicle_type || '4pax'
  if (!VEHICLE_TYPES.includes(vehicle_type)) {
    throw httpError(400, 'vehicle_type must be 4pax, 6pax, or 14pax')
  }

  const community = await resolveCommunity({
    community_id: body.community_id || (!body.community ? booking?.community_id : null),
    community: body.community,
  })
  if (!community) throw httpError(400, 'community not found (send community_id or community name)')

  const priced = await getBasePrice({ community_id: community.id, airport, vehicle_type })
  const catalog = await loadCatalog()
  const requested = Array.isArray(body.addons)
    ? body.addons
    : body.holiday
      ? ['transfer-holiday']
      : []
  const addons = catalog.transfer.addons
    .filter((addon) => requested.includes(addon.key))
    .map((addon) => ({ key: addon.key, name: addon.name, price: addon.price }))
  const base_price = round2(priced.base_price)
  const addons_total = round2(addons.reduce((sum, addon) => sum + addon.price, 0))
  const list_total = round2(base_price + addons_total)
  // Round trip booked together = 5% off both legs (pricing rules sheet).
  const round_trip = Boolean(body.round_trip || body.return_trip)
  const discount_percent = round_trip ? ROUND_TRIP_DISCOUNT_PERCENT : 0
  const total = round2(list_total * (1 - discount_percent / 100))

  return {
    direction,
    trip_type: direction === 'to_airport' ? 'departure' : 'arrival',
    airport,
    airport_label: AIRPORTS[airport],
    vehicle_type,
    vehicle: VEHICLE_LABELS[vehicle_type],
    community,
    base_price,
    addons,
    addons_total,
    list_total,
    round_trip,
    discount_percent,
    discount_amount: round2(list_total - total),
    total,
    round_trip_total: round_trip ? round2(total * 2) : total,
    available_addons: catalog.transfer.addons,
  }
}

async function quoteGrocery(body) {
  const catalog = await loadCatalog()
  const pkg = catalog.grocery.packages.find((row) => row.key === body.package)
  if (!pkg) throw httpError(400, 'package must be one of: ' + catalog.grocery.packages.map((r) => r.key).join(', '))
  const stockingKey = body.stocking || 'bags'
  const stocking = catalog.grocery.stocking.find((row) => row.key === stockingKey)
  if (!stocking) throw httpError(400, 'stocking must be one of: ' + catalog.grocery.stocking.map((r) => r.key).join(', '))
  const requested = Array.isArray(body.addons)
    ? body.addons
    : Object.entries(body.addons || {})
        .filter(([, on]) => Boolean(on))
        .map(([key]) => key)
  const addons = catalog.grocery.addons
    .filter((addon) => requested.includes(addon.key))
    .map((addon) => ({ key: addon.key, name: addon.name, price: addon.price }))
  const addons_total = round2(addons.reduce((sum, addon) => sum + addon.price, 0))
  const service_fee = round2(pkg.price + stocking.price + addons_total)
  return {
    package: { key: pkg.key, name: pkg.name, items: pkg.sub, price: pkg.price, unit: pkg.unit },
    stocking: { key: stocking.key, name: stocking.name, desc: stocking.sub, price: stocking.price },
    addons,
    addons_total,
    package_fee: pkg.price,
    stocking_fee: stocking.price,
    service_fee,
    total_label: `$${service_fee} + Publix`,
  }
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function sendError(res, next, error) {
  if (error?.status === 400 || error?.status === 404) {
    return res.status(error.status).json({ error: error.message })
  }
  return next(error)
}

// Shared by the transfer and grocery /pay endpoints: 'cash' needs no Stripe interaction; every
// other method goes through one manual-capture PaymentIntent that Stripe Elements confirms on
// the client, then staff capture it when the trip/order completes (existing capture code path).
async function authorizeCardPayment({ user, amount, existingPaymentIntentId, metadata }) {
  if (!isStripeUsable(amount)) return { skipped: true, reason: 'INVALID_AMOUNT' }

  if (existingPaymentIntentId) {
    const existing = await retrievePaymentIntent(existingPaymentIntentId)
    if (existing && !existing.skipped) {
      const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action']
      if (reusable.includes(existing.status) && existing.amount === Math.round(amount * 100)) {
        return { intent: existing }
      }
    }
  }

  const customerId = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    name: user.name,
  })
  if (customerId?.skipped) return customerId

  const intent = await createPaymentIntent({ amount, customerId, metadata })
  if (intent?.skipped) return intent
  return { intent }
}

function isStripeUsable(amount) {
  return Number.isFinite(amount) && amount > 0
}

function paymentIntentView(result) {
  if (!result || result.skipped) {
    return { stripe_skipped: true, stripe_skip_reason: result?.reason || 'STRIPE_NOT_CONFIGURED' }
  }
  return {
    client_secret: result.intent.client_secret,
    payment_intent_status: result.intent.status,
    stripe_publishable_key: getPublishableKey(),
  }
}

// Grocery /pay: saves a card (SetupIntent, no hold) rather than authorizing an amount — the exact
// total (service fee + Publix receipt) is only known at delivery, so that's when it's charged,
// in one off-session charge against this saved card (see chargeSavedCard in grocery.js /deliver).
async function saveCardOnFile({ user }) {
  const customerId = await ensureStripeCustomer({ userId: user.id, email: user.email, name: user.name })
  if (customerId?.skipped) return customerId
  const intent = await createSetupIntent({ customerId })
  if (intent?.skipped) return intent
  return { intent }
}

function setupIntentView(result) {
  if (!result || result.skipped) {
    return { stripe_skipped: true, stripe_skip_reason: result?.reason || 'STRIPE_NOT_CONFIGURED' }
  }
  return {
    client_secret: result.intent.client_secret,
    setup_intent_status: result.intent.status,
    stripe_publishable_key: getPublishableKey(),
  }
}

// ---------- public: signup / login ----------

router.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const phone = String(req.body?.phone || '').trim() || null

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role: 'guest' },
    })
    if (error) {
      const status = /already|exists|registered/i.test(error.message) ? 409 : 400
      return res.status(status).json({ error: error.message })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, email, name, phone, roles: ['guest'] }, { onConflict: 'id' })
      .select('id, name, email, phone, avatar_url, roles')
      .single()
    if (profileError) return res.status(400).json({ error: profileError.message })

    const { session, error: sessionError } = await passwordSession(email, password)
    res.status(201).json({
      user: profileView(profile),
      session: session || null,
      ...(sessionError ? { session_error: sessionError.message } : {}),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    const { userId, session, error } = await passwordSession(email, password)
    if (error) return res.status(401).json({ error: 'Invalid email or password' })

    const profile = await loadProfile(userId)
    if (!profile) return res.status(401).json({ error: 'Invalid email or password' })
    if (profile.is_active === false) return res.status(403).json({ error: 'Account disabled' })
    if (!(profile.roles || []).includes('guest')) {
      return res.status(403).json({
        error: 'This account is not a guest account. Please use the staff login.',
      })
    }
    res.json({ user: profileView(profile), session })
  } catch (error) {
    next(error)
  }
})

router.use(requireAuth)

// ---------- profile & stay ----------

router.get('/me', async (req, res, next) => {
  try {
    const [profile, booking, saved, trips, orders] = await Promise.all([
      loadProfile(req.user.id),
      loadBooking(req.user.id),
      supabase.from('saved_places').select('*', { count: 'exact', head: true }).eq('guest_id', req.user.id),
      supabase.from('transfers').select('*', { count: 'exact', head: true }).eq('guest_id', req.user.id),
      supabase.from('grocery_orders').select('*', { count: 'exact', head: true }).eq('guest_id', req.user.id),
    ])
    if (!profile) return res.status(404).json({ error: 'Profile not found' })
    res.json({
      profile: profileView(profile),
      booking: bookingView(booking),
      stay_label: stayLabel(booking),
      stats: {
        saved_places: saved.count || 0,
        transfers: trips.count || 0,
        grocery_orders: orders.count || 0,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/me', async (req, res, next) => {
  try {
    const updates = {}
    if (req.body?.name !== undefined) updates.name = String(req.body.name).trim()
    if (req.body?.phone !== undefined) updates.phone = String(req.body.phone).trim() || null
    if (req.body?.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url || null
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    if (updates.name === '') return res.status(400).json({ error: 'name cannot be empty' })
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, phone, avatar_url, roles')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(profileView(data))
  } catch (error) {
    next(error)
  }
})

router.get('/booking', guestOnly, async (req, res, next) => {
  try {
    res.json(bookingView(await loadBooking(req.user.id)))
  } catch (error) {
    next(error)
  }
})

router.put('/booking', guestOnly, async (req, res, next) => {
  try {
    const body = req.body || {}
    const updates = { updated_at: new Date().toISOString() }
    let community = null
    if (body.community_id !== undefined || body.community !== undefined) {
      community = await resolveCommunity(body)
      if (!community) return res.status(400).json({ error: 'community not found' })
      updates.community_id = community.id
    }
    for (const field of ['property_address', 'check_in', 'check_out']) {
      if (body[field] !== undefined) updates[field] = body[field] || null
    }
    if (body.guests_count !== undefined) {
      const count = Number(body.guests_count)
      if (!Number.isInteger(count) || count < 1) {
        return res.status(400).json({ error: 'guests_count must be a positive integer' })
      }
      updates.guests_count = count
    }

    const existing = await loadBooking(req.user.id)

    // Whichever of community/address didn't change this call still needs checking against
    // whichever did — e.g. changing just the address must be re-checked against the community
    // already on file, and vice versa.
    const finalAddress = 'property_address' in updates ? updates.property_address : existing?.property_address
    const finalCommunity = community || existing?.community || null
    if (finalAddress && finalCommunity) {
      await enforceAddressInCommunity({
        address: finalAddress,
        lat: body.lat,
        lon: body.lon,
        community: finalCommunity,
      })
    }

    const query = existing
      ? supabase.from('guest_bookings').update(updates).eq('id', existing.id)
      : supabase.from('guest_bookings').insert({ guest_id: req.user.id, is_active: true, ...updates })
    const { error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.status(existing ? 200 : 201).json(bookingView(await loadBooking(req.user.id)))
  } catch (error) {
    sendError(res, next, error)
  }
})

router.delete('/booking', guestOnly, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('guest_bookings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('guest_id', req.user.id)
      .eq('is_active', true)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

router.get('/communities', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('communities')
      .select('id, name, zone, default_airport')
      .eq('is_active', true)
      .order('name')
    if (error) return res.status(400).json({ error: error.message })
    res.json(data || [])
  } catch (error) {
    next(error)
  }
})

// Live address suggestions as the guest types (debounced client-side). Not scoped to a single
// community — we want to also surface "looks like this is actually in <other community>" cases.
router.get('/address-autocomplete', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 3) return res.json([])
    const results = await geocodeQuery(q, { limit: 6 })
    res.json(
      results.map((r) => ({
        label: r.label,
        lat: r.lat,
        lon: r.lon,
        address: r.address,
      }))
    )
  } catch (error) {
    sendError(res, next, error)
  }
})

// Confirms a typed/selected address actually falls inside the community the guest picked — the
// same fixed transfer_pricing row only applies when the address really is inside that community.
router.post('/address-check', async (req, res, next) => {
  try {
    const body = req.body || {}
    const address = String(body.address || '').trim()
    if (!address && !(Number.isFinite(body.lat) && Number.isFinite(body.lon))) {
      return res.status(400).json({ error: 'address is required' })
    }
    const community = await resolveCommunity(body)
    if (!community) return res.status(400).json({ error: 'community not found' })

    const result = await checkAddressAgainstCommunity({
      address,
      lat: body.lat,
      lon: body.lon,
      community,
    })
    res.json(result)
  } catch (error) {
    sendError(res, next, error)
  }
})

router.get('/catalog', async (_req, res, next) => {
  try {
    res.json({ ...(await loadCatalog()), airports: AIRPORTS, vehicle_types: VEHICLE_LABELS })
  } catch (error) {
    next(error)
  }
})

// ---------- home feed ----------

router.get('/home', guestOnly, async (req, res, next) => {
  try {
    const [profile, booking, trips, orders, categories, picks, unread] = await Promise.all([
      loadProfile(req.user.id),
      loadBooking(req.user.id),
      supabase
        .from('transfers')
        .select(TRANSFER_SELECT)
        .eq('guest_id', req.user.id)
        .in('status', ACTIVE_TRIP)
        .order('scheduled_at', { ascending: true })
        .limit(3),
      supabase
        .from('grocery_orders')
        .select(ORDER_SELECT)
        .eq('guest_id', req.user.id)
        .in('status', ACTIVE_ORDER)
        .order('delivery_time', { ascending: true })
        .limit(3),
      supabase.from('explore_categories').select('*').eq('is_active', true).order('sort_order'),
      // "Vitoria's Pick" highlights real, genuinely well-reviewed partners (not a curated
      // category shortcut) — the client's own data only has real ratings for a handful of
      // vendors, so that's the actual pool, ranked by rating then review count.
      supabase
        .from('explore_vendors')
        .select('slug, name, place, rating, review_count, image_url')
        .eq('is_active', true)
        .eq('kind', 'vendor')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(3),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false),
    ])

    const activeOrders = [
      ...(orders.data || []).map((order) => ({
        key: `grocery-${order.id}`,
        kind: 'grocery',
        id: order.id,
        title: 'Grocery Orders',
        status: order.status,
        status_label: ORDER_LABELS[order.status] || order.status,
        meta: `Delivery ${formatWhen(order.delivery_time)}`,
        to: `/app/grocery/track?id=${order.id}`,
      })),
      ...(trips.data || []).map((trip) => ({
        key: `transfer-${trip.id}`,
        kind: 'transfer',
        id: trip.id,
        title: 'Airport Transfer',
        status: trip.status,
        status_label: TRIP_LABELS[trip.status] || trip.status,
        meta: `${formatWhen(trip.scheduled_at)} · ${trip.airport} Airport`,
        to: `/app/transfer/track?id=${trip.id}`,
      })),
    ]

    const view = bookingView(booking)
    res.json({
      greeting: greeting(),
      profile: profile ? profileView(profile) : null,
      booking: view,
      location_label: view?.location_label || '30A, FL',
      unread_count: unread.count || 0,
      orders: activeOrders,
      explore: (categories.data || []).map((category) => ({
        key: category.key,
        label: category.label,
        tone: category.tone,
        icon: category.icon,
        to: category.target === 'info' ? '/app/explore/info' : `/app/explore/${category.target}`,
      })),
      picks: (picks.data || []).map((vendor) => ({
        key: vendor.slug,
        title: vendor.name,
        image: vendor.image_url,
        place: vendor.place,
        to: `/app/explore/vendor/${vendor.slug}`,
        rating: Number(vendor.rating),
        reviews: vendor.review_count,
      })),
    })
  } catch (error) {
    next(error)
  }
})

// ---------- Explore 30A ----------

router.get('/explore', async (_req, res, next) => {
  try {
    const { data: categories, error } = await supabase
      .from('explore_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) return res.status(400).json({ error: error.message })

    // Each guide belongs to exactly one tile (category_key) — count real active vendors per
    // tile so the grid shows an honest "N places" instead of a hand-typed number that can drift.
    const { data: guides } = await supabase
      .from('explore_guides')
      .select('slug, category_key')
      .eq('is_active', true)
      .not('category_key', 'is', null)
    const categoryForSlug = Object.fromEntries((guides || []).map((g) => [g.slug, g.category_key]))
    const { data: vendors } = await supabase
      .from('explore_vendors')
      .select('guide_slug')
      .eq('is_active', true)
      .eq('kind', 'vendor')
    const counts = {}
    for (const vendor of vendors || []) {
      const key = categoryForSlug[vendor.guide_slug]
      if (key) counts[key] = (counts[key] || 0) + 1
    }

    res.json({
      categories: categories.map((category) => ({
        key: category.key,
        label: category.label,
        tone: category.tone,
        icon: category.icon,
        image_url: category.image_url,
        coming_soon: category.coming_soon,
        count: counts[category.key] || 0,
        to: category.target === 'info' ? '/app/explore/info' : `/app/explore/${category.target}`,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/explore/guide', async (req, res, next) => {
  try {
    const categoryKey = String(req.query.c || '').trim()
    let query = supabase.from('explore_guides').select('*').eq('is_active', true).order('sort_order')
    if (categoryKey) query = query.eq('category_key', categoryKey)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json({ category: categoryKey || null, items: (data || []).map((guide) => guideView(guide)) })
  } catch (error) {
    next(error)
  }
})

router.get('/explore/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json({ guides: [], vendors: [] })
    const like = `%${q.replace(/[%_]/g, '')}%`
    const [guides, vendors] = await Promise.all([
      supabase.from('explore_guides').select('*').eq('is_active', true).ilike('title', like).limit(10),
      supabase
        .from('explore_vendors')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.${like},place.ilike.${like},description.ilike.${like}`)
        .limit(10),
    ])
    res.json({
      guides: (guides.data || []).map((guide) => guideView(guide)),
      vendors: (vendors.data || []).map((vendor) => vendorView(vendor)),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/explore/vendors/:slug', async (req, res, next) => {
  try {
    const { data: guide } = await supabase
      .from('explore_guides')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .maybeSingle()
    if (!guide) return res.status(404).json({ error: 'Guide not found' })
    const { data, error } = await supabase
      .from('explore_vendors')
      .select('*')
      .eq('guide_slug', guide.slug)
      .eq('is_active', true)
      .order('sort_order')
    if (error) return res.status(400).json({ error: error.message })
    const vendors = (data || []).map((vendor) => vendorView(vendor))
    res.json({ guide: guideView(guide), title: guide.title, count: vendors.length, vendors })
  } catch (error) {
    next(error)
  }
})

router.get('/explore/vendor/:key', async (req, res, next) => {
  try {
    const vendor = await findVendor(req.params.key)
    if (!vendor) return res.status(404).json({ error: 'Place not found' })

    let saved = false
    if ((req.user.roles || []).includes('guest')) {
      const { data } = await supabase
        .from('saved_places')
        .select('id')
        .eq('guest_id', req.user.id)
        .eq('vendor_id', vendor.id)
        .maybeSingle()
      saved = Boolean(data)
    }

    let back = '/app/explore'
    if (vendor.kind === 'restaurant') back = '/app/explore/guide?c=restaurants'
    else if (vendor.kind === 'beach') back = '/app/explore/info?focus=beach-access'
    else if (vendor.guide_slug) back = `/app/explore/vendors/${vendor.guide_slug}`

    res.json(vendorView(vendor, { saved, back }))
  } catch (error) {
    next(error)
  }
})

router.get('/explore/info', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('public_info_sections')
      .select('key, title, items, sort_order')
      .eq('is_active', true)
      .order('sort_order')
    if (error) return res.status(400).json({ error: error.message })
    // Free public layer (beach accesses, parks & playgrounds, emergency numbers) — facts, never partners.
    const { data: places } = await supabase
      .from('public_places')
      .select('section_key, section_title, name, community, details, sort_order')
      .eq('is_active', true)
      .order('sort_order')
    const grouped = []
    for (const place of places || []) {
      let section = grouped.find((s) => s.key === place.section_key)
      if (!section) {
        section = { key: place.section_key, title: place.section_title, places: [] }
        grouped.push(section)
      }
      section.places.push({ name: place.name, community: place.community, details: place.details })
    }
    res.json({ sections: data || [], places: grouped })
  } catch (error) {
    next(error)
  }
})

// ---------- saved places ----------

router.get('/saved', guestOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('saved_places')
      .select('id, created_at, vendor:explore_vendors!vendor_id (*)')
      .eq('guest_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    res.json(
      (data || [])
        .filter((row) => row.vendor)
        .map((row) => vendorView(row.vendor, { saved: true, saved_id: row.id, saved_at: row.created_at }))
    )
  } catch (error) {
    next(error)
  }
})

router.post('/saved/:key', guestOnly, async (req, res, next) => {
  try {
    const vendor = await findVendor(req.params.key)
    if (!vendor) return res.status(404).json({ error: 'Place not found' })
    const { error } = await supabase
      .from('saved_places')
      .upsert({ guest_id: req.user.id, vendor_id: vendor.id }, { onConflict: 'guest_id,vendor_id' })
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ saved: true, vendor_id: vendor.id, slug: vendor.slug })
  } catch (error) {
    next(error)
  }
})

router.delete('/saved/:key', guestOnly, async (req, res, next) => {
  try {
    const vendor = await findVendor(req.params.key)
    if (!vendor) return res.status(404).json({ error: 'Place not found' })
    const { error } = await supabase
      .from('saved_places')
      .delete()
      .eq('guest_id', req.user.id)
      .eq('vendor_id', vendor.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ saved: false, vendor_id: vendor.id, slug: vendor.slug })
  } catch (error) {
    next(error)
  }
})

// ---------- airport transfers ----------

// Guest-typed address vs. selected community: hard-blocks a mismatch (fixed per-community pricing
// only makes sense if the address is actually inside that community), but never blocks a booking
// just because the geocoder itself is unreachable — that's a service hiccup, not a bad address.
async function enforceAddressInCommunity({ address, lat, lon, community }) {
  let check
  try {
    check = await checkAddressAgainstCommunity({ address, lat, lon, community })
  } catch (error) {
    console.error('address-community check failed, allowing booking to proceed:', error.message)
    return null
  }
  if (check.reason === 'NOT_FOUND') throw httpError(400, check.message)
  if (!check.ok) throw httpError(400, check.message)
  return check
}

router.post('/transfers/quote', guestOnly, async (req, res, next) => {
  try {
    const booking = await loadBooking(req.user.id)
    const quote = await quoteTransfer(req.body || {}, booking)
    const credit = await availableCredit({ guest_id: req.user.id, guest_email: req.user.email })
    let address_check = null
    const body = req.body || {}
    const address = String(body.address || booking?.property_address || '').trim()
    if (address || (Number.isFinite(body.lat) && Number.isFinite(body.lon))) {
      address_check = await checkAddressAgainstCommunity({
        address,
        lat: body.lat,
        lon: body.lon,
        community: quote.community,
      }).catch(() => null)
    }
    res.json({ ...quote, available_credit: credit.total, address_check })
  } catch (error) {
    sendError(res, next, error)
  }
})

router.post('/transfers', guestOnly, async (req, res, next) => {
  try {
    const body = req.body || {}
    const booking = await loadBooking(req.user.id)
    const address = String(body.address || booking?.property_address || '').trim()
    if (!address) return res.status(400).json({ error: 'address is required' })
    if (!body.scheduled_at || Number.isNaN(new Date(body.scheduled_at).getTime())) {
      return res.status(400).json({ error: 'scheduled_at (ISO datetime) is required' })
    }
    const passengers = Number(body.passengers ?? 1)
    const bags = Number(body.bags ?? 0)
    if (!Number.isInteger(passengers) || passengers < 1) {
      return res.status(400).json({ error: 'passengers must be a positive integer' })
    }
    if (!Number.isInteger(bags) || bags < 0) {
      return res.status(400).json({ error: 'bags must be a non-negative integer' })
    }
    if (body.payment_method && !PAYMENT_METHODS.includes(body.payment_method)) {
      return res.status(400).json({ error: 'invalid payment_method' })
    }

    const quote = await quoteTransfer(body, booking)
    await enforceAddressInCommunity({ address, lat: body.lat, lon: body.lon, community: quote.community })
    const profile = await loadProfile(req.user.id)
    const isArrival = quote.direction === 'from_airport'
    const insert = {
      guest_id: req.user.id,
      guest_name: String(body.guest_name || profile?.name || req.user.email).trim(),
      guest_phone: String(body.guest_phone || profile?.phone || '').trim() || null,
      guest_email: req.user.email,
      pickup_address: isArrival ? AIRPORTS[quote.airport] : address,
      dropoff_address: isArrival ? address : AIRPORTS[quote.airport],
      community_id: quote.community.id,
      airport: quote.airport,
      direction: quote.direction,
      vehicle_type: quote.vehicle_type,
      passengers,
      bags,
      flight_number: body.flight_number ? String(body.flight_number).trim() : null,
      scheduled_at: new Date(body.scheduled_at).toISOString(),
      payment_method: body.payment_method || null,
      customer_charge: quote.total,
      base_price: quote.base_price,
      addons: quote.addons,
      cash_expected: quote.total,
      status: 'requested',
      notes: body.notes ? String(body.notes).trim() : null,
      created_by: req.user.id,
    }

    insert.discount_percent = quote.discount_percent

    // Apply any "$25 on your next booking" credit to the first leg.
    const credit = await availableCredit({ guest_id: req.user.id, guest_email: req.user.email })
    if (credit.total > 0) {
      const charged = round2(Math.max(0, quote.total - credit.total))
      insert.customer_charge = charged
      insert.cash_expected = charged
      insert.notes = [insert.notes, `Credit applied: $${credit.total}`].filter(Boolean).join('\n')
    }

    // Round trip: second leg mirrors the first (direction/addresses swapped), same 5% discount.
    const returnTrip = body.return_trip && body.return_trip.scheduled_at ? body.return_trip : null
    if (returnTrip && Number.isNaN(new Date(returnTrip.scheduled_at).getTime())) {
      return res.status(400).json({ error: 'return_trip.scheduled_at must be an ISO datetime' })
    }
    const rows = [insert]
    if (returnTrip) {
      const groupId = crypto.randomUUID()
      insert.round_trip_group_id = groupId
      rows.push({
        ...insert,
        direction: isArrival ? 'to_airport' : 'from_airport',
        pickup_address: insert.dropoff_address,
        dropoff_address: insert.pickup_address,
        scheduled_at: new Date(returnTrip.scheduled_at).toISOString(),
        flight_number: returnTrip.flight_number ? String(returnTrip.flight_number).trim() : null,
        customer_charge: quote.total,
        cash_expected: quote.total,
        notes: body.notes ? String(body.notes).trim() : null,
      })
    }

    const { data: created, error } = await supabase
      .from('transfers')
      .insert(rows)
      .select(TRANSFER_SELECT)
    if (error) return res.status(400).json({ error: error.message })
    const data = created[0]
    const returnLeg = created[1] || null
    if (credit.total > 0) await consumeCredits(credit.ids, data.id)

    for (const row of created) {
      await logTrip(row.id, 'requested', req.user.id)
      await notifyAdmins({
        transfer_id: row.id,
        message: `New transfer request #${row.trip_number} from ${insert.guest_name} · ${formatWhen(row.scheduled_at)} · ${row.pickup_address} → ${row.dropoff_address} · $${money(row.customer_charge)}${returnLeg ? ' · round trip (5% off)' : ''}`,
      })
    }
    await notify({
      user_id: req.user.id,
      transfer_id: data.id,
      message: `We received your airport transfer request #${data.trip_number}${returnLeg ? ` and return #${returnLeg.trip_number}` : ''}. We’ll confirm your driver shortly.`,
    })

    res.status(201).json(
      transferView(data, {
        credit_applied: credit.total,
        return_transfer: returnLeg ? transferView(returnLeg) : null,
      })
    )
  } catch (error) {
    sendError(res, next, error)
  }
})

router.get('/transfers', guestOnly, async (req, res, next) => {
  try {
    let query = supabase
      .from('transfers')
      .select(TRANSFER_SELECT)
      .eq('guest_id', req.user.id)
      .order('scheduled_at', { ascending: false })
    if (req.query.active === 'true') query = query.in('status', ACTIVE_TRIP)
    if (req.query.status) query = query.eq('status', req.query.status)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map((row) => transferView(row)))
  } catch (error) {
    next(error)
  }
})

router.get('/transfers/:id', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    const { data: log } = await supabase
      .from('trip_status_log')
      .select('status, created_at')
      .eq('transfer_id', transfer.id)
      .order('created_at', { ascending: true })
    res.json(transferView(transfer, { status_log: log || [] }))
  } catch (error) {
    next(error)
  }
})

router.post('/transfers/:id/pay', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['requested', 'assigned'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Payment can only be set before the trip starts' })
    }
    const payment_method = req.body?.payment_method || 'card_on_file'
    if (!PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'invalid payment_method' })
    }

    const updates = { payment_method, payment_status: 'pending' }
    let extra = { authorized: true }

    if (payment_method === 'cash') {
      // Collected in person; nothing to authorize with Stripe.
    } else {
      const result = await authorizeCardPayment({
        user: req.user,
        amount: money(transfer.customer_charge),
        existingPaymentIntentId: transfer.stripe_payment_intent_id,
        metadata: { my30a_transfer_id: transfer.id, kind: 'transfer' },
      })
      if (!result.skipped) updates.stripe_payment_intent_id = result.intent.id
      extra = { ...extra, ...paymentIntentView(result) }
    }

    const { data, error } = await supabase
      .from('transfers')
      .update(updates)
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(transferView(data, extra))
  } catch (error) {
    next(error)
  }
})

// Fallback for local/dev environments without a public webhook URL: re-fetch the PaymentIntent
// from Stripe directly and reconcile payment_status. The webhook (routes/payments.js) does the
// same thing automatically in production.
router.post('/transfers/:id/sync-payment', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!transfer.stripe_payment_intent_id) {
      return res.json(transferView(transfer, { payment_intent_status: null }))
    }
    const intent = await retrievePaymentIntent(transfer.stripe_payment_intent_id)
    if (intent?.skipped) {
      return res.json(transferView(transfer, { stripe_skipped: true }))
    }
    const payment_status = transfer.payment_status === 'captured' ? 'captured' : mapIntentStatus(intent.status)
    const { data, error } = await supabase
      .from('transfers')
      .update({ payment_status })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(transferView(data, { payment_intent_status: intent.status }))
  } catch (error) {
    next(error)
  }
})

router.post('/transfers/:id/cancel', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!['requested', 'assigned'].includes(transfer.status)) {
      return res.status(400).json({
        error: 'Your driver is already on the way. Message My30A Host to cancel this trip.',
      })
    }
    // Published policy: 48h+ full release · 24–48h $50 · same day $75 (captured from the hold).
    const result = await cancelForGuest({ transfer, actorId: req.user.id, select: TRANSFER_SELECT })
    res.json(transferView(result.transfer, { cancellation_fee: result.fee, cancellation_window: result.window }))
  } catch (error) {
    next(error)
  }
})

// Cancellation preview so the app can show "Cancel now: $0 / $50 / $75" before confirming.
router.get('/transfers/:id/cancellation-preview', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    const { cancellationFeeFor } = await import('../services/tripFlow.js')
    const { fee, window, hours } = cancellationFeeFor(transfer)
    res.json({ fee, window, hours_until_pickup: Math.max(0, Math.round(hours * 10) / 10), can_cancel: ['requested', 'assigned'].includes(transfer.status) })
  } catch (error) {
    next(error)
  }
})

// Per-trip chat with the driver (app guests). Guests without the app use the SMS link instead.
router.get('/transfers/:id/messages', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    const { data } = await supabase
      .from('trip_messages')
      .select('id, sender_role, sender_name, body, created_at')
      .eq('transfer_id', transfer.id)
      .order('created_at', { ascending: true })
      .limit(300)
    // Staff appear by first name only in guest-facing threads.
    const messages = (data || []).map((row) => ({
      ...row,
      sender_name: row.sender_role === 'guest' ? row.sender_name : tripFirstName(row.sender_name),
    }))
    res.json({ messages, chat_open: ACTIVE_TRIP.includes(transfer.status) && Boolean(transfer.driver_id) })
  } catch (error) {
    next(error)
  }
})

router.post('/transfers/:id/messages', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (!ACTIVE_TRIP.includes(transfer.status)) return res.status(410).json({ error: 'This trip has ended. Chat is closed.' })
    if (!transfer.driver_id) return res.status(400).json({ error: 'Chat opens once your driver is confirmed.' })
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'Message is empty' })
    if (body.length > 1000) return res.status(400).json({ error: 'Message is too long' })
    const { data, error } = await supabase
      .from('trip_messages')
      .insert({ transfer_id: transfer.id, sender_role: 'guest', sender_id: req.user.id, sender_name: req.user.name || 'Guest', body })
      .select('id, sender_role, sender_name, body, created_at')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    await notify({
      user_id: transfer.driver_id,
      transfer_id: transfer.id,
      message: `Trip #${transfer.trip_number} · ${tripFirstName(req.user.name)}: ${body.slice(0, 120)}`,
    })
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/transfers/:id/tip', guestOnly, async (req, res, next) => {
  try {
    const transfer = await loadTransfer(req.params.id, req.user.id)
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' })
    if (transfer.status !== 'completed') {
      return res.status(400).json({ error: 'Trip must be completed to add a tip' })
    }
    const tip = money(req.body?.tip_amount)
    if (tip === null || tip < 0) {
      return res.status(400).json({ error: 'tip_amount must be a number >= 0' })
    }
    const { data, error } = await supabase
      .from('transfers')
      .update({ tip_amount: round2(tip) })
      .eq('id', transfer.id)
      .select(TRANSFER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    if (tip > 0 && data.driver_id) {
      await notify({
        user_id: data.driver_id,
        transfer_id: data.id,
        message: `Trip #${data.trip_number} · guest left a $${round2(tip)} tip`,
      })
    }
    res.json(transferView(data))
  } catch (error) {
    next(error)
  }
})

// ---------- grocery orders ----------

router.post('/grocery/quote', guestOnly, async (req, res, next) => {
  try {
    res.json(await quoteGrocery(req.body || {}))
  } catch (error) {
    sendError(res, next, error)
  }
})

router.post('/grocery', guestOnly, async (req, res, next) => {
  try {
    const body = req.body || {}
    const booking = await loadBooking(req.user.id)
    const delivery_address = String(body.delivery_address || booking?.property_address || '').trim()
    if (!delivery_address) return res.status(400).json({ error: 'delivery_address is required' })
    if (!body.delivery_time || Number.isNaN(new Date(body.delivery_time).getTime())) {
      return res.status(400).json({ error: 'delivery_time (ISO datetime) is required' })
    }
    if (body.items !== undefined && !Array.isArray(body.items)) {
      return res.status(400).json({ error: 'items must be an array' })
    }
    if (body.payment_method && !PAYMENT_METHODS.includes(body.payment_method)) {
      return res.status(400).json({ error: 'invalid payment_method' })
    }

    const quote = await quoteGrocery(body)
    const profile = await loadProfile(req.user.id)
    const community = body.community_id || body.community
      ? await resolveCommunity(body)
      : booking?.community_id
        ? { id: booking.community_id }
        : null

    const insert = {
      guest_id: req.user.id,
      guest_name: String(body.guest_name || profile?.name || req.user.email).trim(),
      guest_phone: String(body.guest_phone || profile?.phone || '').trim() || null,
      guest_email: req.user.email,
      delivery_address,
      community_id: community?.id || null,
      package: quote.package.name,
      stocking: quote.stocking.name,
      addons: quote.addons,
      items: body.items || [],
      delivery_time: new Date(body.delivery_time).toISOString(),
      service_fee: quote.service_fee,
      grocery_total: 0,
      customer_charge: quote.service_fee,
      payment_method: body.payment_method || null,
      status: 'requested',
      notes: body.notes ? String(body.notes).trim() : null,
      created_by: req.user.id,
    }

    const { data, error } = await supabase
      .from('grocery_orders')
      .insert(insert)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })

    await logOrder(data.id, 'requested', req.user.id)
    await notifyAdmins({
      grocery_order_id: data.id,
      message: `New grocery request #${data.order_number} from ${insert.guest_name} · ${quote.package.name} · ${formatWhen(data.delivery_time)} · ${delivery_address}`,
    })
    await notify({
      user_id: req.user.id,
      grocery_order_id: data.id,
      message: `Vitoria has your grocery list (#${data.order_number}). We’ll confirm your exact total shortly.`,
    })

    res.status(201).json(orderView(data, { quote }))
  } catch (error) {
    sendError(res, next, error)
  }
})

router.get('/grocery', guestOnly, async (req, res, next) => {
  try {
    let query = supabase
      .from('grocery_orders')
      .select(ORDER_SELECT)
      .eq('guest_id', req.user.id)
      .order('delivery_time', { ascending: false })
    if (req.query.active === 'true') query = query.in('status', ACTIVE_ORDER)
    if (req.query.status) query = query.eq('status', req.query.status)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map((row) => orderView(row)))
  } catch (error) {
    next(error)
  }
})

router.get('/grocery/:id', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const { data: log } = await supabase
      .from('grocery_status_log')
      .select('status, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
    res.json(
      orderView(order, {
        status_log: log || [],
        list_file_signed_url: await getSignedUrl(order.list_file_url),
        receipt_signed_url: await getSignedUrl(order.receipt_url),
        kitchen_signed_url: await getSignedUrl(order.kitchen_photo_url),
      })
    )
  } catch (error) {
    next(error)
  }
})

router.post(
  '/grocery/:id/list-file',
  guestOnly,
  upload.single('list_file'),
  async (req, res, next) => {
    try {
      const order = await loadOrder(req.params.id, req.user.id)
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (!ACTIVE_ORDER.includes(order.status)) {
        return res.status(400).json({ error: 'Order is no longer active' })
      }
      if (!req.file) return res.status(400).json({ error: 'list_file image is required' })

      const filePath = `${order.id}/list.${extensionFor(req.file.mimetype)}`
      await uploadFile(req.file.buffer, filePath, req.file.mimetype)
      const { data, error } = await supabase
        .from('grocery_orders')
        .update({ list_file_url: filePath })
        .eq('id', order.id)
        .select(ORDER_SELECT)
        .single()
      if (error) return res.status(400).json({ error: error.message })
      res.json(orderView(data, { list_file_signed_url: await getSignedUrl(filePath) }))
    } catch (error) {
      if (error.message === 'Images only') return res.status(400).json({ error: error.message })
      next(error)
    }
  }
)

// Saves the guest's card (no hold, no charge) for 'card_on_file' orders — the full total is
// charged off-session once the order is delivered (see /deliver in routes/grocery.js). 'cash'
// needs nothing here since the shopper collects payment in person at delivery.
router.post('/grocery/:id/pay', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!['requested', 'assigned'].includes(order.status)) {
      return res.status(400).json({ error: 'Payment method can only be set before shopping starts' })
    }
    const payment_method = req.body?.payment_method || 'card_on_file'
    if (!PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'invalid payment_method' })
    }

    const updates = { payment_method }
    let extra = {}

    if (payment_method === 'cash') {
      // Collected in person; nothing to save with Stripe.
    } else {
      const result = await saveCardOnFile({ user: req.user })
      extra = { ...extra, ...setupIntentView(result) }
    }

    const { data, error } = await supabase
      .from('grocery_orders')
      .update(updates)
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(orderView(data, extra))
  } catch (error) {
    next(error)
  }
})

// Called once Stripe Elements confirms the SetupIntent client-side — marks the card as saved so
// the guest app can stop prompting and the order is ready for its off-session charge at delivery.
router.post('/grocery/:id/card-saved', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ card_saved_at: new Date().toISOString() })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(orderView(data))
  } catch (error) {
    next(error)
  }
})

// Fallback for local/dev environments without a public webhook URL (see the matching transfer
// endpoint above for why this exists alongside the webhook).
router.post('/grocery/:id/sync-payment', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!order.stripe_payment_intent_id) {
      return res.json(orderView(order, { payment_intent_status: null }))
    }
    const intent = await retrievePaymentIntent(order.stripe_payment_intent_id)
    if (intent?.skipped) {
      return res.json(orderView(order, { stripe_skipped: true }))
    }
    const payment_status = order.payment_status === 'captured' ? 'captured' : mapIntentStatus(intent.status)
    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ payment_status })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(orderView(data, { payment_intent_status: intent.status }))
  } catch (error) {
    next(error)
  }
})

router.post('/grocery/:id/cancel', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'requested') {
      return res.status(400).json({
        error: 'Only a pending request can be cancelled here. Message My30A Host to cancel a confirmed order.',
      })
    }
    if (order.stripe_payment_intent_id) {
      await releasePaymentHold(order.stripe_payment_intent_id).catch((err) =>
        console.log('Stripe release skipped:', err.message)
      )
    }

    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    await logOrder(order.id, 'cancelled', req.user.id)
    await notifyAdmins({
      grocery_order_id: order.id,
      message: `Grocery request #${order.order_number} was cancelled by the guest`,
    })
    res.json(orderView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/grocery/:id/tip', guestOnly, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered to add a tip' })
    }
    const tip = money(req.body?.tip_amount)
    if (tip === null || tip < 0) {
      return res.status(400).json({ error: 'tip_amount must be a number >= 0' })
    }
    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ tip_amount: round2(tip) })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    if (tip > 0 && data.shopper_id) {
      await notify({
        user_id: data.shopper_id,
        grocery_order_id: data.id,
        message: `Grocery order #${data.order_number} · guest left a $${round2(tip)} tip`,
      })
    }
    res.json(orderView(data))
  } catch (error) {
    next(error)
  }
})

// ---------- Vitoria concierge ----------

async function vitoriaContext(userId) {
  const [profile, booking, trips, orders, guides, restaurants, info] = await Promise.all([
    loadProfile(userId),
    loadBooking(userId),
    supabase
      .from('transfers')
      .select('trip_number, status, scheduled_at, airport, direction')
      .eq('guest_id', userId)
      .in('status', ACTIVE_TRIP)
      .order('scheduled_at')
      .limit(3),
    supabase
      .from('grocery_orders')
      .select('order_number, status, delivery_time, package')
      .eq('guest_id', userId)
      .in('status', ACTIVE_ORDER)
      .order('delivery_time')
      .limit(3),
    supabase.from('explore_guides').select('title, kind, place, price_from, filters').eq('is_active', true).order('sort_order'),
    supabase
      .from('explore_vendors')
      .select('name, kind, place, cuisine, hours, description, price_from')
      .eq('is_active', true)
      .order('sort_order')
      .limit(40),
    supabase.from('public_info_sections').select('title, items').eq('is_active', true).order('sort_order'),
  ])
  return {
    profile,
    firstName: firstName(profile?.name, profile?.email),
    booking: bookingView(booking),
    trips: trips.data || [],
    orders: orders.data || [],
    guides: guides.data || [],
    vendors: restaurants.data || [],
    info: info.data || [],
  }
}

function systemPrompt(ctx) {
  const lines = [
    'You are Vitoria, the elegant AI concierge inside the My30A Host guest app for vacation rentals on Scenic Highway 30A, Florida.',
    'Voice: warm, confident, effortlessly polished — like a five-star hotel concierge texting a guest. Never robotic, never salesy, never gushing.',
    '',
    'Formatting rules — follow exactly, no exceptions:',
    '- Plain text only. Never use markdown: no **bold**, no _italics_, no # headings, no [links](url), no backticks.',
    '- Never use dashes, bullets or asterisks as list markers. If you mention more than one option, put each on its own line as a short natural phrase — no symbol in front of it.',
    '- Keep replies short: 2-4 sentences total, or 2-4 short lines when naming multiple places.',
    '- Separate distinct ideas with one blank line (a real paragraph break). Never run them together in one dense block.',
    '- Say a place’s name plainly — never bold it, quote it, or capitalize it for emphasis.',
    '- End with at most one short, warm follow-up question, on its own line — and only when it genuinely helps.',
    'Recommend only places from the data below. Never invent phone numbers or prices.',
    'Airport transfers and Publix grocery delivery are booked in the Services tab of the app; point guests there when relevant.',
    '',
    `Guest: ${ctx.profile?.name || 'Guest'} (${ctx.firstName}).`,
  ]
  if (ctx.booking) {
    lines.push(
      `Stay: ${ctx.booking.community_name || 'a 30A community'}${ctx.booking.property_address ? `, ${ctx.booking.property_address}` : ''}${ctx.booking.check_in ? ` · ${ctx.booking.check_in} to ${ctx.booking.check_out || '?'}` : ''}.`
    )
  }
  if (ctx.trips.length) {
    lines.push(
      'Active transfers: ' +
        ctx.trips.map((t) => `#${t.trip_number} ${t.status} ${formatWhen(t.scheduled_at)} ${t.airport}`).join('; ')
    )
  }
  if (ctx.orders.length) {
    lines.push(
      'Active grocery orders: ' +
        ctx.orders.map((o) => `#${o.order_number} ${o.status} ${o.package} ${formatWhen(o.delivery_time)}`).join('; ')
    )
  }
  lines.push('', 'Local guide (title · kind · place · from):')
  for (const g of ctx.guides) lines.push(`- ${g.title} · ${g.kind} · ${g.place || ''} · ${g.price_from || ''}`)
  lines.push('', 'Places (name · kind · place · details):')
  for (const v of ctx.vendors) {
    lines.push(`- ${v.name} · ${v.kind} · ${v.place || ''} · ${[v.cuisine, v.hours, v.description].filter(Boolean).join(' · ')}`)
  }
  lines.push('', 'Public information:')
  for (const s of ctx.info) lines.push(`- ${s.title}: ${(s.items || []).join(' ')}`)
  return lines.join('\n').slice(0, 12000)
}

// Used only when the AI is unavailable — same voice and layout rules as the system prompt:
// plain text, one idea per line, real paragraph breaks (\n\n), no bullet symbols.
function fallbackReply(text, ctx) {
  const q = String(text || '').toLowerCase()
  const name = ctx.firstName
  const byKind = (kind) => ctx.vendors.filter((v) => v.kind === kind)
  const guidesOf = (kind) => ctx.guides.filter((g) => g.kind === kind)
  const namedLines = (rows, pick) => rows.slice(0, 3).map(pick).join('\n')

  if (/beach|sunset|swim/.test(q)) {
    const beaches = byKind('beach')
    if (!beaches.length) {
      return `The beaches along 30A are all public access — look for the blue access signs.\n\nWould you like me to suggest a spot near your stay?`
    }
    return `For today, I’d recommend:\n\n${namedLines(beaches, (b) => `${b.name}, ${b.place}`)}\n\nCheck the beach flags before swimming — double red means the water is closed.`
  }
  if (/dinner|restaurant|eat|food|lunch|breakfast|top 5/.test(q)) {
    const spots = byKind('restaurant')
    if (!spots.length) {
      return `Open Explore → Restaurants to see tonight’s dining picks near ${ctx.booking?.community_name || '30A'}.`
    }
    return `For dinner tonight, I’d book:\n\n${namedLines(spots, (r) => `${r.name}, ${r.place}${r.hours ? ` — ${r.hours}` : ''}`)}\n\nReservations are recommended in season. Tap the restaurant in Explore to book directly.`
  }
  if (/things to do|activit|fun|golf|bike|boat|kayak|paddle|photo|spa|massage|bonfire/.test(q)) {
    const fun = guidesOf('vendors')
    return `Here’s what’s popular this week, ${name}:\n\n${namedLines(fun, (g) => `${g.title}${g.price_from ? ` — ${g.price_from}` : ''}`)}\n\nOpen Explore → Local Guide to see vetted vendors and book directly with them.`
  }
  if (/grocer|publix|food delivery|stock/.test(q)) {
    return `You can order groceries from the Services tab.\n\nPick a package, choose how you’d like the kitchen stocked, and upload your Publix cart screenshot.\n\nYou pay our flat service fee plus the exact Publix receipt — no markup.`
  }
  if (/airport|transfer|ride|pickup|pick up|drop|flight|shuttle|driver/.test(q)) {
    return `Airport transfers to and from ECP, VPS and PNS are booked in the Services tab.\n\nAdd your flight number and we’ll track it and confirm your driver — you’ll get a notification as soon as it’s assigned.`
  }
  if (/rule|parking|park|weather|emergency|911|helpline|safety|flag/.test(q)) {
    const section = ctx.info.find((s) => new RegExp(s.title.split(' ')[0].toLowerCase()).test(q)) || ctx.info[0]
    if (!section) return `Open Explore → Public Information for beach rules, parking, safety and emergency helplines.`
    return `${section.title}:\n\n${(section.items || []).slice(0, 3).join('\n')}\n\nYou’ll find the full list under Explore → Public Information.`
  }
  if (/hello|hi|hey|good (morning|afternoon|evening)/.test(q)) {
    return `Hi ${name}. I can help with the best beach today, dinner tonight, things to do, groceries or airport transfers.\n\nWhat sounds good?`
  }
  return `Happy to help, ${name}.\n\nI can suggest beaches, dinner spots, activities and local essentials near ${ctx.booking?.community_name || '30A'}, or set you up with groceries and airport transfers from the Services tab.\n\nWhat would you like?`
}

router.get('/vitoria/messages', guestOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('vitoria_messages')
      .select('id, role, content, model, created_at')
      .eq('guest_id', req.user.id)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) return res.status(400).json({ error: error.message })
    res.json({
      greeting: `${greeting()}, ${firstName(req.user.name, req.user.email)}`,
      messages: data || [],
    })
  } catch (error) {
    next(error)
  }
})

router.post('/vitoria/messages', guestOnly, async (req, res, next) => {
  try {
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: 'content is required' })
    if (content.length > 2000) return res.status(400).json({ error: 'content is too long' })

    const { data: userMessage, error: insertError } = await supabase
      .from('vitoria_messages')
      .insert({ guest_id: req.user.id, role: 'user', content })
      .select('id, role, content, model, created_at')
      .single()
    if (insertError) return res.status(400).json({ error: insertError.message })

    const [ctx, history] = await Promise.all([
      vitoriaContext(req.user.id),
      supabase
        .from('vitoria_messages')
        .select('role, content')
        .eq('guest_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ])
    const recent = (history.data || []).reverse().map((m) => ({ role: m.role, content: m.content }))

    const completion = await chatCompletion({
      messages: [{ role: 'system', content: systemPrompt(ctx) }, ...recent],
    })
    // Sanitized regardless of source — a stray "**" or "- " from the model must never reach
    // the guest, since the chat bubble renders plain text, not markdown.
    const reply = cleanConciergeText(completion.skipped ? fallbackReply(content, ctx) : completion.content)
    const model = completion.skipped ? 'fallback' : completion.model

    const { data: assistantMessage, error: replyError } = await supabase
      .from('vitoria_messages')
      .insert({ guest_id: req.user.id, role: 'assistant', content: reply, model })
      .select('id, role, content, model, created_at')
      .single()
    if (replyError) return res.status(400).json({ error: replyError.message })

    res.status(201).json({
      user: userMessage,
      assistant: assistantMessage,
      model,
      ...(completion.skipped ? { skipped_reason: completion.reason } : {}),
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/vitoria/messages', guestOnly, async (req, res, next) => {
  try {
    const { error } = await supabase.from('vitoria_messages').delete().eq('guest_id', req.user.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
