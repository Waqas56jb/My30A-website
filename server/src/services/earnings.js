function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100
}

export function roundToQuarterHour(minutes) {
  const roundedMinutes = Math.round(Number(minutes) / 15) * 15
  return Math.max(0.25, roundMoney(roundedMinutes / 60))
}

function payoutFromAgreement(base, agreement, duration_minutes) {
  if (!agreement) {
    throw new Error('Agreement is required')
  }

  if (agreement.type === 'fixed') {
    return {
      payout: roundMoney(agreement.value),
      hours_billed: null,
    }
  }

  if (agreement.type === 'percentage') {
    return {
      payout: roundMoney((base * agreement.value) / 100),
      hours_billed: null,
    }
  }

  if (agreement.type === 'hourly') {
    if (duration_minutes === null || duration_minutes === undefined) {
      throw new Error('duration_minutes is required for hourly agreements')
    }
    const hours_billed = roundToQuarterHour(duration_minutes)
    return {
      payout: roundMoney(agreement.value * hours_billed),
      hours_billed,
    }
  }

  throw new Error(`Unknown agreement type: ${agreement.type}`)
}

export function calculateTransferSplit(input) {
  const {
    customer_charge,
    driver,
    vehicle_owner,
    owner_fee_percent,
    platform_fee_percent,
    agreement,
    duration_minutes,
  } = input

  const ownerIsAdmin = (vehicle_owner.roles || []).includes('admin')
  const driverIsAdmin = (driver.roles || []).includes('admin')
  const driverIsOwner = driver.id === vehicle_owner.id
  const driverIsPartner = (driver.roles || []).includes('partner')
  const warnings = []

  const owner_fee = ownerIsAdmin
    ? 0
    : roundMoney((customer_charge * owner_fee_percent) / 100)

  let driver_payout = 0
  let hours_billed = null

  if (driverIsAdmin) {
    driver_payout = 0
  } else if (driverIsOwner && driverIsPartner) {
    const platform_fee = roundMoney((customer_charge * platform_fee_percent) / 100)
    driver_payout = roundMoney(customer_charge - owner_fee - platform_fee)
  } else {
    const hired = payoutFromAgreement(customer_charge, agreement, duration_minutes)
    driver_payout = hired.payout
    hours_billed = hired.hours_billed
  }

  const my30ahost_amount = roundMoney(customer_charge - driver_payout - owner_fee)
  if (my30ahost_amount < 0) {
    warnings.push('NEGATIVE_PLATFORM_AMOUNT')
  }

  return {
    driver_payout,
    owner_fee,
    my30ahost_amount,
    hours_billed,
    snapshot: {
      owner_fee_percent,
      platform_fee_percent,
      agreement,
      duration_minutes,
      hours_billed,
      driver_is_admin: driverIsAdmin,
      owner_is_admin: ownerIsAdmin,
      driver_is_owner: driverIsOwner,
    },
    warnings,
  }
}

export function calculateGrocerySplit({ service_fee, agreement, duration_minutes }) {
  const warnings = []
  const { payout: shopper_payout, hours_billed } = payoutFromAgreement(
    service_fee,
    agreement,
    duration_minutes
  )
  const my30ahost_amount = roundMoney(service_fee - shopper_payout)
  if (my30ahost_amount < 0) {
    warnings.push('NEGATIVE_PLATFORM_AMOUNT')
  }

  return {
    shopper_payout,
    my30ahost_amount,
    hours_billed,
    snapshot: {
      agreement,
      duration_minutes,
      hours_billed,
    },
    warnings,
  }
}

export function calculateCashReconciliation({
  customer_charge,
  cash_reported,
  tip_amount,
  driver_payout,
}) {
  const expected = roundMoney(customer_charge)
  const reported = roundMoney(cash_reported)
  const driver_keeps = roundMoney(driver_payout + tip_amount)
  const cash_owed_to_admin = roundMoney(reported - driver_keeps)

  return {
    expected,
    mismatch: Math.abs(reported - expected) > 0.01,
    driver_keeps,
    cash_owed_to_admin,
  }
}
