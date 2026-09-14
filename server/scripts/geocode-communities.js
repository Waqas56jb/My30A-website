// One-time (re-runnable) seed: geocodes every community name via Nominatim to get a real center
// point + a radius derived from its actual OSM bounding box, and stores them on the communities
// row. Address validation later compares guest addresses against these same coordinates, so
// nothing about "where is Rosemary Beach" is ever hand-typed — it all comes from one source.
//   cd server && node scripts/geocode-communities.js [--force]
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { geocodePlace } from '../src/lib/nominatim.js'
import { haversineMiles } from '../src/services/geocoding.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const force = process.argv.includes('--force')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// A few community names don't resolve cleanly on Nominatim as typed (punctuation confuses the
// query, or the dev's marketing name isn't what OSM tags the place). Try the real name first,
// then fall back to these known-good aliases, still hard-bounded to the 30A corridor.
const ALIASES = {
  'Prominence / Hub': ['Prominence, Watersound, FL', 'The Hub, Watersound, FL', 'Prominence, FL'],
  // "Gulf Place" isn't tagged by that name in OSM at all — it's the real 30A/CR-393 town-center
  // address, which OSM files under the Dune Allen Beach hamlet. Anchor on that known address.
  'Gulf Place': ['3785 W County Hwy 30A, Santa Rosa Beach'],
}

async function geocodeWithAliases(name) {
  const direct = await geocodePlace(name)
  if (direct) return direct
  for (const alias of ALIASES[name] || []) {
    const hit = await geocodePlace(alias)
    if (hit) return hit
  }
  return null
}

function radiusFromBbox(center, bbox) {
  // bbox = [south, north, west, east]
  const [south, north, west, east] = bbox
  const corners = [
    [south, west],
    [south, east],
    [north, west],
    [north, east],
  ]
  const maxCorner = Math.max(...corners.map(([lat, lon]) => haversineMiles(center.lat, center.lon, lat, lon)))
  // Never trust an unreasonably huge OSM polygon (e.g. if the name resolved to a whole county) —
  // clamp to a sensible range for a 30A beach community, and never let it collapse to ~0 either.
  return Math.min(3, Math.max(0.35, Math.round(maxCorner * 100) / 100))
}

async function main() {
  const { data: communities, error } = await supabase
    .from('communities')
    .select('id, name, lat, lng, radius_miles')
    .order('name')
  if (error) throw error

  const results = []
  for (const community of communities) {
    if (!force && community.lat && community.lng) {
      console.log(`skip ${community.name} (already geocoded: ${community.lat}, ${community.lng}, r=${community.radius_miles}mi)`)
      results.push(community)
      continue
    }

    const place = await geocodeWithAliases(community.name)
    if (!place) {
      console.log(`MISS ${community.name} — Nominatim returned nothing, leaving un-geocoded`)
      continue
    }

    const radius_miles = radiusFromBbox({ lat: place.lat, lon: place.lon }, place.boundingbox)
    const { error: updateError } = await supabase
      .from('communities')
      .update({ lat: place.lat, lng: place.lon, radius_miles, geocoded_at: new Date().toISOString() })
      .eq('id', community.id)
    if (updateError) throw updateError

    console.log(`geocoded ${community.name} -> ${place.lat}, ${place.lon} (r=${radius_miles}mi, source: "${place.label}")`)
    results.push({ ...community, lat: place.lat, lng: place.lon, radius_miles })
  }

  const missing = results.filter((c) => !c.lat)
  console.log(`\n${results.length}/${communities.length} communities have coordinates.`)
  if (missing.length) console.log('Still missing:', missing.map((c) => c.name).join(', '))
}

main().catch((error) => {
  console.error('geocode-communities failed:', error)
  process.exit(1)
})
