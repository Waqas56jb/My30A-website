// Business rules shared by the admin/driver, guest-app and public (secret-link) routers:
// guest-facing labels, fee windows, cancellations, no-shows, tip requests and the 24h
// auto-cancel job. Keeping them here means every entry point applies exactly the same rules.
import { supabase } from '../lib/supabase.js'
import { capturePaymentIntent, releasePaymentHold, retrievePaymentIntent } from '../lib/stripe.js'
import { maskedCallNumber, sendSms } from '../lib/sms.js'
import { notify } from './notifications.js'

export const ACTIVE_TRIP_STATUSES = ['requested', 'assigned', 'started', 'arrived', 'picked_up']
export const ENDED_TRIP_STATUSES = ['completed', 'cancelled', 'refunded', 'no_show']
export const CANCELLATION_FEES = { '48h+': 0, '24-48h': 50, 'same-day': 75 }
export const NO_SHOW_FEE = 75
export const HOST_CANCEL_CREDIT = 25
export const ROUND_TRIP_DISCOUNT_PERCENT = 5
export const AUTHORIZATION_WINDOW_HOURS = 24

export const TRIP_LABELS = {
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

export function money(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

export function publicBaseUrl() {
  const raw = process.env.PUBLIC_APP_URL || process.env.CLIENT_APP_URL || 'http://localhost:5173'
  return String(raw).trim().replace(/\/$/, '')
}

export function guestLinks(transfer) {
  const base = publicBaseUrl()
  return {
    chat: `${base}/trip/${transfer.guest_token}`,
    tip: `${base}/tip/${transfer.guest_token}`,
  }
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Your driver'
}

// "Ford Fusion · ABC123" or, when the admin hides the model, "Private transfer · Up to 4 passengers".
export function vehicleGuestLabel(vehicle) {
  if (!vehicle) return null
  if (vehicle.show_name === false) {
    return `Private transfer · Up to ${vehicle.capacity || 4} passengers`
  }
  return [`${vehicle.make} ${vehicle.model}`.trim(), vehicle.plate].filter(Boolean).join(' · ')
}

export function cancellationFeeFor(transfer, now = new Date()) {
  const hours = (new Date(transfer.scheduled_at).getTime() - now.getTime()) / 36e5
  if (hours >= 48) return { fee: 0, window: '48h+', hours }
  if (hours >= 24) return { fee: CANCELLATION_FEES['24-48h'], window: '24-48h', hours }
  return { fee: CANCELLATION_FEES['same-day'], window: 'same-day', hours }
}

export async function logTripStatus(transferId, status, userId = null) {
  await supabase.from('trip_status_log').insert({ transfer_id: transferId, status, updated_by: userId })
}

export async function smsGuest(transfer, body, kind) {
  if (!transfer?.guest_phone) return { skipped: true, reason: 'NO_GUEST_PHONE' }
  return sendSms({ to: transfer.guest_phone, body, transfer_id: transfer.id, kind })
}

export async function notifyGuestAccount(transfer, message) {
  if (!transfer?.guest_id) return
  await notify({ user_id: transfer.guest_id, transfer_id: transfer.id, message })
}

export async function notifyAdmins({ message, transfer_id = null }) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .contains('roles', ['admin'])
    .eq('is_active', true)
  for (const admin of admins || []) {
    await notify({ user_id: admin.id, message, transfer_id })
  }
}

// Status-change SMS copy (Part 1 of the comms spec). Links always point at the secret guest page.
export function statusSms(transfer, status) {
  const links = guestLinks(transfer)
  const driver = firstName(transfer.driver?.name)
  const call = maskedCallNumber()
  const callLine = call ? ` Call your driver: ${call}.` : ''
  switch (status) {
    case 'assigned':
      return `My30A Host: your transfer #${transfer.trip_number} is confirmed. Driver: ${driver}. Message your driver here: ${links.chat}${callLine}`
    case 'started':
      return `Your My30A Host driver is on the way. Use the chat link to coordinate your exact meetup location: ${links.chat}${callLine}`
    case 'arrived':
      return `Your driver has arrived and is waiting at the pickup area. Message them to coordinate exactly where to meet: ${links.chat}${callLine}`
    case 'picked_up':
      return `You're on your way! Enjoy the ride.`
    case 'completed':
      return `Your transfer is complete. Thank you for choosing My30A Host! Leave a tip for your driver here: ${links.tip}`
    case 'no_show':
      return `My30A Host: we couldn't reach you for transfer #${transfer.trip_number}. A $${NO_SHOW_FEE} no-show fee applies per our policy. Questions? my30ahost@gmail.com`
    case 'cancelled':
      return `My30A Host: your transfer #${transfer.trip_number} has been cancelled.`
    default:
      return null
  }
}

// Captures `amount` from an authorized hold (releasing the rest), or releases everything when
// amount is 0. Never throws — returns what happened so the caller can record it in notes.
async function settleHold(transfer, amount) {
  const id = transfer.stripe_payment_intent_id
  if (!id) return { action: 'none', reason: 'NO_PAYMENT_INTENT' }
  try {
    const intent = await retrievePaymentIntent(id)
    if (!intent || intent.skipped) return { action: 'skipped', reason: intent?.reason || 'STRIPE_NOT_CONFIGURED' }
    if (intent.status === 'requires_capture') {
      if (amount > 0) {
        await capturePaymentIntent(id, amount)
        return { action: 'captured', amount }
      }
      await releasePaymentHold(id)
      return { action: 'released' }
    }
    if (intent.status === 'succeeded') return { action: 'already_captured' }
    if (intent.status === 'canceled') return { action: 'already_released' }
    await releasePaymentHold(id)
    return { action: 'released', status: intent.status }
  } catch (error) {
    return { action: 'error', reason: error.message }
  }
}

function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join('\n')
}

// Guest-initiated (or admin-on-behalf-of-guest) cancellation with the published fee windows.
export async function cancelForGuest({ transfer, actorId, select }) {
  const { fee, window } = cancellationFeeFor(transfer)
  const settlement = await settleHold(transfer, fee)
  const updates = { status: 'cancelled', cancellation_fee: fee }
  if (settlement.action === 'captured') updates.payment_status = 'captured'
  if (settlement.action === 'released') updates.payment_status = 'failed'
  updates.notes = appendNote(
    transfer.notes,
    `Cancelled by guest (${window} before pickup) · fee $${fee} · Stripe: ${settlement.action}${settlement.reason ? ` (${settlement.reason})` : ''}`
  )

  const { data, error } = await supabase
    .from('transfers')
    .update(updates)
    .eq('id', transfer.id)
    .select(select)
    .single()
  if (error) throw error

  await logTripStatus(transfer.id, 'cancelled', actorId)
  await notifyAdmins({
    transfer_id: transfer.id,
    message: `Transfer #${transfer.trip_number} cancelled by the guest (${window}) · fee $${fee}`,
  })
  if (transfer.driver_id) {
    await notify({ user_id: transfer.driver_id, transfer_id: transfer.id, message: `Trip #${transfer.trip_number} was cancelled by the guest.` })
  }
  await smsGuest(data, statusSms(data, 'cancelled'), 'cancelled')
  return { transfer: data, fee, window, settlement }
}

// My30A Host cancels: full release + $25 credit on the guest's next booking.
export async function cancelByHost({ transfer, actorId, select, reason }) {
  const settlement = await settleHold(transfer, 0)
  const updates = { status: 'cancelled', cancellation_fee: 0 }
  if (transfer.status === 'started' || transfer.status === 'arrived' || transfer.status === 'picked_up') {
    updates.is_flagged = true
    updates.flag_reason = 'CANCELLED_AFTER_START'
  }
  if (settlement.action === 'released') updates.payment_status = 'failed'
  updates.notes = appendNote(
    transfer.notes,
    `Cancelled by My30A Host${reason ? ` · ${reason}` : ''} · $${HOST_CANCEL_CREDIT} credit issued · Stripe: ${settlement.action}`
  )

  const { data, error } = await supabase
    .from('transfers')
    .update(updates)
    .eq('id', transfer.id)
    .select(select)
    .single()
  if (error) throw error

  await supabase.from('guest_credits').insert({
    guest_id: transfer.guest_id || null,
    guest_email: transfer.guest_email || null,
    guest_phone: transfer.guest_phone || null,
    amount: HOST_CANCEL_CREDIT,
    reason: `Cancelled by My30A Host · transfer #${transfer.trip_number}`,
    transfer_id: transfer.id,
  })

  await logTripStatus(transfer.id, 'cancelled', actorId)
  await notifyGuestAccount(
    data,
    `Your airport transfer #${data.trip_number} was cancelled by My30A Host. A $${HOST_CANCEL_CREDIT} credit has been added to your next booking.`
  )
  await smsGuest(
    data,
    `${statusSms(data, 'cancelled')} A $${HOST_CANCEL_CREDIT} credit has been added to your next booking.`,
    'cancelled'
  )
  return { transfer: data, settlement }
}

export async function markNoShow({ transfer, actorId, select }) {
  const settlement = await settleHold(transfer, NO_SHOW_FEE)
  const updates = { status: 'no_show', no_show_fee: NO_SHOW_FEE }
  if (settlement.action === 'captured') updates.payment_status = 'captured'
  updates.notes = appendNote(
    transfer.notes,
    `No-show · $${NO_SHOW_FEE} fee · Stripe: ${settlement.action}${settlement.reason ? ` (${settlement.reason})` : ''}`
  )
  const { data, error } = await supabase
    .from('transfers')
    .update(updates)
    .eq('id', transfer.id)
    .select(select)
    .single()
  if (error) throw error
  await logTripStatus(transfer.id, 'no_show', actorId)
  await notifyGuestAccount(data, `We couldn't reach you for transfer #${data.trip_number}. A $${NO_SHOW_FEE} no-show fee applies.`)
  await smsGuest(data, statusSms(data, 'no_show'), 'no_show')
  return { transfer: data, settlement }
}

// Available credit for a guest (by account, else by email/phone) to apply to a new booking.
export async function availableCredit({ guest_id, guest_email, guest_phone }) {
  let query = supabase.from('guest_credits').select('id, amount').eq('status', 'available')
  if (guest_id) query = query.eq('guest_id', guest_id)
  else if (guest_email) query = query.eq('guest_email', guest_email)
  else if (guest_phone) query = query.eq('guest_phone', guest_phone)
  else return { total: 0, ids: [] }
  const { data } = await query
  const rows = data || []
  return { total: money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)), ids: rows.map((row) => row.id) }
}

// Marks a guest's credits as used against a transfer.
export async function consumeCredits(ids, transferId) {
  if (!ids?.length) return
  await supabase
    .from('guest_credits')
    .update({ status: 'used', used_transfer_id: transferId, used_at: new Date().toISOString() })
    .in('id', ids)
}

// 24h rule: guest-app requests that were confirmed but never card-authorized get auto-cancelled.
export async function expireUnauthorizedHolds({ select = '*' } = {}) {
  const cutoff = new Date(Date.now() - AUTHORIZATION_WINDOW_HOURS * 3600 * 1000).toISOString()
  const { data: candidates, error } = await supabase
    .from('transfers')
    .select('id, trip_number, guest_id, guest_phone, guest_email, notes, status, payment_status, payment_method, stripe_payment_intent_id, scheduled_at, driver_id')
    .eq('status', 'assigned')
    .eq('payment_status', 'pending')
    .not('guest_id', 'is', null)
    // NULL payment_method (guest hasn't chosen yet) must be included: `!= 'cash'` alone drops NULLs.
    .or('payment_method.is.null,payment_method.neq.cash')
  if (error) throw error

  const expired = []
  for (const transfer of candidates || []) {
    const { data: log } = await supabase
      .from('trip_status_log')
      .select('created_at')
      .eq('transfer_id', transfer.id)
      .eq('status', 'assigned')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const assignedAt = log?.created_at
    if (!assignedAt || assignedAt > cutoff) continue

    const settlement = await settleHold(transfer, 0)
    const { data } = await supabase
      .from('transfers')
      .update({
        status: 'cancelled',
        notes: appendNote(transfer.notes, `Auto-cancelled: card not authorized within ${AUTHORIZATION_WINDOW_HOURS}h · Stripe: ${settlement.action}`),
      })
      .eq('id', transfer.id)
      .select(select)
      .single()
    await logTripStatus(transfer.id, 'cancelled', null)
    await notifyGuestAccount(data, `Transfer #${transfer.trip_number} was cancelled because the card was not authorized within ${AUTHORIZATION_WINDOW_HOURS} hours. You can book again anytime.`)
    await smsGuest(data, `My30A Host: transfer #${transfer.trip_number} was cancelled because payment wasn't authorized within ${AUTHORIZATION_WINDOW_HOURS} hours. You can rebook anytime in the app.`, 'auto_cancel')
    await notifyAdmins({ transfer_id: transfer.id, message: `Transfer #${transfer.trip_number} auto-cancelled (no card authorization within ${AUTHORIZATION_WINDOW_HOURS}h)` })
    if (transfer.driver_id) {
      await notify({ user_id: transfer.driver_id, transfer_id: transfer.id, message: `Trip #${transfer.trip_number} was auto-cancelled (guest never authorized payment).` })
    }
    expired.push(transfer.id)
  }
  return { checked: (candidates || []).length, expired }
}

// After completion: in-app tip prompt (app guests) + SMS with the no-login tip link (everyone).
export async function requestTip(transfer) {
  const links = guestLinks(transfer)
  await supabase.from('transfers').update({ tip_requested_at: new Date().toISOString() }).eq('id', transfer.id)
  await notifyGuestAccount(
    transfer,
    `Trip #${transfer.trip_number} completed · Total $${money(transfer.customer_charge)}. Hope your ride was smooth — leave a tip for ${firstName(transfer.driver?.name)}: ${links.tip}`
  )
  await smsGuest(transfer, statusSms(transfer, 'completed'), 'completed')
}

export async function recordTip({ transfer, tip_amount, via, select }) {
  const tip = money(tip_amount)
  const { data, error } = await supabase
    .from('transfers')
    .update({ tip_amount: tip, tip_paid_via: via })
    .eq('id', transfer.id)
    .select(select)
    .single()
  if (error) throw error
  if (tip > 0 && data.driver_id) {
    await notify({ user_id: data.driver_id, transfer_id: data.id, message: `Trip #${data.trip_number} · guest left a $${tip} tip` })
  }
  return data
}
