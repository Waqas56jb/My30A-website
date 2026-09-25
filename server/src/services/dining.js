// Vitoria's dining brain: the client's real list of restaurants, bars and coffee & breakfast
// spots (explore_vendors kind='restaurant'), with
//   - findDining(name)      loose name matching ("Bud & Alley's Waterfront Restaurant" → Bud & Alley's)
//   - diningCard(row)       a render-ready chat card: real photo, today's hours + open now, links
//   - understandDining(txt) what the guest wants: type, cuisine/vibe tags, community, "open now"
//   - recommendDining(...)  ranked picks: their community first, then the nearest neighbours
// It works with no AI at all, so Vitoria can still recommend properly if OpenAI is unavailable.
import { supabase } from '../lib/supabase.js'
import { memo } from '../lib/memo.js'
import { nowIn30A, openStatus, opensLaterToday } from '../lib/hours.js'

const FIELDS =
  'id, slug, name, venue_type, venue_types, community, cuisine, tags, description, image_url, price_range, hours, opening_hours, phone, website_url, booking_url, booking_platform, directions_url, address, lat, lng, rating, review_count'

export function loadDining() {
  return memo('explore:dining-full', async () => {
    const [{ data: rows }, { data: communities }] = await Promise.all([
      supabase
        .from('explore_vendors')
        .select(FIELDS)
        .eq('is_active', true)
        .eq('kind', 'restaurant')
        .not('venue_type', 'is', null)
        .order('sort_order'),
      supabase.from('communities').select('name, lat, lng').eq('is_active', true),
    ])
    const list = (rows || []).map((r) => ({ ...r, key: nameKey(r.name), tokens: tokensOf(r.name) }))
    return { rows: list, communities: communities || [] }
  })
}

// ---------- name matching ----------
const FILLER = new Set([
  'the', 'and', 'a', 'of', 'at', 'on', 'in', 'restaurant', 'restaurants', 'bar', 'grill', 'grille', 'cafe', 'café',
  'kitchen', 'co', 'company', 'waterfront', 'eatery', 'bistro', 'lounge', 'house', '30a', 'fl', 'beach', 'seaside',
  'rosemary', 'grayton', 'watercolor', 'santa', 'rosa', 'miramar', 'destin', 'inlet', 'seagrove', 'alys', 'shop',
])
// Ordinary words a place name can start with ("Sunset Grille", "Local Catch", "Coffee Bar") —
// never enough on their own to mean the guest named that place.
const COMMON = new Set([
  'coffee', 'tea', 'pizza', 'pizzeria', 'sushi', 'taco', 'tacos', 'burger', 'burgers', 'bbq', 'fish', 'seafood',
  'oyster', 'oysters', 'wine', 'beer', 'brewing', 'brewery', 'ice', 'cream', 'donut', 'donuts', 'bakery', 'breakfast',
  'brunch', 'lunch', 'dinner', 'sunset', 'sunrise', 'coastal', 'local', 'little', 'happy', 'golden', 'blue', 'surf',
  'harbor', 'harbour', 'island', 'garden', 'market', 'central', 'southern', 'italian', 'mexican', 'french', 'grand',
  'royal', 'salty', 'sandy', 'summer', 'ocean', 'gulf', 'coast', 'bay', 'bayou', 'dune', 'dunes', 'rooftop', 'open',
  'tonight', 'today', 'best', 'good', 'great', 'food', 'dining', 'drinks', 'cocktails', 'place', 'spot', 'club',
  'hotel', 'resort', 'social', 'tavern', 'pub', 'cantina', 'deli', 'diner', 'juice', 'smoothie', 'crab', 'shrimp',
  'steak', 'steakhouse', 'chicken', 'tavern', 'table', 'bistro', 'kitchen', 'canteen', 'station', 'porch', 'deck',
  'another', 'barefoot', 'barefoots', 'buffalo', 'cabana', 'friends', 'gather', 'hurricane', 'marble', 'marina',
  'parlor', 'pickles', 'scratch', 'shades', 'seacrest', 'freeport', 'formula', 'mezcal', 'growler', 'surfing',
  'crabby', 'causeway', 'pompano', 'hibiscus', 'whales', 'landshark', 'havana', 'edwards', 'johnny', 'sunquest',
  'steamboat', 'sandcastles', 'marcos', 'littles',
])

const plain = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const nameKey = (s) => plain(s).replace(/^the /, '').replace(/\s+/g, '')
const tokensOf = (s) => plain(s).split(' ').filter((t) => t && !FILLER.has(t))

export async function findDining(name, hintArea = '') {
  if (!name) return null
  const { rows } = await loadDining()
  const key = nameKey(name)
  const exact = rows.filter((r) => r.key === key)
  if (exact.length) return pickByArea(exact, hintArea)
  const contained = rows.filter((r) => r.key.length >= 5 && (key.startsWith(r.key) || r.key.startsWith(key)))
  if (contained.length) return pickByArea(contained, hintArea)
  // Token overlap: every meaningful word of the shorter name appears in the other.
  const want = tokensOf(name)
  if (!want.length) return null
  let best = null
  for (const r of rows) {
    if (!r.tokens.length) continue
    const shared = r.tokens.filter((t) => want.includes(t)).length
    const score = shared / Math.min(r.tokens.length, want.length)
    const coverage = shared / Math.max(r.tokens.length, want.length)
    if (shared && score >= 1 && coverage >= 0.5 && (!best || score + shared * 0.1 > best.score)) best = { r, score: score + shared * 0.1 }
  }
  return best?.r || null
}

function pickByArea(list, hintArea) {
  if (list.length === 1 || !hintArea) return list[0]
  const area = plain(hintArea)
  return list.find((r) => plain(r.community).includes(area) || area.includes(plain(r.community))) || list[0]
}

// Names typed by the guest inside a sentence ("is borago open tonight?").
export async function diningMentionedIn(text) {
  const { rows } = await loadDining()
  const hay = ` ${plain(text)} `
  const hits = rows.filter((r) => {
    // Match the brand without its location suffix: "Canopy Road Café – Rosemary Beach",
    // "Big Bad Breakfast-Inlet Beach", "Amavida Coffee & Tea (Rosemary Beach)".
    const brand = plain(String(r.name).replace(/\s*[-–—(].*$/, ''))
    const n = brand.length >= 4 ? brand : plain(r.name)
    if (n.length >= 4 && hay.includes(` ${n} `)) return true
    // Guests shorten names: "is canopy road open?", "pescado tonight", "amavida coffee".
    const words = n.split(' ').filter(Boolean)
    const distinct = (w) => w.length >= 3 && !FILLER.has(w) && !COMMON.has(w)
    if (words.length >= 2 && `${words[0]} ${words[1]}`.length >= 9 && (distinct(words[0]) || distinct(words[1]))) {
      if (hay.includes(` ${words[0]} ${words[1]} `)) return true
    }
    return words[0]?.length >= 6 && distinct(words[0]) && hay.includes(` ${words[0]} `)
  })
  return hits.sort((a, b) => b.name.length - a.name.length).slice(0, 3)
}

// ---------- chat card ----------
const TYPE_LABEL = { restaurant: 'Restaurant', bar: 'Bar', coffee: 'Coffee & Breakfast' }
export function diningCard(r, why = '') {
  const status = openStatus(r.opening_hours)
  const features = (r.tags || []).filter((t) => t !== r.cuisine).slice(0, 2)
  return {
    name: r.name,
    area: r.community,
    category: [r.cuisine || TYPE_LABEL[r.venue_type], ...features].filter(Boolean).join(' · '),
    why: why || r.description || '',
    hours: status.label ? `${status.label}${status.open_now ? '' : status.today && status.today !== 'Closed today' ? ` · today ${status.today}` : ''}` : r.hours || '',
    open_now: status.open_now,
    today: status.today,
    price: r.price_range || '',
    phone: r.phone || '',
    website: r.website_url || '',
    booking: r.booking_platform === 'phone_only' ? '' : r.booking_url || '',
    booking_platform: r.booking_platform || null,
    directions:
      r.directions_url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address || r.community}`)}`,
    image: r.image_url || null,
    partner: false,
    in_guide: true,
    kind: 'dining',
    venue_type: r.venue_type,
    slug: r.slug,
    to: `/app/explore/restaurant/${r.slug}`,
  }
}

// ---------- understanding the request ----------
const COMMUNITY_ALIASES = [
  ['Rosemary Beach', /rosemary/],
  ['Alys Beach', /alys|alice beach/],
  ['Inlet Beach', /inlet/],
  ['Seacrest Beach', /seacrest/],
  ['Watersound', /watersound|water sound/],
  ['Prominence / Hub', /prominence|the hub\b/],
  ['Seaside', /seaside|sea side/],
  ['WaterColor', /watercolou?r|water colou?r/],
  ['Seagrove Beach', /seagrove|sea grove/],
  ['Grayton Beach', /grayton|greyton/],
  ['Blue Mountain Beach', /blue mountain/],
  ['Gulf Place', /gulf place/],
  ['Dune Allen Beach', /dune allen/],
  ['Santa Rosa Beach', /santa rosa/],
  ['Topsail Hill', /topsail/],
  ['Miramar Beach', /miramar|sandestin|baytowne/],
  ['Destin', /destin/],
]
export function communityIn(text) {
  const t = plain(text)
  return COMMUNITY_ALIASES.find(([, re]) => re.test(t))?.[0] || null
}

const TAG_WORDS = [
  ['Seafood', /seafood|fish|oyster|shrimp|crab|lobster|gulf/],
  ['Italian', /italian|pasta/],
  ['Pizza', /pizza/],
  ['Mexican & Latin', /mexican|taco|burrito|latin|cantina|margarita/],
  ['Sushi & Asian', /sushi|asian|thai|chinese|japanese|ramen|indian|poke/],
  ['Steakhouse', /steak/],
  ['Mediterranean & Greek', /greek|mediterranean/],
  ['Burgers & Casual', /burger|casual|hot dog/],
  ['Southern & BBQ', /bbq|barbecue|southern|biscuit/],
  ['Breakfast & Brunch', /breakfast|brunch|pancake|morning/],
  ['Coffee', /coffee|latte|espresso|cappuccino/],
  ['Bakery & Café', /bakery|pastr|croissant|donut|doughnut|bread/],
  ['Desserts & Ice Cream', /dessert|ice cream|gelato|sweet|fudge|cookie|froyo|yogurt/],
  ['Wine Bar', /wine/],
  ['Cocktails', /cocktail|martini|drinks/],
  ['Beer & Brewery', /beer|brew/],
  ['Healthy & Juice', /healthy|juice|smoothie|vegan|salad|acai/],
  ['Fine Dining', /fine dining|upscale|fancy|special occasion|anniversary|romantic|best of the best/],
  ['Rooftop', /rooftop|roof top/],
  ['Waterfront', /waterfront|on the water|by the water/],
  ['Gulf View', /gulf view|ocean view|sea view|beach view|sunset|view/],
  ['Live Music', /live music|band|music/],
  ['Family Friendly', /kid|family|children|toddler/],
  ['Date Night', /date|romantic|anniversary/],
  ['Happy Hour', /happy hour/],
  ['Late Night', /late night|late-night|after 10|midnight/],
  ['Dog Friendly', /dog|pet/],
  ['Outdoor Seating', /outdoor|patio|outside/],
]

// Misspellings included on purpose ("resturant", "restraunt") — guests type fast on phones.
export const DINING_INTENT =
  /rest[a-z]*r[a-z]*nt|restraunt|resturant|food|eat\b|eats|eating|hungry|dine|dining|dinner|lunch|breakfast|brunch|coffee|cafe|café|bar\b|bars\b|drink|cocktail|pizza|sushi|seafood|taco|burger|italian|mexican|oyster|wine|beer|dessert|ice cream|bakery|donut|happy hour|where to go tonight|top \d+ (places|spots)/

export function understandDining(text) {
  const t = plain(text)
  let type = null
  if (/\bbars?\b|cocktail|nightlife|drinks|pub|brewery|wine bar|happy hour|night out|late night/.test(t)) type = 'bar'
  if (/coffee|latte|espresso|breakfast|brunch|bakery|donut|pastr|morning/.test(t)) type = 'coffee'
  if (/rest[a-z]*r[a-z]*nt|restraunt|resturant|dinner|lunch|dine|dining|eat\b/.test(t) && type !== 'coffee') type = type === 'bar' ? null : 'restaurant'
  const tags = TAG_WORDS.filter(([, re]) => re.test(t)).map(([tag]) => tag)
  const count = Number(t.match(/top (\d+)/)?.[1]) || null
  return {
    type,
    tags: type === 'coffee' ? tags.filter((x) => !['Coffee', 'Breakfast & Brunch'].includes(x)) : tags,
    community: communityIn(text),
    openNow: /open now|right now|now open|currently open|open late|still open/.test(t),
    tonight: /tonight|dinner|this evening/.test(t),
    near: /near|closest|nearby|nearest|close to|walking|walk/.test(t),
    best: /best|top|favou?rite|must|recommend|special/.test(t),
    count: count ? Math.min(count, 6) : null,
  }
}

// ---------- recommending ----------
const miles = (a, b) => {
  if (!a?.lat || !b?.lat) return 99
  const R = 3958.8
  const rad = (d) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const SNACK_TAGS = ['Desserts & Ice Cream', 'Bakery & Café', 'Coffee', 'Healthy & Juice']
const MEAL_TAGS = ['Seafood', 'Italian', 'Pizza', 'Mexican & Latin', 'Sushi & Asian', 'American', 'Southern & BBQ', 'Steakhouse', 'Mediterranean & Greek', 'Burgers & Casual', 'Fine Dining', 'Breakfast & Brunch']

export async function recommendDining({ type = null, tags = [], community = null, openNow = false, tonight = false, best = false, count = null, exclude = [] } = {}) {
  const { rows, communities } = await loadDining()
  // One of our 16 communities, or a nearby town (Destin, Freeport…) centred on its own restaurants.
  let center = communities.find((c) => c.name === community)
  if (!center && community) {
    const own = rows.filter((r) => r.community === community && r.lat)
    if (own.length) center = { lat: own.reduce((t, r) => t + r.lat, 0) / own.length, lng: own.reduce((t, r) => t + r.lng, 0) / own.length }
  }
  const { minute } = nowIn30A()
  const eveningFrom = Math.max(minute, 18 * 60)

  let pool = rows.filter((r) => (!type || (r.venue_types?.length ? r.venue_types : [r.venue_type]).includes(type)) && !exclude.includes(r.slug))
  const scored = pool.map((r) => {
    const status = openStatus(r.opening_hours)
    const dist = center ? (r.community === community ? 0 : miles(center, r)) : 0
    const tagHits = tags.filter((t) => (r.tags || []).includes(t) || plain(r.cuisine).includes(plain(t).split(' ')[0])).length
    let score = 0
    score += tagHits * 6
    // "Best restaurant" / "dinner" means a real meal: treats, juice and coffee counters only lead
    // when the guest asked for them.
    const asked = tags.some((t) => SNACK_TAGS.includes(t) || t === 'Breakfast & Brunch')
    const treat = (r.tags || []).some((t) => SNACK_TAGS.includes(t)) || /bakery|ice cream|yogurt|fudge|donut|candy|coffee|juice|market|creamery|shaved ice/i.test(r.cuisine || '')
    if (type === 'restaurant' && !asked) {
      if (treat) score -= (r.tags || []).some((t) => MEAL_TAGS.includes(t) && t !== 'Breakfast & Brunch') ? 3 : 7
      if ((r.tags || []).includes('Breakfast & Brunch') && !(r.tags || []).some((t) => ['Seafood', 'Italian', 'Steakhouse', 'Fine Dining', 'Mexican & Latin', 'Sushi & Asian'].includes(t))) score -= 2
    }
    if (best) score += (r.tags || []).includes('Fine Dining') ? 2 : 0
    if (best) score += /\${3,}/.test(r.price_range || '') ? 1 : 0
    score += r.image_url ? 2 : 0
    score += r.opening_hours ? 1 : 0
    score += r.description ? 0.5 : 0
    score += r.rating ? Number(r.rating) / 5 : 0
    if (tonight) {
      // Dinner means open this evening — a breakfast bakery that shuts at 3pm is no answer.
      if (r.opening_hours) score += opensLaterToday(r.opening_hours, eveningFrom) ? 3 : -8
      if ((r.tags || []).includes('Bakery & Café') || (r.tags || []).includes('Breakfast & Brunch')) score -= 3
    } else if (status.open_now) score += openNow ? 5 : 1.5
    else if (openNow && status.open_now === false) score -= 6
    if (center) score -= Math.min(dist, 15) * 1.2
    return { r, score, dist, tagHits }
  })
  // When the guest asked for something specific, only keep places that match it (unless none do).
  let filtered = tags.length ? scored.filter((s) => s.tagHits > 0) : scored
  if (!filtered.length) filtered = scored
  if (center) {
    const local = filtered.filter((s) => s.dist <= 3.5)
    if (local.length >= 2) filtered = local
  }
  filtered.sort((a, b) => b.score - a.score)
  const picks = filtered.slice(0, count || 4).map((s) => s.r)
  return { picks, matchedTags: tags.length && scored.some((s) => s.tagHits > 0) }
}
