import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role'

const { unpaidItemsForUser, summarize, pendingForUser } = await import('../src/services/payouts.js')

const DRIVER = 'driver-1'
const SHOPPER = 'shopper-1'
const PARTNER = 'partner-1'
const TRIP_ID = 'trip-cash'
const ORDER_ID = 'order-1'

function allocated(entries) {
  const map = new Map()
  for (const [userId, items] of Object.entries(entries)) {
    const inner = new Map()
    for (const [key, amounts] of Object.entries(items)) inner.set(key, amounts)
    map.set(userId, inner)
  }
  return map
}

function universe(overrides = {}) {
  return {
    transfers: [
      {
        id: TRIP_ID,
        trip_number: 5,
        completed_at: '2026-09-03T12:00:00Z',
        scheduled_at: '2026-09-03T12:00:00Z',
        driver_payout: 30,
        tip_amount: 10,
        payment_method: 'cash',
        cash_reported: 85,
        customer_charge: 85,
        status: 'completed',
        driver_id: DRIVER,
        vehicle_owner_id: PARTNER,
        owner_fee: 17,
      },
    ],
    orders: [
      {
        id: ORDER_ID,
        order_number: 1,
        delivered_at: '2026-09-03T12:00:00Z',
        delivery_time: '2026-09-03T12:00:00Z',
        shopper_payout: 44.7,
        tip_amount: 30,
        status: 'delivered',
        shopper_id: SHOPPER,
      },
    ],
    allocatedByUser: new Map(),
    pendingTotalByUser: new Map(),
    pendingCountByUser: new Map(),
    rolesByUser: new Map([
      [DRIVER, ['driver']],
      [SHOPPER, ['shopper']],
      [PARTNER, ['partner']],
    ]),
    ...overrides,
  }
}

test('owed includes completed cash trip when it is in no payout', () => {
  const items = unpaidItemsForUser(DRIVER, universe())
  assert.deepEqual(summarize(items), {
    trip_earnings: 30,
    tip_earnings: 10,
    cash_collected: 85,
    cash_owed_to_admin: 45,
    total_amount: -5,
  })
})

test('pending payout items leave owed at 0 and keep pending_total', () => {
  const data = universe({
    allocatedByUser: allocated({
      [DRIVER]: { [`driver:${TRIP_ID}:`]: { trip: 30, tip: 10 } },
    }),
    pendingTotalByUser: new Map([[DRIVER, -5]]),
    pendingCountByUser: new Map([[DRIVER, 1]]),
  })
  const items = unpaidItemsForUser(DRIVER, data)
  assert.equal(items.length, 0)
  assert.deepEqual(summarize(items).total_amount, 0)
  assert.deepEqual(pendingForUser(DRIVER, data), { pending_total: -5, pending_count: 1 })
})

test('paid payout items also leave owed at 0', () => {
  const items = unpaidItemsForUser(
    PARTNER,
    universe({
      allocatedByUser: allocated({
        [PARTNER]: { [`owner:${TRIP_ID}:`]: { trip: 17, tip: 0 } },
      }),
    })
  )
  assert.equal(items.length, 0)
})

test('late tip after a payout shows only the remaining difference', () => {
  const items = unpaidItemsForUser(
    SHOPPER,
    universe({
      allocatedByUser: allocated({
        [SHOPPER]: { [`shopper::${ORDER_ID}`]: { trip: 44.7, tip: 20 } },
      }),
    })
  )
  assert.deepEqual(summarize(items), {
    trip_earnings: 0,
    tip_earnings: 10,
    cash_collected: 0,
    cash_owed_to_admin: 0,
    total_amount: 10,
  })
})

test('late tip after pending payout is also only the difference', () => {
  const items = unpaidItemsForUser(
    SHOPPER,
    universe({
      allocatedByUser: allocated({
        [SHOPPER]: { [`shopper::${ORDER_ID}`]: { trip: 44.7, tip: 30 } },
      }),
    })
  )
  assert.equal(items.length, 0)
})

test('cash owed is skipped once the trip is a driver item in any payout', () => {
  const items = unpaidItemsForUser(
    DRIVER,
    universe({
      allocatedByUser: allocated({
        [DRIVER]: { [`driver:${TRIP_ID}:`]: { trip: 30, tip: 5 } },
      }),
    })
  )
  assert.equal(items.length, 1)
  assert.equal(items[0].cash_collected, 0)
  assert.equal(items[0].cash_owed_to_admin, 0)
  assert.equal(items[0].tip_earnings, 5)
})

test('deleting a pending payout (no allocated row) returns the item to owed', () => {
  const items = unpaidItemsForUser(DRIVER, universe())
  assert.equal(summarize(items).total_amount, -5)
})
