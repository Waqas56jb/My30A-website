// Opening hours are stored as 30a.com's structured spans ({ mon: [["17:00","21:00"]], … }) and
// evaluated in 30A's own time zone (Central), so "Open now" is right whatever the server clock says.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function clockLabel(t) {
  const [h, m] = String(t).split(':').map(Number)
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am'
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`
}

const minutes = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}

export function nowIn30A() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  )
  return { day: parts.weekday.slice(0, 3).toLowerCase(), minute: Number(parts.hour) * 60 + Number(parts.minute) }
}

// → { open_now, today: "5pm–9pm" | "Closed today", label: "Open now · until 9pm" | "Opens 5pm" | … }
export function openStatus(openingHours) {
  if (!openingHours || typeof openingHours !== 'object') return { open_now: null, today: null, label: null }
  const { day, minute: now } = nowIn30A()
  const spans = openingHours[day] || []
  const yesterday = openingHours[DAY_KEYS[(DAY_KEYS.indexOf(day) + 6) % 7]] || []

  let openSpan = spans.find(([o, c]) => {
    const [a, b] = [minutes(o), minutes(c)]
    return b > a ? now >= a && now < b : now >= a // span that closes after midnight
  })
  if (!openSpan) openSpan = yesterday.find(([o, c]) => minutes(c) < minutes(o) && now < minutes(c))
  const today = spans.length ? spans.map(([o, c]) => `${clockLabel(o)}–${clockLabel(c)}`).join(', ') : 'Closed today'

  let label
  if (openSpan) label = `Open now · until ${clockLabel(openSpan[1])}`
  else {
    const next = spans.map(([o]) => o).find((o) => minutes(o) > now)
    label = next ? `Opens ${clockLabel(next)}` : spans.length ? 'Closed for today' : 'Closed today'
  }
  return { open_now: Boolean(openSpan), today, label }
}

// "Will it be open this evening?" — any span today that is open at or after `fromMinute`.
export function opensLaterToday(openingHours, fromMinute) {
  if (!openingHours) return false
  const { day } = nowIn30A()
  return (openingHours[day] || []).some(([o, c]) => {
    const [a, b] = [minutes(o), minutes(c)]
    return b <= a || b > fromMinute
  })
}
