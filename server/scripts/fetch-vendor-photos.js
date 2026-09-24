// Replaces the shared stock photos on Explore partners with each business's OWN photo: the
// share image (og:image / twitter:image) its official website publishes. Partners with no website
// on file get their official site looked up via OpenAI web search first (used only to source the
// photo — the website field itself is not overwritten). Images are resized to 960px WebP in
// client/public/vendors/ so cards load fast, and deduplicated by content hash so no two partners
// share a picture. Re-runnable: already-fetched vendors are skipped unless --force.
//   cd server && node scripts/fetch-vendor-photos.js [--force] [--only=<slug>]
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
const OUT_DIR = path.resolve(__dirname, '../../client/public/vendors')
const MANIFEST = path.join(OUT_DIR, 'manifest.json')
const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

fs.mkdirSync(OUT_DIR, { recursive: true })
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}

const SITE_SCHEMA = {
  name: 'official_site',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'confident'],
    properties: { url: { type: 'string' }, confident: { type: 'boolean' } },
  },
}

async function findOfficialSite(vendor) {
  const res = await webResponse({
    instructions:
      'Find the official website (or official Facebook/Instagram page if no website exists) of the named local business on Scenic Highway 30A / South Walton, Florida. Return confident=false if you cannot identify this exact business with certainty. Never return a directory, review site or map link.',
    input: `${vendor.name} — ${vendor.place || '30A, FL'} — ${vendor.description || ''}`,
    schema: SITE_SCHEMA,
    location: { country: 'US', region: 'Florida', city: 'Santa Rosa Beach' },
  })
  if (res.skipped || !res.data?.confident || !res.data.url) return null
  const url = res.data.url.replace(/[?&]utm_source=openai/, '')
  if (/yelp|tripadvisor|google\.|maps\.|mapquest|yellowpages|bbb\.org/i.test(url)) return null
  return url
}

const absolute = (src, base) => {
  try {
    return new URL(src.replace(/&amp;/g, '&'), base).toString()
  } catch {
    return null
  }
}

// og:image / twitter:image first (the image the business chose to represent itself), then the
// first sizeable content image that isn't obviously a logo, icon or tracking pixel.
function imageCandidates(html, base) {
  const out = []
  const meta = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/gi,
  ]
  for (const re of meta) for (const m of html.matchAll(re)) out.push(absolute(m[1], base))
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)) {
    if (!/logo|icon|favicon|sprite|pixel|badge|avatar|placeholder/i.test(m[1])) out.push(absolute(m[1], base))
  }
  return [...new Set(out.filter(Boolean))].slice(0, 8)
}

async function fetchWithTimeout(url, ms = 15000) {
  return fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(ms) })
}

const usedHashes = new Map(Object.entries(manifest).filter(([, v]) => v.hash).map(([slug, v]) => [v.hash, slug]))

async function processVendor(vendor) {
  // Hand-reviewed rejects (logos, screenshots, hijacked domains) stay rejected.
  if (manifest[vendor.slug]?.rejected) return { slug: vendor.slug, status: 'rejected' }
  if (!force && manifest[vendor.slug]?.file && fs.existsSync(path.join(OUT_DIR, manifest[vendor.slug].file))) {
    return { slug: vendor.slug, status: 'cached' }
  }
  let site = vendor.website_url
  let viaSearch = false
  if (!site) {
    site = await findOfficialSite(vendor).catch(() => null)
    viaSearch = Boolean(site)
    if (!site) return { slug: vendor.slug, status: 'no-site' }
  }
  let html
  try {
    const res = await fetchWithTimeout(site)
    if (!res.ok) return { slug: vendor.slug, status: `site-${res.status}`, site }
    html = await res.text()
  } catch (error) {
    return { slug: vendor.slug, status: 'site-error', site, error: error.message }
  }
  for (const src of imageCandidates(html, site)) {
    try {
      const res = await fetchWithTimeout(src, 20000)
      if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 12000) continue
      const img = sharp(buf, { failOn: 'none' })
      const metaInfo = await img.metadata()
      if (!metaInfo.width || metaInfo.width < 400 || metaInfo.height < 250) continue
      // Reject near-square tiny-palette images (logos on flat backgrounds) via entropy.
      const stats = await sharp(buf).stats()
      if (stats.entropy < 5) continue
      const out = await sharp(buf).rotate().resize({ width: 960, height: 720, fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toBuffer()
      const hash = crypto.createHash('sha1').update(out).digest('hex')
      if (usedHashes.has(hash) && usedHashes.get(hash) !== vendor.slug) continue
      const file = `${vendor.slug}.webp`
      fs.writeFileSync(path.join(OUT_DIR, file), out)
      usedHashes.set(hash, vendor.slug)
      manifest[vendor.slug] = { file, hash, source: src, site, viaSearch }
      return { slug: vendor.slug, status: 'ok', site, viaSearch, kb: Math.round(out.length / 1024) }
    } catch {
      // try next candidate
    }
  }
  return { slug: vendor.slug, status: 'no-usable-image', site }
}

async function main() {
  let query = supabase.from('explore_vendors').select('slug, name, place, description, website_url').eq('is_active', true).eq('kind', 'vendor').order('sort_order')
  if (only) query = query.eq('slug', only)
  const { data: vendors, error } = await query
  if (error) throw error

  const results = []
  const queue = [...vendors]
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const vendor = queue.shift()
      const r = await processVendor(vendor)
      results.push(r)
      console.log(`${r.status.padEnd(16)} ${vendor.slug}${r.site ? `  <- ${r.site}${r.viaSearch ? ' (found via search)' : ''}` : ''}${r.kb ? `  ${r.kb}KB` : ''}`)
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
    }
  })
  await Promise.all(workers)

  // Point every vendor that now has a real photo at it.
  let updated = 0
  for (const [slug, entry] of Object.entries(manifest)) {
    if (!entry.file || !fs.existsSync(path.join(OUT_DIR, entry.file))) continue
    const { error: updateError } = await supabase.from('explore_vendors').update({ image_url: `/vendors/${entry.file}` }).eq('slug', slug)
    if (!updateError) updated += 1
  }
  const tally = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {})
  console.log('\nsummary:', tally, `| vendors pointed at real photos: ${updated}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
