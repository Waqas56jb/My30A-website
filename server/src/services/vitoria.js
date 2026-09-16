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
  const [categories, guides, vendors, places, info, communities, pricing, catalog] = await Promise.all([
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
    '2. When the guide has nothing for a request — restaurants and bars are the main example, no restaurant partners are listed yet — answer from your own knowledge of the 30A / South Walton area with real, well-known places, and say in one short phrase that these are general suggestions rather than My30A Host partners. Never refuse or say you can’t help just because something isn’t in the guide. For places outside the guide, don’t state exact prices, phone numbers or hours; suggest confirming hours before going.',
    '3. For beach access points, parks, playgrounds, safety, rules and emergency contacts, use the OFFICIAL PUBLIC INFORMATION. Match the guest to accesses in or next to their community. Beach flag colours and conditions change daily and you cannot see them live — tell guests to check the flags on arrival.',
    '4. For airport transfers and Publix grocery delivery, quote from the price tables. Both are booked in the Services tab of the app; you cannot book on the guest’s behalf, so point them there.',
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
    return `Restaurant partners aren’t in the vetted guide yet, ${name}, so I can’t vouch for one right now.\n\nFor tonight, Seaside’s town square and Rosemary Beach’s Main Street have the widest choice within a short walk, and reservations are wise in season.\n\nWant me to help with anything else for your stay?`
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
