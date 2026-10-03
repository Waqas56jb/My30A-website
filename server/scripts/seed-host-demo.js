// Public demo of the Host Version for prospective hosts (re-runnable — resets the demo):
//   • host login  demo.host@my30ahost.com / Demo-My30A-2026  (read-only: the API refuses changes)
//   • an active annual plan for 3 properties (no Stripe — comped), flagged is_demo
//   • two sample properties with generic My30A branding (never a real company's logo)
//   • 30 days of sample guest activity so the dashboard has something to show
// Demo app links: my30ahost.com/h/demo-beach-house and /h/demo-rosemary-cottage
//   cd server && node scripts/seed-host-demo.js
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { supabase } = await import('../src/lib/supabase.js')
const { uploadPublicImage } = await import('../src/lib/storage.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EMAIL = 'demo.host@my30ahost.com'
const PASSWORD = 'Demo-My30A-2026'
const COMPANY = 'Your Rentals Co.'

// 1) login + profile
let { data: profile } = await supabase.from('profiles').select('id').eq('email', EMAIL).maybeSingle()
if (!profile) {
  const { data, error } = await supabase.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { name: 'Demo Host', role: 'host' } })
  if (error) throw error
  profile = { id: data.user.id }
} else {
  await supabase.auth.admin.updateUserById(profile.id, { password: PASSWORD })
}
await supabase.from('profiles').upsert({ id: profile.id, email: EMAIL, name: 'Demo Host', roles: ['host'], is_active: true }, { onConflict: 'id' })

// 2) comped, read-only subscription
await supabase.from('host_subscriptions').upsert(
  {
    host_id: profile.id,
    company_name: COMPANY,
    plan: 'annual',
    quantity: 3,
    status: 'active',
    is_demo: true,
    unit_amount: 149.99,
    current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
  },
  { onConflict: 'host_id' }
)

// 3) sample properties
const logo = await uploadPublicImage('brand', fs.readFileSync(path.join(__dirname, '../data/demo-host-logo.png')), 'homes/demo/logo.png', 'image/png')
const cover = (file) => uploadPublicImage('brand', fs.readFileSync(path.resolve(__dirname, `../../client/public/marketing/${file}`)), `homes/demo/${file}`, 'image/webp')
const common = {
  owner_id: profile.id,
  host_name: COMPANY,
  host_tagline: '30A Florida Vacation Rentals',
  logo_url: logo,
  check_in_time: '4:00 PM',
  check_out_time: '10:00 AM',
  pets: 'Not allowed on this property',
  instructions: [
    { icon: 'tv', label: 'TV streaming', value: 'Smart TV · Netflix & Apple TV ready' },
    { icon: 'thermostat', label: 'AC / Heating', value: 'Nest thermostat · 68–74°F suggested' },
    { icon: 'kitchen', label: 'Kitchen', value: 'Fully equipped · Coffee starter kit' },
    { icon: 'trash', label: 'Trash', value: 'Bins in garage · Pickup Wednesdays' },
  ],
  rules: ['🚭 No smoking inside', '🎉 No parties without approval', '🌙 Quiet hours 10pm – 8am'],
  contact_label: `${COMPANY} · Guest services`,
  contact_phone: '(850) 555-0130',
  website_url: 'my30ahost.com',
  properties_label: 'See all our properties',
  plan: 'annual',
  is_active: true,
}
const homes = [
  { ...common, slug: 'demo-beach-house', home_name: 'Your Beach House', address: '123 Scenic Hwy 30A', area: 'Seaside', cover_url: await cover('stay-balcony.webp'), wifi_network: 'BeachHouse_5G', wifi_password: 'Welcome2Seaside', door_code: '2468#', parking: '2 spaces · Driveway', max_guests: 8 },
  { ...common, slug: 'demo-rosemary-cottage', home_name: 'Your Rosemary Cottage', address: '45 Main St', area: 'Rosemary Beach', cover_url: await cover('stay-boardwalk.webp'), wifi_network: 'Cottage_5G', wifi_password: 'RosemaryDays30A', door_code: '1357#', parking: '1 space · Street parking allowed', max_guests: 6 },
]
const ids = []
for (const home of homes) {
  const { data: existing } = await supabase.from('host_homes').select('id').eq('slug', home.slug).maybeSingle()
  const { data, error } = existing
    ? await supabase.from('host_homes').update(home).eq('id', existing.id).select('id').single()
    : await supabase.from('host_homes').insert(home).select('id').single()
  if (error) throw error
  ids.push(data.id)
}

// 4) sample activity (no real guests — guest_id empty)
await supabase.from('host_home_events').delete().in('home_id', ids).is('guest_id', null)
const TOPICS = [['wifi', 18], ['dining', 14], ['checkout', 9], ['beach', 7], ['door', 6], ['house', 6], ['transfer', 4], ['events', 3], ['parking', 2]]
const rows = []
const at = () => new Date(Date.now() - Math.random() * 29 * 86400000).toISOString()
ids.forEach((homeId, i) => {
  const scale = i === 0 ? 1 : 0.6
  const add = (kind, n, topic = null) => {
    for (let k = 0; k < Math.round(n * scale); k += 1) rows.push({ home_id: homeId, guest_id: null, kind, topic, created_at: at() })
  }
  add('joined', 24)
  add('opened', 81)
  for (const [topic, n] of TOPICS) add('vitoria', n, topic)
  add('transfer', 5)
  add('grocery', 3)
})
for (let k = 0; k < rows.length; k += 200) {
  const { error } = await supabase.from('host_home_events').insert(rows.slice(k, k + 200))
  if (error) throw error
}

console.log(`Demo ready: ${EMAIL} / ${PASSWORD} · ${homes.length} properties · ${rows.length} sample events`)
console.log(homes.map((h) => `  https://www.my30ahost.com/h/${h.slug}`).join('\n'))
process.exit(0)
