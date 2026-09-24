// Imports the client's restaurant list (My30A_Host_Restaurant_List.xlsx → data/restaurants-source.json:
// 164 restaurants, 49 bars, 33 coffee & breakfast spots) into explore_vendors as kind='restaurant'.
// The sheet mostly has only a name, phone and a 30a.com profile link, so each place is enriched:
//   1. 30a.com profile  → structured schema.org data: street address, town, GPS, hours, price range,
//                          phone, the official website link, and the place's own photo.
//   2. OpenAI web search → official website/booking link when still missing, whether it is still
//                          open, a short factual description, cuisine + features (rooftop, live music…).
//   3. Photo            → the restaurant's own website share image, else its 30a.com photo; resized to
//                          960px WebP in client/public/restaurants/, deduplicated, logos rejected.
//   4. Community        → one of our 16 communities by GPS (then by town), else the nearby town.
// Every stage is cached in data/restaurants-enriched.json, so the script is safely re-runnable.
//   cd server && node scripts/import-restaurants.js [--refresh-ai] [--refresh-photos] [--only=<name>]
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { webResponse } from '../src/lib/openai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const SOURCE = path.resolve(__dirname, '../data/restaurants-source.json')
const CACHE = path.resolve(__dirname, '../data/restaurants-enriched.json')
const PHOTO_DIR = path.resolve(__dirname, '../../client/public/restaurants')
const refreshAi = process.argv.includes('--refresh-ai')
const refreshPhotos = process.argv.includes('--refresh-photos')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).toLowerCase()
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

fs.mkdirSync(PHOTO_DIR, { recursive: true })
const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1))

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const decode = (s) =>
  String(s || '')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .trim()

const fetchWithTimeout = (url, ms = 20000) =>
  fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(ms) })

const normalizeUrl = (u) => {
  if (!u) return null
  const clean = String(u).trim().replace(/[?&]utm_source=openai/, '')
  if (!clean) return null
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
}

const NOT_OFFICIAL = /30a\.com|facebook\.com|instagram\.com|yelp\.|tripadvisor\.|google\.|maps\.|mapquest|yellowpages|x\.com|twitter\.com|tiktok|youtube|pinterest|apple\.com|30agear|beachhappycafe|saltiebeauty|graytonbeer|surfingbearbev|30arealestate|jonahallen|doordash|ubereats|grubhub/i

// Hand review (contact sheets): photos that are logos/flyers/unrelated are marked photo_rejected;
// sites that now serve spam (hijacked domains) are marked website_blocked. Both stick across re-runs.
const REJECT_PHOTOS = [
  '2as-mossy-head-diner', 'bucettis-beach-pizza', 'chanticleer-eatery', 'hibiscus-coffee-and-guesthouse',
  'holi-indian-kitchen', 'pompano-joes-seafood-house', 'raw-and-juicy', 'scratch-biscuit-kitchen',
  'the-beach-house', 'vincenzos-italian-bistro', 'old-florida-fish-house', 'papa-surf-burger-bar',
  'surfing-deer', 'shore-thing-cigars', 'sweet-henriettas-treats-and-coffee', 'neat-bottle-shop-and-tasting-room',
  'frost-bites', 'graffiti-and-the-funky-blues',
]
const BLOCK_WEBSITES = ['frost-bites', 'graffiti-and-the-funky-blues']

// ---------- Stage 1: 30a.com profile (schema.org LocalBusiness data) ----------
const DAY_KEYS = { Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri', Saturday: 'sat', Sunday: 'sun' }

function parseProfile(html) {
  const out = {}
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let json
    try {
      json = JSON.parse(m[1])
    } catch {
      continue
    }
    const nodes = json['@graph'] || [json]
    const biz = nodes.find((n) => n.address && n['@type'] !== 'Organization')
    if (!biz) continue
    const a = biz.address || {}
    out.address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ')
    out.locality = a.addressLocality || null
    if (biz.geo?.latitude) {
      out.lat = Number(biz.geo.latitude)
      out.lng = Number(biz.geo.longitude)
    }
    out.phone = biz.telephone || null
    out.cuisine_30a = [].concat(biz.servesCuisine || [])
    out.price_range = biz.priceRange || null
    out.image = typeof biz.image === 'string' ? biz.image : biz.image?.url || null
    out.maps_url = biz.hasMap || null
    const hours = {}
    for (const spec of [].concat(biz.openingHoursSpecification || [])) {
      for (const day of [].concat(spec.dayOfWeek || [])) {
        const key = DAY_KEYS[String(day).replace(/^https?:\/\/schema\.org\//, '')]
        if (key && spec.opens) (hours[key] ||= []).push([spec.opens, spec.closes])
      }
    }
    if (Object.keys(hours).length) out.opening_hours = hours
  }
  const desc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (desc) out.description_30a = decode(desc[1])
  // The official site is the link whose visible text is its own domain ("www.boragorestaurant.com").
  for (const m of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>\s*([^<]{4,80})</gi)) {
    const [href, text] = [m[1], m[2].trim().toLowerCase()]
    if (NOT_OFFICIAL.test(href)) continue
    let host
    try {
      host = new URL(href).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (text.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').startsWith(host)) {
      out.website = href
      break
    }
  }
  return out
}

async function stageProfile(item, entry) {
  if (entry.profile_done || !item.profile) return
  try {
    const res = await fetchWithTimeout(item.profile)
    if (res.ok) Object.assign(entry, { profile: parseProfile(await res.text()) })
    else entry.profile_status = res.status
  } catch (error) {
    entry.profile_status = error.message
  }
  entry.profile_done = true
}

// ---------- Stage 2: OpenAI web search enrichment ----------
export const CUISINES = [
  'Seafood', 'Italian', 'Pizza', 'Mexican & Latin', 'Sushi & Asian', 'American', 'Southern & BBQ',
  'Steakhouse', 'Mediterranean & Greek', 'Burgers & Casual', 'Bakery & Café', 'Coffee', 'Breakfast & Brunch',
  'Desserts & Ice Cream', 'Wine Bar', 'Cocktails', 'Beer & Brewery', 'Healthy & Juice', 'Fine Dining',
]
export const FEATURES = [
  'Rooftop', 'Waterfront', 'Gulf View', 'Live Music', 'Outdoor Seating', 'Family Friendly', 'Date Night',
  'Happy Hour', 'Late Night', 'Dog Friendly', 'Takeout',
]

const AI_SCHEMA = {
  name: 'restaurant_facts',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['found', 'still_open', 'website', 'booking_url', 'description', 'primary_cuisine', 'cuisines', 'features', 'town', 'hours_summary'],
    properties: {
      found: { type: 'boolean' },
      still_open: { type: 'boolean' },
      website: { type: 'string' },
      booking_url: { type: 'string' },
      description: { type: 'string' },
      primary_cuisine: { type: 'string' },
      cuisines: { type: 'array', items: { type: 'string', enum: CUISINES } },
      features: { type: 'array', items: { type: 'string', enum: FEATURES } },
      town: { type: 'string' },
      hours_summary: { type: 'string' },
    },
  },
}

async function stageAi(item, entry) {
  if (entry.ai && !refreshAi) return
  const p = entry.profile || {}
  const known = [
    `Name: ${item.name}`,
    `Type: ${{ restaurant: 'restaurant', bar: 'bar', coffee: 'coffee shop / breakfast spot' }[item.type]}`,
    item.phone || p.phone ? `Phone: ${item.phone || p.phone}` : null,
    p.address ? `Address: ${p.address}` : null,
    item.website || p.website ? `Website on file: ${item.website || p.website}` : null,
    item.description || p.description_30a ? `Notes: ${item.description || p.description_30a}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  const res = await webResponse({
    instructions: `You verify facts about ONE real food & drink business on/near Scenic Highway 30A, South Walton, Florida, for a guest concierge app. Use web search.
- found=false if you cannot identify this exact business.
- still_open=false only if reliable sources say it is permanently closed.
- website: its official website (not Facebook/Yelp/TripAdvisor/30a.com/Google). Empty string if it has none.
- booking_url: its OpenTable/Resy/Tock/SevenRooms reservation page if one exists, else empty string.
- description: 1–2 factual, guest-facing sentences (max 200 chars): what it serves and what it's known for. No hype words, no invented awards.
- primary_cuisine: 1–3 words (e.g. "Coastal Italian", "Sushi", "Craft Cocktails", "Coffee & Pastries").
- cuisines: 1–3 labels from the list. features: only ones you can confirm.
- town: the 30A community or town it is in (e.g. "Seaside", "Rosemary Beach", "Grayton Beach", "Inlet Beach", "Miramar Beach", "Destin").
- hours_summary: short weekly hours like "Daily 11am–9pm" or "Tue–Sun 5–9pm", empty string if unknown.`,
    input: known,
    schema: AI_SCHEMA,
    location: { country: 'US', region: 'Florida', city: 'Santa Rosa Beach' },
    timeoutMs: 90000,
  })
  if (res.skipped) {
    entry.ai_error = res.reason
    return
  }
  entry.ai = res.data
  delete entry.ai_error
}

// ---------- Stage 3: the place's own photo ----------
const usedHashes = new Map()
for (const [name, e] of Object.entries(cache)) if (e.photo?.hash) usedHashes.set(e.photo.hash, name)

function ogImages(html, base) {
  const out = []
  for (const re of [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
  ]) {
    for (const m of html.matchAll(re)) {
      try {
        out.push(new URL(m[1].replace(/&amp;/g, '&'), base).toString())
      } catch {
        /* skip */
      }
    }
  }
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|webp)[^"']*)["']/gi)) {
    if (/logo|icon|favicon|sprite|pixel|badge|avatar|placeholder/i.test(m[1])) continue
    try {
      out.push(new URL(m[1].replace(/&amp;/g, '&'), base).toString())
    } catch {
      /* skip */
    }
  }
  return [...new Set(out)].slice(0, 6)
}

async function savePhoto(src, key, slug) {
  const res = await fetchWithTimeout(src, 25000)
  if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) return null
  const meta = await sharp(buf, { failOn: 'none' }).metadata()
  if (!meta.width || meta.width < 400 || meta.height < 260) return null
  const stats = await sharp(buf, { failOn: 'none' }).stats()
  if (stats.entropy < 5.2) return null // flat logos / text cards
  const out = await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({ width: 960, height: 720, fit: 'cover', position: 'attention' })
    .webp({ quality: 78 })
    .toBuffer()
  const hash = crypto.createHash('sha1').update(out).digest('hex')
  if (usedHashes.has(hash) && usedHashes.get(hash) !== key) return null
  fs.writeFileSync(path.join(PHOTO_DIR, `${slug}.webp`), out)
  usedHashes.set(hash, key)
  return { file: `${slug}.webp`, hash, source: src }
}

async function stagePhoto(item, entry, slug) {
  if (entry.photo_rejected) return
  if (entry.photo?.file && fs.existsSync(path.join(PHOTO_DIR, entry.photo.file)) && !refreshPhotos) return
  const site = normalizeUrl(entry.ai?.website || item.website || entry.profile?.website)
  const candidates = []
  if (site && !NOT_OFFICIAL.test(site)) {
    try {
      const res = await fetchWithTimeout(site)
      if (res.ok) candidates.push(...ogImages(await res.text(), res.url || site))
    } catch {
      /* site down — fall back to the 30a.com photo */
    }
  }
  if (entry.profile?.image) candidates.push(entry.profile.image)
  for (const src of candidates) {
    try {
      const photo = await savePhoto(src, item.name, slug)
      if (photo) {
        entry.photo = photo
        return
      }
    } catch {
      /* next candidate */
    }
  }
  entry.photo = null
}

// ---------- Stage 4: community ----------
const miles = (a, b) => {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function communityFor(entry, communities) {
  const p = entry.profile || {}
  // 1. GPS inside (or right next to) a community's own radius — the tightest fit wins, so a
  //    WaterColor address isn't swallowed by the much larger Santa Rosa Beach circle.
  if (p.lat && p.lng) {
    const inside = communities
      .filter((c) => c.lat)
      .map((c) => ({ c, d: miles(p, c), r: Number(c.radius_miles) || 1 }))
      .filter(({ d, r }) => d <= r + 0.35)
      .sort((x, y) => x.d / x.r - y.d / y.r)
    if (inside[0]) return inside[0].c.name
  }
  // 2. The town named by 30a.com or the web search, when it is one of ours.
  const towns = [entry.ai?.town, p.locality].filter(Boolean)
  for (const town of towns) {
    const hit = communities.find((c) => town.toLowerCase().includes(c.name.toLowerCase().split(' /')[0]))
    if (hit) return hit.name
  }
  // 3. Nearest community within 2.5 miles, else the real town (Destin, Freeport…) as-is.
  if (p.lat && p.lng) {
    const near = communities.filter((c) => c.lat).map((c) => ({ c, d: miles(p, c) })).sort((x, y) => x.d - y.d)[0]
    if (near && near.d <= 2.5) return near.c.name
  }
  const town = towns.find((t) => !/^santa rosa beach$/i.test(t)) || towns[0]
  return town ? town.replace(/,.*$/, '').trim() : '30A'
}

// ---------- Hours text ----------
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const clock = (t) => {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am'
  const hr = h % 12 || 12
  return m ? `${hr}:${String(m).padStart(2, '0')}${suffix}` : `${hr}${suffix}`
}
export function hoursText(hours) {
  if (!hours) return null
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

// Web-search answers sometimes carry citation markdown — "([site.com](https://…?utm_source=openai))".
const stripCitations = (text) =>
  text
    ? String(text)
        .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\s*\(?https?:\/\/\S+\)?/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : text

// ---------- Main ----------
async function pool(items, size, fn) {
  const queue = [...items]
  let done = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) {
        const item = queue.shift()
        await fn(item)
        done += 1
        if (done % 10 === 0) {
          saveCache()
          process.stdout.write(`  ${done}/${items.length}\n`)
        }
      }
    })
  )
  saveCache()
}

async function main() {
  const items = source.filter((s) => !only || s.name.toLowerCase().includes(only))
  const slugs = new Map()
  const { data: taken } = await supabase.from('explore_vendors').select('slug, kind')
  const foreign = new Set((taken || []).filter((t) => t.kind !== 'restaurant').map((t) => t.slug))
  for (const item of source) {
    let slug = slugify(item.name)
    if (foreign.has(slug) || [...slugs.values()].includes(slug)) slug = `${slug}-${item.type}`
    slugs.set(item.name, slug)
  }
  for (const item of items) cache[item.name] ||= { type: item.type }
  for (const item of source) {
    const e = (cache[item.name] ||= { type: item.type })
    const slug = slugs.get(item.name)
    const fileSlug = slugify(item.name)
    if (REJECT_PHOTOS.some((r) => slug.startsWith(r) || fileSlug.startsWith(r))) {
      if (e.photo?.file) fs.rmSync(path.join(PHOTO_DIR, e.photo.file), { force: true })
      e.photo = null
      e.photo_rejected = true
    }
    if (BLOCK_WEBSITES.some((r) => slug.startsWith(r))) e.website_blocked = true
  }

  console.log('stage 1: 30a.com profiles')
  await pool(items, 6, (item) => stageProfile(item, cache[item.name]))
  console.log('stage 2: web-search enrichment')
  await pool(items, 8, (item) => stageAi(item, cache[item.name]))
  console.log('stage 3: photos')
  await pool(items, 6, (item) => stagePhoto(item, cache[item.name], slugs.get(item.name)))

  const { data: communities } = await supabase.from('communities').select('name, lat, lng, radius_miles').eq('is_active', true)
  const rows = source.map((item, i) => {
    const e = cache[item.name] || {}
    const p = e.profile || {}
    const ai = e.ai || {}
    const website = e.website_blocked ? null : normalizeUrl(item.website || p.website || (ai.found ? ai.website : null))
    const bookingUrl = normalizeUrl(ai.booking_url) || null
    const community = communityFor(e, communities || [])
    const address = p.address || null
    const description = stripCitations(ai.found && ai.description ? ai.description : item.description || p.description_30a || null)
    const cuisines = ai.cuisines?.length ? ai.cuisines : []
    return {
      slug: slugs.get(item.name),
      kind: 'restaurant',
      guide_slug: null,
      venue_type: item.type,
      name: item.name,
      place: community,
      community,
      cuisine: stripCitations((ai.found && ai.primary_cuisine) || cuisines[0] || null),
      description,
      about: description,
      tags: [...cuisines, ...(ai.features || [])],
      hours: hoursText(p.opening_hours) || stripCitations(ai.hours_summary || null),
      opening_hours: p.opening_hours || null,
      phone: item.phone || p.phone || null,
      website_url: website && !NOT_OFFICIAL.test(website) ? website : null,
      booking_url: bookingUrl && /opentable|resy|tock|sevenrooms|yelp\.com\/reservations/i.test(bookingUrl) ? bookingUrl : null,
      directions_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${address || community + ', FL'}`)}`,
      address,
      lat: p.lat || null,
      lng: p.lng || null,
      price_range: p.price_range || null,
      map_name: community,
      map_line1: address ? address.split(', ').slice(0, 1).join('') : `${community}, FL`,
      map_line2: address ? address.split(', ').slice(1).join(', ') : null,
      image_url: e.photo?.file ? `/restaurants/${e.photo.file}` : null,
      source_url: item.profile || null,
      sort_order: i,
      is_active: ai.still_open !== false,
    }
  })

  if (only) {
    console.log(JSON.stringify(rows.filter((r) => r.name.toLowerCase().includes(only)), null, 1))
    return
  }
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from('explore_vendors').upsert(rows.slice(i, i + 50), { onConflict: 'slug' })
    if (error) throw error
  }
  // Anything imported earlier that is no longer on the client's list gets hidden, not deleted.
  const keep = new Set(rows.map((r) => r.slug))
  const { data: existing } = await supabase.from('explore_vendors').select('slug').eq('kind', 'restaurant').not('venue_type', 'is', null)
  const stale = (existing || []).map((r) => r.slug).filter((s) => !keep.has(s))
  if (stale.length) await supabase.from('explore_vendors').update({ is_active: false }).in('slug', stale)

  const tally = (f) => rows.reduce((acc, r) => ((acc[f(r)] = (acc[f(r)] || 0) + 1), acc), {})
  console.log('\nimported', rows.length, '| open', rows.filter((r) => r.is_active).length)
  console.log('by type', tally((r) => r.venue_type))
  console.log('with photo', rows.filter((r) => r.image_url).length, '| website', rows.filter((r) => r.website_url).length, '| hours', rows.filter((r) => r.hours).length, '| GPS', rows.filter((r) => r.lat).length)
  console.log('by community', tally((r) => r.community))
  console.log('ai errors', Object.values(cache).filter((e) => e.ai_error).length)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
