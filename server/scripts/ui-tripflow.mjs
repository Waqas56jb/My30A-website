// Browser test for trip flow v2 across all four surfaces: driver dashboard (On the way → Arrived →
// Guest in vehicle → Complete via Zelle, plus chat), guest app tracker (chat + arrived state), the
// no-login public trip + tip pages, and the admin Messages page / Transfers drawer / vehicle toggle.
//   cd server && node scripts/ui-tripflow.mjs   (API on :4000, client on :5173, admin on :5174)
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import Stripe from 'stripe'
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const API = 'http://localhost:4000'
const CLIENT = 'http://localhost:5173'
const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'
const PASSWORD = 'Test-Pass-2026!'
const GUEST = 'guest.demo@example.com'
const DRIVER = 'driver.test@example.com'

const results = []
let failures = 0
const ok = (cond, name, detail = '') => {
  results.push({ ok: Boolean(cond), name })
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function call(method, route, { token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${JSON.stringify(data)}`)
  return data
}

async function passwordToken(email, password) {
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`login ${email}: ${json.error_description || json.msg}`)
  return json.access_token
}

// ---------- setup through the API: a paid, confirmed trip for the demo guest ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const guestLogin = await call('POST', '/api/guest/login', { body: { email: GUEST, password: PASSWORD } })
const G = guestLogin.session.access_token
const A = await passwordToken(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
const users = await call('GET', '/api/users?role=driver', { token: A })
const driver = users.find((u) => u.email === DRIVER)
const vehicle = (await call('GET', '/api/vehicles', { token: A })).find((v) => v.plate === 'E2E-4PAX')
const trip = await call('POST', '/api/guest/transfers', {
  token: G,
  body: { trip_type: 'arrival', airport: 'ECP', vehicle_type: '4pax', scheduled_at: new Date(Date.now() + 3 * 3600e3).toISOString(), passengers: 2, bags: 2, flight_number: 'UA 1234' },
})
const pay = await call('POST', `/api/guest/transfers/${trip.id}/pay`, { token: G, body: { payment_method: 'card_on_file' } })
await stripe.paymentIntents.confirm(pay.client_secret.split('_secret_')[0], { payment_method: 'pm_card_visa' })
await call('POST', `/api/guest/transfers/${trip.id}/sync-payment`, { token: G })
await call('POST', `/api/transfers/${trip.id}/assign`, { token: A, body: { driver_id: driver.id, vehicle_id: vehicle.id } })
const adminView = await call('GET', `/api/transfers/${trip.id}`, { token: A })
const token = adminView.guest_links.chat.split('/trip/')[1]
console.log(`setup: trip #${trip.trip_number} (${trip.id}) assigned, authorized, token ${token.slice(0, 8)}…`)

const browser = await chromium.launch()
try {
  // ---------- Driver dashboard ----------
  const dctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const d = await dctx.newPage()
  const derrors = []
  d.on('pageerror', (e) => derrors.push(e.message))
  await d.goto(`${CLIENT}/login`)
  await d.fill('#email', DRIVER)
  await d.fill('#password', PASSWORD)
  await d.click('button[type="submit"]')
  await d.waitForURL(/\/driver/, { timeout: 20000 })
  const card = d.locator('article.trip', { hasText: `Trip #${trip.trip_number}` }).first()
  await card.waitFor({ timeout: 20000 })
  ok(!(await card.textContent()).includes('850 555'), 'driver card does not show the guest phone number')
  await card.getByRole('button', { name: /On the way/ }).click()
  await card.locator('.pill.live', { hasText: 'On the way' }).waitFor({ timeout: 15000 })
  ok(true, 'driver: On the way → live pill')
  await card.getByRole('button', { name: /Message/ }).click()
  await d.waitForSelector('.chat-input input', { timeout: 10000 })
  await d.fill('.chat-input input', 'I am at door 3, white Fusion')
  await d.click('.chat-input button[type="submit"]')
  await d.locator('.chat-msg.me', { hasText: 'door 3' }).first().waitFor({ timeout: 10000 })
  await d.waitForTimeout(9000) // let one poll cycle pass, then confirm no duplicate bubble
  const dupes = await d.locator('.chat-msg.me', { hasText: 'door 3' }).count()
  ok(dupes === 1, 'driver: sent a chat message from the trip sheet (no duplicate after poll)', `${dupes} bubble(s)`)
  await shot(d, 'v2-driver-chat')
  await d.keyboard.press('Escape')
  await d.waitForTimeout(400)
  await card.getByRole('button', { name: /^Arrived$/ }).click()
  await card.locator('.pill.live', { hasText: 'Arrived' }).waitFor({ timeout: 15000 })
  ok(true, 'driver: Arrived → live pill')
  await shot(d, 'v2-driver-arrived')

  // ---------- Guest app tracker (sees "Driver arrived" + the driver's message, replies) ----------
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const g = await gctx.newPage()
  await g.goto(`${CLIENT}/app/login`)
  await g.fill('input[name="email"]', GUEST)
  await g.fill('input[name="password"]', PASSWORD)
  await g.click('button[type="submit"]')
  await g.waitForURL(/\/app\/home/, { timeout: 20000 })
  await g.goto(`${CLIENT}/app/transfer/track?id=${trip.id}`)
  await g.locator('.app-xfer-tl-item.is-live h3', { hasText: 'Driver arrived' }).waitFor({ timeout: 20000 })
  ok(true, 'guest tracker: "Driver arrived" is the live step')
  await g.locator('.app-chat-msg', { hasText: 'door 3' }).waitFor({ timeout: 15000 })
  ok(true, 'guest tracker: driver message visible in chat')
  await g.fill('.app-chat-form input', 'Coming out now, blue jacket')
  await g.click('.app-chat-form button[type="submit"]')
  await g.locator('.app-chat-msg.is-me', { hasText: 'blue jacket' }).waitFor({ timeout: 10000 })
  ok(true, 'guest tracker: reply sent')
  ok((await g.textContent('body')).includes('Test') && !(await g.textContent('body')).includes('Test Driver'), 'guest sees driver first name only')
  await shot(g, 'v2-guest-tracker-chat')

  // ---------- Public trip page (no login) ----------
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p = await pctx.newPage()
  await p.goto(`${CLIENT}/trip/${token}`)
  await p.locator('.app-xfer-tl-item.is-live h3', { hasText: 'Driver arrived' }).waitFor({ timeout: 20000 })
  await p.locator('.app-chat-msg').nth(1).waitFor({ timeout: 15000 })
  const pubMsgs = await p.locator('.app-chat-msg').count()
  ok(pubMsgs >= 2, 'public trip page shows the conversation without login', `${pubMsgs} messages`)
  await shot(p, 'v2-public-trip')

  // ---------- Driver: Guest in vehicle → Complete (Zelle) ----------
  await card.getByRole('button', { name: /Guest in vehicle/ }).click()
  await card.locator('.pill.live', { hasText: 'Guest on board' }).waitFor({ timeout: 15000 })
  ok(true, 'driver: Guest in vehicle → live pill')
  await card.getByRole('button', { name: /Complete trip/ }).click()
  await d.waitForSelector('.sheet form', { timeout: 10000 })
  const sheetText = await d.textContent('.sheet')
  ok(sheetText.includes('Card on file is authorized'), 'complete sheet: card on file auto-capture notice (no payment choice needed)')
  await d.click('.sheet button[type="submit"]')
  await d.locator('.toast', { hasText: 'Tip request sent' }).waitFor({ timeout: 20000 })
  ok(true, 'driver: completion toast "Trip completed ✔ · Payment recorded · Tip request sent to guest."')
  await shot(d, 'v2-driver-completed')

  // ---------- Public tip page after completion (saved card path) ----------
  await p.reload()
  await p.locator('a.app-xfer-cta', { hasText: /Leave a tip/ }).waitFor({ timeout: 20000 })
  ok(true, 'public trip page: chat closed, "Leave a tip" appears after completion')
  await p.click('a.app-xfer-cta')
  await p.waitForURL(/\/tip\//, { timeout: 15000 })
  await p.locator('.app-xfer-tip', { hasText: '18%' }).waitFor({ timeout: 15000 })
  await p.locator('.app-xfer-tip', { hasText: '18%' }).click()
  await p.locator('button.app-xfer-cta', { hasText: /Leave \$15\.30 Tip/ }).click()
  await p.locator('.app-xfer-hero-title', { hasText: /tip sent/ }).waitFor({ timeout: 30000 })
  ok(true, 'public tip page: $15.30 tip charged to the saved card, thank-you screen shown')
  await shot(p, 'v2-public-tip-done')
  const after = await call('GET', `/api/transfers/${trip.id}`, { token: A })
  ok(after.tip_amount === 15.3 && after.tip_paid_via === 'saved_card' && after.payment_status === 'captured', 'server: tip 15.30 via saved card, fare captured', `${after.tip_amount} / ${after.tip_paid_via} / ${after.payment_status}`)

  // ---------- Admin: Messages page, Transfers drawer, vehicle toggle ----------
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const a = await actx.newPage()
  const aerrors = []
  a.on('pageerror', (e) => aerrors.push(e.message))
  await a.goto(`${ADMIN}/login`)
  await a.fill('input[type="email"]', process.env.ADMIN_EMAIL)
  await a.fill('input[type="password"]', process.env.ADMIN_PASSWORD)
  await a.click('button[type="submit"]')
  await a.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
  await a.goto(`${ADMIN}/messages`)
  await a.fill('input[placeholder^="Search"]', `#${trip.trip_number}`)
  await a.locator('tbody tr', { hasText: 'door 3' }).first().waitFor({ timeout: 20000 })
  // Wait for the filtered result set (every row belongs to this trip) rather than the stale full list.
  await a.waitForFunction(
    (n) => { const rows = [...document.querySelectorAll('tbody tr')]; return rows.length >= 6 && rows.every((r) => r.textContent.includes('#' + n)) },
    trip.trip_number,
    { timeout: 20000 }
  )
  const rows = await a.locator('tbody tr').count()
  ok(rows >= 6, "admin Messages page: only this trip's chat + SMS rows after search", `${rows} rows`)
  await shot(a, 'v2-admin-messages')
  await a.goto(`${ADMIN}/transfers?open=${trip.id}`)
  await a.locator('.comms', { hasText: 'Conversation, SMS & calls' }).waitFor({ timeout: 20000 })
  const drawer = await a.textContent('.drawer')
  ok(drawer.includes('Trip chat') && drawer.includes('Tip page'), 'admin drawer: guest links (chat + tip)')
  ok(drawer.includes('Guest picked up'), 'admin drawer: timeline shows the new statuses')
  await shot(a, 'v2-admin-drawer')
  await a.goto(`${ADMIN}/vehicles`)
  await a.locator('button', { hasText: 'Edit' }).first().click()
  await a.locator('label', { hasText: 'Show vehicle name to guests' }).first().waitFor({ timeout: 10000 })
  ok(true, 'admin vehicles: "show vehicle name" toggle present in the edit form')
  ok(derrors.length === 0 && aerrors.length === 0, 'no page errors (driver + admin)', [...derrors, ...aerrors].join(' | ').slice(0, 200))
} finally {
  await browser.close()
}
console.log(`\n${results.length - failures}/${results.length} UI checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
