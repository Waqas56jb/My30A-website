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

export function chicagoShortDateLine(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function usd(value, { empty = '$0', digits } = {}) {
  if (value === null || value === undefined || value === '') return empty
  const number = Number(value)
  if (!Number.isFinite(number)) return empty
  const whole = digits == null && Math.abs(number % 1) < 1e-9
  const fraction = digits != null ? digits : whole ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fraction,
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

export function weekdayDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function monthTitle(yyyyMm) {
  const [year, month] = String(yyyyMm).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function shiftMonth(yyyyMm, delta) {
  const [year, month] = String(yyyyMm).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

export function chicagoMonth(date = new Date()) {
  return chicagoToday(date).slice(0, 7)
}

export function addChicagoDays(yyyyMmDd, days) {
  const [year, month, date] = String(yyyyMmDd).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + Number(days)))
  return next.toISOString().slice(0, 10)
}

export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const minutes = Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60000))
  if (minutes < 1) return 'under a minute'
  return `${minutes} min`
}

export function formatCountdown(iso, now = Date.now()) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return 'now'
  const totalMin = Math.max(1, Math.round(ms / 60000))
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatUpdatedAgo(ts, now = Date.now()) {
  if (!ts) return ''
  const sec = Math.max(0, Math.floor((now - ts) / 1000))
  if (sec < 5) return 'Updated just now'
  if (sec < 60) return `Updated ${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `Updated ${min}m ago`
  return 'Updated over an hour ago'
}

export function roleLabel(role) {
  if (role === 'driver') return 'Driver'
  if (role === 'partner') return 'Partner'
  if (role === 'shopper') return 'Shopper'
  if (role === 'admin') return 'Admin'
  return role
}

export function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function transferRoute(trip) {
  const community = trip.community || trip.community_name || trip.community?.name || 'Community'
  const airport = trip.airport || 'Airport'
  if (trip.direction === 'from_airport') return `${airport} → ${community}`
  return `${community} → ${airport}`
}

export function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

export function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone || ''
}

export function paymentLabel(method) {
  if (method === 'card_on_file' || method === 'card' || method === 'apple_pay' || method === 'google_pay') {
    return 'Paid by card'
  }
  if (method === 'cash') return 'Cash'
  if (method === 'zelle') return 'Zelle'
  if (method === 'stripe') return 'Stripe'
  return method || '—'
}

export function payoutMethodLabel(method) {
  if (method === 'zelle') return 'Zelle'
  if (method === 'cash') return 'Cash'
  if (method === 'stripe') return 'Stripe'
  return method || ''
}

export function formatPeriodRange(start, end) {
  if (!start && !end) return null
  if (start && end) return `${formatShortDate(start)} – ${formatShortDate(end)}`
  return formatShortDate(start || end)
}

export function formatWhenLine(iso) {
  if (!iso) return ''
  const day = chicagoToday(new Date(iso))
  const today = chicagoToday()
  const [year, month, date] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(year, month - 1, date - 1)).toISOString().slice(0, 10)
  const time = formatTime(iso)
  if (day === today) return `Today, ${time}`
  if (day === yesterday) return `Yesterday, ${time}`
  return `${formatShortDate(iso)}, ${time}`
}
