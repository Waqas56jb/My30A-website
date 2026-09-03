import { supabase } from '../lib/supabase.js'
import { calculateCashReconciliation } from './earnings.js'

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function itemKey(itemType, transferId, groceryOrderId) {
  return `${itemType}:${transferId || ''}:${groceryOrderId || ''}`
}

function remainingFor(allocated, itemType, transferId, groceryOrderId, trip, tip) {
  const already = allocated.get(itemKey(itemType, transferId, groceryOrderId)) || {
    trip: 0,
    tip: 0,
  }
  return {
    trip: money(Math.max(0, trip - already.trip)),
    tip: money(Math.max(0, tip - already.tip)),
    alreadyHasRow: allocated.has(itemKey(itemType, transferId, groceryOrderId)),
  }
}

export function summarize(items) {
  const trip_earnings = money(items.reduce((sum, item) => sum + Number(item.trip_earnings || 0), 0))
  const tip_earnings = money(items.reduce((sum, item) => sum + Number(item.tip_earnings || 0), 0))
  const cash_collected = money(
    items.reduce((sum, item) => sum + Number(item.cash_collected || 0), 0)
  )
  const cash_owed_to_admin = money(
    items.reduce((sum, item) => sum + Number(item.cash_owed_to_admin || 0), 0)
  )

  return {
    trip_earnings,
    tip_earnings,
    cash_collected,
    cash_owed_to_admin,
    total_amount: money(trip_earnings + tip_earnings - cash_owed_to_admin),
  }
}

export async function loadPayoutUniverse() {
  const [transfersResult, ordersResult, itemsResult, payoutsResult, profilesResult] =
    await Promise.all([
      supabase
        .from('transfers')
        .select(
          'id, trip_number, scheduled_at, completed_at, driver_payout, tip_amount, payment_method, cash_reported, customer_charge, status, driver_id, vehicle_owner_id, owner_fee'
        )
        .eq('status', 'completed'),
      supabase
        .from('grocery_orders')
        .select(
          'id, order_number, delivery_time, delivered_at, shopper_payout, tip_amount, status, shopper_id'
        )
        .eq('status', 'delivered'),
      supabase
        .from('payout_items')
        .select(
          'item_type, transfer_id, grocery_order_id, trip_earnings, tip_earnings, payout:payouts!payout_id(user_id, status)'
        ),
      supabase.from('payouts').select('user_id, status, total_amount').in('status', ['pending', 'paid']),
      supabase.from('profiles').select('id, name, email, roles, is_active'),
    ])

  if (transfersResult.error) throw transfersResult.error
  if (ordersResult.error) throw ordersResult.error
  if (itemsResult.error) throw itemsResult.error
  if (payoutsResult.error) throw payoutsResult.error
  if (profilesResult.error) throw profilesResult.error

  const rolesByUser = new Map()
  for (const profile of profilesResult.data || []) {
    rolesByUser.set(profile.id, profile.roles || [])
  }

  const allocatedByUser = new Map()
  for (const item of itemsResult.data || []) {
    const payout = item.payout
    if (!payout || !['pending', 'paid'].includes(payout.status)) continue
    const userId = payout.user_id
    if (!allocatedByUser.has(userId)) allocatedByUser.set(userId, new Map())
    const allocated = allocatedByUser.get(userId)
    const type = item.item_type || (item.grocery_order_id ? 'shopper' : 'driver')
    const key = itemKey(type, item.transfer_id, item.grocery_order_id)
    const current = allocated.get(key) || { trip: 0, tip: 0 }
    current.trip = money(current.trip + Number(item.trip_earnings || 0))
    current.tip = money(current.tip + Number(item.tip_earnings || 0))
    allocated.set(key, current)
  }

  const pendingTotalByUser = new Map()
  const pendingCountByUser = new Map()
  for (const payout of payoutsResult.data || []) {
    if (payout.status !== 'pending') continue
    const userId = payout.user_id
    pendingTotalByUser.set(
      userId,
      money((pendingTotalByUser.get(userId) || 0) + Number(payout.total_amount || 0))
    )
    pendingCountByUser.set(userId, (pendingCountByUser.get(userId) || 0) + 1)
  }

  return {
    transfers: transfersResult.data || [],
    orders: ordersResult.data || [],
    allocatedByUser,
    pendingTotalByUser,
    pendingCountByUser,
    profiles: profilesResult.data || [],
    rolesByUser,
  }
}

export function pendingForUser(userId, universe) {
  return {
    pending_total: money(universe.pendingTotalByUser?.get(userId) || 0),
    pending_count: universe.pendingCountByUser?.get(userId) || 0,
  }
}

export function unpaidItemsForUser(userId, universe) {
  const allocated = universe.allocatedByUser.get(userId) || new Map()
  const items = []

  for (const trip of universe.transfers) {
    if (trip.driver_id === userId) {
      const tripAmt = money(trip.driver_payout)
      const tipAmt = money(trip.tip_amount)
      const remaining = remainingFor(allocated, 'driver', trip.id, null, tripAmt, tipAmt)
      let cash_collected = 0
      let cash_owed_to_admin = 0
      if (trip.payment_method === 'cash' && !remaining.alreadyHasRow) {
        cash_collected = money(trip.cash_reported)
        cash_owed_to_admin = calculateCashReconciliation({
          customer_charge: money(trip.customer_charge),
          cash_reported: money(trip.cash_reported),
          tip_amount: tipAmt,
          driver_payout: tripAmt,
        }).cash_owed_to_admin
      }
      if (remaining.trip > 0 || remaining.tip > 0 || cash_collected !== 0 || cash_owed_to_admin !== 0) {
        items.push({
          item_type: 'driver',
          transfer_id: trip.id,
          grocery_order_id: null,
          trip_number: trip.trip_number,
          order_number: null,
          date: trip.completed_at || trip.scheduled_at,
          trip_earnings: remaining.trip,
          tip_earnings: remaining.tip,
          cash_collected,
          cash_owed_to_admin,
        })
      }
    }

    if (trip.vehicle_owner_id === userId) {
      const roles = universe.rolesByUser.get(userId) || []
      if (!roles.includes('admin')) {
        const tripAmt = money(trip.owner_fee)
        const remaining = remainingFor(allocated, 'owner', trip.id, null, tripAmt, 0)
        if (remaining.trip > 0 || remaining.tip > 0) {
          items.push({
            item_type: 'owner',
            transfer_id: trip.id,
            grocery_order_id: null,
            trip_number: trip.trip_number,
            order_number: null,
            date: trip.completed_at || trip.scheduled_at,
            trip_earnings: remaining.trip,
            tip_earnings: 0,
            cash_collected: 0,
            cash_owed_to_admin: 0,
          })
        }
      }
    }
  }

  for (const order of universe.orders) {
    if (order.shopper_id !== userId) continue
    const tripAmt = money(order.shopper_payout)
    const tipAmt = money(order.tip_amount)
    const remaining = remainingFor(allocated, 'shopper', null, order.id, tripAmt, tipAmt)
    if (remaining.trip <= 0 && remaining.tip <= 0) continue
    items.push({
      item_type: 'shopper',
      transfer_id: null,
      grocery_order_id: order.id,
      trip_number: null,
      order_number: order.order_number,
      date: order.delivered_at || order.delivery_time,
      trip_earnings: remaining.trip,
      tip_earnings: remaining.tip,
      cash_collected: 0,
      cash_owed_to_admin: 0,
    })
  }

  return items
}

export async function getUnpaidItems(userId) {
  const universe = await loadPayoutUniverse()
  return unpaidItemsForUser(userId, universe)
}

export async function getOwedForUser(userId) {
  const universe = await loadPayoutUniverse()
  const items = unpaidItemsForUser(userId, universe)
  return {
    items,
    summary: summarize(items),
    ...pendingForUser(userId, universe),
  }
}

export async function getOwedRows() {
  const universe = await loadPayoutUniverse()
  const workers = (universe.profiles || []).filter(
    (user) =>
      user.is_active !== false &&
      (user.roles || []).some((role) => ['driver', 'partner', 'shopper'].includes(role))
  )

  const rows = workers.map((user) => ({
    user: { id: user.id, name: user.name, email: user.email, roles: user.roles },
    summary: summarize(unpaidItemsForUser(user.id, universe)),
    ...pendingForUser(user.id, universe),
  }))

  rows.sort((a, b) => {
    const byOwed = b.summary.total_amount - a.summary.total_amount
    if (byOwed) return byOwed
    return Math.abs(b.pending_total) - Math.abs(a.pending_total)
  })
  return rows
}
