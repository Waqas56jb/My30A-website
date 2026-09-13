// No-login endpoints reached through the secret per-trip link the guest gets by SMS
// (my30ahost.com/trip/<token>, /tip/<token>) plus the Twilio voice webhooks that route masked
// calls. Nothing here exposes a phone number to the other party.
import crypto from 'crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { supabase } from '../lib/supabase.js'
import { chargeSavedCard, createCheckoutSession, retrieveCheckoutSession } from '../lib/stripe.js'
import { isSmsConfigured, last10, maskedCallNumber } from '../lib/sms.js'
import { notify } from '../services/notifications.js'
import {
  ACTIVE_TRIP_STATUSES,
  ENDED_TRIP_STATUSES,
  TRIP_LABELS,
  firstName,
  guestLinks,
  money,
  publicBaseUrl,
  recordTip,
  vehicleGuestLabel,
} from '../services/tripFlow.js'

const router = Router()
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }))

const SELECT = `
  *,
  driver:profiles!driver_id (id, name, phone),
  vehicle:vehicles!vehicle_id (id, make, model, plate, vehicle_type, capacity, show_name),
  community:communities!community_id (id, name),
  guest:profiles!guest_id (id, stripe_customer_id)
`

function isToken(value) {
  return /^[a-f0-9]{32}$/i.test(String(value || ''))
}

async function loadByToken(token) {
  if (!isToken(token)) return null
  const { data } = await supabase.from('transfers').select(SELECT).eq('guest_token', token).maybeSingle()
  return data || null
}

function fmt(iso, opts) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', ...opts })
}

function tripView(transfer) {
  const isArrival = transfer.direction === 'from_airport'
  return {
    trip_number: transfer.trip_number,
    status: transfer.status,
    status_label: TRIP_LABELS[transfer.status] || transfer.status,
    active: ACTIVE_TRIP_STATUSES.includes(transfer.status),
    ended: ENDED_TRIP_STATUSES.includes(transfer.status),
    trip_type: isArrival ? 'arrival' : 'departure',
    airport: transfer.airport,
    community: transfer.community?.name || null,
    pickup_address: transfer.pickup_address,
    dropoff_address: transfer.dropoff_address,
    scheduled_at: transfer.scheduled_at,
    date_label: fmt(transfer.scheduled_at, { month: 'short', day: 'numeric', year: 'numeric' }),
    time_label: fmt(transfer.scheduled_at, { hour: 'numeric', minute: '2-digit' }),
    passengers: transfer.passengers,
    bags: transfer.bags,
    flight_number: transfer.flight_number,
    driver: transfer.driver ? { first_name: firstName(transfer.driver.name) } : null,
    vehicle_label: vehicleGuestLabel(transfer.vehicle),
    total: money(transfer.customer_charge),
    tip_amount: money(transfer.tip_amount),
    started_at: transfer.started_at,
    arrived_at: transfer.arrived_at,
    picked_up_at: transfer.picked_up_at,
    completed_at: transfer.completed_at,
    guest_first_name: firstName(transfer.guest_name),
    call_number: transfer.driver_id && ACTIVE_TRIP_STATUSES.includes(transfer.status) ? maskedCallNumber() : null,
  }
}

// Guests only ever see staff first names (driver/admin), never full names or numbers.
export function guestFacingMessage(row) {
  return {
    ...row,
    sender_name: row.sender_role === 'guest' ? row.sender_name : firstName(row.sender_name),
  }
}

async function loadMessages(transferId) {
  const { data } = await supabase
    .from('trip_messages')
    .select('id, sender_role, sender_name, body, created_at')
    .eq('transfer_id', transferId)
    .order('created_at', { ascending: true })
    .limit(300)
  return (data || []).map(guestFacingMessage)
}

// ---------- trip page (status + chat) ----------

router.get('/trip/:token', async (req, res, next) => {
  try {
    const transfer = await loadByToken(req.params.token)
    if (!transfer) return res.status(404).json({ error: 'Link not found' })
    const { data: log } = await supabase
      .from('trip_status_log')
      .select('status, created_at')
      .eq('transfer_id', transfer.id)
      .order('created_at', { ascending: true })
    const ended = ENDED_TRIP_STATUSES.includes(transfer.status)
    res.json({
      trip: tripView(transfer),
      status_log: log || [],
      // Chat is read-only once the trip ends (Part 4: link expires when the trip is completed).
      messages: ended ? [] : await loadMessages(transfer.id),
      chat_open: !ended,
      tip_url: transfer.status === 'completed' ? guestLinks(transfer).tip : null,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/trip/:token/messages', async (req, res, next) => {
  try {
    const transfer = await loadByToken(req.params.token)
    if (!transfer) return res.status(404).json({ error: 'Link not found' })
    if (ENDED_TRIP_STATUSES.includes(transfer.status)) {
      return res.status(410).json({ error: 'This trip has ended. Chat is closed.' })
    }
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'Message is empty' })
    if (body.length > 1000) return res.status(400).json({ error: 'Message is too long' })

    const { data, error } = await supabase
      .from('trip_messages')
      .insert({
        transfer_id: transfer.id,
        sender_role: 'guest',
        sender_id: transfer.guest_id || null,
        sender_name: transfer.guest_name || 'Guest',
        body,
      })
      .select('id, sender_role, sender_name, body, created_at')
      .single()
    if (error) return res.status(400).json({ error: error.message })

    if (transfer.driver_id) {
      await notify({
        user_id: transfer.driver_id,
        transfer_id: transfer.id,
        message: `Trip #${transfer.trip_number} · ${firstName(transfer.guest_name)}: ${body.slice(0, 120)}`,
      })
    }
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

// ---------- tip page ----------

const TIP_OPTIONS = [10, 18, 20]

router.get('/tip/:token', async (req, res, next) => {
  try {
    const transfer = await loadByToken(req.params.token)
    if (!transfer) return res.status(404).json({ error: 'Link not found' })
    const total = money(transfer.customer_charge)
    res.json({
      trip: tripView(transfer),
      can_tip: transfer.status === 'completed',
      already_tipped: money(transfer.tip_amount) > 0,
      options: TIP_OPTIONS.map((pct) => ({ pct, amount: money((total * pct) / 100) })),
      saved_card: Boolean(transfer.guest?.stripe_customer_id),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/tip/:token', async (req, res, next) => {
  try {
    const transfer = await loadByToken(req.params.token)
    if (!transfer) return res.status(404).json({ error: 'Link not found' })
    if (transfer.status !== 'completed') return res.status(400).json({ error: 'Tips can be added once the trip is completed.' })
    const tip = money(req.body?.tip_amount)
    if (!Number.isFinite(tip) || tip < 0 || tip > 500) return res.status(400).json({ error: 'tip_amount must be between 0 and 500' })
    if (tip === 0) {
      const data = await recordTip({ transfer, tip_amount: 0, via: 'declined', select: SELECT })
      return res.json({ ok: true, tip_amount: 0, trip: tripView(data) })
    }

    // App guests with a saved card: charge it off-session right now.
    if (transfer.guest?.stripe_customer_id) {
      const charge = await chargeSavedCard({
        customerId: transfer.guest.stripe_customer_id,
        amount: tip,
        metadata: { my30a_transfer_id: transfer.id, kind: 'tip' },
      })
      if (!charge?.skipped) {
        const data = await recordTip({ transfer, tip_amount: tip, via: 'saved_card', select: SELECT })
        return res.json({ ok: true, tip_amount: tip, trip: tripView(data) })
      }
      // fall through to a hosted checkout if the saved card couldn't be charged
    }

    const base = publicBaseUrl()
    const session = await createCheckoutSession({
      amount: tip,
      description: `Tip for your My30A Host driver · Trip #${transfer.trip_number}`,
      metadata: { my30a_transfer_id: transfer.id, kind: 'tip' },
      successUrl: `${base}/tip/${transfer.guest_token}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/tip/${transfer.guest_token}`,
      customerEmail: transfer.guest_email || undefined,
    })
    if (session?.skipped) return res.status(503).json({ error: 'Card payments are not available right now.' })
    res.json({ checkout_url: session.url, session_id: session.id })
  } catch (error) {
    next(error)
  }
})

// Called by the tip page when Stripe redirects back with ?session_id=…
router.post('/tip/:token/confirm', async (req, res, next) => {
  try {
    const transfer = await loadByToken(req.params.token)
    if (!transfer) return res.status(404).json({ error: 'Link not found' })
    const session = await retrieveCheckoutSession(String(req.body?.session_id || ''))
    if (!session || session.skipped) return res.status(400).json({ error: 'Payment session not found' })
    if (session.metadata?.my30a_transfer_id !== transfer.id || session.metadata?.kind !== 'tip') {
      return res.status(400).json({ error: 'Payment session does not match this trip' })
    }
    if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Payment not completed' })
    const tip = money(session.amount_total / 100)
    const data = await recordTip({ transfer, tip_amount: tip, via: 'checkout', select: SELECT })
    res.json({ ok: true, tip_amount: tip, trip: tripView(data) })
  } catch (error) {
    next(error)
  }
})

// ---------- Twilio voice: one masked number, routed by who is calling ----------

function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])
}

function twilioSignatureOk(req) {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) return true // nothing to verify against yet
  const signature = req.headers['x-twilio-signature']
  if (!signature) return false
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const params = Object.keys(req.body || {})
    .sort()
    .map((key) => key + req.body[key])
    .join('')
  const expected = crypto.createHmac('sha1', token).update(url + params).digest('base64')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)))
}

async function activeTripForGuestPhone(phone) {
  const { data } = await supabase
    .from('transfers')
    .select(SELECT)
    .in('status', ACTIVE_TRIP_STATUSES)
    .not('driver_id', 'is', null)
    .gte('scheduled_at', new Date(Date.now() - 12 * 3600 * 1000).toISOString())
    .lte('scheduled_at', new Date(Date.now() + 48 * 3600 * 1000).toISOString())
    .order('scheduled_at', { ascending: true })
  const key = last10(phone)
  return (data || []).find((row) => last10(row.guest_phone) === key) || null
}

async function activeTripForDriverPhone(phone) {
  const key = last10(phone)
  const { data: drivers } = await supabase.from('profiles').select('id, phone').not('phone', 'is', null)
  const driver = (drivers || []).find((row) => last10(row.phone) === key)
  if (!driver) return null
  const { data } = await supabase
    .from('transfers')
    .select(SELECT)
    .eq('driver_id', driver.id)
    .in('status', ACTIVE_TRIP_STATUSES)
    .gte('scheduled_at', new Date(Date.now() - 12 * 3600 * 1000).toISOString())
    .lte('scheduled_at', new Date(Date.now() + 48 * 3600 * 1000).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data || null
}

router.post('/voice', async (req, res, next) => {
  try {
    res.type('text/xml')
    if (!isSmsConfigured()) {
      return res.send(twiml('<Say>Calling is not set up yet. Please message your driver from the trip link.</Say>'))
    }
    if (!twilioSignatureOk(req)) return res.status(403).send(twiml('<Reject/>'))

    const from = req.body?.From
    const callSid = req.body?.CallSid
    const callerId = escapeXml(maskedCallNumber())
    const statusUrl = '/api/public/voice/status' // relative to the webhook URL Twilio called

    let transfer = await activeTripForGuestPhone(from)
    let direction = 'guest_to_driver'
    let target = transfer?.driver?.phone
    if (!transfer) {
      transfer = await activeTripForDriverPhone(from)
      direction = 'driver_to_guest'
      target = transfer?.guest_phone
    }

    await supabase.from('call_log').insert({
      transfer_id: transfer?.id || null,
      direction: transfer ? direction : 'unknown',
      from_phone: from || null,
      to_phone: target || null,
      twilio_call_sid: callSid || null,
      status: transfer && target ? 'routing' : 'no_match',
    })

    if (!transfer || !target) {
      return res.send(
        twiml('<Say>Sorry, we could not find an active My30A Host trip for this number. Please use the chat link in your text message.</Say>')
      )
    }
    return res.send(
      twiml(
        `<Say>Connecting you now.</Say><Dial callerId="${callerId}" timeout="25" action="${statusUrl}" method="POST">${escapeXml(target)}</Dial>`
      )
    )
  } catch (error) {
    next(error)
  }
})

router.post('/voice/status', async (req, res, next) => {
  try {
    res.type('text/xml')
    const sid = req.body?.CallSid
    if (sid) {
      await supabase
        .from('call_log')
        .update({
          status: req.body?.DialCallStatus || req.body?.CallStatus || 'unknown',
          duration_seconds: Number(req.body?.DialCallDuration || req.body?.CallDuration || 0) || null,
        })
        .eq('twilio_call_sid', sid)
    }
    res.send(twiml(''))
  } catch (error) {
    next(error)
  }
})

export default router
