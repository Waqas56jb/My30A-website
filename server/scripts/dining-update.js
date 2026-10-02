// Applies a client dining update file (default data/dining-update-2026-10.json):
//  • "updates": changes existing Dining rows matched by exact name (reservations, notes, types…)
//  • "add": new restaurants / bars / coffee spots (or updates the row if it already exists)
// Re-runnable. Photos for rows without one: scripts/missing-photos.js.
//   cd server && node scripts/dining-update.js [file] [--dry-run]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry-run')
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.resolve(__dirname, '../data/dining-update-2026-10.json')
const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

const FIELDS = [
  'venue_type', 'venue_types', 'cuisine', 'community', 'phone', 'website_url', 'address', 'menu_url',
  'booking_platform', 'booking_url', 'booking_note', 'access_note', 'description', 'tags', 'is_active',
]

const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function pick(entry) {
  const row = {}
  for (const f of FIELDS) if (entry[f] !== undefined) row[f] = entry[f]
  if (row.description !== undefined) row.about = row.description
  if (row.booking_platform !== undefined) row.last_verified_date = today
  if (row.community !== undefined) Object.assign(row, { place: row.community, map_name: row.community })
  if (row.address !== undefined) row.map_line1 = row.address
  return row
}

const directions = (name, address, community) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address || community, 'FL'].filter(Boolean).join(' '))}`

let problems = 0

for (const entry of spec.updates || []) {
  const { data: rows } = await supabase.from('explore_vendors').select('id, name').eq('kind', 'restaurant').eq('name', entry.name)
  if (!rows?.length) {
    console.log(`✗ not found: ${entry.name}`)
    problems += 1
    continue
  }
  const row = pick(entry)
  for (const r of rows) {
    console.log(`${dry ? '[dry] ' : ''}~ ${r.name}: ${Object.keys(row).join(', ')}`)
    if (!dry) {
      const { error } = await supabase.from('explore_vendors').update(row).eq('id', r.id)
      if (error) throw new Error(`${r.name}: ${error.message}`)
    }
  }
}

const { data: last } = await supabase.from('explore_vendors').select('sort_order').eq('kind', 'restaurant').order('sort_order', { ascending: false }).limit(1)
let sort = (last?.[0]?.sort_order || 0) + 1

for (const entry of spec.add || []) {
  const slug = entry.slug || slugify(entry.name)
  const { data: existing } = await supabase.from('explore_vendors').select('id, name').or(`slug.eq.${slug},name.eq.${JSON.stringify(entry.name)}`).eq('kind', 'restaurant').limit(1)
  const row = {
    ...pick(entry),
    name: entry.name,
    kind: 'restaurant',
    directions_url: directions(entry.name, entry.address, entry.community),
    is_active: entry.is_active ?? true,
  }
  if (existing?.length) {
    console.log(`${dry ? '[dry] ' : ''}~ exists, updating: ${entry.name}`)
    if (!dry) {
      const { error } = await supabase.from('explore_vendors').update(row).eq('id', existing[0].id)
      if (error) throw new Error(`${entry.name}: ${error.message}`)
    }
  } else {
    console.log(`${dry ? '[dry] ' : ''}+ ${entry.name} → ${entry.community} · ${(entry.venue_types || [entry.venue_type]).join('+')} · ${entry.booking_platform}${entry.access_note ? ` · ${entry.access_note}` : ''}`)
    if (!dry) {
      const { error } = await supabase.from('explore_vendors').insert({ ...row, slug, sort_order: sort++, tags: entry.tags || [] })
      if (error) throw new Error(`${entry.name}: ${error.message}`)
    }
  }
}

console.log(problems ? `\n${problems} name(s) not found — fix the file and re-run.` : '\nDone. Restart the API (or wait 5 min) so guests see it.')
process.exit(problems ? 1 : 0)
