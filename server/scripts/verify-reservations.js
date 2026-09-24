// Finds each restaurant's REAL reservation page by reading its own website (not a generic search):
//   Resy        resy.com/cities/<city>/venues/<venue>   or a widgets.resy.com / resy embed on the site
//   OpenTable   opentable.com/r/<slug>, /restaurant/profile/<id>, or the widget's ?rid=<id>
//   SevenRooms  sevenrooms.com/reservations/<venue> or the widget's venueId
//   Tock        exploretock.com/<venue>
//   website_widget  the site has its own Reservations page / form, no platform link
//   phone_only      none of the above, but a phone number on file
// Checks the home page and, when it links one, the site's own "reservations" page. Stores
// booking_platform, booking_url and last_verified_date. Re-run every few months (platforms change).
//   cd server && node scripts/verify-reservations.js [--only=<name>] [--types=restaurant,bar]
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).toLowerCase()
const types = (process.argv.find((a) => a.startsWith('--types='))?.slice(8) || 'restaurant,bar,coffee').split(',')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const today = new Date().toISOString().slice(0, 10)

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(String(res.status))
  return { html: await res.text(), url: res.url || url }
}
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/\\\//g, '/')

// All reservation links in a page as { platform, url }, strongest kinds first.
function candidates(html) {
  const h = unescape(html)
  const out = []
  const add = (platform, url) => out.push({ platform, url: url.replace(/^http:/, 'https:') })
  for (const m of h.matchAll(/https?:\/\/(?:www\.)?resy\.com\/cities\/[a-z0-9-]+\/(?:venues\/)?[a-z0-9-]+/gi)) add('resy', m[0])
  for (const m of h.matchAll(/widgets\.resy\.com\/#\/venues\/([a-z0-9-]+)/gi)) add('resy', `https://widgets.resy.com/#/venues/${m[1]}`)
  for (const m of h.matchAll(/https?:\/\/(?:www\.)?opentable\.com\/r\/[a-z0-9-]+/gi)) add('opentable', m[0])
  for (const m of h.matchAll(/https?:\/\/(?:www\.)?opentable\.com\/restaurant\/profile\/\d+/gi)) add('opentable', m[0])
  for (const m of h.matchAll(/opentable\.com\/[^"'\s]*?[?&](?:rid|restref)=(\d+)/gi)) add('opentable', `https://www.opentable.com/restref/client/?rid=${m[1]}`)
  for (const m of h.matchAll(/https?:\/\/(?:www\.)?sevenrooms\.com\/(?:reservations|explore\/[a-z0-9-]+\/reservations\/create\/search)\/[a-z0-9-]+/gi)) add('sevenrooms', m[0])
  const sr = h.match(/venueId['"]?\s*[:=]\s*['"]([a-z0-9-]+)['"][\s\S]{0,400}sevenrooms|sevenrooms[\s\S]{0,400}venueId['"]?\s*[:=]\s*['"]([a-z0-9-]+)['"]/i)
  if (sr) add('sevenrooms', `https://www.sevenrooms.com/reservations/${sr[1] || sr[2]}`)
  for (const m of h.matchAll(/https?:\/\/(?:www\.)?exploretock\.com\/[a-z0-9-]+/gi)) if (!/exploretock\.com\/(?:join|business|about)/i.test(m[0])) add('tock', m[0])
  const seen = new Set()
  return out.filter((c) => !seen.has(c.url) && seen.add(c.url))
}

const words = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'and', 'restaurant', 'bar', 'grill', 'cafe'].includes(w))

// Group sites list several locations (Mimmo's: Destin + 30A) — pick the link that best matches
// this restaurant's own name and address.
export function detect(html, r = {}) {
  const list = candidates(html)
  const nameWords = new Set(words(r.name).filter((w) => !['30a', 'beach', 'santa', 'rosa'].includes(w)))
  const mine = new Set([...nameWords, ...words(r.address), ...words(r.community)])
  const venueSlug = (c) => words(c.url.replace(/https?:\/\/[^/]+/, '').replace(/[?#].*$/, '').replace(/cities\/[a-z0-9-]+\//, '').replace(/reservations?|venues|restref|client|profile|explore|create|search/g, ' ')).filter((w) => !/^\d+$/.test(w))
  // A link that names a venue must name THIS one (sister restaurants link each other). Id-only
  // links (OpenTable ?rid=) carry no name, so they're trusted only when they're the only option.
  const idOnly = list.filter((c) => !venueSlug(c).length)
  const ok = list.filter((c) => {
    const slug = venueSlug(c)
    return slug.length ? slug.some((w) => nameWords.has(w)) : idOnly.length === 1
  })
  if (!ok.length) return null
  const score = (c) => venueSlug(c).filter((w) => mine.has(w)).length
  return [...ok].sort((a, b) => score(b) - score(a))[0]
}

// A link on the site to its own reservations page ("Reservations", "Book a table", …).
function reservationsPage(html, base) {
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').toLowerCase()
    const href = m[1]
    // Table reservations only — hotel sites link "reservations" for rooms, offers and packages.
    if (/offer|package|room|suite|stay|lodging|hotel|spa|golf|tee.?time|event|wedding/i.test(href)) continue
    if (/reserv|book a table|book now|make a booking/.test(text) || /reserv/i.test(href)) {
      try {
        const url = new URL(unescape(href), base)
        if (/^https?:$/.test(url.protocol)) return url.toString()
      } catch {
        /* skip */
      }
    }
  }
  return null
}

async function verify(r) {
  if (!r.website_url) return { platform: r.phone ? 'phone_only' : null, url: null, note: 'no website' }
  let home
  try {
    home = await get(r.website_url)
  } catch (error) {
    return { platform: r.phone ? 'phone_only' : null, url: null, note: `site ${error.message}` }
  }
  const direct = detect(home.html, r)
  if (direct) return { ...direct, note: 'home page' }
  const page = reservationsPage(home.html, home.url)
  if (page) {
    const offsite = detect(page, r)
    if (offsite) return { ...offsite, note: 'reservations link' }
    if (new URL(page).hostname.replace(/^www\./, '') === new URL(home.url).hostname.replace(/^www\./, '')) {
      try {
        const sub = await get(page)
        const found = detect(sub.html, r)
        if (found) return { ...found, note: 'reservations page' }
        if (/<form|<iframe|reserv/i.test(sub.html)) return { platform: 'website_widget', url: sub.url, note: 'own reservations page' }
      } catch {
        /* fall through */
      }
    }
  }
  return { platform: r.phone ? 'phone_only' : null, url: null, note: 'no reservation link on site' }
}

async function main() {
  let q = supabase
    .from('explore_vendors')
    .select('id, slug, name, venue_type, website_url, phone, booking_url, booking_platform, address, community')
    .eq('kind', 'restaurant')
    .eq('is_active', true)
    .in('venue_type', types)
  const { data, error } = await q
  if (error) throw error
  const rows = data.filter((r) => !only || r.name.toLowerCase().includes(only))
  const results = []
  const queue = [...rows]
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const r = queue.shift()
        const v = await verify(r)
        results.push({ r, v })
        const update = { booking_platform: v.platform, last_verified_date: today }
        // Online platforms: the exact page. Phone-only: no link. Keep a previously found link if the
        // site was unreachable this time.
        if (v.url) update.booking_url = v.url
        else if (v.platform === 'phone_only' && !/site \d|site /.test(v.note)) update.booking_url = null
        await supabase.from('explore_vendors').update(update).eq('id', r.id)
        if (only) console.log(r.name, '→', v)
      }
    })
  )
  const tally = results.reduce((acc, { v }) => ((acc[v.platform || 'unknown'] = (acc[v.platform || 'unknown'] || 0) + 1), acc), {})
  console.log('checked', results.length, tally)
  for (const { r, v } of results.filter(({ v }) => v.url).slice(0, 60)) console.log(`  ${v.platform.padEnd(15)} ${r.name} → ${v.url}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
