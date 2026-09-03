import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTransferSplit,
  calculateGrocerySplit,
  calculateCashReconciliation,
} from '../src/services/earnings.js'

const CHARGE = 150

function transferInput(overrides = {}) {
  return {
    customer_charge: CHARGE,
    driver: { id: 'driver-1', roles: ['driver'] },
    vehicle_owner: { id: 'owner-1', roles: ['partner'] },
    owner_fee_percent: 20,
    platform_fee_percent: 20,
    agreement: null,
    duration_minutes: null,
    ...overrides,
  }
}

test('1. Admin drives own car', () => {
  const result = calculateTransferSplit(
    transferInput({
      driver: { id: 'admin-1', roles: ['admin'] },
      vehicle_owner: { id: 'admin-1', roles: ['admin'] },
    })
  )
  assert.equal(result.driver_payout, 0)
  assert.equal(result.owner_fee, 0)
  assert.equal(result.my30ahost_amount, 150)
})

test('2. Admin drives partner van', () => {
  const result = calculateTransferSplit(
    transferInput({
      driver: { id: 'admin-1', roles: ['admin'] },
      vehicle_owner: { id: 'partner-1', roles: ['partner'] },
    })
  )
  assert.equal(result.driver_payout, 0)
  assert.equal(result.owner_fee, 30)
  assert.equal(result.my30ahost_amount, 120)
})

test('3. Partner drives own van', () => {
  const result = calculateTransferSplit(
    transferInput({
      driver: { id: 'partner-1', roles: ['partner'] },
      vehicle_owner: { id: 'partner-1', roles: ['partner'] },
    })
  )
  assert.equal(result.driver_payout, 90)
  assert.equal(result.owner_fee, 30)
  assert.equal(result.my30ahost_amount, 30)
  assert.equal(result.driver_payout + result.owner_fee, 120)
})

test('4. Hired driver fixed 30 on partner van', () => {
  const result = calculateTransferSplit(
    transferInput({
      agreement: { type: 'fixed', value: 30 },
    })
  )
  assert.equal(result.driver_payout, 30)
  assert.equal(result.owner_fee, 30)
  assert.equal(result.my30ahost_amount, 90)
})

test('5. Hired driver fixed 30 on admin car', () => {
  const result = calculateTransferSplit(
    transferInput({
      vehicle_owner: { id: 'admin-1', roles: ['admin'] },
      agreement: { type: 'fixed', value: 30 },
    })
  )
  assert.equal(result.driver_payout, 30)
  assert.equal(result.owner_fee, 0)
  assert.equal(result.my30ahost_amount, 120)
})

test('6. Hired driver 25% on partner van', () => {
  const result = calculateTransferSplit(
    transferInput({
      agreement: { type: 'percentage', value: 25 },
    })
  )
  assert.equal(result.driver_payout, 37.5)
  assert.equal(result.owner_fee, 30)
  assert.equal(result.my30ahost_amount, 82.5)
})

test('7. Hired driver hourly 20, duration 100 min', () => {
  const result = calculateTransferSplit(
    transferInput({
      agreement: { type: 'hourly', value: 20 },
      duration_minutes: 100,
    })
  )
  assert.equal(result.hours_billed, 1.75)
  assert.equal(result.driver_payout, 35)
})

test('8. Hired driver hourly 20, duration 7 min', () => {
  const result = calculateTransferSplit(
    transferInput({
      agreement: { type: 'hourly', value: 20 },
      duration_minutes: 7,
    })
  )
  assert.equal(result.hours_billed, 0.25)
  assert.equal(result.driver_payout, 5)
})

test('9. owner_fee_percent 25 on partner van with fixed 30', () => {
  const result = calculateTransferSplit(
    transferInput({
      owner_fee_percent: 25,
      agreement: { type: 'fixed', value: 30 },
    })
  )
  assert.equal(result.owner_fee, 37.5)
})

test('10. Hired driver fixed 200 on 150 trip warns negative platform', () => {
  const result = calculateTransferSplit(
    transferInput({
      agreement: { type: 'fixed', value: 200 },
    })
  )
  assert.equal(result.my30ahost_amount, -80)
  assert.deepEqual(result.warnings, ['NEGATIVE_PLATFORM_AMOUNT'])
})

test('11. Hired driver with agreement null throws', () => {
  assert.throws(() => calculateTransferSplit(transferInput({ agreement: null })))
})

test('12. Grocery 30% of service_fee 149; grocery_total ignored', () => {
  const result = calculateGrocerySplit({
    service_fee: 149,
    agreement: { type: 'percentage', value: 30 },
    duration_minutes: null,
    grocery_total: 312,
  })
  assert.equal(result.shopper_payout, 44.7)
  assert.equal(result.my30ahost_amount, 104.3)
})

test('13. Cash reported matches charge', () => {
  const result = calculateCashReconciliation({
    customer_charge: 150,
    cash_reported: 150,
    tip_amount: 15,
    driver_payout: 30,
  })
  assert.equal(result.mismatch, false)
  assert.equal(result.driver_keeps, 45)
  assert.equal(result.cash_owed_to_admin, 105)
})

test('14. Cash reported 140 mismatches', () => {
  const result = calculateCashReconciliation({
    customer_charge: 150,
    cash_reported: 140,
    tip_amount: 15,
    driver_payout: 30,
  })
  assert.equal(result.mismatch, true)
  assert.equal(result.cash_owed_to_admin, 95)
})
