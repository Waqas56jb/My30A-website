// Events from 30a.com/events — organizer-submitted listings (The 30A Company, not the county), so
// treated as a volume source: the app tells guests to confirm before they go.
//
// How it's pulled (checked 2026-09-25): the site's RSS / iCal feeds exist but are capped at the
// next ~100 events (≈3 days) and the iCal export mangles recurring dates (1970 / 2022), so the
// reliable source is the listing page for one day at a time (/events/?calendar_day=YYYY-MM-DD):
// time, title, occurrence URL, venue. Each unique event's own page then adds its schema.org Event
// data — photo, description, address, town, cancelled status — fetched once and reused for every
// repeat of the same title at the same venue.
import { supabase } from '../lib/supabase.js'
import { clearMemo, memo } from '../lib/memo.js'

const BASE = 'https://30a.com'
const UA = 'Mozilla/5.0 (compatible; My30AHostEvents/1.0; +https://www.my30ahost.com)'
const TZ = 'America/Chicago'

const decode = (s) =>
  String(s || '')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const get = (url, ms = 20000) =>
  fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(ms) }).then((r) =>
    r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${url}`))
  )

// "YYYY-MM-DD" in 30A time, `offset` days from today.
export function dayKey(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Central-time wall clock → UTC ISO (handles CST/CDT by asking Intl for that day's offset).
function centralToIso(day, hhmm) {
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = hhmm
  const guess = Date.UTC(y, m - 1, d, h + 6, min)
  const offsetName = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(guess))
    .find((p) => p.type === 'timeZoneName').value // "GMT-5" / "GMT-6"
  const offset = Number(offsetName.replace('GMT', '')) || -6
  return new Date(Date.UTC(y, m - 1, d, h - offset, min)).toISOString()
}

const clock = (text) => {
  const m = String(text).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (/pm/i.test(m[3])) h += 12
  return [h, Number(m[2] || 0)]
}

// One listing page → occurrences on that day.
export function parseDay(html, day) {
  const out = []
  for (const li of html.matchAll(/<li><div class="custom_date">([\s\S]*?)<\/li>/g)) {
    const block = li[1]
    const link = block.match(/<a href="(https:\/\/30a\.com\/events\/[^"]+)">([\s\S]*?)<\/a>/)
    if (!link) continue
    const venue = block.match(/@ <a href="(https:\/\/30a\.com\/locations\/[^"]+)">([\s\S]*?)<\/a>/)
    const range = decode(block.match(/<span class="single_loc_list">([\s\S]*?)<\/span>/)?.[1] || '')
    const times = [...range.matchAll(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi)].map((m) => clock(m[0]))
    const allDay = !times.length || /all day/i.test(range)
    const start = times[0] || [0, 0]
    let end = times[1] || null
    let endDay = day
    if (end && end[0] * 60 + end[1] <= start[0] * 60 + start[1]) {
      // ends after midnight
      const next = new Date(`${day}T12:00:00Z`)
      next.setUTCDate(next.getUTCDate() + 1)
      endDay = next.toISOString().slice(0, 10)
    }
    out.push({
      source_url: link[1],
      title: decode(link[2]),
      venue_url: venue?.[1] || null,
      venue_name: venue ? decode(venue[2]) : null,
      starts_at: centralToIso(day, start),
      ends_at: end ? centralToIso(endDay, end) : null,
      all_day: allDay,
    })
  }
  return out
}

// schema.org Event on the occurrence page: description, photo, address, town, status.
export function parseDetail(html) {
  for (const m of html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let json
    try {
      json = JSON.parse(m[1])
    } catch {
      continue
    }
    const node = (json['@graph'] || [json]).find((n) => n['@type'] === 'Event')
    if (!node) continue
    const place = node.location || {}
    const a = place.address || {}
    const image = [].concat(node.image || [])[0] || html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null
    const status = /Cancel/i.test(node.eventStatus || '') ? 'cancelled' : /Postpon/i.test(node.eventStatus || '') ? 'postponed' : 'scheduled'
    return {
      description: decode(node.description || '').slice(0, 600) || null,
      image_url: image,
      address: [a.streetAddress, a.addressLocality, a.postalCode].filter(Boolean).join(', ') || null,
      town: a.addressLocality || null,
      lat: place.geo?.latitude ? Number(place.geo.latitude) : null,
      lng: place.geo?.longitude ? Number(place.geo.longitude) : null,
      status,
    }
  }
  return {}
}

// ---------- categories ----------
const CATEGORY_RULES = [
  ['Markets', /market|makers|flea|pop-?up shop|artisan fair/i],
  ['Games & Sports', /trivia|bingo|game night|game days?|karaoke|poker|cornhole|nfl|sec football|football|watch party|tailgate|pickleball tournament/i],
  ['Kids & Family', /kids?|family|children|story ?time|toddler|teen|youth|camp|puppet|magic show|touch a truck|lego|preschool|homeschool|crafty/i],
  ['Fitness & Outdoors', /run|5k|10k|yoga|pilates|bike|paddle|fitness|workout|walk|hike|surf|kayak|race series|boot ?camp|golf|tennis|pickleball/i],
  ['Food & Drink', /wine|beer|tasting|dinner|brunch|happy hour|special|cocktail|oyster|crawfish|pairing|chef|food|taco|pizza|prime rib|bourbon|tequila|margarita|whiskey|sip|mimosa/i],
  ['Arts & Culture', /art|arts|gallery|theatre|theater|film|movie|author|book|paint|pottery|glass|exhibit|museum|lecture|symphony|orchestra|ballet|poetry|musical|play|comedy/i],
  ['Festivals & Community', /festival|fest|fair|parade|celebration|fundraiser|gala|benefit|holiday|halloween|christmas|thanksgiving|fireworks|tree lighting|community|meet ?up|networking|church|worship/i],
  ['Live Music', /music|band|jazz|acoustic|dj|concert|live|duo|trio|singer|songwriter|piano|guitar|blues|country|bluegrass|reggae|rock/i],
]
const VENUE_RULES = [
  ['Arts & Culture', /theatre|theater|gallery|museum|arts center|art center|playhouse/i],
  ['Kids & Family', /library/i],
  ['Fitness & Outdoors', /state park|golf club|tennis|racquet|yoga|fitness|crossfit/i],
]
export const EVENT_CATEGORIES = ['Live Music', 'Food & Drink', 'Markets', 'Festivals & Community', 'Arts & Culture', 'Kids & Family', 'Fitness & Outdoors', 'Games & Sports']

export function categorize(title, description = '', venue = '', diningVenue = false) {
  const t = String(title).trim()
  const byTitle = CATEGORY_RULES.find(([, re]) => re.test(t))
  if (byTitle) return byTitle[0]
  const byVenue = VENUE_RULES.find(([, re]) => re.test(venue))
  if (byVenue) return byVenue[0]
  // A bare performer's name ("Chris Johnson", "Keylan Rayne") at a restaurant or bar is live music.
  if (diningVenue && /^[A-Z][\w'’.&-]*(?:\s+(?:&\s+|and\s+|the\s+)?[A-Z][\w'’.&-]*){0,4}$/.test(t)) return 'Live Music'
  const byText = CATEGORY_RULES.find(([, re]) => re.test(description))
  if (byText) return byText[0]
  return diningVenue ? 'Live Music' : 'Festivals & Community'
}

// ---------- community ----------
const COMMUNITY_WORDS = [
  ['Rosemary Beach', /rosemary/i], ['Alys Beach', /alys/i], ['Inlet Beach', /inlet/i], ['Seacrest Beach', /seacrest/i],
  ['Watersound', /watersound/i], ['Seaside', /seaside/i], ['WaterColor', /watercolor/i], ['Seagrove Beach', /seagrove/i],
  ['Grayton Beach', /grayton/i], ['Blue Mountain Beach', /blue mountain/i], ['Gulf Place', /gulf place/i],
  ['Dune Allen Beach', /dune allen/i], ['Miramar Beach', /miramar|sandestin|baytowne|grand boulevard/i],
  ['Santa Rosa Beach', /santa rosa/i], ['Destin', /destin/i], ['Freeport', /freeport/i],
]
function communityFor(e, venueIndex) {
  const known = e.venue_url ? venueIndex.get(e.venue_url.replace(/\/$/, '')) : null
  if (known) return known
  const text = `${e.venue_name || ''} ${e.address || ''} ${e.town || ''}`
  const town = e.town ? e.town.replace(/^defuniak springs$/i, 'DeFuniak Springs') : null
  return COMMUNITY_WORDS.find(([, re]) => re.test(text))?.[0] || town
}

async function pool(items, size, fn) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift())
    })
  )
}

// Sync `days` days starting today. `detailLimit` bounds how many new event pages are fetched in one
// run and `budgetMs` how long the run may take (the daily Vercel cron has 60s) — whatever isn't
// enriched now keeps its listing data and is completed on the next run.
export async function syncEvents({ days = 31, detailLimit = 400, budgetMs = 50000, log = () => {} } = {}) {
  const started = Date.now()
  const timeLeft = () => budgetMs - (Date.now() - started)
  const dayKeys = Array.from({ length: days }, (_, i) => dayKey(i))

  // 1. Listing pages, one per day.
  const occurrences = new Map()
  let daysFetched = 0
  const failed = []
  const fetchDay = async (day, retry) => {
    if (timeLeft() < 12000) return
    try {
      const html = await get(`${BASE}/events/?calendar_day=${day}`, 25000)
      for (const e of parseDay(html, day)) occurrences.set(e.source_url, e)
      daysFetched += 1
    } catch (error) {
      if (!retry) failed.push(day)
      log(`day ${day}${retry ? ' (retry)' : ''}: ${error.message}`)
    }
  }
  await pool(dayKeys, 6, (day) => fetchDay(day, false))
  // 30a.com is slow at times — one more try for any day that timed out.
  await pool(failed, 3, (day) => fetchDay(day, true))
  const list = [...occurrences.values()]
  log(`listing: ${list.length} occurrences over ${daysFetched}/${days} days`)

  // 2. Details: reuse what we already know for the same title at the same venue.
  const { data: known } = await supabase
    .from('events')
    .select('source_url, title, venue_url, description, image_url, address, town, lat, lng, status')
    .gte('starts_at', new Date(Date.now() - 60 * 86400000).toISOString())
  const byUrl = new Map((known || []).map((k) => [k.source_url, k]))
  const seriesKey = (e) => `${e.title.toLowerCase()}|${e.venue_url || e.venue_name || ''}`
  const bySeries = new Map()
  for (const k of known || []) if (k.description || k.image_url) bySeries.set(seriesKey(k), k)

  const needDetail = []
  for (const e of list) {
    const k = byUrl.get(e.source_url)
    const s = bySeries.get(seriesKey(e))
    const reuse = k?.description || k?.image_url ? k : s
    if (reuse) Object.assign(e, pick(reuse))
    else needDetail.push(e)
  }
  // One detail fetch per series; copy the result to its other occurrences.
  const series = new Map()
  for (const e of needDetail) if (!series.has(seriesKey(e))) series.set(seriesKey(e), e)
  const toFetch = [...series.values()].slice(0, detailLimit)
  let detailsFetched = 0
  await pool(toFetch, 8, async (e) => {
    if (timeLeft() < 6000) return
    try {
      Object.assign(e, parseDetail(await get(e.source_url, 15000)))
      detailsFetched += 1
    } catch (error) {
      log(`detail ${e.source_url}: ${error.message}`)
    }
  })
  for (const e of needDetail) {
    const src = series.get(seriesKey(e))
    if (src !== e) Object.assign(e, pick(src))
  }
  log(`details: ${detailsFetched} fetched (${series.size} new series, ${list.length - needDetail.length} reused)`)

  // 3. Community + category, then upsert.
  const { data: venues } = await supabase.from('explore_vendors').select('source_url, community').not('source_url', 'is', null)
  const venueIndex = new Map((venues || []).map((v) => [v.source_url.replace(/\/$/, ''), v.community]))
  const diningVenues = new Set(venueIndex.keys())
  const now = new Date().toISOString()
  const rows = list.map((e) => ({
    source: '30a.com',
    source_url: e.source_url,
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    all_day: e.all_day,
    venue_name: e.venue_name,
    venue_url: e.venue_url,
    address: e.address || null,
    town: e.town || null,
    community: communityFor(e, venueIndex),
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    description: e.description || null,
    image_url: e.image_url || null,
    category: categorize(e.title, e.description || '', e.venue_name || '', diningVenues.has((e.venue_url || '').replace(/\/$/, ''))),
    status: e.status || 'scheduled',
    last_seen_at: now,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('events').upsert(rows.slice(i, i + 200), { onConflict: 'source_url' })
    if (error) throw error
  }
  // Occurrences in the synced window that vanished from the listing were removed by the organizer.
  if (daysFetched === days && rows.length) {
    const windowEnd = new Date(Date.now() + days * 86400000).toISOString()
    await supabase
      .from('events')
      .update({ status: 'removed' })
      .gte('starts_at', new Date().toISOString())
      .lt('starts_at', windowEnd)
      .lt('last_seen_at', now)
      .eq('status', 'scheduled')
  }
  clearMemo('explore:events')
  return { ok: true, occurrences: rows.length, days: daysFetched, details_fetched: detailsFetched, ms: Date.now() - started }
}

const pick = (k) => ({
  description: k.description,
  image_url: k.image_url,
  address: k.address,
  town: k.town,
  lat: k.lat,
  lng: k.lng,
  status: k.status === 'removed' ? 'scheduled' : k.status,
})

// Events (30a.com, organizer-submitted): next 5 weeks, grouped client-side into today / this
// weekend / this month. Dates and times are formatted in 30A's own time zone.
const EVENT_TZ = 'America/Chicago'
export const eventDay = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const eventClock = (iso) =>
  new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(':00', '').replace(' ', '').toLowerCase()
const gcalStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function eventView(e) {
  const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 3600000).toISOString()
  const where = [e.venue_name, e.address].filter(Boolean).join(', ')
  return {
    id: e.id,
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    day: eventDay(e.starts_at),
    time: e.all_day ? 'All day' : `${eventClock(e.starts_at)}${e.ends_at ? `–${eventClock(e.ends_at)}` : ''}`,
    venue: e.venue_name,
    community: e.community,
    address: e.address,
    category: e.category,
    image: e.image_url,
    description: e.description,
    url: e.source_url,
    directions: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where || `${e.title} 30A FL`)}`,
    calendar: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${gcalStamp(e.starts_at)}/${gcalStamp(end)}&location=${encodeURIComponent(where)}&details=${encodeURIComponent(`${e.source_url}\n\nListed on 30a.com — confirm with the organizer before you go.`)}`,
  }
}

export function loadUpcomingEvents() {
  return memo('explore:events', async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'scheduled')
      .gte('starts_at', new Date(Date.now() - 3 * 3600000).toISOString())
      .lte('starts_at', new Date(Date.now() + 36 * 86400000).toISOString())
      .order('starts_at')
      .limit(1500)
    if (error) throw new Error(error.message)
    return data || []
  }, 10 * 60 * 1000)
}


// ---------- Vitoria: events as chat cards ----------
const plain = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const EVENT_INTENT = /event|happening|going on|what(’|')?s on|things to do|live music|concert|band|festival|farmers? market|market|trivia|bingo|karaoke|show tonight|fun tonight|this weekend|nightlife|entertainment|activities/

const CAT_WORDS = [
  ['Live Music', /live music|music|band|concert|jazz|acoustic|dj/],
  ['Markets', /market/],
  ['Food & Drink', /wine|beer|tasting|happy hour|food|drink|brunch/],
  ['Kids & Family', /kid|family|children|toddler/],
  ['Arts & Culture', /art|theat|gallery|film|movie|comedy/],
  ['Fitness & Outdoors', /yoga|run|fitness|outdoor|paddle|bike/],
  ['Games & Sports', /trivia|bingo|game|karaoke|football|nfl|sports/],
  ['Festivals & Community', /festival|parade|fair|community|fundraiser/],
]

export function understandEvents(text, todayKey) {
  const t = plain(text)
  const add = (n) => {
    const d = new Date(`${todayKey}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const wd = new Date(`${todayKey}T12:00:00Z`).getUTCDay()
  let days = [todayKey]
  let when = 'today'
  if (/tomorrow/.test(t)) (days = [add(1)]), (when = 'tomorrow')
  else if (/weekend|saturday|sunday|friday/.test(t)) {
    const fri = wd === 0 ? add(-2) : wd === 6 ? add(-1) : add(5 - wd)
    days = [0, 1, 2].map((i) => {
      const d = new Date(`${fri}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    }).filter((d) => d >= todayKey)
    when = 'weekend'
  } else if (/this week|next few days|coming up|upcoming/.test(t)) (days = Array.from({ length: 7 }, (_, i) => add(i))), (when = 'week')
  return {
    days,
    when,
    tonight: /tonight|this evening|night/.test(t),
    category: CAT_WORDS.find(([, re]) => re.test(t))?.[0] || null,
  }
}

export function eventCard(v, why = '') {
  return {
    name: v.title,
    area: v.community || '',
    category: v.category,
    why: why || [v.venue, (v.description || '').split(/(?<=[.!?])\s/)[0]].filter(Boolean).join(' — ').slice(0, 180),
    facts: [v.day, v.time].filter(Boolean),
    hours: '',
    phone: '',
    website: v.url,
    directions: v.directions,
    image: v.image || null,
    partner: false,
    in_guide: true,
    kind: 'event',
    calendar: v.calendar,
    to: '/app/explore/events?when=month',
  }
}

const stepWords = ['miramar', 'topsail', 'dune allen', 'santa rosa', 'gulf place', 'blue mountain', 'grayton', 'watercolor', 'seaside', 'seagrove', 'watersound', 'prominence', 'alys', 'seacrest', 'rosemary', 'inlet']
const step = (c) => stepWords.findIndex((w) => plain(c).includes(w))

export async function recommendEvents({ text = '', community = null, count = 4 } = {}) {
  const rows = await loadUpcomingEvents()
  const now = Date.now()
  const views = rows
    .filter((e) => new Date(e.ends_at || e.starts_at).getTime() + (e.ends_at ? 0 : 2 * 3600000) > now)
    .map(eventView)
  const today = eventDay(new Date().toISOString())
  const want = understandEvents(text, today)
  const home = community ? step(community) : -1
  let pool = views.filter((v) => want.days.includes(v.day))
  if (want.tonight) {
    const evening = pool.filter((v) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(new Date(v.starts_at))) >= 16)
    if (evening.length) pool = evening
  }
  if (want.category) {
    const cat = pool.filter((v) => v.category === want.category)
    if (cat.length) pool = cat
  }
  const scored = pool.map((v) => {
    const s = step(v.community)
    const dist = home >= 0 && s >= 0 ? Math.abs(s - home) : home >= 0 ? 8 : 0
    return { v, score: -dist * 2 + (v.image ? 1 : 0) + (v.description ? 0.5 : 0) }
  })
  scored.sort((a, b) => b.score - a.score || a.v.starts_at.localeCompare(b.v.starts_at))
  // Variety: at most one per title.
  const picks = []
  const seen = new Set()
  for (const { v } of scored) {
    if (seen.has(plain(v.title))) continue
    seen.add(plain(v.title))
    picks.push(v)
    if (picks.length >= count) break
  }
  picks.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return { picks, want, total: pool.length }
}

export async function findEvent(name) {
  const key = plain(name)
  if (key.length < 4) return null
  const rows = await loadUpcomingEvents()
  const hit = rows.find((e) => plain(e.title) === key) || rows.find((e) => plain(e.title).includes(key) || key.includes(plain(e.title)))
  return hit ? eventView(hit) : null
}

// Compact text for Vitoria's knowledge pack: the next few days, one line per event.
export async function eventsKnowledge(days = 4) {
  const rows = await loadUpcomingEvents()
  const views = rows.map(eventView)
  const today = eventDay(new Date().toISOString())
  const until = new Date(`${today}T12:00:00Z`)
  until.setUTCDate(until.getUTCDate() + days)
  const lastDay = until.toISOString().slice(0, 10)
  const byDay = new Map()
  for (const v of views) if (v.day < lastDay) (byDay.get(v.day) || byDay.set(v.day, []).get(v.day)).push(v)
  const lines = [`\nEVENTS ALONG 30A (from 30a.com, organizer-submitted — tell guests to confirm before going). Next ${days} days:`]
  for (const [day, list] of byDay) {
    lines.push(`\n## ${day}`)
    for (const v of list) lines.push(`- ${v.time} ${v.title} — ${[v.venue, v.community].filter(Boolean).join(', ')} [${v.category}]`)
  }
  return lines.join('\n')
}
