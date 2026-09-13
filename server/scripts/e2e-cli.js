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
  await expect('GET /api/guest/explore', 'GET', '/api/guest/explore', G, 200, (d) => d.categories.length === 8 && d.filters.length === 6)
  await expect('GET /api/guest/explore/guide?c=beaches', 'GET', '/api/guest/explore/guide?c=beaches', G, 200, (d) => d.items.length >= 3 && d.items.every((i) => i.filters.includes('beaches')))
  await expect('GET /api/guest/explore/guide (all)', 'GET', '/api/guest/explore/guide', G, 200, (d) => d.items.length >= 6)
  await expect('GET /api/guest/explore/search?q=bonfire', 'GET', '/api/guest/explore/search?q=bonfire', G, 200, (d) => d.vendors.length >= 1)
  await expect('GET /api/guest/explore/vendors/beach-bonfires', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count === 3 && d.title === 'Beach Bonfire')
  await expect('GET /api/guest/explore/vendors/unknown → 404', 'GET', '/api/guest/explore/vendors/nope', G, 404)
  const bonfire = await expect('GET /api/guest/explore/vendor/bonfire-co', 'GET', '/api/guest/explore/vendor/bonfire-co', G, 200, (d) => d.name === '30A Bonfire Co.' && d.services.length === 4 && d.saved === false)
  await expect('GET /api/guest/explore/vendor/:uuid', 'GET', `/api/guest/explore/vendor/${bonfire.id}`, G, 200, (d) => d.slug === 'bonfire-co')
  await expect('GET /api/guest/explore/vendor/pescado (restaurant)', 'GET', '/api/guest/explore/vendor/pescado', G, 200, (d) => d.kind === 'restaurant' && d.tags.length === 5 && d.hours_today)
  await expect('GET /api/guest/explore/vendor/rosemary (beach)', 'GET', '/api/guest/explore/vendor/rosemary', G, 200, (d) => d.kind === 'beach' && d.amenities.length === 6 && d.rules.length === 5)
  await expect('GET /api/guest/explore/info', 'GET', '/api/guest/explore/info', G, 200, (d) => d.sections.length === 8 && d.sections[0].items.length === 6)
  await expect('POST /api/guest/saved/bonfire-co', 'POST', '/api/guest/saved/bonfire-co', G, 201, (d) => d.saved === true)
  await expect('GET /api/guest/saved', 'GET', '/api/guest/saved', G, 200, (d) => d.some((v) => v.slug === 'bonfire-co'))
  await expect('vendor detail shows saved=true', 'GET', '/api/guest/explore/vendor/bonfire-co', G, 200, (d) => d.saved === true)
  await expect('DELETE /api/guest/saved/bonfire-co', 'DELETE', '/api/guest/saved/bonfire-co', G, 200, (d) => d.saved === false)
  await expect('POST /api/guest/saved/unknown → 404', 'POST', '/api/guest/saved/does-not-exist', G, 404)

  // ---------- 9. guest transfer request ----------
  await expect('POST /api/guest/transfers/quote', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'ECP', vehicle_type: '4pax', holiday: true } }, 200, (d) => d.base_price === 85 && d.total === 125 && d.community.name === 'Rosemary Beach')
  await expect('POST /api/guest/transfers/quote bad airport → 400', 'POST', '/api/guest/transfers/quote', { ...G, body: { airport: 'JFK' } }, 400)
  const scheduled = isoPlusHours(30)
  const t1 = await expect(
    'POST /api/guest/transfers (T1 arrival request)',
    'POST',
    '/api/guest/transfers',
    { ...G, body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: scheduled, passengers: 2, bags: 3, flight_number: 'WN 0987', holiday: true, payment_method: 'card' } },
    201,
    (d) => d.status === 'requested' && d.total === 125 && d.trip_type === 'arrival' && d.pickup_address.startsWith('ECP')
  )
  await expect('POST /api/guest/transfers missing date → 400', 'POST', '/api/guest/transfers', { ...G, body: { airport: 'ECP' } }, 400)
  await expect('GET /api/guest/transfers', 'GET', '/api/guest/transfers', G, 200, (d) => d.some((t) => t.id === t1.id))
  await expect('GET /api/guest/transfers?active=true', 'GET', '/api/guest/transfers?active=true', G, 200, (d) => d.some((t) => t.id === t1.id))
  await expect('GET /api/guest/transfers/:id', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.status_log.length === 1 && d.status_log[0].status === 'requested')
  await expect('POST /api/guest/transfers/:id/pay', 'POST', `/api/guest/transfers/${t1.id}/pay`, { ...G, body: { payment_method: 'apple_pay' } }, 200, (d) => d.payment_method === 'apple_pay')
  await expect('POST /api/guest/transfers/:id/tip before completion → 400', 'POST', `/api/guest/transfers/${t1.id}/tip`, { ...G, body: { tip_amount: 5 } }, 400)
  const t2 = await expect('POST /api/guest/transfers (T2 departure, to cancel)', 'POST', '/api/guest/transfers', { ...G, body: { trip_type: 'departure', airport: 'VPS', vehicle_type: '6pax', scheduled_at: isoPlusHours(50), passengers: 4, bags: 4 } }, 201, (d) => d.direction === 'to_airport' && d.dropoff_address.startsWith('VPS'))
  await expect('POST /api/guest/transfers/:id/cancel (T2)', 'POST', `/api/guest/transfers/${t2.id}/cancel`, G, 200, (d) => d.status === 'cancelled')
  await expect('cancel again → 400', 'POST', `/api/guest/transfers/${t2.id}/cancel`, G, 400)

  // ---------- 10. guest grocery request ----------
  await expect('POST /api/guest/grocery/quote', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'full', stocking: 'full-kitchen', addons: ['rush'] } }, 200, (d) => d.service_fee === 309 && d.addons_total === 50)
  await expect('POST /api/guest/grocery/quote bad package → 400', 'POST', '/api/guest/grocery/quote', { ...G, body: { package: 'mega' } }, 400)
  const deliveryTime = isoPlusHours(28)
  const g1 = await expect(
    'POST /api/guest/grocery (G1 request)',
    'POST',
    '/api/guest/grocery',
    { ...G, body: { package: 'full', stocking: 'full-kitchen', addons: { rush: true, holiday: false }, delivery_time: deliveryTime, items: ['Sparkling water 12-pack', 'Eggs', 'Avocados'], notes: 'Leave cold items in fridge', payment_method: 'card' } },
    201,
    (d) => d.status === 'requested' && d.service_fee === 309 && d.stocking === 'Full Kitchen Organization' && d.items.length === 3
  )
  await expect('GET /api/guest/grocery', 'GET', '/api/guest/grocery', G, 200, (d) => d.some((o) => o.id === g1.id))
  await expect('GET /api/guest/grocery/:id', 'GET', `/api/guest/grocery/${g1.id}`, G, 200, (d) => d.status_log.length === 1)
  await expect('POST /api/guest/grocery/:id/list-file (Publix screenshot)', 'POST', `/api/guest/grocery/${g1.id}/list-file`, { ...G, form: pngForm({}, { list_file: 'publix-cart.png' }) }, 200, (d) => d.list_file_url && d.list_file_signed_url)
  await expect('POST /api/guest/grocery/:id/pay', 'POST', `/api/guest/grocery/${g1.id}/pay`, { ...G, body: { payment_method: 'card' } }, 200, (d) => d.payment_method === 'card')
  const g2 = await expect('POST /api/guest/grocery (G2, to cancel)', 'POST', '/api/guest/grocery', { ...G, body: { package: 'large', delivery_time: isoPlusHours(40) } }, 201, (d) => d.service_fee === 379)
  await expect('POST /api/guest/grocery/:id/cancel (G2)', 'POST', `/api/guest/grocery/${g2.id}/cancel`, G, 200, (d) => d.status === 'cancelled')

  await expect('GET /api/guest/home (active orders present)', 'GET', '/api/guest/home', G, 200, (d) => d.orders.length >= 2 && d.picks.length === 3 && d.explore.length === 8 && d.location_label === 'Rosemary Beach, FL' && /^Good/.test(d.greeting))
  await expect('GET /api/notifications/mine (guest)', 'GET', '/api/notifications/mine', G, 200, (d) => d.notifications.length >= 2)

  // ---------- 11. admin sees + assigns the requests ----------
  await expect('GET /api/transfers?status=requested', 'GET', '/api/transfers?status=requested', A, 200, (d) => d.some((t) => t.id === t1.id && t.is_guest_request && t.guest_account?.email === GUEST.email))
  await expect('GET /api/transfers/:id (admin)', 'GET', `/api/transfers/${t1.id}`, A, 200, (d) => d.addons.length === 1 && d.base_price === 85)
  await expect('PATCH /api/transfers/:id while requested', 'PATCH', `/api/transfers/${t1.id}`, { ...A, body: { notes: 'Guest arrives Terminal B' } }, 200, (d) => d.notes === 'Guest arrives Terminal B')
  await expect('POST /api/transfers/:id/assign missing → 400', 'POST', `/api/transfers/${t1.id}/assign`, { ...A, body: {} }, 400)
  await expect('POST /api/transfers/:id/assign', 'POST', `/api/transfers/${t1.id}/assign`, { ...A, body: { driver_id: ids.driver, vehicle_id: vehicle.id } }, 200, (d) => d.status === 'assigned' && d.driver_id === ids.driver && d.vehicle_owner_id === ids.partner)
  await expect('guest sees T1 confirmed with driver', 'GET', `/api/guest/transfers/${t1.id}`, G, 200, (d) => d.status === 'assigned' && d.driver?.name === 'Test Driver' && d.vehicle_label?.includes('E2E-4PAX'))

  await expect('GET /api/grocery?status=requested', 'GET', '/api/grocery?status=requested', A, 200, (d) => d.some((o) => o.id === g1.id && o.guest_account?.email === GUEST.email && o.list_file_signed_url))
  await expect('GET /api/grocery/:id (admin)', 'GET', `/api/grocery/${g1.id}`, A, 200, (d) => d.addons.length === 1 && d.stocking)
  await expect('PATCH /api/grocery/:id while requested', 'PATCH', `/api/grocery/${g1.id}`, { ...A, body: { notes: 'Gate code 1234' } }, 200, (d) => d.notes === 'Gate code 1234')
  await expect('POST /api/grocery/:id/assign', 'POST', `/api/grocery/${g1.id}/assign`, { ...A, body: { shopper_id: ids.shopper } }, 200, (d) => d.status === 'assigned' && d.shopper_id === ids.shopper)
  await expect('POST /api/grocery/:id/assign non-shopper → 400', 'POST', `/api/grocery/${g1.id}/assign`, { ...A, body: { shopper_id: ids.driver } }, 400)

  // ---------- 12. driver panel ----------
  const D = { token: await passwordToken(ACCOUNTS.driver.email, TEST_PASSWORD) }
  const tripDate = scheduled.slice(0, 10)
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
  const orderDate = deliveryTime.slice(0, 10)
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
  await expect('POST /api/guest/grocery/:id/tip (guest, delivered)', 'POST', `/api/guest/grocery/${g1.id}/tip`, { ...G, body: { tip_amount: 12 } }, 200, (d) => d.tip_amount === 12 && d.total === 595.83)
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
  const chat1 = await expect('POST /api/guest/vitoria/messages "Best beach today"', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: 'Best beach today' } }, 201, (d) => d.assistant?.content?.length > 20)
  console.log(`      Vitoria (${chat1.model}${chat1.skipped_reason ? `, fallback because: ${chat1.skipped_reason}` : ''}): ${chat1.assistant.content.slice(0, 160)}…`)
  const chat2 = await expect('POST /api/guest/vitoria/messages "Dinner tonight"', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: 'Dinner tonight' } }, 201, (d) => d.assistant?.content?.length > 20)
  console.log(`      Vitoria (${chat2.model}): ${chat2.assistant.content.slice(0, 160)}…`)
  await expect('POST /api/guest/vitoria/messages empty → 400', 'POST', '/api/guest/vitoria/messages', { ...G, body: { content: '  ' } }, 400)
  await expect('GET /api/guest/vitoria/messages (4 messages)', 'GET', '/api/guest/vitoria/messages', G, 200, (d) => d.messages.length === 4)

  // ---------- 19. admin content management ----------
  await expect('GET /api/content', 'GET', '/api/content', A, 200, (d) => d.resources.length === 5)
  await expect('GET /api/content/guides', 'GET', '/api/content/guides', A, 200, (d) => d.length >= 12)
  await expect('GET /api/content/catalog', 'GET', '/api/content/catalog', A, 200, (d) => d.length === 10)
  await expect('GET /api/content/unknown → 404', 'GET', '/api/content/nope', A, 404)
  const newVendor = await expect('POST /api/content/vendors (create)', 'POST', '/api/content/vendors', { ...A, body: { guide_slug: 'beach-bonfires', slug: 'e2e-test-vendor', name: 'E2E Test Vendor', place: 'Seaside, FL', rating: 4.5, review_count: 1, description: 'Temporary vendor', image_url: '/image6.png', price_from: 99 } }, 201, (d) => d.id && d.slug === 'e2e-test-vendor')
  await expect('guest sees 4 bonfire vendors now', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count === 4)
  await expect('PATCH /api/content/vendors/:id', 'PATCH', `/api/content/vendors/${newVendor.id}`, { ...A, body: { rating: 4.8 } }, 200, (d) => Number(d.rating) === 4.8)
  await expect('POST /api/content/vendors (upsert by slug)', 'POST', '/api/content/vendors', { ...A, body: { slug: 'e2e-test-vendor', name: 'E2E Test Vendor (renamed)' } }, 201, (d) => d.id === newVendor.id && d.name.includes('renamed'))
  await expect('DELETE /api/content/vendors/:id', 'DELETE', `/api/content/vendors/${newVendor.id}`, A, 200, (d) => d.deleted === 1)
  await expect('DELETE again → 404', 'DELETE', `/api/content/vendors/${newVendor.id}`, A, 404)
  await expect('guest back to 3 bonfire vendors', 'GET', '/api/guest/explore/vendors/beach-bonfires', G, 200, (d) => d.count === 3)
  await expect('POST /api/content/info (upsert section)', 'POST', '/api/content/info', { ...A, body: { key: 'e2e', title: 'E2E Section', items: ['one', 'two'], sort_order: 99 } }, 201, (d) => d.key === 'e2e')
  await expect('DELETE /api/content/info/e2e', 'DELETE', '/api/content/info/e2e', A, 200)

  // ---------- 20. auth: change password (guest) ----------
  await expect('POST /api/auth/change-password wrong current → 400', 'POST', '/api/auth/change-password', { ...G, body: { current_password: 'wrong-wrong', new_password: 'Guest-New-2026!' } }, 400)
  await expect('POST /api/auth/change-password', 'POST', '/api/auth/change-password', { ...G, body: { current_password: TEST_PASSWORD, new_password: 'Guest-New-2026!' } }, 200, (d) => d.ok)
  await expect('login with new password', 'POST', '/api/guest/login', { body: { email: GUEST.email, password: 'Guest-New-2026!' } }, 200)
  await expect('restore demo password', 'POST', '/api/auth/change-password', { ...G, body: { current_password: 'Guest-New-2026!', new_password: TEST_PASSWORD } }, 200, (d) => d.ok)

  // ---------- 21. final guest state ----------
  await expect('GET /api/guest/me (stats updated)', 'GET', '/api/guest/me', G, 200, (d) => d.stats.transfers >= 2 && d.stats.grocery_orders >= 2 && d.stay_label)
  await expect('GET /api/guest/home (final)', 'GET', '/api/guest/home', G, 200, (d) => Array.isArray(d.orders) && d.unread_count >= 1)

  // ---------- 22. Stripe payments (real test/sandbox API calls, no browser needed) ----------
  // pm_card_visa is Stripe's official test token for a card that always succeeds — this is the
  // documented way to exercise a real PaymentIntent confirmation from a script instead of the
  // Payment Element UI. See https://stripe.com/docs/testing.
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  await expect(
    'POST /api/payments/webhook without signature → 200 skipped (no whsec_ configured yet)',
    'POST',
    '/api/payments/webhook',
    { body: {} },
    200,
    (d) => d.skipped === true
  )

  if (!stripeConfigured) {
    record(true, 'Stripe section skipped — STRIPE_SECRET_KEY not set', 'add test keys to server/.env to run this section')
  } else {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const confirmWithTestCard = (clientSecret) =>
      stripe.paymentIntents.confirm(clientSecret.split('_secret_')[0], { payment_method: 'pm_card_visa' })

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

    // --- 22d. grocery: service-fee authorization + capture, THEN a separate off-session charge
    //          for the exact Publix total once it's known — the two-charge design this app needs.
    const g5 = await expect(
      'POST /api/guest/grocery (G5, for Stripe capture + off-session Publix charge)',
      'POST',
      '/api/guest/grocery',
      { ...G, body: { package: 'full', delivery_time: isoPlusHours(85) } },
      201,
      (d) => d.service_fee === 229
    )
    const g5pay = await expect(
      'POST /api/guest/grocery/:id/pay (G5) authorizes the $229 service fee only',
      'POST',
      `/api/guest/grocery/${g5.id}/pay`,
      { ...G, body: { payment_method: 'card_on_file' } },
      200,
      (d) => Boolean(d.client_secret)
    )
    const g5PiId = g5pay.client_secret.split('_secret_')[0]
    const g5confirm = await confirmWithTestCard(g5pay.client_secret)
    record(g5confirm.status === 'requires_capture', 'stripe.paymentIntents.confirm (G5 service fee) → requires_capture', g5confirm.status)
    await expect('POST /api/guest/grocery/:id/sync-payment (G5)', 'POST', `/api/guest/grocery/${g5.id}/sync-payment`, G, 200, (d) => d.payment_status === 'authorized')
    await expect('POST /api/grocery/:id/assign (G5)', 'POST', `/api/grocery/${g5.id}/assign`, { ...A, body: { shopper_id: ids.shopper } }, 200, (d) => d.status === 'assigned')
    await expect('POST /api/grocery/:id/shopping (G5)', 'POST', `/api/grocery/${g5.id}/shopping`, S, 200)
    await expect('POST /api/grocery/:id/on-the-way (G5)', 'POST', `/api/grocery/${g5.id}/on-the-way`, S, 200)
    const g5delivered = await expect(
      'POST /api/grocery/:id/deliver (G5) captures service fee AND charges the Publix total off-session',
      'POST',
      `/api/grocery/${g5.id}/deliver`,
      { ...S, form: pngForm({ grocery_total: 214.37, payment_method: 'card_on_file' }, { receipt: 'r.png', kitchen_photo: 'k.png' }) },
      200,
      (d) => d.status === 'delivered'
    )
    const g5Intent = await stripe.paymentIntents.retrieve(g5PiId)
    record(g5Intent.status === 'succeeded', 'Stripe confirms G5 service-fee PaymentIntent captured', g5Intent.status)
    const g5Admin = await expect(
      'GET /api/grocery/:id (G5) admin sees both charges captured',
      'GET',
      `/api/grocery/${g5.id}`,
      A,
      200,
      (d) => d.payment_status === 'captured' && d.grocery_payment_status === 'captured' && d.stripe_grocery_payment_intent_id
    )
    const g5GroceryIntent = await stripe.paymentIntents.retrieve(g5Admin.stripe_grocery_payment_intent_id)
    record(
      g5GroceryIntent.status === 'succeeded' && g5GroceryIntent.amount === 21437,
      'Stripe confirms the off-session Publix charge amount matches the receipt exactly ($214.37)',
      `${g5GroceryIntent.status} / $${g5GroceryIntent.amount / 100}`
    )

    // --- 22e. admin refund on a delivered order refunds BOTH Stripe charges ---
    await expect('POST /api/grocery/:id/refund (G5)', 'POST', `/api/grocery/${g5.id}/refund`, A, 200, (d) => d.status === 'refunded' && d.grocery_payment_status === 'refunded')
    const g5ServiceRefunds = await stripe.refunds.list({ payment_intent: g5PiId, limit: 1 })
    const g5GroceryRefunds = await stripe.refunds.list({ payment_intent: g5GroceryIntent.id, limit: 1 })
    record(g5ServiceRefunds.data.length === 1, 'Stripe confirms the service-fee charge was refunded')
    record(g5GroceryRefunds.data.length === 1, 'Stripe confirms the Publix-total charge was refunded too')
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
