const TZ = 'America/Chicago'

export function errorMessage(error) {
  return error?.data?.error || error?.message || 'Something went wrong'
}

export function chicagoToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function chicagoDateLine(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
  return `${day} · Central time`
}

function addDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function chicagoWallToUtc(ymd, hour = 0, minute = 0) {
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utc))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )
  let hours = Number(parts.hour)
  if (hours === 24) hours = 0
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hours,
    Number(parts.minute),
    Number(parts.second)
  )
  return new Date(utc - (asUTC - utc))
}

export function chicagoDayIsoRange(ymd = chicagoToday()) {
  const start = chicagoWallToUtc(ymd, 0, 0)
  const end = chicagoWallToUtc(addDays(ymd, 1), 0, 0)
  return {
    date_from: start.toISOString(),
    date_to: new Date(end.getTime() - 1).toISOString(),
  }
}

export function usd(value, { empty = '$0.00' } = {}) {
  if (value === null || value === undefined || value === '') return empty
  const number = Number(value)
  if (!Number.isFinite(number)) return empty
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(date)
  return `${day} · ${formatTime(iso)}`
}

export function chicagoDatetimeLocal(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function chicagoDateTimeToIso(local) {
  if (!local) return null
  const [ymd, time] = local.split('T')
  const [hour, minute] = (time || '00:00').split(':').map(Number)
  return chicagoWallToUtc(ymd, hour, minute).toISOString()
}

export function statusLabel(status) {
  const labels = {
    assigned: 'Assigned',
    started: 'Started',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    shopping: 'Shopping',
    on_the_way: 'On the way',
    delivered: 'Delivered',
  }
  return labels[status] || status || '—'
}

export function paymentLabel(method) {
  if (method === 'card_on_file') return 'Card on file'
  if (method === 'cash') return 'Cash'
  if (method === 'card') return 'Card on the spot'
  return method || '—'
}

export function splitShares(driver, owner, host) {
  const d = Math.max(0, Number(driver) || 0)
  const o = Math.max(0, Number(owner) || 0)
  const h = Math.max(0, Number(host) || 0)
  const total = d + o + h
  if (total <= 0) return null
  return {
    driver: (d / total) * 100,
    owner: (o / total) * 100,
    host: (h / total) * 100,
  }
}

export function formatShortDate(value) {
  if (!value) return '—'
  const ymd = String(value).slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [year, month, day] = ymd.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    }).format(new Date(Date.UTC(year, month - 1, day)))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function roleLabel(role) {
  if (role === 'driver') return 'Driver'
  if (role === 'partner') return 'Partner'
  if (role === 'shopper') return 'Shopper'
  if (role === 'admin') return 'Admin'
  return role
}

export function primaryWorkerRole(roles = []) {
  if (roles.includes('shopper') && !roles.includes('driver') && !roles.includes('partner')) {
    return 'shopper'
  }
  if (roles.includes('partner') && !roles.includes('driver')) return 'partner'
  if (roles.includes('driver')) return 'driver'
  if (roles.includes('shopper')) return 'shopper'
  if (roles.includes('partner')) return 'partner'
  return roles[0] || 'driver'
}

export function flagLabel(reason) {
  if (!reason) return 'Flagged'
  return String(reason)
    .split(',')
    .map((part) => {
      const key = part.trim()
      if (key === 'CASH_MISMATCH') return 'Cash mismatch'
      if (key === 'CANCELLED_AFTER_START') return 'Cancelled after start'
      if (key === 'NEGATIVE_PLATFORM_AMOUNT') return 'Needs review'
      return key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
    })
    .join(' · ')
}

export function transferRoute(trip) {
  const community = trip.community_name || trip.community?.name || 'Community'
  const airport = trip.airport || 'Airport'
  if (trip.direction === 'from_airport') return `${airport} → ${community}`
  return `${community} → ${airport}`
}

export function vehicleTypeLabel(type, capacity) {
  if (type === '4pax') return `Car · ${capacity || 4} pax`
  if (type === '6pax') return `SUV · ${capacity || 6} pax`
  if (type === '14pax') return `Van · ${capacity || 14} pax`
  return type || '—'
}

export function vehicleLabel(vehicle) {
  if (!vehicle) return '—'
  return `${vehicle.make} ${vehicle.model} (${vehicle.plate})`
}

export function compensationLabel(agreement, roles = [], { includeSince = true } = {}) {
  if (!agreement) return 'No rate set'
  const since = includeSince && agreement.effective_from ? ` since ${formatShortDate(agreement.effective_from)}` : ''
  if (agreement.type === 'fixed') return `Fixed ${usd(agreement.value)} per trip${since}`
  if (agreement.type === 'hourly') return `${usd(agreement.value)} per hour${since}`
  if (agreement.type === 'percentage') {
    const of = roles.includes('shopper') && !roles.includes('driver') ? 'service fee' : 'trip'
    return `${Number(agreement.value)}% of ${of}${since}`
  }
  return `${agreement.type} ${agreement.value}${since}`
}

export function statusPill(status) {
  if (status === 'assigned') return { sand: true }
  if (status === 'refunded' || status === 'cancelled' || status === 'inactive') return { neutral: true }
  return {}
}
