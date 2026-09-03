const TZ = 'America/Chicago'

export function ymdInTimeZone(date = new Date(), timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function zonedDate(year, month, day, hour, minute, timeZone = TZ) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
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

export function startOfDay(ymd, timeZone = TZ) {
  const [year, month, day] = ymd.split('-').map(Number)
  return zonedDate(year, month, day, 0, 0, timeZone)
}

export function addDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function mondayOffset(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

export function rangeFor(range, dateFrom, dateTo, timeZone = TZ) {
  const today = ymdInTimeZone(new Date(), timeZone)

  if (range === 'custom' && dateFrom && dateTo) {
    return { start: startOfDay(dateFrom, timeZone), end: startOfDay(addDays(dateTo, 1), timeZone) }
  }

  if (range === 'week') {
    const monday = addDays(today, -mondayOffset(today))
    return { start: startOfDay(monday, timeZone), end: startOfDay(addDays(monday, 7), timeZone) }
  }

  if (range === 'month') {
    const [year, month] = today.split('-').map(Number)
    const startYmd = `${year}-${String(month).padStart(2, '0')}-01`
    const endYmd =
      month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    return { start: startOfDay(startYmd, timeZone), end: startOfDay(endYmd, timeZone) }
  }

  return { start: startOfDay(today, timeZone), end: startOfDay(addDays(today, 1), timeZone) }
}

export function monthRange(month, timeZone = TZ) {
  const [year, monthNumber] = month.split('-').map(Number)
  const startYmd = `${year}-${String(monthNumber).padStart(2, '0')}-01`
  const endYmd =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`
  return { start: startOfDay(startYmd, timeZone), end: startOfDay(endYmd, timeZone) }
}
