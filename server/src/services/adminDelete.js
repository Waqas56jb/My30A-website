// Admin "Delete" for Transfers, Grocery, Payouts, People, Vehicles and Messages. Deleting must never
// leave money or bookkeeping half-done, so each one checks what still depends on the record:
//  • a trip / order that is part of a payout → delete (or edit) that payout first
//  • a card hold still open on a trip / order → released first (the guest isn't charged)
//  • a person or vehicle with trips, orders or payouts → refused with the counts; use Deactivate
//    (keeps their history) or delete those records first
// Each function returns { ok } or { status, error } for the route to send.
import { supabase } from '../lib/supabase.js'
import { cancelIntentSafe } from '../lib/stripe.js'

async function count(table, column, value) {
  const { count: n } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, value)
  return n || 0
}

async function inPayout(column, id) {
  const { data } = await supabase.from('payout_items').select('payout_id').eq(column, id).limit(1)
  return data?.[0]?.payout_id || null
}

export async function deleteTransfer(id) {
  const { data: t } = await supabase.from('transfers').select('id, trip_number, payment_status, stripe_payment_intent_id').eq('id', id).maybeSingle()
  if (!t) return { status: 404, error: 'Trip not found' }
  if (await inPayout('transfer_id', id)) {
    return { status: 409, error: `Trip #${t.trip_number} is part of a staff payout. Delete that payout in Payouts first, then delete the trip.` }
  }
  if (t.payment_status === 'authorized' && t.stripe_payment_intent_id) await cancelIntentSafe(t.stripe_payment_intent_id)
  await supabase.from('notifications').delete().eq('transfer_id', id)
  await supabase.from('gps_points').delete().eq('transfer_id', id)
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) return { status: 400, error: error.message }
  return { ok: true }
}

export async function deleteGroceryOrder(id) {
  const { data: o } = await supabase
    .from('grocery_orders')
    .select('id, order_number, payment_status, stripe_payment_intent_id, grocery_payment_status, stripe_grocery_payment_intent_id')
    .eq('id', id)
    .maybeSingle()
  if (!o) return { status: 404, error: 'Order not found' }
  if (await inPayout('grocery_order_id', id)) {
    return { status: 409, error: `Order #${o.order_number} is part of a staff payout. Delete that payout in Payouts first, then delete the order.` }
  }
  if (o.payment_status === 'authorized' && o.stripe_payment_intent_id) await cancelIntentSafe(o.stripe_payment_intent_id)
  if (o.grocery_payment_status === 'authorized' && o.stripe_grocery_payment_intent_id) await cancelIntentSafe(o.stripe_grocery_payment_intent_id)
  await supabase.from('notifications').delete().eq('grocery_order_id', id)
  const { error } = await supabase.from('grocery_orders').delete().eq('id', id)
  if (error) return { status: 400, error: error.message }
  return { ok: true }
}

export async function deletePerson(id, { selfId }) {
  if (id === selfId) return { status: 400, error: 'You can’t delete your own account while signed in.' }
  const { data: p } = await supabase.from('profiles').select('id, name, email, roles').eq('id', id).maybeSingle()
  if (!p) return { status: 404, error: 'Person not found' }
  const links = {
    trips: (await count('transfers', 'guest_id', id)) + (await count('transfers', 'driver_id', id)) + (await count('transfers', 'vehicle_owner_id', id)),
    'grocery orders': (await count('grocery_orders', 'guest_id', id)) + (await count('grocery_orders', 'shopper_id', id)),
    payouts: await count('payouts', 'user_id', id),
    vehicles: await count('vehicles', 'owner_id', id),
  }
  const used = Object.entries(links).filter(([, n]) => n)
  if (used.length) {
    return {
      status: 409,
      error: `${p.name || p.email} has ${used.map(([k, n]) => `${n} ${n === 1 ? k.replace(/s$/, '') : k}`).join(', ')}. Deactivate them instead (keeps that history), or delete those records first.`,
      links,
    }
  }
  // Nothing operational — clear the small personal rows that point at them, then the login.
  await supabase.from('notifications').delete().eq('user_id', id)
  await supabase.from('compensation_agreements').delete().eq('user_id', id)
  await supabase.from('compensation_agreements').update({ created_by: null }).eq('created_by', id)
  await supabase.from('trip_status_log').update({ updated_by: null }).eq('updated_by', id)
  await supabase.from('grocery_status_log').update({ updated_by: null }).eq('updated_by', id)
  await supabase.from('trip_messages').update({ sender_id: null }).eq('sender_id', id)
  await supabase.from('transfers').update({ created_by: null }).eq('created_by', id)
  await supabase.from('grocery_orders').update({ created_by: null }).eq('created_by', id)
  const { error: authError } = await supabase.auth.admin.deleteUser(id)
  if (authError && !/not found/i.test(authError.message)) return { status: 400, error: authError.message }
  await supabase.from('profiles').delete().eq('id', id)
  return { ok: true }
}

export async function deleteVehicle(id) {
  const { data: v } = await supabase.from('vehicles').select('id, make, model, plate').eq('id', id).maybeSingle()
  if (!v) return { status: 404, error: 'Vehicle not found' }
  const trips = await count('transfers', 'vehicle_id', id)
  if (trips) {
    return { status: 409, error: `${v.make} ${v.model} (${v.plate}) was used on ${trips} trip${trips === 1 ? '' : 's'}. Set it to Inactive instead (keeps the trip history), or delete those trips first.` }
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) return { status: 400, error: error.message }
  return { ok: true }
}

const MESSAGE_TABLES = { chat: 'trip_messages', sms: 'sms_log', calls: 'call_log' }

export async function deleteMessage(kind, id) {
  const table = MESSAGE_TABLES[kind]
  if (!table) return { status: 400, error: 'Unknown message type' }
  const { error, count: n } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id)
  if (error) return { status: 400, error: error.message }
  if (!n) return { status: 404, error: 'Message not found' }
  return { ok: true }
}

export function sendResult(res, result) {
  if (result.ok) return res.json({ ok: true })
  return res.status(result.status || 400).json({ error: result.error, ...(result.links ? { links: result.links } : {}) })
}
