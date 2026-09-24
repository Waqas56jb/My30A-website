// Public beach accesses (Walton County list in public_places) as Vitoria chat cards — the same rich
// card as restaurants: photo, community, parking / restroom facts, address and Directions.
// Accesses have no photos of their own, so each gets one of our real 30A beach photos
// (deterministic per access, never a partner's picture).
import { supabase } from '../lib/supabase.js'
import { memo } from '../lib/memo.js'

const BEACH_PHOTOS = [
  '/image6.png',
  '/cover.png',
  '/image1.png',
  '/marketing/stay-boardwalk.webp',
  '/marketing/coastal-poster.webp',
  '/marketing/hero-poster.webp',
]
const INLET_PHOTO = '/image3.png' // aerial of the Phillips Inlet jetty

// 30A communities west → east; "nearest" = fewest steps along the highway.
export const ALONG_30A = [
  'miramar', 'topsail', 'dune allen', 'santa rosa', 'gulf place', 'blue mountain', 'grayton', 'watercolor',
  'seaside', 'seagrove', 'watersound', 'prominence', 'alys', 'seacrest', 'rosemary', 'inlet',
]
const low = (s) => String(s || '').toLowerCase()
export function stepOf(label) {
  const l = low(label)
  const inner = l.match(/\(([^)]+)\)/)?.[1] || l
  return ALONG_30A.findIndex((k) => inner.includes(k))
}

function parse(row) {
  const parts = String(row.details || '').split('|').map((s) => s.trim()).filter(Boolean)
  const address = parts.find((p) => /\d/.test(p) && /(fl|rd|st|dr|ln|ave|hwy|blvd|way|pl|ct)\b/i.test(p)) || parts[0] || ''
  const spacesText = row.details?.match(/(\d+(?:\s*[-–]\s*\d+)?)(?:\s*\+\s*\d+[^|]*)?\s*spaces?/i)
  const spaces = spacesText ? Number(spacesText[1].split(/[-–]/).pop()) : 0
  const text = low(`${row.name} ${row.details}`)
  return {
    address,
    spaces,
    spacesLabel: spacesText ? `${spacesText[1].replace(/\s+/g, '')} parking ${spacesText[1].trim() === '1' ? 'space' : 'spaces'}` : null,
    restroom: /restroom/.test(text),
    statePark: /state park/.test(text),
    regional: /\brba\b|regional/.test(text),
    accessible: /accessible|ada\b|mobi-?mat|wheelchair/.test(text),
    dogs: /dog/.test(text),
    walkOnly: row.section_key === 'beach-access-walk',
  }
}

export function loadBeaches() {
  return memo('explore:beaches', async () => {
    const { data } = await supabase
      .from('public_places')
      .select('name, community, details, section_key, sort_order')
      .eq('is_active', true)
      .like('section_key', 'beach-access%')
      .order('sort_order')
    return (data || []).map((row, i) => ({ ...row, ...parse(row), index: i }))
  })
}

function photoFor(b) {
  if (/inlet/i.test(b.name) || /phillip/i.test(b.name)) return INLET_PHOTO
  let h = 0
  for (const ch of b.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return BEACH_PHOTOS[h % BEACH_PHOTOS.length]
}

export function beachCard(b, why = '') {
  const facts = [
    b.statePark ? 'State park' : null,
    b.walkOnly ? 'Walk, bike or rideshare' : b.spacesLabel || (b.statePark ? 'Park parking' : null),
    b.restroom ? 'Restrooms' : null,
    b.accessible ? 'Accessible' : null,
    b.dogs ? 'Dog friendly' : null,
  ].filter(Boolean)
  const area = String(b.community || '').replace(/^Santa Rosa Beach \((.+)\)$/, '$1').replace(/^Panama City Beach \((.+)\)$/, '$1')
  return {
    name: b.name.replace(/\s+#\w+$/, ''),
    area,
    category: b.statePark ? 'State park beach' : b.regional ? 'Regional beach access' : 'Public beach access',
    why: why || b.address,
    facts,
    hours: '',
    phone: '',
    website: '',
    directions: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address || `${b.name} ${b.community} FL`)}`,
    image: photoFor(b),
    partner: false,
    in_guide: true,
    kind: 'beach',
    to: '/app/explore/info?focus=beach-access',
  }
}

const STOP = new Set(['beach', 'access', 'accesses', 'public', 'the', 'of', 's', 'at', 'fl'])
const tokens = (s) =>
  low(s)
    .replace(/regional beach access|regional access/g, ' rba ')
    .replace(/#\s*\w+/g, ' ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))

// Word match: every meaningful word the guest/model used must be in the access name; among those,
// the closest name wins, then the better-equipped access (restrooms, parking).
export async function findBeach(name) {
  const want = tokens(name)
  if (!want.length) return null
  const beaches = await loadBeaches()
  const hits = beaches
    .map((b) => ({ b, have: tokens(b.name) }))
    .filter(({ have }) => want.every((t) => have.includes(t)))
    .sort((x, y) => x.have.length - y.have.length || Number(y.b.restroom) - Number(x.b.restroom) || y.b.spaces - x.b.spaces)
  return hits[0]?.b || null
}

// Best accesses for a guest: nearest along 30A first, then the ones that make a beach day easy
// (lots of parking, restrooms, regional / state-park facilities). No community → the best-equipped
// accesses spread along 30A.
export async function recommendBeaches({ community = null, count = 3, parking = false, accessible = false, dogs = false } = {}) {
  const beaches = await loadBeaches()
  const home = community ? stepOf(community) : -1
  const quality = (b) =>
    Math.min(b.spaces, 60) / 12 + (b.restroom ? 3 : 0) + (b.statePark ? 5 : 0) + (b.regional ? 2 : 0) +
    (accessible && b.accessible ? 4 : 0) + (dogs && b.dogs ? 4 : 0) + (parking && !b.walkOnly && b.spaces ? 3 : 0)
  if (home >= 0) {
    const ranked = beaches
      .map((b) => ({ b, d: stepOf(b.community) < 0 ? 9 : Math.abs(stepOf(b.community) - home) }))
      .sort((x, y) => x.d - y.d || quality(y.b) - quality(x.b))
    const nearest = ranked.filter((x) => x.d <= ranked[0].d + 1).sort((x, y) => x.d * 5 - quality(x.b) - (y.d * 5 - quality(y.b)))
    return { picks: nearest.slice(0, count).map((x) => x.b), exact: ranked[0].d === 0 }
  }
  const byQuality = [...beaches].sort((a, b) => quality(b) - quality(a))
  const picks = []
  for (const b of byQuality) {
    if (picks.length >= count) break
    if (picks.some((p) => Math.abs(stepOf(p.community) - stepOf(b.community)) < 3)) continue
    picks.push(b)
  }
  return { picks, exact: false }
}

// Several accesses in one answer should never share a photo.
export function distinctPhotos(cards) {
  const used = new Set()
  for (const card of cards) {
    if (card.kind !== 'beach') continue
    if (used.has(card.image)) card.image = [INLET_PHOTO, ...BEACH_PHOTOS].find((p) => !used.has(p)) || card.image
    used.add(card.image)
  }
  return cards
}
