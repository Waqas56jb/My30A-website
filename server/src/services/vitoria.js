// Vitoria's knowledge: everything real in the database (all vetted partners, every public beach
// access / park / emergency contact, the 16 communities with their full airport transfer price
// table, grocery packages, house rules) packed into one plain-text brief the model reads on every
// turn. It's assembled stable-first so OpenAI's prompt cache reuses the big unchanging prefix and
// only the short per-guest tail changes between calls.
import { supabase } from '../lib/supabase.js'

const TIME_ZONE = 'America/Chicago'
const CACHE_TTL_MS = 5 * 60 * 1000
const VEHICLE_ORDER = ['4pax', '6pax', '14pax']
const AIRPORTS = {
  ECP: 'ECP · Northwest Florida Beaches International (Panama City)',
  VPS: 'VPS · Destin–Fort Walton Beach',
  PNS: 'PNS · Pensacola International',
}

let cached = { at: 0, text: '' }

const bare = (url) => String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')

async function buildKnowledge() {
  const [categories, guides, vendors, places, info, communities, pricing, catalog, dining] = await Promise.all([
    supabase.from('explore_categories').select('key, label, coming_soon, sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('explore_guides').select('slug, title, category_key, sort_order').eq('is_active', true).order('sort_order'),
    supabase
      .from('explore_vendors')
      .select('guide_slug, name, place, description, phone, website_url, rating, review_count')
      .eq('is_active', true)
      .eq('kind', 'vendor')
      .order('sort_order'),
    supabase.from('public_places').select('section_key, section_title, name, community, details, sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('public_info_sections').select('title, items').eq('is_active', true).order('sort_order'),
    supabase.from('communities').select('id, name, zone, default_airport').eq('is_active', true).order('name'),
    supabase.from('transfer_pricing').select('community_id, airport, vehicle_type, base_price'),
    supabase.from('service_catalog').select('kind, name, sub, price, unit').eq('is_active', true).order('sort_order'),
    supabase
      .from('explore_vendors')
      .select('name, venue_type, community, cuisine, tags, hours, price_range, phone, website_url')
      .eq('is_active', true)
      .eq('kind', 'restaurant')
      .not('venue_type', 'is', null)
      .order('sort_order'),
  ])

  const lines = []

  // ---- Vetted partners, grouped tile -> category -> vendor ----
  lines.push('MY30A HOST VETTED LOCAL GUIDE (real partner businesses, grouped by category):')
  const guidesByCategory = new Map()
  for (const g of guides.data || []) {
    if (!guidesByCategory.has(g.category_key)) guidesByCategory.set(g.category_key, [])
    guidesByCategory.get(g.category_key).push(g)
  }
  const vendorsByGuide = new Map()
  for (const v of vendors.data || []) {
    if (!vendorsByGuide.has(v.guide_slug)) vendorsByGuide.set(v.guide_slug, [])
    vendorsByGuide.get(v.guide_slug).push(v)
  }
  for (const c of categories.data || []) {
    const cGuides = guidesByCategory.get(c.key) || []
    if (c.coming_soon) {
      lines.push(`\n## ${c.label.toUpperCase()} — not in the vetted guide yet (partners coming soon).`)
      continue
    }
    if (!cGuides.length) continue
    lines.push(`\n## ${c.label.toUpperCase()}`)
    for (const g of cGuides) {
      const rows = vendorsByGuide.get(g.slug) || []
      lines.push(`${g.title} (${rows.length}):`)
      for (const v of rows) {
        const extras = [
          v.place,
          v.description,
          v.rating != null ? `rated ${Number(v.rating).toFixed(1)} (${v.review_count} reviews)` : null,
          v.phone,
          bare(v.website_url),
        ].filter(Boolean)
        lines.push(`- ${v.name} — ${extras.join(' · ')}`)
      }
    }
  }

  // ---- Dining guide: the client's curated list of local favorites, by community then type ----
  const diningRows = dining.data || []
  if (diningRows.length) {
    lines.push(
      `\n30A DINING GUIDE — ${diningRows.length} local favorite restaurants, bars and coffee & breakfast spots curated by My30A Host (not paid partners), grouped by community. [R]=restaurant [B]=bar [C]=coffee & breakfast. Hours come from their listings and can change:`
    )
    const TYPE_ORDER = ['restaurant', 'bar', 'coffee']
    const TYPE_MARK = { restaurant: 'R', bar: 'B', coffee: 'C' }
    const byCommunity = new Map()
    for (const r of diningRows) {
      if (!byCommunity.has(r.community)) byCommunity.set(r.community, [])
      byCommunity.get(r.community).push(r)
    }
    for (const [community, rows] of [...byCommunity.entries()].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`\n## ${String(community).toUpperCase()} (${rows.length})`)
      rows.sort((a, b) => TYPE_ORDER.indexOf(a.venue_type) - TYPE_ORDER.indexOf(b.venue_type))
      for (const r of rows) {
        const vibe = (r.tags || []).filter((t) => t !== r.cuisine).slice(0, 4).join('/')
        const extras = [r.cuisine, vibe, r.price_range, r.hours, r.phone, bare(r.website_url)].filter(Boolean)
        lines.push(`- [${TYPE_MARK[r.venue_type]}] ${r.name}${extras.length ? ` — ${extras.join(' · ')}` : ''}`)
      }
    }
  }

  // ---- Official public layer ----
  lines.push('\nOFFICIAL PUBLIC INFORMATION (Walton County / Visit South Walton — facts, not partners):')
  const sections = new Map()
  for (const p of places.data || []) {
    if (!sections.has(p.section_key)) sections.set(p.section_key, { title: p.section_title, rows: [] })
    sections.get(p.section_key).rows.push(p)
  }
  for (const s of sections.values()) {
    lines.push(`\n## ${s.title.toUpperCase()} (${s.rows.length})`)
    for (const p of s.rows) lines.push(`- ${p.name} — ${[p.community, p.details].filter(Boolean).join(' · ')}`)
  }
  for (const s of info.data || []) {
    lines.push(`\n## ${String(s.title).toUpperCase()}`)
    for (const item of s.items || []) lines.push(`- ${item}`)
  }

  // ---- Communities + transfer price table ----
  lines.push('\nCOMMUNITIES ON 30A AND AIRPORT TRANSFER PRICES (private door-to-door, one way, per vehicle):')
  lines.push(`Airports: ${Object.values(AIRPORTS).join(' · ')}`)
  lines.push('Vehicle sizes: 4-passenger / 6-passenger / 14-passenger. Round trip booked together = 5% off both legs. Staff may add a $40 holiday/peak-date surcharge.')
  const priceIndex = new Map()
  for (const p of pricing.data || []) priceIndex.set(`${p.community_id}|${p.airport}|${p.vehicle_type}`, Number(p.base_price))
  for (const c of communities.data || []) {
    const perAirport = Object.keys(AIRPORTS).map((code) => {
      const prices = VEHICLE_ORDER.map((vt) => {
        const price = priceIndex.get(`${c.id}|${code}|${vt}`)
        return price == null ? '?' : `$${price}`
      })
      return `${code} ${prices.join('/')}`
    })
    lines.push(`- ${c.name} (${c.zone} 30A; nearest airport ${c.default_airport}): ${perAirport.join(' · ')}`)
  }
  lines.push('Transfer cancellation policy: 48h+ before pickup full release, no charge; 24–48h before $50; same day or no-show $75; if My30A Host cancels, full release plus a $25 credit on the next booking.')

  // ---- Grocery service ----
  lines.push('\nPUBLIX GROCERY DELIVERY & STOCKING (shopped at Publix, Watersound Town Center):')
  for (const row of catalog.data || []) {
    if (row.kind === 'grocery_package') lines.push(`- Package: ${row.name} — ${row.sub} — $${row.price} ${row.unit || ''}`.trim())
  }
  for (const row of catalog.data || []) {
    if (row.kind === 'grocery_stocking') lines.push(`- Stocking: ${row.name} — ${row.sub} — ${row.price ? `+$${row.price}` : 'included'}`)
  }
  lines.push('The guest pays the flat package + stocking fee plus the exact Publix receipt (no markup). Nothing is charged until the order is delivered; the card is saved in the app and charged once, after delivery. The guest sends their list by uploading a Publix cart screenshot or emailing my30ahost@gmail.com.')

  return lines.join('\n')
}

export async function loadVitoriaKnowledge() {
  if (cached.text && Date.now() - cached.at < CACHE_TTL_MS) return cached.text
  const text = await buildKnowledge()
  cached = { at: Date.now(), text }
  return text
}

export function invalidateVitoriaKnowledge() {
  cached = { at: 0, text: '' }
}

function nowLine() {
  const now = new Date()
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TIME_ZONE })
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE })
  return `Right now it is ${date}, ${time} (Central time, 30A local).`
}

// ctx: { profile, firstName, booking, trips, orders, formatWhen } — the per-guest tail.
export function vitoriaSystemPrompt(knowledge, ctx) {
  const head = [
    'You are Vitoria, the AI concierge inside the My30A Host guest app for vacation rentals along Scenic Highway 30A on Florida’s Emerald Coast (Walton County / South Walton).',
    'Voice: warm, confident, effortlessly polished — like a five-star hotel concierge texting a guest. Knowledgeable and specific, never robotic, never salesy, never gushing.',
    '',
    'What you know and how to use it:',
    '1. The MY30A HOST VETTED LOCAL GUIDE below is your first source. When it covers the request, recommend those partners by name with their real details (where they are, what they do, their phone or website when the guest wants to book or call). Never invent details for them.',
    '2. For food and drink (dinner, lunch, breakfast, brunch, coffee, bars, cocktails, “top 5 restaurants”), the 30A DINING GUIDE below is your source: recommend from it by name, matching what the guest wants (cuisine, vibe such as rooftop / waterfront / live music / family, price) and favouring their own community first, then the neighbouring ones. Mention in a short phrase that these are local favorites (not paid partners). Only go beyond the dining guide when nothing in it fits, and say so. For anything else no guide covers, recommend real, well-known places in the 30A / South Walton area as local favorites. Never refuse or say you can’t help just because something isn’t in a guide.',
    '2b. You have a web_search tool. Use it whenever the guest asks about hours, whether a place is open, phone numbers, menus, events or anything time-sensitive, and whenever you recommend restaurants, so the hours you give are today’s real hours. Give hours confidently in a friendly form (e.g. “open today 11 AM–3:30 PM and 4:30–10 PM”). Never say you lack internet or Google access. If a search genuinely finds nothing, say hours weren’t listed and suggest calling.',
    '3. For beach access points, parks, playgrounds, safety, rules and emergency contacts, use the OFFICIAL PUBLIC INFORMATION. Match the guest to accesses in or next to their community. Beach flag colours and conditions change daily and you cannot see them live — tell guests to check the flags on arrival.',
    '4. For airport transfers and Publix grocery delivery, quote from the price tables. Those two — and only those two — are booked in the Services tab of the app. Everything else (partners, restaurants, rentals, tours) the guest books directly with the business using the Call / Website buttons on the cards; never say those are booked in the Services tab.',
    '5. Use the guest’s stay (community, address, dates) and today’s date to tailor every answer: “tonight”, “this weekend”, “near me” should reflect where and when they are.',
    '6. If the guest asks about something unrelated to 30A or their stay, help briefly and steer back to their trip.',
    '',
    'Formatting rules — follow exactly, no exceptions:',
    '- Plain text only. Never use markdown: no **bold**, no _italics_, no # headings, no [links](url), no backticks.',
    '- Never use dashes, bullets, numbers or asterisks as list markers. When naming several places, put each on its own line as a short natural phrase — the name, then a few words on why, with no symbol in front.',
    '- Keep it tight: 2–4 sentences for a simple answer, or up to 6 short lines when the guest asks for a list (a “top 5” is five lines).',
    '- Separate distinct ideas with one blank line (a real paragraph break). Never run everything together in one dense block.',
    '- Say a place’s name plainly — never bold it, quote it, or capitalize it for emphasis.',
    '- End with at most one short, warm follow-up question, on its own line, and only when it genuinely helps.',
    '',
    'Output: respond with JSON matching the schema.',
    '- "reply": your message to the guest, following the formatting rules above. When you recommend specific places, keep the reply to at most two short paragraphs (an intro plus one closing tip or question) — names, hours, phones and details go in the cards, not the text.',
    '- "places": one card per specific place you recommend or are asked about (restaurants, partners, beach accesses, parks, pharmacies, etc.), in the order you recommend them, max 6. Empty array when the answer is not about specific places.',
    '  name: exact business/place name. area: community or town. category: short type, e.g. "Seafood · Waterfront", "Golf cart rental", "Beach access". why: one short sentence on why it fits. hours: today’s hours from your web search, or "" if unknown. phone: real phone or "". website: bare domain or URL, or "". partner: true only if it appears in the MY30A HOST VETTED LOCAL GUIDE (dining-guide places are local favorites: partner false).',
    '- Never put URLs, citations or source markers in "reply".',
    '',
    knowledge,
    '',
    'GUEST CONTEXT (changes per guest):',
    nowLine(),
    `Guest: ${ctx.profile?.name || 'Guest'} — address them as ${ctx.firstName}.`,
  ]
  if (ctx.booking) {
    head.push(
      `Their stay: ${ctx.booking.community_name || 'a 30A community'}${ctx.booking.property_address ? `, ${ctx.booking.property_address}` : ''}${ctx.booking.check_in ? ` · ${ctx.booking.check_in} to ${ctx.booking.check_out || '?'}` : ''}${ctx.booking.guests_count ? ` · ${ctx.booking.guests_count} guests` : ''}.`
    )
  } else {
    head.push('Their stay: no property on file yet — ask which community they’re staying in when it matters.')
  }
  if (ctx.trips.length) {
    head.push('Their active airport transfers: ' + ctx.trips.map((t) => `#${t.trip_number} ${t.status}, ${ctx.formatWhen(t.scheduled_at)}, ${t.airport}`).join('; '))
  }
  if (ctx.orders.length) {
    head.push('Their active grocery orders: ' + ctx.orders.map((o) => `#${o.order_number} ${o.status}, ${o.package}, delivery ${ctx.formatWhen(o.delivery_time)}`).join('; '))
  }
  return head.join('\n')
}

export const VITORIA_SCHEMA = {
  name: 'vitoria_reply',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'places'],
    properties: {
      reply: { type: 'string' },
      places: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'area', 'category', 'why', 'hours', 'phone', 'website', 'partner'],
          properties: {
            name: { type: 'string' },
            area: { type: 'string' },
            category: { type: 'string' },
            why: { type: 'string' },
            hours: { type: 'string' },
            phone: { type: 'string' },
            website: { type: 'string' },
            partner: { type: 'boolean' },
          },
        },
      },
    },
  },
}

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const cleanUrl = (url) => {
  const raw = String(url || '').trim().replace(/[?&]utm_source=openai/, '')
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

// Turns the model's place list into render-ready cards: partners are matched against the DB so
// the card gets the real photo, the Explore link and DB phone/website (never a guessed one).
export async function enrichPlaces(places) {
  const list = (Array.isArray(places) ? places : []).slice(0, 6)
  if (!list.length) return []
  const { data: vendors } = await supabase
    .from('explore_vendors')
    .select('slug, kind, name, place, phone, website_url, image_url, rating, review_count')
    .eq('is_active', true)
    .in('kind', ['vendor', 'restaurant'])
  const byName = new Map((vendors || []).map((v) => [normalize(v.name), v]))
  return list.map((p) => {
    const vendor = byName.get(normalize(p.name))
    const query = encodeURIComponent([p.name, p.area || '30A', 'FL'].filter(Boolean).join(' '))
    return {
      name: p.name,
      area: p.area || vendor?.place || '',
      category: p.category || '',
      why: p.why || '',
      hours: String(p.hours || '').replace(/\*\*/g, ''),
      phone: vendor?.phone || p.phone || '',
      website: cleanUrl(vendor?.website_url || p.website),
      partner: vendor?.kind === 'vendor',
      in_guide: Boolean(vendor),
      slug: vendor?.slug || null,
      to: vendor ? `/app/explore/${vendor.kind === 'restaurant' ? 'restaurant' : 'vendor'}/${vendor.slug}` : null,
      image: vendor?.image_url || null,
      rating: vendor?.rating != null ? Number(vendor.rating) : null,
      reviews: vendor?.review_count || 0,
      directions: `https://www.google.com/maps/search/?api=1&query=${query}`,
    }
  })
}

// Only when the AI is unreachable — same voice and layout rules, plain text, real paragraph breaks.
export function vitoriaFallback(text, ctx, beachAccesses = []) {
  const q = String(text || '').toLowerCase()
  const name = ctx.firstName
  const community = ctx.booking?.community_name || null

  if (/beach|sunset|swim|sand/.test(q)) {
    const near = community ? beachAccesses.filter((p) => String(p.community || '').includes(community)) : []
    const picks = (near.length ? near : beachAccesses).slice(0, 3)
    if (!picks.length) return `Every beach along 30A is public access — look for the blue access signs.\n\nWhich community are you staying in? I’ll point you to the closest ones.`
    return `Closest public beach access${community ? ` to ${community}` : ''}:\n\n${picks.map((p) => `${p.name}${p.details ? ` — ${p.details}` : ''}`).join('\n')}\n\nCheck the flags when you arrive — double red means the water is closed.`
  }
  if (/dinner|restaurant|eat|food|lunch|breakfast|brunch|bar|top 5/.test(q)) {
    return `I can’t pull up live picks this second, ${name}, but the full dining guide is in Explore under Restaurants, Bars and Coffee & Breakfast, sorted by community${community ? ` (start with ${community})` : ''}.\n\nReservations are wise in season. Want help with anything else for your stay?`
  }
  if (/grocer|publix|stock/.test(q)) {
    return `Groceries are ordered from the Services tab.\n\nPick a package, choose how you’d like the kitchen stocked, and upload your Publix cart screenshot.\n\nYou pay the flat service fee plus the exact Publix receipt, charged only once it’s delivered.`
  }
  if (/airport|transfer|ride|pickup|pick up|drop|flight|shuttle|driver/.test(q)) {
    return `Airport transfers to and from ECP, VPS and PNS are booked in the Services tab.\n\nAdd your flight number and we’ll track it and confirm your driver — you’ll get a notification as soon as one is assigned.`
  }
  if (/hello|hi\b|hey|good (morning|afternoon|evening)/.test(q)) {
    return `Hi ${name}. I can help with beaches, things to do, dinner ideas, groceries or airport transfers.\n\nWhat sounds good?`
  }
  return `Happy to help, ${name}.\n\nAsk me about beaches, activities, local services and dining near ${community || '30A'}, or about groceries and airport transfers from the Services tab.\n\nWhat would you like?`
}
