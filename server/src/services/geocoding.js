// Address ↔ community matching. A community's center/radius comes from Nominatim once (see
// scripts/geocode-communities.js) and is stored on the communities row; every guest address is
// then geocoded through the same service and compared by real distance — no hand-typed
// coordinates, no fragile string matching as the only signal.
import { supabase } from '../lib/supabase.js'
import { geocodeQuery, reverseGeocode } from '../lib/nominatim.js'

const EARTH_RADIUS_MILES = 3958.8
// A selected address slightly outside a community's derived radius (e.g. right at the edge of a
// long, thin development) is still allowed if it's this much within the limit.
const TOLERANCE = 1.2

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

export async function loadGeocodedCommunities() {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, zone, default_airport, lat, lng, radius_miles')
    .eq('is_active', true)
    .not('lat', 'is', null)
  if (error) throw error
  return data || []
}

// A development name appearing directly in the geocoded address (OSM tags these as
// village/suburb/neighbourhood) is treated as a confident match even if the point geocodes a
// few tenths of a mile outside the derived radius — the strongest signal available.
function nameAppearsIn(address, communityName) {
  const needle = communityName.toLowerCase()
  return Object.values(address || {}).some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle)
  )
}

export function distanceToCommunity(lat, lon, community) {
  return haversineMiles(lat, lon, community.lat, community.lng)
}

// Ranks every geocoded community by distance from the point; used both to validate a specific
// selection and to suggest what the address actually looks like it belongs to.
export function rankCommunities(lat, lon, communities, geocodedAddress) {
  return communities
    .map((c) => ({
      community: c,
      distanceMiles: Math.round(distanceToCommunity(lat, lon, c) * 100) / 100,
      byName: nameAppearsIn(geocodedAddress, c.name),
    }))
    .sort((a, b) => {
      if (a.byName !== b.byName) return a.byName ? -1 : 1
      return a.distanceMiles - b.distanceMiles
    })
}

// True if the point plausibly belongs to `community` (by name tag, or within its radius + slack).
export function isWithinCommunity(lat, lon, community, geocodedAddress) {
  if (nameAppearsIn(geocodedAddress, community.name)) return true
  const radius = Number(community.radius_miles) || 1
  return distanceToCommunity(lat, lon, community) <= radius * TOLERANCE
}

// Most of these 30A developments are private, gated communities where OSM has the streets mapped
// but not individual house-number address points — a guest's exact rental address ("34 Some Ln,
// Watersound, FL") often geocodes to nothing even though the street/community-level query
// resolves fine. Progressively broaden the query (drop the house number, then drop the street
// entirely) until something matches — we only need to know *which community* the address is in,
// not a turn-by-turn-accurate pin.
function addressFallbackQueries(address) {
  const parts = String(address || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return []
  const queries = [address]
  const withoutHouseNumber = parts[0].replace(/^\d+[a-z]?\s+/i, '').trim()
  if (withoutHouseNumber && withoutHouseNumber !== parts[0]) {
    queries.push([withoutHouseNumber, ...parts.slice(1)].join(', '))
  }
  if (parts.length > 1) queries.push(parts.slice(1).join(', '))
  return [...new Set(queries)]
}

// Distinguishes "the geocoder cleanly told us it has nothing" (real NOT_FOUND, fine to block on)
// from "the geocoder call itself failed" (network blip/timeout/rate-limit — must NOT be treated
// the same as a bad address, so this rethrows once every fallback query has been tried and none
// of them came back clean; the caller (checkAddressAgainstCommunity → enforceAddressInCommunity)
// lets a thrown error fail open instead of blocking the booking).
async function geocodeWithFallback(address) {
  let lastError = null
  for (const query of addressFallbackQueries(address)) {
    try {
      const results = await geocodeQuery(query, { limit: 1 })
      if (results[0]) return results[0]
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) throw lastError
  return null
}

// Geocodes `query` (or reuses lat/lon if the guest already picked an autocomplete suggestion),
// then checks it against `community`. Returns enough detail for a precise guest-facing message.
export async function checkAddressAgainstCommunity({ address, lat, lon, community }) {
  let point = null
  let geocodedAddress = {}
  let label = address

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    point = { lat: Number(lat), lon: Number(lon) }
    const reverse = await reverseGeocode(point.lat, point.lon).catch(() => null)
    if (reverse) {
      geocodedAddress = reverse.address
      label = reverse.label
    }
  } else {
    const best = await geocodeWithFallback(address)
    if (!best) {
      return { ok: false, reason: 'NOT_FOUND', message: 'We couldn’t find that address. Please check it and try again.' }
    }
    point = { lat: best.lat, lon: best.lon }
    geocodedAddress = best.address
    label = best.label
  }

  const all = await loadGeocodedCommunities()
  const ranked = rankCommunities(point.lat, point.lon, all, geocodedAddress)
  const ok = isWithinCommunity(point.lat, point.lon, community, geocodedAddress)
  const nearest = ranked[0] || null

  return {
    ok,
    label,
    point,
    nearest: nearest
      ? { id: nearest.community.id, name: nearest.community.name, distance_miles: nearest.distanceMiles }
      : null,
    distance_miles:
      ranked.find((r) => r.community.id === community.id)?.distanceMiles ??
      Math.round(distanceToCommunity(point.lat, point.lon, community) * 100) / 100,
    message: ok
      ? null
      : nearest && nearest.community.id !== community.id
        ? `This address looks like it’s in ${nearest.community.name}, not ${community.name}. Please choose ${nearest.community.name}, or enter an address inside ${community.name}.`
        : `This address doesn’t look like it’s inside ${community.name}. Please double-check it, or select the community it’s actually in.`,
  }
}
