// Address box search: guests type a street address OR a hotel / resort / place name ("WaterColor
// Inn", "Hotel Effie", "Hilton Sandestin"). Three sources, all kept to the Destin–30A–Panama City
// corridor so a name like "The Henderson" can't resolve to a hotel in another state:
//   1. src/data/lodging.js — hotels OpenStreetMap doesn't have yet, addresses from their own sites
//   2. Photon (komoot) — OpenStreetMap search that is good at place and business names
//   3. Nominatim — OpenStreetMap search that is good at street addresses (existing geocoder)
import LODGING from '../data/lodging.js'
import { geocodeQuery } from './nominatim.js'
const BBOX = { west: -86.6, south: 30.18, east: -85.6, north: 30.52 }
const UA = 'My30AHost/1.0 (www.my30ahost.com)'

const plain = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const addressLine = (a) =>
  [[a.house_number, a.road].filter(Boolean).join(' '), a.city, [a.state || 'FL', a.postcode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

function shape({ name, lat, lon, address, kind }) {
  const line = addressLine(address)
  return {
    label: name && !line.toLowerCase().startsWith(name.toLowerCase()) ? `${name}, ${line}` : line || name,
    name: name || null,
    kind,
    lat,
    lon,
    address,
  }
}

function lodgingMatches(q) {
  const words = plain(q).split(' ').filter((w) => w.length > 1)
  if (!words.length) return []
  return LODGING.filter((h) => {
    const hay = plain([h.name, ...(h.aliases || [])].join(' '))
    return words.every((w) => hay.includes(w))
  }).map((h) =>
    shape({
      name: h.name,
      lat: h.lat,
      lon: h.lon,
      kind: 'place',
      address: { house_number: h.house_number, road: h.road, city: h.city, state: 'FL', postcode: h.postcode },
    })
  )
}

async function photon(q, limit) {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lat: '30.33',
    lon: '-86.15',
    bbox: `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`,
  })
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
  if (!res.ok) return []
  const data = await res.json()
  return (data.features || []).map((f) => {
    const p = f.properties || {}
    const [lon, lat] = f.geometry?.coordinates || []
    const isPlace = p.name && p.osm_key !== 'highway' && p.osm_key !== 'place' && p.osm_key !== 'boundary'
    return shape({
      name: isPlace ? p.name : null,
      lat,
      lon,
      kind: isPlace ? 'place' : 'address',
      address: {
        house_number: p.housenumber || '',
        road: p.street || (p.osm_key === 'highway' ? p.name : ''),
        city: p.city || p.district || p.locality || (p.osm_key === 'place' ? p.name : ''),
        state: p.state === 'Florida' ? 'FL' : p.state || 'FL',
        postcode: p.postcode || '',
      },
    })
  })
}

async function nominatim(q, limit) {
  const rows = await geocodeQuery(q, { limit, bounded: true })
  return rows.map((r) => {
    const a = r.address || {}
    const named = r.name && !a.house_number && r.type !== 'road' && r.type !== 'residential'
    return shape({
      name: named ? r.name : null,
      lat: r.lat,
      lon: r.lon,
      kind: named ? 'place' : 'address',
      address: {
        house_number: a.house_number || '',
        road: a.road || '',
        city: a.city || a.town || a.village || a.hamlet || a.suburb || '',
        state: 'FL',
        postcode: a.postcode || '',
      },
    })
  })
}

const close = (a, b) => Math.abs(a.lat - b.lat) < 0.0006 && Math.abs(a.lon - b.lon) < 0.0006

export async function searchPlaces(q, { limit = 6 } = {}) {
  const query = String(q || '').trim()
  if (query.length < 3) return []
  const [local, byName, byAddress] = await Promise.all([
    Promise.resolve(lodgingMatches(query)),
    photon(query, limit).catch(() => []),
    nominatim(query, limit).catch(() => []),
  ])
  // "21 N Barrett Square": the map often knows only the street — keep the number the guest typed.
  const typedNumber = query.match(/^(\d+[a-z]?)\s+\S/i)?.[1]
  const withNumber = (r) =>
    typedNumber && r.kind === 'address' && !r.address.house_number && r.address.road
      ? shape({ ...r, address: { ...r.address, house_number: typedNumber } })
      : r
  const out = []
  for (const r of [...local, ...byName, ...byAddress].map(withNumber)) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon) || !r.label) continue
    const dupe = out.find((x) => x.label.toLowerCase() === r.label.toLowerCase() || (close(x, r) && (x.name || '') === (r.name || '')))
    if (!dupe) out.push(r)
    if (out.length >= limit) break
  }
  return out
}
