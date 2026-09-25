// End-to-end CLI verification of every API route, run against a live server:
//   cd server && npm run dev            (in one terminal)
//   cd server && node scripts/e2e-cli.js   (in another)
//
// Uses the Supabase credentials in server/.env. Creates (or resets) disposable test accounts:
//   driver.test@example.com / partner.test@example.com / shopper.test@example.com / guest.demo@example.com
//   password for all four: Test-Pass-2026!
// All rows it creates stay in the database (they are useful demo data). Exit code 1 on any FAIL.

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const API = process.env.E2E_API_URL || `http://localhost:${process.env.PORT || 4000}`
const TEST_PASSWORD = 'Test-Pass-2026!'
const ACCOUNTS = {
  driver: { email: 'driver.test@example.com', name: 'Test Driver', roles: ['driver'] },
  partner: { email: 'partner.test@example.com', name: 'Test Partner', roles: ['partner'] },
  shopper: { email: 'shopper.test@example.com', name: 'Test Shopper', roles: ['shopper'] },
}
const GUEST = { email: 'guest.demo@example.com', name: 'Alex Jessy', phone: '+1 850 555 0100' }
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const results = []
let failures = 0

function record(ok, name, detail = '') {
  results.push({ ok, name, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

async function call(method, route, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const response = await fetch(`${API}${route}`, { method, headers, body: payload })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: response.status, data }
}

// Assert a call returns `expected` status and (optionally) that `verify(data)` holds.
async function expect(name, method, route, options, expected, verify) {
  const res = await call(method, route, options)
  let ok = res.status === expected
  let detail = `${method} ${route} → ${res.status}`
  if (ok && verify) {
    try {
      // Any truthy value passes; a falsy value fails the check.
      if (!verify(res.data)) {
        ok = false
        detail += ` (check failed: ${JSON.stringify(res.data).slice(0, 160)})`
      }
    } catch (error) {
      ok = false
      detail += ` (check threw: ${error.message})`
    }
  }
  if (!ok && res.status !== expected) {
    detail += ` expected ${expected}: ${JSON.stringify(res.data).slice(0, 200)}`
  }
  record(ok, name, detail)
  return res.data
}

async function passwordToken(email, password) {
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await response.json()
  if (!response.ok) throw new Error(`login failed for ${email}: ${json.error_description || json.msg || json.error}`)
  return json.access_token
}

async function ensureAccount({ email, name, roles, phone = null }) {
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  let id = existing?.id
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name, phone, role: roles.includes('guest') ? 'guest' : undefined },
    })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    id = data.user.id
  } else {
    const { error } = await admin.auth.admin.updateUserById(id, { password: TEST_PASSWORD })
    if (error) throw new Error(`updateUser ${email}: ${error.message}`)
  }
  const { error } = await admin
    .from('profiles')
    .upsert({ id, email, name, phone, roles, is_active: true }, { onConflict: 'id' })
  if (error) throw new Error(`profile ${email}: ${error.message}`)
  return id
}

// The /mine?date= endpoints use Chicago-local days (what the driver/shopper panels send).
function chicagoDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

function isoPlusHours(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString()
}

function pngForm(fields, files) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value))
  for (const [key, filename] of Object.entries(files)) {
    form.append(key, new Blob([PNG_1x1], { type: 'image/png' }), filename)
  }
  return form
}

async function main() {
  console.log(`\nMy30A Host API end-to-end CLI test → ${API}\n`)

  // ---------- 0. health + unauthenticated ----------
  await expect('health', 'GET', '/health', {}, 200, (d) => d.ok === true)
  await expect('api health', 'GET', '/api/health', {}, 200, (d) => d.ok === true)
  await expect('users without token → 401', 'GET', '/api/users', {}, 401)
  await expect('guest home without token → 401', 'GET', '/api/guest/home', {}, 401)

  // ---------- 1. accounts ----------
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD missing in server/.env')
  const adminToken = await passwordToken(adminEmail, adminPassword)
  record(true, 'admin login (Supabase password grant)', adminEmail)

  const ids = {}
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    ids[key] = await ensureAccount(account)
  }
  record(true, 'test staff accounts ready (driver/partner/shopper)', TEST_PASSWORD)
  // Make sure the demo guest starts from a known password, whether or not it already exists.
  const { data: existingGuest } = await admin.from('profiles').select('id').eq('email', GUEST.email).maybeSingle()
  if (existingGuest) {
    await admin.auth.admin.updateUserById(existingGuest.id, { password: TEST_PASSWORD })
    await admin.from('profiles').update({ roles: ['guest'], is_active: true }).eq('id', existingGuest.id)
  }

  const A = { token: adminToken }

  // ---------- 2. users (admin) ----------
  const stamp = Date.now()
  const staff = await expect(
    'POST /api/users creates a staff login',
    'POST',
    '/api/users',
    { ...A, body: { name: 'E2E Staff', email: `staff.${stamp}@example.com`, roles: ['driver'], password: TEST_PASSWORD } },
    201,
    (d) => d.id && d.roles.includes('driver')
  )
  await expect('GET /api/users', 'GET', '/api/users', A, 200, (d) => Array.isArray(d) && d.length >= 4)
  await expect('GET /api/users?role=shopper', 'GET', '/api/users?role=shopper', A, 200, (d) =>
    d.some((u) => u.id === ids.shopper)
  )
  await expect('PATCH /api/users/:id (deactivate e2e staff)', 'PATCH', `/api/users/${staff.id}`, { ...A, body: { is_active: false } }, 200, (d) => d.is_active === false)
  await expect('POST /api/users/:id/reset-password', 'POST', `/api/users/${staff.id}/reset-password`, { ...A, body: {} }, 200, (d) => d.password?.length === 10)

  // ---------- 3. settings ----------
  const settings = await expect('GET /api/settings', 'GET', '/api/settings', A, 200, (d) => d.id === 1)
  await expect(
    'PATCH /api/settings',
    'PATCH',
    '/api/settings',
    { ...A, body: { platform_fee_percent: Number(settings.platform_fee_percent) } },
    200,
    (d) => Number(d.platform_fee_percent) === Number(settings.platform_fee_percent)
  )
  await expect('PATCH /api/settings invalid → 400', 'PATCH', '/api/settings', { ...A, body: { platform_fee_percent: 500 } }, 400)

  // ---------- 4. vehicles + compensation ----------
  const vehicles = await expect('GET /api/vehicles', 'GET', '/api/vehicles', A, 200, (d) => Array.isArray(d))
  let vehicle = vehicles.find((v) => v.plate === 'E2E-4PAX')
  if (!vehicle) {
    vehicle = await expect(
      'POST /api/vehicles (partner-owned 4pax)',
      'POST',
      '/api/vehicles',
      { ...A, body: { owner_id: ids.partner, make: 'Chevrolet', model: 'Suburban', year: 2024, vehicle_type: '4pax', capacity: 4, plate: 'E2E-4PAX', owner_fee_percent: 20 } },
      201,
      (d) => d.id && d.owner_id === ids.partner
    )
  } else {
    record(true, 'POST /api/vehicles (reusing existing E2E-4PAX)', vehicle.id)
  }
  await expect('PATCH /api/vehicles/:id', 'PATCH', `/api/vehicles/${vehicle.id}`, { ...A, body: { status: 'active', owner_fee_percent: 20 } }, 200, (d) => d.status === 'active')
  await expect('POST /api/vehicles invalid type → 400', 'POST', '/api/vehicles', { ...A, body: { owner_id: ids.partner, make: 'X', model: 'Y', year: 2020, vehicle_type: '2pax', capacity: 2, plate: 'BAD' } }, 400)

  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10)
  await expect('POST /api/compensation (driver fixed $40)', 'POST', '/api/compensation', { ...A, body: { user_id: ids.driver, type: 'fixed', value: 40, effective_from: yesterday } }, 201, (d) => d.type === 'fixed')
  await expect('POST /api/compensation (shopper fixed $50)', 'POST', '/api/compensation', { ...A, body: { user_id: ids.shopper, type: 'fixed', value: 50, effective_from: yesterday } }, 201, (d) => d.type === 'fixed')
  await expect('GET /api/compensation/user/:id', 'GET', `/api/compensation/user/${ids.driver}`, A, 200, (d) => d.current && Number(d.current.value) === 40)
  await expect('POST /api/compensation partner → 400', 'POST', '/api/compensation', { ...A, body: { user_id: ids.partner, type: 'fixed', value: 1 } }, 400)

  // ---------- 5. communities / pricing ----------
  const communities = await expect('GET /api/communities', 'GET', '/api/communities', A, 200, (d) => d.length >= 16)
  const rosemary = communities.find((c) => c.name === 'Rosemary Beach')
  await expect('GET /api/communities/pricing', 'GET', `/api/communities/pricing?community_id=${rosemary.id}&airport=ECP&vehicle_type=4pax`, A, 200, (d) => Number(d.base_price) === 85)
  await expect('GET /api/communities/pricing/all', 'GET', '/api/communities/pricing/all', A, 200, (d) => d.length >= 100)
  await expect('GET /api/communities/pricing missing → 400', 'GET', '/api/communities/pricing?airport=ECP', A, 400)

  // ---------- 6. guest signup / login ----------
  let signup = await call('POST', '/api/guest/signup', { body: { ...GUEST, password: TEST_PASSWORD } })
  if (signup.status === 409) {
    record(true, 'POST /api/guest/signup (already exists → 409, reusing demo guest)', GUEST.email)
  } else {
    record(signup.status === 201 && signup.data?.session?.access_token, 'POST /api/guest/signup', `→ ${signup.status} ${signup.data?.user?.email || JSON.stringify(signup.data)}`)
  }
  await expect('POST /api/guest/signup duplicate → 409', 'POST', '/api/guest/signup', { body: { ...GUEST, password: TEST_PASSWORD } }, 409)
  await expect('POST /api/guest/signup short password → 400', 'POST', '/api/guest/signup', { body: { name: 'x', email: `bad.${stamp}@example.com`, password: '123' } }, 400)
  const login = await expect('POST /api/guest/login', 'POST', '/api/guest/login', { body: { email: GUEST.email, password: TEST_PASSWORD } }, 200, (d) => d.session?.access_token && d.user.roles.includes('guest'))
  await expect('POST /api/guest/login wrong password → 401', 'POST', '/api/guest/login', { body: { email: GUEST.email, password: 'nope-nope-nope' } }, 401)
  await expect('POST /api/guest/login staff account → 403', 'POST', '/api/guest/login', { body: { email: ACCOUNTS.driver.email, password: TEST_PASSWORD } }, 403)
  const G = { token: login.session.access_token }
  const guestId = login.user.id

  // ---------- 7. guest profile / booking ----------
  await expect('GET /api/guest/me', 'GET', '/api/guest/me', G, 200, (d) => d.profile.id === guestId && d.stats)
  await expect('PATCH /api/guest/me', 'PATCH', '/api/guest/me', { ...G, body: { phone: GUEST.phone, name: GUEST.name } }, 200, (d) => d.phone === GUEST.phone)
  await expect('PATCH /api/guest/me empty → 400', 'PATCH', '/api/guest/me', { ...G, body: {} }, 400)
  const bookingRes = await call('PUT', '/api/guest/booking', {
    ...G,
    body: { community: 'Rosemary Beach', property_address: '21 N Barrett Square, Rosemary Beach, FL 32461', check_in: new Date(Date.now() + 86400e3).toISOString().slice(0, 10), check_out: new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10), guests_count: 4 },
  })
  record([200, 201].includes(bookingRes.status) && bookingRes.data?.community_name === 'Rosemary Beach', 'PUT /api/guest/booking', `→ ${bookingRes.status} ${bookingRes.data?.location_label}`)
  await expect('GET /api/guest/booking', 'GET', '/api/guest/booking', G, 200, (d) => d.property_address?.includes('Barrett'))
  await expect('PUT /api/guest/booking bad community → 400', 'PUT', '/api/guest/booking', { ...G, body: { community: 'Nowhere Beach' } }, 400)
  await expect('GET /api/guest/communities', 'GET', '/api/guest/communities', G, 200, (d) => d.length >= 16)
  await expect('GET /api/guest/catalog', 'GET', '/api/guest/catalog', G, 200, (d) => d.grocery.packages.length === 4 && d.transfer.addons.length === 1)
  await expect('GET /api/communities as guest', 'GET', '/api/communities', G, 200, (d) => d.length >= 16)
  await expect('GET /api/users as guest → 403', 'GET', '/api/users', G, 403)
  await expect('GET /api/content/guides as guest → 403', 'GET', '/api/content/guides', G, 403)

  // ---------- 8. explore ----------
  // 13 real-data-backed categories: the 3 dining tiles (the client's list of restaurants, bars and
  // coffee & breakfast spots, migration 023) plus the partner categories and the public-info tiles.
  await expect('GET /api/guest/explore', 'GET', '/api/guest/explore', G, 200, (d) =>
    d.categories.length === 14 &&
    ['restaurants', 'bars', 'coffee'].every((k) => {
      const c = d.categories.find((x) => x.key === k)
      return c && !c.coming_soon && c.count > 0 && c.to.startsWith('/app/explore/dining?type=')
    })
  )
  await expect('GET /api/guest/explore/dining (real client list, typed + by community)', 'GET', '/api/guest/explore/dining', G, 200, (d) =>
    d.places.length > 200 &&
    ['restaurant', 'bar', 'coffee'].every((t) => d.places.some((p) => p.type === t)) &&
    d.places.every((p) => p.community && p.to.startsWith('/app/explore/restaurant/'))
  )
  await expect('GET /api/guest/explore/events (30a.com events, next 5 weeks)', 'GET', '/api/guest/explore/events', G, 200, (d) =>
    d.events.length > 50 && d.events.every((e) => e.title && e.day && e.time && e.url.startsWith('https://30a.com/events/') && e.calendar.startsWith('https://calendar.google.com'))
  )
  await expect('GET /api/guest/explore/beaches (59 county accesses as cards)', 'GET', '/api/guest/explore/beaches', G, 200, (d) => d.beaches.length === 59 && d.featured.length >= 3)
  await expect('voice tool find_restaurants → real dining cards', 'POST', '/api/guest/vitoria/voice/tool', { ...G, body: { name: 'find_restaurants', arguments: '{"request":"seafood dinner","community":"Seaside"}' } }, 200, (d) => d.cards.length > 0 && d.result.picks.length > 0)
  await expect('voice tool transfer_price → fixed price from the table', 'POST', '/api/guest/vitoria/voice/tool', { ...G, body: { name: 'transfer_price', arguments: { community: 'Seaside', airport: 'ECP', passengers: 2 } } }, 200, (d) => d.result.one_way_price_usd > 0)
  await expect('GET /api/guest/explore/vendor/borago (dining detail: hours, open-now, address)', 'GET', '/api/guest/explore/vendor/borago', G, 200, (d) =>
    d.kind === 'restaurant' && d.venue_type === 'restaurant' && Boolean(d.hours) && typeof d.open_now === 'boolean' && Boolean(d.address) && d.back.startsWith('/app/explore/dining') && d.booking_platform === 'phone_only' && Boolean(d.last_verified_date)
  )
  await expect(
    'GET /api/guest/explore/guide?c=golf-outdoor (category_key scoping — the old bug showed all 20 guides here)',
    'GET',
    '/api/guest/explore/guide?c=golf-outdoor',
    G,
    200,
    (d) => d.items.length === 4 && d.items.every((i) => ['Golf Cart Rentals', 'Bike Rentals', 'Golf Courses', 'Pickleball'].includes(i.title))
  )
  await expect('GET /api/guest/explore/guide (all)', 'GET', '/api/guest/explore/guide', G, 200, (d) => d.items.length >= 6)
  await expect('GET /api/guest/explore/search?q=bonfire', 'GET', '/api/guest/explore/search?q=bonfire', G, 200, (d) => d.vendors.length >= 1)
  const bonfireList = await expect('GET /api/guest/explore/vendors/beach-bonfires (real partners)', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count >= 9 && /Beach/.test(d.title))
  const bonfireBefore = bonfireList.count
  await expect('GET /api/guest/explore/vendors/unknown → 404', 'GET', '/api/guest/explore/vendors/nope', G, 404)
  const bonfireSlug = bonfireList.vendors[0].slug
  const bonfire = await expect('GET /api/guest/explore/vendor/:slug (real partner)', 'GET', `/api/guest/explore/vendor/${bonfireSlug}`, G, 200, (d) => d.name === bonfireList.vendors[0].name && d.saved === false && d.website_url !== undefined)
  await expect('GET /api/guest/explore/vendor/:uuid', 'GET', `/api/guest/explore/vendor/${bonfire.id}`, G, 200, (d) => d.slug === bonfireSlug)
  // The mockup-era placeholder restaurant/beach rows are retired (never client data) — they
  // must be unreachable, not just delisted.
  await expect('GET /api/guest/explore/vendor/pescado (retired placeholder) → 404', 'GET', '/api/guest/explore/vendor/pescado', G, 404)
  await expect('GET /api/guest/explore/vendor/rosemary (retired placeholder) → 404', 'GET', '/api/guest/explore/vendor/rosemary', G, 404)
  await expect('GET /api/guest/explore/info', 'GET', '/api/guest/explore/info', G, 200, (d) => d.sections.length === 8 && d.sections[0].items.length === 6)
  await expect('POST /api/guest/saved/:slug', 'POST', `/api/guest/saved/${bonfireSlug}`, G, 201, (d) => d.saved === true)
  await expect('GET /api/guest/saved', 'GET', '/api/guest/saved', G, 200, (d) => d.some((v) => v.slug === bonfireSlug))
  await expect('vendor detail shows saved=true', 'GET', `/api/guest/explore/vendor/${bonfireSlug}`, G, 200, (d) => d.saved === true)
  await expect('DELETE /api/guest/saved/:slug', 'DELETE', `/api/guest/saved/${bonfireSlug}`, G, 200, (d) => d.saved === false)
  await expect('POST /api/guest/saved/unknown → 404', 'POST', '/api/guest/saved/does-not-exist', G, 404)

  // ---------- 9. guest transfer request ----------
  // Holiday/peak-date surcharge is staff-only now (client request) — a guest sending
  // holiday:true (or addons directly) is silently ignored, not applied.
  await expect('POST /api/guest/transfers/quote', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'ECP', vehicle_type: '4pax' } }, 200, (d) => d.base_price === 85 && d.total === 85 && d.community.name === 'Rosemary Beach')
  await expect(
    'POST /api/guest/transfers/quote holiday:true is ignored (guest can no longer self-select it)',
    'POST',
    '/api/guest/transfers/quote',
    { ...G, body: { airport: 'ECP', vehicle_type: '4pax', holiday: true, addons: ['transfer-holiday'] } },
    200,
    (d) => d.total === 85 && d.addons.length === 0
  )
  await expect('POST /api/guest/transfers/quote bad airport → 400', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'JFK' } }, 400)
  const scheduled = isoPlusHours(30)
  const t1 = await expect(
    'POST /api/guest/transfers (T1 arrival request)',
    'POST',
    '/api/guest/transfers',
    { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: scheduled, passengers: 2, bags: 3, flight_number: 'WN 0987', holiday: true, payment_method: 'card' } },
    201,
    (d) => d.status === 'requested' && d.total === 85 && d.trip_type === 'arrival' && d.pickup_address.startsWith('ECP')
  )
  await expect('POST /api/guest/transfers missing date → 400', 'POST', '/api/guest/transfers', { ...G, body: { airport: 'ECP' } }, 400)
  await expect('GET /api/guest/transfers', 'GET', '/api/guest/transfers', G, 200, (d) => d.some((t) => t.id === t1.id))
  await expect('GET /api/guest/transfers?active=true', 'GET', '/api/guest/transfers?active=true', G, 200, (d) => d.some((t) => t.id === t1.id))
  await expect('GET /api/guest/transfers/:id', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.status_log.length === 1 && d.status_log[0].status === 'requested')
  await expect('POST /api/guest/transfers/:id/pay', 'POST', `/api/guest/transfers/${t1.id}/pay`, { ...G, body: { payment_method: 'apple_pay' } }, 200, (d) => d.payment_method === 'apple_pay')
  await expect('POST /api/guest/transfers/:id/tip before completion → 400', 'POST', `/api/guest/transfers/${t1.id}/tip`, { ...G, body: { tip_amount: 5 } }, 400)

  // Admin-only holiday fee toggle (POST /api/transfers/:id/holiday-fee)
  await expect(
    'POST /api/transfers/:id/holiday-fee apply=true adds the $40 fee',
    'POST',
    `/api/transfers/${t1.id}/holiday-fee`,
    { ...A, body: { apply: true } },
    200,
    (d) => d.customer_charge === 125 && d.addons.some((addon) => addon.key === 'transfer-holiday' && addon.price === 40)
  )
  await expect('GET /api/guest/transfers/:id sees the admin-added holiday fee', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.total === 125 && d.addons.some((addon) => addon.key === 'transfer-holiday'))
  await expect(
    'POST /api/transfers/:id/holiday-fee apply=false removes it again',
    'POST',
    `/api/transfers/${t1.id}/holiday-fee`,
    { ...A, body: { apply: false } },
    200,
    (d) => d.customer_charge === 85 && !d.addons.some((addon) => addon.key === 'transfer-holiday')
  )
  await expect('POST /api/transfers/:id/holiday-fee as guest → 403', 'POST', `/api/transfers/${t1.id}/holiday-fee`, { ...G, body: { apply: true } }, 403)
  const t2 = await expect('POST /api/guest/transfers (T2 departure, to cancel)', 'POST', '/api/guest/transfers', { ...G, body: { trip_type: 'departure', airport: 'VPS', vehicle_type: '6pax', scheduled_at: isoPlusHours(50), passengers: 4, bags: 4 } }, 201, (d) => d.direction === 'to_airport' && d.dropoff_address.startsWith('VPS'))
  await expect('POST /api/guest/transfers/:id/cancel (T2)', 'POST', `/api/guest/transfers/${t2.id}/cancel`, G, 200, (d) => d.status === 'cancelled')
  await expect('cancel again → 400', 'POST', `/api/guest/transfers/${t2.id}/cancel`, G, 400)

  // ---------- 10. guest grocery request ----------
  // Client price sheet (Sep 2026): Rush (+$50) is same-day only, Holiday is +$75.
  await expect('POST /api/guest/grocery/quote', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'full', stocking: 'full-kitchen' } }, 200, (d) => d.service_fee === 259 && d.addons_total === 0)
  await expect('POST /api/guest/grocery/quote Rush is not charged for a later day', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'full', stocking: 'full-kitchen', addons: ['rush'], delivery_time: isoPlusHours(24 * 4) } }, 200, (d) => d.service_fee === 259 && d.addons_total === 0 && d.addons.length === 0)
  await expect('POST /api/guest/grocery/quote Holiday add-on +$75', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'full', stocking: 'full-kitchen', addons: ['holiday'] } }, 200, (d) => d.service_fee === 334 && d.addons_total === 75)
  await expect('POST /api/guest/grocery/quote bad package → 400', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'mega' } }, 400)
  const deliveryTime = isoPlusHours(28)
  const g1 = await expect(
    'POST /api/guest/grocery (G1 request)',
    'POST',
    '/api/guest/grocery',
    { ...G, body: { package: 'full', stocking: 'full-kitchen', delivery_time: deliveryTime, items: ['Sparkling water 12-pack', 'Eggs', 'Avocados'], notes: 'Leave cold items in fridge', payment_method: 'card' } },
    201,
    (d) => d.status === 'requested' && d.service_fee === 259 && d.stocking === 'Full Kitchen Organization' && d.items.length === 3
  )
  await expect('GET /api/guest/grocery', 'GET', '/api/guest/grocery', G, 200, (d) => d.some((o) => o.id === g1.id))
  await expect('GET /api/guest/grocery/:id', 'GET', `/api/guest/grocery/${g1.id}`, G, 200, (d) => d.status_log.length === 1)
  await expect('POST /api/guest/grocery/:id/list-file (Publix screenshot)', 'POST', `/api/guest/grocery/${g1.id}/list-file`, { ...G, form: pngForm({}, { list_file: 'publix-cart.png' }) }, 200, (d) => d.list_file_url && d.list_file_signed_url)
  await expect('POST /api/guest/grocery/:id/pay', 'POST', `/api/guest/grocery/${g1.id}/pay`, { ...G, body: { payment_method: 'card' } }, 200, (d) => d.payment_method === 'card')
  const g2 = await expect('POST /api/guest/grocery (G2, to cancel)', 'POST', '/api/guest/grocery', { ...G, body: { package: 'large', delivery_time: isoPlusHours(40) } }, 201, (d) => d.service_fee === 329)
  await expect('POST /api/guest/grocery/:id/cancel (G2)', 'POST', `/api/guest/grocery/${g2.id}/cancel`, G, 200, (d) => d.status === 'cancelled')

  // "Vitoria's Pick" now highlights real, genuinely top-rated partners (not a curated category
  // shortcut) — the client's data has real Google ratings for exactly 4 vendors, top 3 shown.
  await expect(
    'GET /api/guest/home (active orders present)',
    'GET',
    '/api/guest/home',
    G,
    200,
    (d) =>
      d.orders.length >= 2 &&
      d.picks.length === 3 &&
      d.picks[0].title === '30A Blaze Beach Bonfires' &&
      d.picks[0].rating === 5 &&
      d.picks[0].reviews === 1200 &&
      d.explore.length === 14 &&
      d.location_label === 'Rosemary Beach, FL' &&
      /^Good/.test(d.greeting)
  )
  await expect('GET /api/notifications/mine (guest)', 'GET', '/api/notifications/mine', G, 200, (d) => d.notifications.length >= 2)

  // ---------- 11. admin sees + assigns the requests ----------
  // T1's addons are empty here — its holiday fee was added then removed again above, proving
  // the admin-only toggle works both ways (guest-side holiday:true on creation was ignored).
  await expect('GET /api/transfers?status=requested', 'GET', '/api/transfers?status=requested', A, 200, (d) => d.some((t) => t.id === t1.id && t.is_guest_request && t.guest_account?.email === GUEST.email))
  await expect('GET /api/transfers/:id (admin)', 'GET', `/api/transfers/${t1.id}`, A, 200, (d) => d.addons.length === 0 && d.base_price === 85)
  await expect('PATCH /api/transfers/:id while requested', 'PATCH', `/api/transfers/${t1.id}`, { ...A, body: { notes: 'Guest arrives Terminal B' } }, 200, (d) => d.notes === 'Guest arrives Terminal B')
  await expect('POST /api/transfers/:id/assign missing → 400', 'POST', `/api/transfers/${t1.id}/assign`, { ...A, body: {} }, 400)
  await expect('POST /api/transfers/:id/assign', 'POST', `/api/transfers/${t1.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200, (d) => d.status === 'assigned' && d.driver_id === ids.driver && d.vehicle_owner_id === ids.partner)
  await expect('guest sees T1 confirmed with driver', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.status === 'assigned' && d.driver?.name === 'Test' && d.vehicle_label?.includes('E2E-4PAX'))

  await expect('GET /api/grocery?status=requested', 'GET', '/api/grocery?status=requested', A, 200, (d) => d.some((o) => o.id === g1.id && o.guest_account?.email === GUEST.email && o.list_file_signed_url))
  await expect('GET /api/grocery/:id (admin)', 'GET', `/api/grocery/${g1.id}`, A, 200, (d) => d.addons.length === 0 && d.stocking)
  await expect('PATCH /api/grocery/:id while requested', 'PATCH', `/api/grocery/${g1.id}`, { ...A, body: { notes: 'Gate code 1234' } }, 200, (d) => d.notes === 'Gate code 1234')
  await expect('POST /api/grocery/:id/assign', 'POST', `/api/grocery/${g1.id}/assign`, { ...A, body: { shopper_id: ids.shopper } }, 200, (d) => d.status === 'assigned' && d.shopper_id === ids.shopper)
  await expect('POST /api/grocery/:id/assign non-shopper → 400', 'POST', `/api/grocery/${g1.id}/assign`, { ...A, body: { shopper_id: ids.driver } }, 400)

  // ---------- 12. driver panel ----------
  const D = { token: await passwordToken(ACCOUNTS.driver.email, TEST_PASSWORD) }
  const tripDate = chicagoDate(scheduled)
  await expect('GET /api/transfers/mine (driver)', 'GET', `/api/transfers/mine?date=${tripDate}`, D, 200, (d) => d.some((t) => t.id === t1.id && t.status === 'assigned'))
  await expect('POST /api/transfers/:id/complete before start → 400', 'POST', `/api/transfers/${t1.id}/complete`, { ...D, body: { payment_method: 'card' } }, 400)
  await expect('POST /api/transfers/:id/start', 'POST', `/api/transfers/${t1.id}/start`, D, 200, (d) => d.status === 'started')
  await expect('guest sees driver on the way', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.status === 'started' && d.status_label === 'Driver on the way')
  await expect('POST /api/transfers/:id/complete (card)', 'POST', `/api/transfers/${t1.id}/complete`, { ...D, body: { payment_method: 'card', tip_amount: 0 } }, 200, (d) => d.status === 'completed' && d.driver_payout === 40)
  await expect('POST /api/transfers/:id/tip (driver)', 'POST', `/api/transfers/${t1.id}/tip`, { ...D, body: { tip_amount: 5 } }, 200, (d) => d.tip_amount === 5)
  await expect('GET /api/transfers/mine/history (driver)', 'GET', `/api/transfers/mine/history?month=${tripDate.slice(0, 7)}`, D, 200, (d) => d.some((t) => t.id === t1.id))
  await expect('GET /api/earnings/mine (driver)', 'GET', '/api/earnings/mine?range=today', D, 200, (d) => d.trips_count >= 1 && d.trip_earnings >= 40)
  await expect('GET /api/payouts/mine (driver)', 'GET', '/api/payouts/mine', D, 200, (d) => Array.isArray(d))
  await expect('GET /api/notifications/mine (driver)', 'GET', '/api/notifications/mine', D, 200, (d) => d.notifications.length >= 1)
  await expect('driver cannot list all transfers → 403', 'GET', '/api/transfers', D, 403)
  await expect('POST /api/guest/transfers/:id/tip (guest, completed)', 'POST', `/api/guest/transfers/${t1.id}/tip`, { ...G, body: { tip_amount: 10 } }, 200, (d) => d.tip_amount === 10 && d.status === 'completed')

  // ---------- 13. admin-created transfers: edit/cancel, complete/refund, flag ----------
  const adminTripBody = {
    guest_name: 'Walk-in Guest', guest_phone: '+1 850 555 0199', pickup_address: '30A Beach House', dropoff_address: AIRPORT('ECP'),
    community_id: rosemary.id, airport: 'ECP', direction: 'to_airport', vehicle_type: '4pax', passengers: 1, bags: 1,
    driver_id: ids.driver, vehicle_id: vehicle.id, payment_method: 'cash',
  }
  const t3 = await expect('POST /api/transfers (admin create T3)', 'POST', '/api/transfers', { ...A, body: { ...adminTripBody, scheduled_at: isoPlusHours(60) } }, 201, (d) => d.status === 'assigned' && d.customer_charge === 85)
  await expect('PATCH /api/transfers/:id (T3 custom price)', 'PATCH', `/api/transfers/${t3.id}`, { ...A, body: { custom_price: 99 } }, 200, (d) => d.customer_charge === 99 && d.is_custom_price)
  await expect('POST /api/transfers/:id/cancel (T3)', 'POST', `/api/transfers/${t3.id}/cancel`, A, 200, (d) => d.status === 'cancelled')
  const t4 = await expect('POST /api/transfers (admin create T4)', 'POST', '/api/transfers', { ...A, body: { ...adminTripBody, scheduled_at: isoPlusHours(70) } }, 201, (d) => d.status === 'assigned')
  await expect('POST /api/transfers/:id/start (T4)', 'POST', `/api/transfers/${t4.id}/start`, D, 200, (d) => d.status === 'started')
  await expect('POST /api/transfers/:id/complete cash without cash_reported → 400', 'POST', `/api/transfers/${t4.id}/complete`, { ...D, body: { payment_method: 'cash' } }, 400)
  await expect('POST /api/transfers/:id/complete (T4 cash)', 'POST', `/api/transfers/${t4.id}/complete`, { ...D, body: { payment_method: 'cash', cash_reported: 85 } }, 200, (d) => d.status === 'completed')
  await expect('POST /api/transfers/:id/flag', 'POST', `/api/transfers/${t4.id}/flag`, { ...A, body: { reason: 'E2E check' } }, 200, (d) => d.is_flagged === true)
  await expect('GET /api/transfers?is_flagged=true', 'GET', '/api/transfers?is_flagged=true', A, 200, (d) => d.some((t) => t.id === t4.id))
  await expect('POST /api/transfers/:id/unflag', 'POST', `/api/transfers/${t4.id}/unflag`, A, 200, (d) => d.is_flagged === false)
  await expect('POST /api/transfers/:id/refund (T4)', 'POST', `/api/transfers/${t4.id}/refund`, A, 200, (d) => d.status === 'refunded' && d.status_log.length >= 4)
  await expect('GET /api/transfers (admin list)', 'GET', `/api/transfers?driver_id=${ids.driver}`, A, 200, (d) => d.length >= 3)

  // ---------- 14. partner panel ----------
  const P = { token: await passwordToken(ACCOUNTS.partner.email, TEST_PASSWORD) }
  const month = new Date().toISOString().slice(0, 7)
  await expect('GET /api/transfers/vehicle-owner (partner)', 'GET', `/api/transfers/vehicle-owner?month=${tripDate.slice(0, 7)}`, P, 200, (d) => d.trips.some((t) => t.trip_number === t1.trip_number) && d.total_owner_fee > 0)
  await expect('GET /api/earnings/vehicle-owner (partner)', 'GET', `/api/earnings/vehicle-owner?month=${month}`, P, 200, (d) => d.vehicles.length >= 1 && d.month_total > 0)
  const partnerNotes = await expect('GET /api/notifications/mine (partner)', 'GET', '/api/notifications/mine', P, 200, (d) => d.notifications.length >= 1)
  await expect('PATCH /api/notifications/:id/read', 'PATCH', `/api/notifications/${partnerNotes.notifications[0].id}/read`, P, 200, (d) => d.is_read === true)
  await expect('POST /api/notifications/read-all', 'POST', '/api/notifications/read-all', P, 200, (d) => d.unread_count === 0)
  await expect('GET /api/payouts/mine (partner)', 'GET', '/api/payouts/mine', P, 200, (d) => Array.isArray(d))
  await expect('partner cannot see driver trips → 403', 'GET', '/api/grocery/mine', P, 403)

  // ---------- 15. shopper panel ----------
  const S = { token: await passwordToken(ACCOUNTS.shopper.email, TEST_PASSWORD) }
  const orderDate = chicagoDate(deliveryTime)
  await expect('GET /api/grocery/mine (shopper)', 'GET', `/api/grocery/mine?date=${orderDate}`, S, 200, (d) => d.some((o) => o.id === g1.id && o.status === 'assigned'))
  await expect('POST /api/grocery/:id/on-the-way before shopping → 400', 'POST', `/api/grocery/${g1.id}/on-the-way`, S, 400)
  await expect('POST /api/grocery/:id/shopping', 'POST', `/api/grocery/${g1.id}/shopping`, S, 200, (d) => d.status === 'shopping')
  await expect('guest sees Shopping at Publix', 'GET', `/api/guest/grocery/${g1.id}`, G, 200, (d) => d.status_label === 'Shopping at Publix' && d.shopper?.name === 'Test Shopper')
  await expect('POST /api/grocery/:id/on-the-way', 'POST', `/api/grocery/${g1.id}/on-the-way`, S, 200, (d) => d.status === 'on_the_way')
  await expect('POST /api/grocery/:id/deliver missing files → 400', 'POST', `/api/grocery/${g1.id}/deliver`, { ...S, form: pngForm({ grocery_total: 286.83, payment_method: 'card' }, {}) }, 400)
  await expect('POST /api/grocery/:id/deliver (receipt + kitchen photo)', 'POST', `/api/grocery/${g1.id}/deliver`, { ...S, form: pngForm({ grocery_total: 286.83, payment_method: 'card' }, { receipt: 'receipt.png', kitchen_photo: 'kitchen.png' }) }, 200, (d) => d.status === 'delivered' && d.shopper_payout === 50)
  await expect('POST /api/grocery/:id/tip (shopper)', 'POST', `/api/grocery/${g1.id}/tip`, { ...S, body: { tip_amount: 8 } }, 200, (d) => d.tip_amount === 8)
  await expect('GET /api/grocery/mine/history (shopper)', 'GET', `/api/grocery/mine/history?month=${orderDate.slice(0, 7)}`, S, 200, (d) => d.some((o) => o.id === g1.id))
  await expect('GET /api/earnings/mine (shopper)', 'GET', '/api/earnings/mine?range=today', S, 200, (d) => d.trips_count >= 1 && d.trip_earnings >= 50)
  await expect('shopper cannot start transfers → 403', 'POST', `/api/transfers/${t1.id}/start`, S, 403)
  await expect('POST /api/guest/grocery/:id/tip (guest, delivered)', 'POST', `/api/guest/grocery/${g1.id}/tip`, { ...G, body: { tip_amount: 12 } }, 200, (d) => d.tip_amount === 12 && d.total === 545.83)
  await expect('GET /api/guest/grocery/:id shows receipt + kitchen photo', 'GET', `/api/guest/grocery/${g1.id}`, G, 200, (d) => d.receipt_signed_url && d.kitchen_signed_url && d.grocery_total === 286.83)

  // ---------- 16. admin-created grocery: edit/cancel, deliver/refund, flag ----------
  const adminOrderBody = { guest_name: 'Walk-in Guest', guest_phone: '+1 850 555 0199', delivery_address: '30A Beach House', package: 'Full Pack', items: ['Milk', 'Bread'], shopper_id: ids.shopper, service_fee: 229, payment_method: 'card' }
  const g3 = await expect('POST /api/grocery (admin create G3)', 'POST', '/api/grocery', { ...A, body: { ...adminOrderBody, delivery_time: isoPlusHours(48) } }, 201, (d) => d.status === 'assigned' && d.service_fee === 229)
  await expect('PATCH /api/grocery/:id (G3)', 'PATCH', `/api/grocery/${g3.id}`, { ...A, body: { service_fee: 250 } }, 200, (d) => d.service_fee === 250)
  await expect('POST /api/grocery/:id/cancel (G3)', 'POST', `/api/grocery/${g3.id}/cancel`, A, 200, (d) => d.status === 'cancelled')
  const g4 = await expect('POST /api/grocery (admin create G4)', 'POST', '/api/grocery', { ...A, body: { ...adminOrderBody, delivery_time: isoPlusHours(52) } }, 201, (d) => d.status === 'assigned')
  await expect('POST /api/grocery/:id/shopping (G4)', 'POST', `/api/grocery/${g4.id}/shopping`, S, 200)
  await expect('POST /api/grocery/:id/on-the-way (G4)', 'POST', `/api/grocery/${g4.id}/on-the-way`, S, 200)
  await expect('POST /api/grocery/:id/deliver (G4)', 'POST', `/api/grocery/${g4.id}/deliver`, { ...S, form: pngForm({ grocery_total: 120.5, payment_method: 'card' }, { receipt: 'r.png', kitchen_photo: 'k.png' }) }, 200, (d) => d.status === 'delivered')
  await expect('POST /api/grocery/:id/flag', 'POST', `/api/grocery/${g4.id}/flag`, { ...A, body: { reason: 'E2E check' } }, 200, (d) => d.is_flagged)
  await expect('GET /api/grocery?is_flagged=true', 'GET', '/api/grocery?is_flagged=true', A, 200, (d) => d.some((o) => o.id === g4.id))
  await expect('POST /api/grocery/:id/unflag', 'POST', `/api/grocery/${g4.id}/unflag`, A, 200, (d) => !d.is_flagged)
  await expect('POST /api/grocery/:id/refund (G4)', 'POST', `/api/grocery/${g4.id}/refund`, A, 200, (d) => d.status === 'refunded')
  await expect('GET /api/grocery (admin list)', 'GET', `/api/grocery?shopper_id=${ids.shopper}`, A, 200, (d) => d.length >= 2)

  // ---------- 17. payouts / earnings / dashboard (admin) ----------
  await expect('GET /api/payouts/owed', 'GET', '/api/payouts/owed', A, 200, (d) => Array.isArray(d) && d.some((r) => r.user_id === ids.driver || r.id === ids.driver || JSON.stringify(r).includes(ids.driver)))
  await expect('GET /api/payouts/owed/:userId', 'GET', `/api/payouts/owed/${ids.driver}`, A, 200, (d) => d !== null)
  const payout = await expect('POST /api/payouts (driver)', 'POST', '/api/payouts', { ...A, body: { user_id: ids.driver, notes: 'E2E' } }, 201, (d) => d.id && d.items.length >= 1)
  await expect('GET /api/payouts', 'GET', `/api/payouts?user_id=${ids.driver}`, A, 200, (d) => d.some((p) => p.id === payout.id))
  await expect('GET /api/payouts/:id', 'GET', `/api/payouts/${payout.id}`, A, 200, (d) => d.id === payout.id && d.items.length >= 1)
  await expect('POST /api/payouts/:id/mark-paid', 'POST', `/api/payouts/${payout.id}/mark-paid`, { ...A, body: { payment_method: 'zelle' } }, 200, (d) => d.status === 'paid')
  await expect('driver sees paid payout', 'GET', '/api/payouts/mine', D, 200, (d) => d.some((p) => p.id === payout.id && p.status === 'paid'))
  const shopperPayout = await expect('POST /api/payouts (shopper)', 'POST', '/api/payouts', { ...A, body: { user_id: ids.shopper } }, 201, (d) => d.id)
  await expect('DELETE /api/payouts/:id (pending shopper payout)', 'DELETE', `/api/payouts/${shopperPayout.id}`, A, 200, (d) => d.ok === true)
  await expect('POST /api/payouts nothing owed → 400', 'POST', '/api/payouts', { ...A, body: { user_id: staff.id } }, 400)
  // The partner is owed the vehicle-owner fee from T1: create and settle that payout too.
  const partnerPayout = await expect('POST /api/payouts (partner owner fee)', 'POST', '/api/payouts', { ...A, body: { user_id: ids.partner } }, 201, (d) => d.total_amount > 0)
  await expect('POST /api/payouts/:id/mark-paid (partner, cash)', 'POST', `/api/payouts/${partnerPayout.id}/mark-paid`, { ...A, body: { payment_method: 'cash' } }, 200, (d) => d.status === 'paid')
  await expect('GET /api/earnings/admin/summary', 'GET', '/api/earnings/admin/summary?range=today', A, 200, (d) => typeof d === 'object')
  await expect('GET /api/dashboard', 'GET', '/api/dashboard', A, 200, (d) => typeof d === 'object')

  // ---------- 18. Vitoria ----------
  await expect('DELETE /api/guest/vitoria/messages (reset)', 'DELETE', '/api/guest/vitoria/messages', G, 200)
  await expect('GET /api/guest/vitoria/messages (empty)', 'GET', '/api/guest/vitoria/messages', G, 200, (d) => d.messages.length === 0 && d.greeting.includes('Alex'))
  const chat1 = await expect('POST /api/guest/vitoria/messages "Best beach today" (real AI, not fallback)', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: 'Best beach today' } }, 201, (d) => d.assistant?.content?.length > 20 && d.model !== 'fallback')
  console.log(`      Vitoria (${chat1.model}${chat1.skipped_reason ? `, fallback because: ${chat1.skipped_reason}` : ''}): ${chat1.assistant.content.slice(0, 160)}…`)
  const chat2 = await expect('POST /api/guest/vitoria/messages "Dinner tonight" (dining-guide cards: photo, live hours, profile link — AI or offline)', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: 'Dinner tonight' } }, 201, (d) => d.assistant?.content?.length > 20 && (d.assistant.places || []).length >= 2 && d.assistant.places.some((p) => p.image) && d.assistant.places.every((p) => !p.in_guide || p.to))
  console.log(`      Vitoria (${chat2.model}): ${chat2.assistant.content.slice(0, 160)}…`)
  await expect('POST /api/guest/vitoria/messages empty → 400', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: '  ' } }, 400)
  await expect('GET /api/guest/vitoria/messages (4 messages)', 'GET', '/api/guest/vitoria/messages', G, 200, (d) => d.messages.length === 4)

  // ---------- 19. admin content management ----------
  await expect('GET /api/content', 'GET', '/api/content', A, 200, (d) => d.resources.length >= 6 && d.resources.includes('places'))
  await expect('GET /api/content/guides', 'GET', '/api/content/guides', A, 200, (d) => d.length >= 12)
  await expect('GET /api/content/catalog', 'GET', '/api/content/catalog', A, 200, (d) => d.length === 10)
  await expect('GET /api/content/unknown → 404', 'GET', '/api/content/nope', A, 404)
  const newVendor = await expect('POST /api/content/vendors (create)', 'POST', '/api/content/vendors', { ...A, body: { guide_slug: 'beach-bonfires', slug: 'e2e-test-vendor', name: 'E2E Test Vendor', place: 'Seaside, FL', rating: 4.5, review_count: 1, description: 'Temporary vendor', image_url: '/image6.png', price_from: 99 } }, 201, (d) => d.id && d.slug === 'e2e-test-vendor')
  await expect('guest sees one more bonfire vendor now', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count === bonfireBefore + 1)
  await expect('PATCH /api/content/vendors/:id', 'PATCH', `/api/content/vendors/${newVendor.id}`, { ...A, body: { rating: 4.8 } }, 200, (d) => Number(d.rating) === 4.8)
  await expect('POST /api/content/vendors (upsert by slug)', 'POST', '/api/content/vendors', { ...A, body: { slug: 'e2e-test-vendor', name: 'E2E Test Vendor (renamed)' } }, 201, (d) => d.id === newVendor.id && d.name.includes('renamed'))
  await expect('DELETE /api/content/vendors/:id', 'DELETE', `/api/content/vendors/${newVendor.id}`, A, 200, (d) => d.deleted === 1)
  await expect('DELETE again → 404', 'DELETE', `/api/content/vendors/${newVendor.id}`, A, 404)
  await expect('guest back to the original bonfire vendor count', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count === bonfireBefore)
  await expect('POST /api/content/info (upsert section)', 'POST', '/api/content/info', { ...A, body: { key: 'e2e', title: 'E2E Section', items: ['one', 'two'], sort_order: 99 } }, 201, (d) => d.key === 'e2e')
  await expect('DELETE /api/content/info/e2e', 'DELETE', '/api/content/info/e2e', A, 200)

  // ---------- 20. auth: change password (guest) ----------
  // A password change can invalidate the session that made the request (Supabase's timing on
  // this isn't guaranteed), so every step after a successful change re-logs in for a fresh token
  // instead of reusing G's — reusing it intermittently 401'd the very next call.
  await expect('POST /api/auth/change-password wrong current → 400', 'POST', '/api/auth/change-password', { ...G, body: { current_password: 'wrong-wrong', new_password: 'Guest-New-2026!' } }, 400)
  await expect('POST /api/auth/change-password', 'POST', '/api/auth/change-password', { ...G, body: { current_password: TEST_PASSWORD, new_password: 'Guest-New-2026!' } }, 200, (d) => d.ok)
  const afterChange = await expect('login with new password', 'POST', '/api/guest/login', { body: { email: GUEST.email, password: 'Guest-New-2026!' } }, 200, (d) => d.session?.access_token)
  await expect(
    'restore demo password',
    'POST',
    '/api/auth/change-password',
    { token: afterChange.session.access_token, body: { current_password: 'Guest-New-2026!', new_password: TEST_PASSWORD } },
    200,
    (d) => d.ok
  )
  const relogin = await expect('re-login after password change', 'POST', '/api/guest/login', { body: { email: GUEST.email, password: TEST_PASSWORD } }, 200, (d) => d.session?.access_token)
  G.token = relogin.session.access_token

  // ---------- 21. final guest state ----------
  await expect('GET /api/guest/me (stats updated)', 'GET', '/api/guest/me', G, 200, (d) => d.stats.transfers >= 2 && d.stats.grocery_orders >= 2 && d.stay_label)
  await expect('GET /api/guest/home (final)', 'GET', '/api/guest/home', G, 200, (d) => Array.isArray(d.orders) && d.unread_count >= 1)

  // ---------- 22. Stripe payments (real test/sandbox API calls, no browser needed) ----------
  // pm_card_visa is Stripe's official test token for a card that always succeeds — this is the
  // documented way to exercise a real PaymentIntent confirmation from a script instead of the
  // Payment Element UI. See https://stripe.com/docs/testing.
  // Never against LIVE keys: this section confirms real PaymentIntents with test cards.
  const serverMode = await fetch(`${API}/api/health`).then((r) => r.json()).then((d) => d.stripe).catch(() => null)
  const liveStripe = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '') || serverMode === 'live'
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY) && !liveStripe
  // Once a real whsec_ is configured (it now is — see server/.env), a request with no
  // stripe-signature header must be rejected, not silently skipped.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    await expect(
      'POST /api/payments/webhook without signature → 400 rejected (whsec_ configured)',
      'POST',
      '/api/payments/webhook',
      { body: {} },
      400
    )
  } else {
    await expect(
      'POST /api/payments/webhook without signature → 200 skipped (no whsec_ configured yet)',
      'POST',
      '/api/payments/webhook',
      { body: {} },
      200,
      (d) => d.skipped === true
    )
  }

  if (!stripeConfigured) {
    record(true, liveStripe ? 'Stripe section skipped — LIVE keys (would make real charges)' : 'Stripe section skipped — STRIPE_SECRET_KEY not set', 'use sk_test_ keys in server/.env for this section')
  } else {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const confirmWithTestCard = (clientSecret) =>
      stripe.paymentIntents.confirm(clientSecret.split('_secret_')[0], { payment_method: 'pm_card_visa' })
    const confirmSetupWithTestCard = (clientSecret) =>
      stripe.setupIntents.confirm(clientSecret.split('_secret_')[0], { payment_method: 'pm_card_visa' })

    // --- 22a. transfer: authorize → admin assigns → driver completes → captured ---
    const t5 = await expect(
      'POST /api/guest/transfers (T5, for Stripe capture)',
      'POST',
      '/api/guest/transfers',
      { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: isoPlusHours(80), passengers: 2, bags: 1 } },
      201,
      (d) => d.status === 'requested'
    )
    const t5pay = await expect(
      'POST /api/guest/transfers/:id/pay (T5) creates a real manual-capture PaymentIntent',
      'POST',
      `/api/guest/transfers/${t5.id}/pay`,
      { ...G, body: { payment_method: 'card_on_file' } },
      200,
      (d) => Boolean(d.client_secret) && d.payment_intent_status === 'requires_payment_method'
    )
    const t5PiId = t5pay.client_secret.split('_secret_')[0]
    const t5confirm = await confirmWithTestCard(t5pay.client_secret)
    record(t5confirm.status === 'requires_capture', 'stripe.paymentIntents.confirm (T5) → requires_capture', t5confirm.status)
    await expect(
      'POST /api/guest/transfers/:id/sync-payment (T5) reconciles to authorized',
      'POST',
      `/api/guest/transfers/${t5.id}/sync-payment`,
      G,
      200,
      (d) => d.payment_status === 'authorized' && d.payment_intent_status === 'requires_capture'
    )
    await expect('POST /api/transfers/:id/assign (T5)', 'POST', `/api/transfers/${t5.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200, (d) => d.status === 'assigned')
    await expect('POST /api/transfers/:id/complete card_on_file before auth (guard) — reuse existing T5 auth', 'POST', `/api/transfers/${t5.id}/start`, D, 200, (d) => d.status === 'started')
    await expect(
      'POST /api/transfers/:id/complete (T5) captures the real PaymentIntent',
      'POST',
      `/api/transfers/${t5.id}/complete`,
      { ...D, body: { payment_method: 'card_on_file' } },
      200,
      (d) => d.status === 'completed'
    )
    const t5Intent = await stripe.paymentIntents.retrieve(t5PiId)
    record(t5Intent.status === 'succeeded', 'Stripe confirms T5 PaymentIntent actually captured', t5Intent.status)
    await expect('GET /api/transfers/:id (T5) payment_status captured', 'GET', `/api/transfers/${t5.id}`, A, 200, (d) => d.payment_status === 'captured')

    // --- 22b. transfer: authorize → guest cancels while requested → hold released ---
    const t6 = await expect(
      'POST /api/guest/transfers (T6, for Stripe cancel/release)',
      'POST',
      '/api/guest/transfers',
      { ...G, body: { trip_type: 'departure', airport: 'VPS', vehicle_type: '4pax', scheduled_at: isoPlusHours(90), passengers: 1, bags: 1 } },
      201
    )
    const t6pay = await expect('POST /api/guest/transfers/:id/pay (T6)', 'POST', `/api/guest/transfers/${t6.id}/pay`, { ...G, body: { payment_method: 'card_on_file' } }, 200, (d) => Boolean(d.client_secret))
    const t6PiId = t6pay.client_secret.split('_secret_')[0]
    await confirmWithTestCard(t6pay.client_secret)
    const t6Before = await stripe.paymentIntents.retrieve(t6PiId)
    record(t6Before.status === 'requires_capture', 'T6 authorized before cancel', t6Before.status)
    await expect('POST /api/guest/transfers/:id/cancel (T6) releases the Stripe hold', 'POST', `/api/guest/transfers/${t6.id}/cancel`, G, 200, (d) => d.status === 'cancelled')
    const t6After = await stripe.paymentIntents.retrieve(t6PiId)
    record(t6After.status === 'canceled', 'Stripe confirms T6 PaymentIntent was released (canceled), not left on hold', t6After.status)

    // --- 22c. transfer: driver tries to complete card_on_file before the guest ever paid → 400 ---
    const t7 = await expect(
      'POST /api/transfers (admin create T7, never paid)',
      'POST',
      '/api/transfers',
      { ...A, body: { guest_name: 'Unpaid Guest', guest_phone: '+1 850 555 0111', pickup_address: '30A Beach House', dropoff_address: AIRPORT('ECP'), community_id: rosemary.id, airport: 'ECP', direction: 'to_airport', vehicle_type: '4pax', passengers: 1, bags: 1, driver_id: ids.driver, vehicle_id: vehicle.id, payment_method: 'card_on_file', scheduled_at: isoPlusHours(95) } },
      201
    )
    await expect('POST /api/transfers/:id/start (T7)', 'POST', `/api/transfers/${t7.id}/start`, D, 200)
    await expect(
      'POST /api/transfers/:id/complete (T7) card_on_file with no PaymentIntent → clean 400, not a 500',
      'POST',
      `/api/transfers/${t7.id}/complete`,
      { ...D, body: { payment_method: 'card_on_file' } },
      400
    )
    await expect('POST /api/transfers/:id/complete (T7) fall back to cash', 'POST', `/api/transfers/${t7.id}/complete`, { ...D, body: { payment_method: 'cash', cash_reported: 85 } }, 200, (d) => d.status === 'completed')

    // --- 22d. grocery: save a card up front (no hold — a SetupIntent), THEN one combined
    //          off-session charge for service fee + exact Publix total, only once delivered.
    const g5 = await expect(
      'POST /api/guest/grocery (G5, for save-card + combined off-session charge at delivery)',
      'POST',
      '/api/guest/grocery',
      { ...G, body: { package: 'full', delivery_time: isoPlusHours(85) } },
      201,
      (d) => d.service_fee === 229
    )
    const g5pay = await expect(
      'POST /api/guest/grocery/:id/pay (G5) saves a card — no hold, nothing charged',
      'POST',
      `/api/guest/grocery/${g5.id}/pay`,
      { ...G, body: { payment_method: 'card_on_file' } },
      200,
      (d) => Boolean(d.client_secret) && d.setup_intent_status === 'requires_payment_method'
    )
    const g5confirm = await confirmSetupWithTestCard(g5pay.client_secret)
    record(g5confirm.status === 'succeeded', 'stripe.setupIntents.confirm (G5 save card) → succeeded', g5confirm.status)
    await expect('POST /api/guest/grocery/:id/card-saved (G5)', 'POST', `/api/guest/grocery/${g5.id}/card-saved`, G, 200, (d) => d.card_saved === true)
    await expect('POST /api/grocery/:id/assign (G5)', 'POST', `/api/grocery/${g5.id}/assign`, { ...A, body: { shopper_id: ids.shopper } }, 200, (d) => d.status === 'assigned')
    await expect('POST /api/grocery/:id/shopping (G5)', 'POST', `/api/grocery/${g5.id}/shopping`, S, 200)
    await expect('POST /api/grocery/:id/on-the-way (G5)', 'POST', `/api/grocery/${g5.id}/on-the-way`, S, 200)
    const g5delivered = await expect(
      'POST /api/grocery/:id/deliver (G5) charges service fee + Publix total together, off-session',
      'POST',
      `/api/grocery/${g5.id}/deliver`,
      { ...S, form: pngForm({ grocery_total: 214.37, payment_method: 'card_on_file' }, { receipt: 'r.png', kitchen_photo: 'k.png' }) },
      200,
      (d) => d.status === 'delivered'
    )
    const g5Admin = await expect(
      'GET /api/grocery/:id (G5) admin sees the combined charge captured',
      'GET',
      `/api/grocery/${g5.id}`,
      A,
      200,
      (d) => d.payment_status === 'captured' && d.grocery_payment_status === 'captured' && d.stripe_payment_intent_id
    )
    const g5Intent = await stripe.paymentIntents.retrieve(g5Admin.stripe_payment_intent_id)
    record(
      g5Intent.status === 'succeeded' && g5Intent.amount === 44337,
      'Stripe confirms the combined charge amount is exactly $229 service fee + $214.37 Publix = $443.37',
      `${g5Intent.status} / $${g5Intent.amount / 100}`
    )

    // --- 22e. admin refund on a delivered order refunds the one combined charge ---
    await expect('POST /api/grocery/:id/refund (G5)', 'POST', `/api/grocery/${g5.id}/refund`, A, 200, (d) => d.status === 'refunded' && d.grocery_payment_status === 'refunded')
    const g5Refunds = await stripe.refunds.list({ payment_intent: g5Intent.id, limit: 1 })
    record(g5Refunds.data.length === 1, 'Stripe confirms the combined charge was refunded')
  }

  // ---------- 23. Trip flow v2: statuses, fees, no-show, chat, SMS log, public links, tips, round trip, jobs ----------
  {
    const stripe = stripeConfigured ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
    const confirm = (clientSecret) => stripe.paymentIntents.confirm(clientSecret.split('_secret_')[0], { payment_method: 'pm_card_visa' })
    const piId = (clientSecret) => clientSecret.split('_secret_')[0]
    const payAndAuthorize = async (id) => {
      const pay = await call('POST', `/api/guest/transfers/${id}/pay`, { ...G, body: { payment_method: 'card_on_file' } })
      await confirm(pay.data.client_secret)
      await call('POST', `/api/guest/transfers/${id}/sync-payment`, G)
      return piId(pay.data.client_secret)
    }
    const guestTransfer = (hours, extra = {}) =>
      call('POST', '/api/guest/transfers', { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: isoPlusHours(hours), passengers: 2, bags: 1, flight_number: 'DL 100', ...extra } })

    // Content import
    await expect('partners: /explore/guide lists 20+ categories', 'GET', '/api/guest/explore/guide', G, 200, (d) => d.items.length >= 20)
    await expect('partners: On The Water has 34 vendors', 'GET', '/api/guest/explore/vendors/on-the-water', G, 200, (d) => d.count === 34)
    await expect('partners: Golf Courses has 7 vendors', 'GET', '/api/guest/explore/vendors/golf-courses', G, 200, (d) => d.count === 7)
    await expect('partners: closed gallery is hidden (Arts & Culture = 9 active)', 'GET', '/api/guest/explore/vendors/arts-culture', G, 200, (d) => d.count === 9)
    await expect('public info: 4 place sections, 79 places', 'GET', '/api/guest/explore/info', G, 200, (d) => d.places.length === 4 && d.places.reduce((n, s) => n + s.places.length, 0) === 79)
    await expect('admin content: places resource', 'GET', '/api/content/places', A, 200, (d) => d.length === 79)

    // Round trip + quote
    await expect('quote round trip → 5% off, both legs', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'ECP', vehicle_type: '4pax', round_trip: true } }, 200, (d) => d.discount_percent === 5 && d.total === 80.75 && d.round_trip_total === 161.5 && typeof d.available_credit === 'number')
    const rt = await expect('POST /api/guest/transfers round trip creates 2 linked legs', 'POST', '/api/guest/transfers', { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: isoPlusHours(100), passengers: 2, bags: 1, return_trip: { scheduled_at: isoPlusHours(200), flight_number: 'DL 200' } } }, 201, (d) => d.return_transfer && d.discount_percent === 5 && d.total === 80.75 && d.return_transfer.trip_type === 'departure' && d.round_trip_group_id && d.round_trip_group_id === d.return_transfer.round_trip_group_id)
    await expect('cancellation preview 48h+ → $0', 'GET', `/api/guest/transfers/${rt.id}/cancellation-preview`, G, 200, (d) => d.fee === 0 && d.window === '48h+')
    await expect('guest cancel 48h+ → no fee', 'POST', `/api/guest/transfers/${rt.id}/cancel`, G, 200, (d) => d.status === 'cancelled' && d.cancellation_fee === 0)
    await expect('guest cancel return leg too', 'POST', `/api/guest/transfers/${rt.return_transfer.id}/cancel`, G, 200, (d) => d.status === 'cancelled')

    // Vehicle name visibility for guests
    await expect('PATCH vehicle show_name=false', 'PATCH', `/api/vehicles/${vehicle.id}`, { ...A, body: { show_name: false } }, 200, (d) => d.show_name === false)

    if (!stripe) {
      record(true, 'trip flow v2 Stripe-dependent checks skipped (no STRIPE_SECRET_KEY)')
    } else {
      // Guest cancel 24–48h → $50 captured from the hold
      const t9 = (await guestTransfer(30)).data
      const t9Pi = await payAndAuthorize(t9.id)
      await expect('assign T9', 'POST', `/api/transfers/${t9.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      await expect('guest view hides model when show_name=false', 'GET', `/api/guest/transfers/${t9.id}`, G, 200, (d) => d.vehicle_label === 'Private transfer · Up to 4 passengers' && d.driver?.name === 'Test')
      await expect('cancellation preview 24–48h → $50', 'GET', `/api/guest/transfers/${t9.id}/cancellation-preview`, G, 200, (d) => d.fee === 50 && d.window === '24-48h')
      await expect('guest cancel 24–48h → $50 fee captured', 'POST', `/api/guest/transfers/${t9.id}/cancel`, G, 200, (d) => d.status === 'cancelled' && d.cancellation_fee === 50 && d.payment_status === 'captured')
      const t9Intent = await stripe.paymentIntents.retrieve(t9Pi)
      record(t9Intent.status === 'succeeded' && t9Intent.amount_received === 5000, 'Stripe: T9 captured exactly $50, rest released', `${t9Intent.status} / received $${t9Intent.amount_received / 100}`)
      await expect('PATCH vehicle show_name=true (restore)', 'PATCH', `/api/vehicles/${vehicle.id}`, { ...A, body: { show_name: true } }, 200, (d) => d.show_name === true)

      // Same-day cancel on the guest's behalf by admin → $75
      const t10 = (await guestTransfer(5)).data
      const t10Pi = await payAndAuthorize(t10.id)
      await expect('assign T10', 'POST', `/api/transfers/${t10.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      await expect('admin cancel on guest behalf same-day → $75', 'POST', `/api/transfers/${t10.id}/cancel`, { ...A, body: { initiated_by: 'guest' } }, 200, (d) => d.status === 'cancelled' && d.cancellation_fee === 75)
      const t10Intent = await stripe.paymentIntents.retrieve(t10Pi)
      record(t10Intent.amount_received === 7500, 'Stripe: T10 captured exactly $75', `received $${t10Intent.amount_received / 100}`)

      // Host cancels → full release + $25 credit, applied to the guest's next booking
      const t11 = (await guestTransfer(30)).data
      const t11Pi = await payAndAuthorize(t11.id)
      await expect('assign T11', 'POST', `/api/transfers/${t11.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      await expect('admin cancel (host) → full release + credit', 'POST', `/api/transfers/${t11.id}/cancel`, { ...A, body: { reason: 'vehicle issue' } }, 200, (d) => d.status === 'cancelled' && d.cancellation_fee === 0 && d.cancellation.stripe.action === 'released')
      const t11Intent = await stripe.paymentIntents.retrieve(t11Pi)
      record(t11Intent.status === 'canceled', 'Stripe: T11 hold fully released', t11Intent.status)
      await expect('quote shows the $25 credit', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'ECP', vehicle_type: '4pax' } }, 200, (d) => d.available_credit >= 25)
      const t12 = await expect('next booking consumes the credit ($85 − $25)', 'POST', '/api/guest/transfers', { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: isoPlusHours(120), passengers: 1, bags: 1 } }, 201, (d) => d.credit_applied >= 25 && d.total === 85 - d.credit_applied)
      await expect('credit is now used up', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'ECP', vehicle_type: '4pax' } }, 200, (d) => d.available_credit === 0)
      await expect('cancel T12 (cleanup)', 'POST', `/api/guest/transfers/${t12.id}/cancel`, G, 200)

      // Full driver flow with chat, SMS log and public links
      const t13 = (await guestTransfer(20)).data
      const t13Pi = await payAndAuthorize(t13.id)
      await expect('assign T13 → SMS logged (skipped: Twilio not configured)', 'POST', `/api/transfers/${t13.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      const t13Admin = await expect('admin view has guest_links (chat + tip)', 'GET', `/api/transfers/${t13.id}`, A, 200, (d) => d.guest_links?.chat && d.guest_links?.tip)
      const token = t13Admin.guest_links.chat.split('/trip/')[1]
      await expect('driver /mine does NOT expose guest_phone', 'GET', `/api/transfers/mine?date=${chicagoDate(t13.scheduled_at)}`, D, 200, (d) => d.some((t) => t.id === t13.id) && d.every((t) => !('guest_phone' in t)))
      await expect('driver: On the way', 'POST', `/api/transfers/${t13.id}/start`, D, 200, (d) => d.status === 'started')
      await expect('driver: Arrived', 'POST', `/api/transfers/${t13.id}/arrive`, D, 200, (d) => d.status === 'arrived' && d.arrived_at)
      await expect('guest tracker shows Driver arrived', 'GET', `/api/guest/transfers/${t13.id}`, G, 200, (d) => d.status_label === 'Driver arrived')
      await expect('public trip page (no login) is live', 'GET', `/api/public/trip/${token}`, {}, 200, (d) => d.trip.status === 'arrived' && d.chat_open === true && d.trip.driver.first_name === 'Test')
      await expect('public trip page 404 for bad token', 'GET', `/api/public/trip/${'0'.repeat(32)}`, {}, 404)
      await expect('guest posts via secret link', 'POST', `/api/public/trip/${token}/messages`, { body: { body: 'I am at door 3 with a red bag' } }, 201, (d) => d.sender_role === 'guest')
      await expect('guest posts via app', 'POST', `/api/guest/transfers/${t13.id}/messages`, { ...G, body: { body: 'Blue jacket' } }, 201)
      await expect('driver reads the thread', 'GET', `/api/transfers/${t13.id}/messages`, D, 200, (d) => d.messages.length === 2 && d.chat_open)
      await expect('driver replies', 'POST', `/api/transfers/${t13.id}/messages`, { ...D, body: { body: 'See you, white Ford Fusion' } }, 201, (d) => d.sender_role === 'driver')
      await expect('guest app reads reply', 'GET', `/api/guest/transfers/${t13.id}/messages`, G, 200, (d) => d.messages.length === 3)
      await expect('driver: Guest in vehicle', 'POST', `/api/transfers/${t13.id}/pickup`, D, 200, (d) => d.status === 'picked_up' && d.picked_up_at)
      await expect('driver: Complete (card on file captured)', 'POST', `/api/transfers/${t13.id}/complete`, { ...D, body: { payment_method: 'card_on_file' } }, 200, (d) => d.status === 'completed')
      const t13Intent = await stripe.paymentIntents.retrieve(t13Pi)
      record(t13Intent.status === 'succeeded' && t13Intent.amount_received === 8500, 'Stripe: T13 captured full $85 on completion', `received $${t13Intent.amount_received / 100}`)
      const t13Full = await expect('admin sees messages + SMS log for every status', 'GET', `/api/transfers/${t13.id}`, A, 200, (d) => d.messages.length === 3 && ['assigned', 'started', 'arrived', 'picked_up', 'completed'].every((k) => d.sms_log.some((s) => s.kind === k && s.status === 'skipped')) && d.tip_requested_at)
      record(t13Full.sms_log.find((s) => s.kind === 'completed')?.body.includes('/tip/'), 'completion SMS carries the tip link', t13Full.sms_log.find((s) => s.kind === 'completed')?.body)
      await expect('public chat closed after completion', 'POST', `/api/public/trip/${token}/messages`, { body: { body: 'late' } }, 410)
      await expect('public trip page after completion shows tip_url, no chat', 'GET', `/api/public/trip/${token}`, {}, 200, (d) => d.chat_open === false && d.tip_url)
      await expect('public tip page (no login)', 'GET', `/api/public/tip/${token}`, {}, 200, (d) => d.can_tip && d.options.length === 3 && d.options[1].pct === 18 && d.saved_card === true)
      await expect('public tip charges the saved card off-session', 'POST', `/api/public/tip/${token}`, { body: { tip_amount: 12 } }, 200, (d) => d.ok && d.tip_amount === 12 && d.trip.tip_amount === 12)
      await expect('admin search finds the conversation by trip #', 'GET', `/api/messages?q=%23${t13.trip_number}`, A, 200, (d) => d.messages.length === 3 && d.sms.length >= 5)
      await expect('admin search by driver', 'GET', `/api/messages?driver_id=${ids.driver}&kind=chat`, A, 200, (d) => d.messages.length >= 3)

      // No-show → $75 captured, rest released
      const t14 = (await guestTransfer(6)).data
      const t14Pi = await payAndAuthorize(t14.id)
      await expect('assign T14', 'POST', `/api/transfers/${t14.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      await expect('driver on the way (T14)', 'POST', `/api/transfers/${t14.id}/start`, D, 200)
      await expect('driver arrived (T14)', 'POST', `/api/transfers/${t14.id}/arrive`, D, 200)
      await expect('admin declares no-show → $75', 'POST', `/api/transfers/${t14.id}/no-show`, A, 200, (d) => d.status === 'no_show' && d.no_show_fee === 75 && d.stripe.action === 'captured')
      const t14Intent = await stripe.paymentIntents.retrieve(t14Pi)
      record(t14Intent.amount_received === 7500, 'Stripe: T14 no-show captured exactly $75', `received $${t14Intent.amount_received / 100}`)

      // On-the-spot: pay link must be paid before completing with card; Zelle path
      const t15 = await expect('admin creates walk-in T15 (no card on file)', 'POST', '/api/transfers', { ...A, body: { guest_name: 'Walk In', guest_phone: '+1 850 555 0177', pickup_address: '30A Beach House', dropoff_address: AIRPORT('ECP'), community_id: rosemary.id, airport: 'ECP', direction: 'to_airport', vehicle_type: '4pax', passengers: 1, bags: 1, driver_id: ids.driver, vehicle_id: vehicle.id, payment_method: 'card', scheduled_at: isoPlusHours(8) } }, 201)
      await expect('driver on the way (T15)', 'POST', `/api/transfers/${t15.id}/start`, D, 200)
      await expect('driver generates Stripe payment link', 'POST', `/api/transfers/${t15.id}/pay-link`, D, 201, (d) => d.url?.startsWith('https://checkout.stripe.com') && d.amount === 85)
      await expect('same link returned while still open', 'POST', `/api/transfers/${t15.id}/pay-link`, D, 200, (d) => d.paid === false && d.url)
      await expect('complete with card while link unpaid → 400', 'POST', `/api/transfers/${t15.id}/complete`, { ...D, body: { payment_method: 'card' } }, 400)
      await expect('complete via Zelle → recorded + flagged for admin review', 'POST', `/api/transfers/${t15.id}/complete`, { ...D, body: { payment_method: 'zelle' } }, 200, (d) => d.status === 'completed' && d.payment_method === 'zelle')
      await expect('admin sees Zelle review flag', 'GET', `/api/transfers/${t15.id}`, A, 200, (d) => d.is_flagged && d.flag_reason === 'ZELLE_REVIEW' && d.payment_status === 'captured')
      await expect('driver tips are 100% driver (tip via driver endpoint still works)', 'POST', `/api/transfers/${t15.id}/tip`, { ...D, body: { tip_amount: 7 } }, 200, (d) => d.tip_amount === 7)

      // 24h auto-cancel job
      const t16 = (await guestTransfer(60)).data
      await expect('assign T16 (never authorized)', 'POST', `/api/transfers/${t16.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200)
      await admin.from('trip_status_log').update({ created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() }).eq('transfer_id', t16.id).eq('status', 'assigned')
      await expect('POST /api/jobs/run expires the unauthorized hold', 'POST', '/api/jobs/run', A, 200, (d) => d.ok && d.expire_unauthorized_holds.expired.includes(t16.id))
      await expect('T16 auto-cancelled', 'GET', `/api/transfers/${t16.id}`, A, 200, (d) => d.status === 'cancelled' && /Auto-cancelled/.test(d.notes))
      await expect('jobs endpoint rejects anonymous', 'POST', '/api/jobs/run', {}, 401)
    }

    // Twilio voice webhook (not configured → friendly TwiML, never a crash)
    {
      const res = await fetch(`${API}/api/public/voice`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ From: '+18505550100', CallSid: 'CAtest' }) })
      const xml = await res.text()
      record(res.status === 200 && xml.includes('<Response>'), 'POST /api/public/voice returns TwiML', xml.slice(0, 80))
    }
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
  console.log(`\nDemo logins (password ${TEST_PASSWORD}): guest ${GUEST.email} · driver ${ACCOUNTS.driver.email} · partner ${ACCOUNTS.partner.email} · shopper ${ACCOUNTS.shopper.email}`)
  process.exit(failures ? 1 : 0)
}

function AIRPORT(code) {
  return { ECP: 'ECP · Northwest Florida Beaches International Airport' }[code] || code
}

main().catch((error) => {
  console.error('\nE2E aborted:', error)
  process.exit(1)
})
