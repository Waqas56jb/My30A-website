// Every Dining tab a place belongs to (explore_vendors.venue_types), not just its section in the
// client's list: Pescado is listed as a bar but is a fine-dining restaurant too; many restaurants
// have a full bar; breakfast restaurants belong under "Coffee & Breakfast". Rules use the cuisine,
// tags and description gathered by import-restaurants.js. Re-run after any restaurant import.
//   cd server && node scripts/classify-venues.js [--dry-run]
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry-run')

const MEAL_TAGS = ['Seafood', 'Italian', 'Pizza', 'Mexican & Latin', 'Sushi & Asian', 'American', 'Southern & BBQ', 'Steakhouse', 'Mediterranean & Greek', 'Burgers & Casual', 'Fine Dining']
const DRINK_TAGS = ['Cocktails', 'Wine Bar', 'Beer & Brewery']
// Drinks-first businesses stay bars only, whatever snacks they serve.
const DRINKS_ONLY = /^(craft cocktails|frozen cocktails|wine & spirits|cigar lounge|craft beer)$/i
const FOOD_WORDS = /serv(es|ing)[^.]{0,60}(seafood|burger|pizza|sushi|taco|barbecue|bbq|oyster|dishes|fare|entr[ée]e|menu|food|lunch|dinner|brunch|breakfast|sandwich|wings|pasta|steak|shrimp|gumbo|brisket)|restaurant|grill\b|grille|kitchen|bistro|dining|eatery|gastropub/i
const BAR_WORDS = /\bbar\b|\bpub\b|tavern|lounge|brewery|taproom|full bar|rooftop bar|raw bar|cocktail bar/i

export function venueTypes(r) {
  const tags = r.tags || []
  const text = `${r.name} ${r.cuisine || ''} ${r.description || ''}`
  const types = new Set([r.venue_type])
  if (r.venue_type === 'bar') {
    const food = tags.some((t) => MEAL_TAGS.includes(t)) && FOOD_WORDS.test(text) && !DRINKS_ONLY.test(r.cuisine || '')
    if (food) types.add('restaurant')
  }
  if (r.venue_type === 'restaurant') {
    // A real bar scene, not just a drinks list: named/described as a bar, or drinks + bar life.
    const barLife = ['Happy Hour', 'Live Music', 'Late Night', 'Rooftop'].some((t) => tags.includes(t))
    const bar = BAR_WORDS.test(`${r.name} ${r.description || ''}`) || (tags.some((t) => DRINK_TAGS.includes(t)) && barLife)
    if (bar) types.add('bar')
    if (tags.includes('Breakfast & Brunch') || /breakfast|brunch/i.test(r.cuisine || '')) types.add('coffee')
  }
  return ['restaurant', 'bar', 'coffee'].filter((t) => types.has(t))
}

const { data, error } = await db
  .from('explore_vendors')
  .select('id, name, venue_type, cuisine, tags, description, venue_types')
  .eq('kind', 'restaurant')
  .not('venue_type', 'is', null)
if (error) throw error
const tally = { restaurant: 0, bar: 0, coffee: 0 }
let changed = 0
for (const r of data) {
  const types = venueTypes(r)
  for (const t of types) tally[t] += 1
  if (JSON.stringify(types) !== JSON.stringify(r.venue_types || [])) {
    changed += 1
    if (types.length > 1) console.log(`${r.venue_type.padEnd(10)} → ${types.join(' + ').padEnd(28)} ${r.name}`)
    if (!dry) await db.from('explore_vendors').update({ venue_types: types }).eq('id', r.id)
  }
}
console.log(`\n${changed} updated · places per tab now:`, tally)
process.exit(0)
