// OpenStreetMap Nominatim geocoder — free, no API key required (there is no Google Maps key
// anywhere in this project; when one is provided, swap this module for the Places/Geocoding API
// and everything calling geocodeQuery()/communities.lat+lng stays the same).
//
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/) requires a descriptive
// User-Agent and an absolute max of ~1 request/second — enforced here with a simple in-process
// queue plus a short result cache so the guest-app autocomplete never bursts past that.
const ENDPOINT = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'My30AHostGuestApp/1.0 (+https://my30ahost.com; contact: my30ahost@gmail.com)'
const MIN_INTERVAL_MS = 1100

// Roughly the Scenic Highway 30A corridor (Walton/Bay County, FL) — biases/limits results so a
// typed "Seaside" doesn't match some unrelated town in another state.
export const CORRIDOR_VIEWBOX = { west: -86.42, south: 30.12, east: -85.85, north: 30.48 }

let lastCallAt = 0
let queue = Promise.resolve()
const cache = new Map() // query -> { at, data }
const CACHE_TTL_MS = 60_000

function throttled(run) {
  const next = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt)
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastCallAt = Date.now()
    return run()
  })
  // Never let one failed call jam the queue for subsequent callers.
  queue = next.catch(() => {})
  return next
}

async function request(path, params) {
  const url = new URL(`${ENDPOINT}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  }
  const cacheKey = url.toString()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data

  const data = await throttled(async () => {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Nominatim ${response.status} ${response.statusText}`)
    return response.json()
  })
  cache.set(cacheKey, { at: Date.now(), data })
  return data
}

function mapRow(row) {
  return {
    label: row.display_name,
    name: row.name || null,
    lat: Number(row.lat),
    lon: Number(row.lon),
    type: row.addresstype || row.type || null,
    address: row.address || {},
    boundingbox: (row.boundingbox || []).map(Number), // [south, north, west, east]
  }
}

// Free-text search, biased to the 30A corridor so short/ambiguous queries still resolve locally.
export async function geocodeQuery(query, { limit = 5, bounded = false } = {}) {
  const q = String(query || '').trim()
  if (q.length < 3) return []
  const { west, south, east, north } = CORRIDOR_VIEWBOX
  const rows = await request('/search', {
    q,
    format: 'jsonv2',
    addressdetails: 1,
    limit,
    countrycodes: 'us',
    viewbox: `${west},${north},${east},${south}`,
    bounded: bounded ? 1 : 0,
  })
  return (Array.isArray(rows) ? rows : []).map(mapRow)
}

// Used once per community (see scripts/geocode-communities.js) to get a real, data-sourced
// center point + bounding box for that specific named place — not a hand-typed guess. `bounded`
// hard-restricts results to the 30A corridor so an ambiguous short name (e.g. "Gulf Place")
// can never resolve to a same-named place in a different county.
export async function geocodePlace(name, { bounded = true } = {}) {
  const { west, south, east, north } = CORRIDOR_VIEWBOX
  const rows = await request('/search', {
    q: `${name}, Florida, USA`,
    format: 'jsonv2',
    addressdetails: 1,
    limit: 1,
    viewbox: `${west},${north},${east},${south}`,
    bounded: bounded ? 1 : 0,
  })
  const row = Array.isArray(rows) ? rows[0] : null
  return row ? mapRow(row) : null
}

// Reverse geocode a coordinate back to an address + place name (used to confirm what a selected
// autocomplete suggestion actually is, and to report the *nearest real place* on a mismatch).
export async function reverseGeocode(lat, lon) {
  const row = await request('/reverse', {
    lat,
    lon,
    format: 'jsonv2',
    addressdetails: 1,
    zoom: 16,
  })
  return row && !row.error ? mapRow(row) : null
}
