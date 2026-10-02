// Photo pass for every listing guests see (restaurants, bars, coffee, Local Guide vendors) that has
// no photo yet. Two steps, with a human review in between (a scraped image can be a logo, a stock
// banner or spam):
//   1) node scripts/missing-photos.js --fetch <dir>   download each place's own share image
//      (og:image / twitter:image from its official website) into <dir>, + report.json
//   2) delete the files that aren't a good photo of the place, then
//      node scripts/missing-photos.js --upload <dir>  4:3 WebP → public 'listings' bucket → image_url
// Run from server/. Admin → Partners → Listings → "Missing photo" shows whatever is still missing.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

const { supabase } = await import('../src/lib/supabase.js')
const { saveListingPhoto, refreshListingCaches } = await import('../src/services/partners.js')

const mode = process.argv.includes('--upload') ? 'upload' : 'fetch'
const dir = process.argv[process.argv.indexOf(`--${mode}`) + 1]
if (!dir || dir.startsWith('--')) {
  console.log('Usage: node scripts/missing-photos.js --fetch <dir> | --upload <dir>')
  process.exit(1)
}
fs.mkdirSync(dir, { recursive: true })

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const SKIP_HOSTS = /facebook\.com|instagram\.com|tiktok\.com|yelp\.com|tripadvisor|google\.com|thebigchill\.com/i

const { data: rows, error } = await supabase
  .from('explore_vendors')
  .select('id, slug, name, kind, website_url, menu_url')
  .eq('is_active', true)
  .in('kind', ['restaurant', 'vendor'])
  .is('image_url', null)
  .order('name')
if (error) throw error

function metaImage(html, base) {
  const pick = (re) => html.match(re)?.[1]
  const raw =
    pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i) ||
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image/i)
  if (!raw) return null
  try {
    return new URL(raw.replace(/&amp;/g, '&'), base).toString()
  } catch {
    return null
  }
}

if (mode === 'fetch') {
  const report = []
  for (const row of rows) {
    const site = row.website_url
    if (!site || SKIP_HOSTS.test(site)) {
      report.push({ slug: row.slug, name: row.name, status: site ? 'skipped (social / shared site)' : 'no website' })
      continue
    }
    try {
      const page = await fetch(site, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
      const html = await page.text()
      const img = metaImage(html, page.url)
      if (!img) {
        report.push({ slug: row.slug, name: row.name, status: 'no share image on site', site })
        continue
      }
      const res = await fetch(img, { headers: { 'User-Agent': UA, Referer: page.url }, signal: AbortSignal.timeout(20000) })
      const type = res.headers.get('content-type') || ''
      const buf = Buffer.from(await res.arrayBuffer())
      if (!res.ok || !type.startsWith('image/') || buf.length < 8000) {
        report.push({ slug: row.slug, name: row.name, status: `bad image (${res.status} ${type} ${buf.length}b)`, img })
        continue
      }
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
      fs.writeFileSync(path.join(dir, `${row.slug}.${ext}`), buf)
      report.push({ slug: row.slug, name: row.name, status: 'downloaded', img })
      console.log(`✓ ${row.name}`)
    } catch (e) {
      report.push({ slug: row.slug, name: row.name, status: `error: ${e.message}`, site })
    }
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2))
  const got = report.filter((r) => r.status === 'downloaded').length
  console.log(`\n${rows.length} listings without a photo · ${got} candidate photos in ${dir} — review, delete the bad ones, then --upload.`)
} else {
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  let done = 0
  for (const file of fs.readdirSync(dir)) {
    const slug = file.replace(/\.(jpe?g|png|webp)$/i, '')
    const row = bySlug.get(slug)
    if (!row || slug === file) continue
    const url = await saveListingPhoto(fs.readFileSync(path.join(dir, file)), slug)
    const { error: upErr } = await supabase.from('explore_vendors').update({ image_url: url }).eq('id', row.id)
    if (upErr) throw upErr
    done += 1
    console.log(`↑ ${row.name}`)
  }
  refreshListingCaches()
  console.log(`\n${done} photos uploaded. Restart the API (or wait 5 min) so guests see them.`)
}
process.exit(0)
