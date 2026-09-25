// Adds places the client sends one by one (not in the original restaurant spreadsheet) to the
// Dining guide — e.g. both Canopy Road Café locations. Each entry in data/places-extra.json has the
// name, Dining tab (venue_type: restaurant | bar | coffee), address + GPS, phone, website, weekly
// hours and a photo URL from the place's own website. The community comes from GPS exactly like
// import-restaurants.js; the photo is cropped to 4:3 and saved as 960px WebP next to the others.
// Re-runnable: rows are upserted by slug.
//   cd server && node scripts/add-places.js [--dry-run]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry-run')
const PHOTO_DIR = path.resolve(__dirname, '../../client/public/restaurants')
const places = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/places-extra.json'), 'utf8'))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const miles = (a, b) => {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Same rule as import-restaurants.js: tightest community radius that contains the GPS point.
function communityFor(p, communities) {
  const inside = communities
    .filter((c) => c.lat)
    .map((c) => ({ c, d: miles(p, c), r: Number(c.radius_miles) || 1 }))
    .filter(({ d, r }) => d <= r + 0.35)
    .sort((x, y) => x.d / x.r - y.d / y.r)
  if (inside[0]) return inside[0].c.name
  const near = communities.filter((c) => c.lat).map((c) => ({ c, d: miles(p, c) })).sort((x, y) => x.d - y.d)[0]
  return near && near.d <= 2.5 ? near.c.name : null
}

const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const clock = (t) => {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am'
  const hr = h % 12 || 12
  return m ? `${hr}:${String(m).padStart(2, '0')}${suffix}` : `${hr}${suffix}`
}
function hoursText(hours) {
  const spans = ORDER.map((d) => (hours[d] || []).map(([o, c]) => `${clock(o)}–${clock(c)}`).join(', ') || 'Closed')
  const groups = []
  ORDER.forEach((d, i) => {
    const last = groups[groups.length - 1]
    if (last && last.value === spans[i]) last.to = d
    else groups.push({ from: d, to: d, value: spans[i] })
  })
  if (groups.length === 1) return `Daily ${groups[0].value}`
  return groups
    .filter((g) => g.value !== 'Closed')
    .map((g) => `${LABEL[g.from]}${g.to !== g.from ? `–${LABEL[g.to]}` : ''} ${g.value}`)
    .join(' · ')
}

async function savePhoto(url, slug, cropTop = 0.3) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`photo ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const img = sharp(buf).rotate()
  const { width, height } = await img.metadata()
  // 4:3 landscape crop; for portrait shots start cropTop down so the plate stays in frame.
  const h = Math.min(height, Math.round((width * 3) / 4))
  const top = Math.max(0, Math.min(height - h, Math.round(height * cropTop - h * 0.1)))
  const file = `${slug}.webp`
  if (!dry) {
    await img.extract({ left: 0, top, width, height: h }).resize(960).webp({ quality: 82 }).toFile(path.join(PHOTO_DIR, file))
  }
  return `/restaurants/${file}`
}

const { data: communities, error: cErr } = await supabase.from('communities').select('name, lat, lng, radius_miles').eq('is_active', true)
if (cErr) throw cErr
const { data: last } = await supabase.from('explore_vendors').select('sort_order').eq('kind', 'restaurant').order('sort_order', { ascending: false }).limit(1)
let sort = (last?.[0]?.sort_order || 0) + 1

for (const p of places) {
  const slug = slugify(p.name)
  const community = p.community || communityFor(p, communities) || '30A'
  const { data: existing } = await supabase.from('explore_vendors').select('sort_order').eq('slug', slug).maybeSingle()
  const row = {
    slug,
    kind: 'restaurant',
    name: p.name,
    place: community,
    community,
    venue_type: p.venue_type,
    venue_types: p.venue_types || [p.venue_type],
    cuisine: p.cuisine,
    description: p.description,
    about: p.description,
    tags: p.tags || [],
    hours: hoursText(p.hours),
    opening_hours: p.hours,
    address: p.address,
    map_name: community,
    map_line1: p.line1,
    map_line2: p.line2,
    lat: p.lat,
    lng: p.lng,
    phone: p.phone,
    website_url: p.website_url || null,
    booking_url: p.booking_url || null,
    booking_platform: p.booking_platform || 'phone_only',
    directions_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name.split(' – ')[0]} ${p.address}`)}`,
    image_url: await savePhoto(p.photo, slug, p.photo_crop_top),
    source_url: p.source_url || p.website_url || null,
    last_verified_date: new Date().toISOString().slice(0, 10),
    sort_order: existing?.sort_order || sort++,
    is_active: true,
  }
  console.log(`${dry ? '[dry] ' : ''}${row.name} → ${row.community} · ${row.venue_types.join('+')} · ${row.hours} · ${row.image_url}`)
  if (!dry) {
    const { error } = await supabase.from('explore_vendors').upsert(row, { onConflict: 'slug' })
    if (error) throw error
  }
}
process.exit(0)
