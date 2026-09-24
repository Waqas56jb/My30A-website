// End-to-end test of the booking CHECKOUT (card on file) against Stripe TEST mode:
//   near trip → card saved + hold placed before booking → captured at ride completion
//   far trip → card saved, no hold, no "authorize" prompt, not auto-expired
//   declined card → 402 and NO booking created
//   3-D Secure card → 402 requires_action with a client secret (the app shows the bank check)
//   someone else's card → rejected
//   grocery → card saved at checkout, order placed, charged once at delivery
//   holiday fee added after booking → hold captured + the difference charged to the saved card
// Refuses to run when the target API reports Stripe LIVE mode (never charges real cards).
//   cd server && node scripts/e2e-checkout.mjs            (API :4000; E2E_API_URL to override)
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const API = process.env.E2E_API_URL || 'http://localhost:4000'
const PASSWORD = 'Test-Pass-2026!'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let pass = 0
let fail = 0
const ok = (cond, name, detail = '') => {
  cond ? (pass += 1) : (fail += 1)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
async function call(method, url, { token, body, form } = {}) {
  const res = await fetch(API + url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}
async function supaToken(email) {
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: email === process.env.ADMIN_EMAIL ? process.env.ADMIN_PASSWORD : PASSWORD }),
  }).then((x) => x.json())
  if (!r.access_token) throw new Error(`login failed ${email}`)
  return r.access_token
}
const inHours = (h) => new Date(Date.now() + h * 3600000).toISOString()
// A card saved through checkout: SetupIntent from our API, confirmed with a Stripe test token.
async function saveCard(G, testToken) {
  const setup = await call('POST', '/api/guest/checkout/setup', { token: G })
  try {
    const si = await stripe.setupIntents.confirm(setup.data.client_secret.split('_secret_')[0], { payment_method: testToken, return_url: 'https://www.my30ahost.com' })
    return { status: si.status, pm: typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id }
  } catch (error) {
    return { status: 'declined', error: error.message }
  }
}
const tinyPng = () =>
  new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' })

const health = await fetch(`${API}/api/health`).then((r) => r.json())
if (health.stripe !== 'test' || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.log(`Refusing to run: API Stripe mode is "${health.stripe}" (this suite only runs against TEST mode).`)
  process.exit(1)
}

const login = await call('POST', '/api/guest/login', { body: { email: 'guest.demo@example.com', password: PASSWORD } })
const G = login.data.session.access_token
const A = await supaToken(process.env.ADMIN_EMAIL)
const D = await supaToken('driver.test@example.com')
const S = await supaToken('shopper.test@example.com')
const { data: driver } = await db.from('profiles').select('id').eq('email', 'driver.test@example.com').single()
const { data: shopper } = await db.from('profiles').select('id').eq('email', 'shopper.test@example.com').single()
const { data: vehicle } = await db.from('vehicles').select('id').eq('plate', 'E2E-4PAX').single()
const transferBody = (hours, extra = {}) => ({ trip_type: 'departure', airport: 'ECP', vehicle_type: '4pax', scheduled_at: inHours(hours), passengers: 2, bags: 2, payment_method: 'card_on_file', ...extra })
const countTransfers = async () => (await call('GET', '/api/guest/transfers', { token: G })).data.length

// ---- saved cards + setup ----
const pms = await call('GET', '/api/guest/payment-methods', { token: G })
ok(pms.status === 200 && pms.data.configured === true && Array.isArray(pms.data.cards), 'GET /payment-methods lists saved cards', `${pms.data.cards?.length} cards`)
const visa = await saveCard(G, 'pm_card_visa')
ok(visa.status === 'succeeded' && visa.pm?.startsWith('pm_'), 'checkout/setup + confirm → card saved', visa.pm)

// ---- 1. near trip: hold before booking, capture at completion ----
const near = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(30, { payment_method_id: visa.pm, checkout_key: `t-${Date.now()}` }) })
ok(near.status === 201 && near.data.payment_status === 'authorized' && near.data.card_on_file && /Visa •••• 4242/.test(near.data.card_label), 'near trip booked with hold authorized', `${near.status} ${near.data.payment_status} ${near.data.card_label}`)
const { data: nearRow } = await db.from('transfers').select('stripe_payment_intent_id, customer_charge').eq('id', near.data.id).single()
const nearPi = await stripe.paymentIntents.retrieve(nearRow.stripe_payment_intent_id)
ok(nearPi.status === 'requires_capture' && nearPi.amount === Math.round(nearRow.customer_charge * 100), 'Stripe hold = exact price, not charged yet', `${nearPi.status} $${nearPi.amount / 100}`)
await call('POST', `/api/transfers/${near.data.id}/assign`, { token: A, body: { driver_id: driver.id, vehicle_id: vehicle.id } })
await call('POST', `/api/transfers/${near.data.id}/start`, { token: D })
const done = await call('POST', `/api/transfers/${near.data.id}/complete`, { token: D, body: { payment_method: 'card_on_file', tip_amount: 0 } })
const nearAfter = await stripe.paymentIntents.retrieve(nearRow.stripe_payment_intent_id)
ok(done.status === 200 && done.data.payment_status === 'captured' && nearAfter.status === 'succeeded', 'ride completed → hold captured', `${done.status} ${nearAfter.status}`)

// ---- 2. far trip: card on file, no hold yet, no expiry ----
const far = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(24 * 12, { payment_method_id: visa.pm, checkout_key: `f-${Date.now()}` }) })
const { data: farRow } = await db.from('transfers').select('stripe_payment_intent_id, stripe_payment_method_id').eq('id', far.data.id).single()
ok(far.status === 201 && far.data.payment_status === 'pending' && far.data.card_on_file && !farRow.stripe_payment_intent_id && farRow.stripe_payment_method_id === visa.pm, 'far trip booked with card on file, hold deferred', `${far.status} ${far.data.payment_status}`)
const jobs = await call('POST', '/api/jobs/run', { token: A })
ok(jobs.status === 200 && !jobs.data.expire_unauthorized_holds.expired.includes(far.data.id) && !jobs.data.upcoming_holds.held.includes(far.data.id), 'daily job: far trip neither expired nor held yet')
// Bring it inside the 5-day window → the job places the hold off-session.
await db.from('transfers').update({ scheduled_at: inHours(72) }).eq('id', far.data.id)
const jobs2 = await call('POST', '/api/jobs/run', { token: A })
const { data: farHeld } = await db.from('transfers').select('payment_status, stripe_payment_intent_id').eq('id', far.data.id).single()
ok(jobs2.data.upcoming_holds.held.includes(far.data.id) && farHeld.payment_status === 'authorized', 'within 5 days → job places the hold on the saved card', farHeld.payment_status)
await call('POST', `/api/guest/transfers/${far.data.id}/cancel`, { token: G })

// ---- 3. declined cards → nothing booked ----
const rejected = await saveCard(G, 'pm_card_chargeDeclined')
ok(rejected.status === 'declined', 'declined card is rejected while saving (error shown in the card form)', rejected.error)
// Saves fine, but every charge fails → the hold is declined at checkout.
const declined = await saveCard(G, 'pm_card_chargeCustomerFail')
const before = await countTransfers()
const bad = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(30, { payment_method_id: declined.pm, checkout_key: `d-${Date.now()}` }) })
const after = await countTransfers()
ok(bad.status === 402 && /declined/i.test(bad.data.error) && before === after, 'declined card → 402, no booking created', `${bad.status} "${bad.data.error}"`)

// ---- 4. 3-D Secure card → requires_action ----
const sca = await saveCard(G, 'pm_card_authenticationRequiredOnSetup')
if (sca.status === 'succeeded') {
  const r = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(30, { payment_method_id: sca.pm, checkout_key: `s-${Date.now()}` }) })
  ok(r.status === 402 && r.data.requires_action && r.data.client_secret?.includes('_secret_'), '3-D Secure → requires_action + client secret for the bank check', `${r.status}`)
  if (r.data.client_secret) await stripe.paymentIntents.cancel(r.data.client_secret.split('_secret_')[0]).catch(() => {})
} else {
  // Setup itself needed 3-D Secure (the app shows it inside the card form) — nothing booked.
  ok(sca.status === 'requires_action', '3-D Secure at card setup → bank check shown in the card form', sca.status)
}

// ---- 5. someone else's card ----
const foreign = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })
const stolen = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(30, { payment_method_id: foreign.id }) })
ok(stolen.status === 400, 'card not saved on this guest → rejected', `${stolen.status} "${stolen.data.error}"`)

// ---- 6. grocery: card at checkout, one charge at delivery ----
const order = await call('POST', '/api/guest/grocery', { token: G, body: { package: 'full', stocking: 'full-kitchen', delivery_time: inHours(28), items: ['Eggs'], payment_method: 'card_on_file', payment_method_id: visa.pm } })
ok(order.status === 201 && order.data.card_saved && /Visa/.test(order.data.card_label), 'grocery order placed with saved card, nothing charged', `${order.status} ${order.data.card_label}`)
await call('POST', `/api/grocery/${order.data.id}/assign`, { token: A, body: { shopper_id: shopper.id } })
await call('POST', `/api/grocery/${order.data.id}/shopping`, { token: S })
await call('POST', `/api/grocery/${order.data.id}/on-the-way`, { token: S })
const form = new FormData()
form.append('grocery_total', '150.25')
form.append('payment_method', 'card_on_file')
form.append('receipt', tinyPng(), 'r.png')
form.append('kitchen_photo', tinyPng(), 'k.png')
const delivered = await call('POST', `/api/grocery/${order.data.id}/deliver`, { token: S, form })
const { data: orderRow } = await db.from('grocery_orders').select('stripe_payment_intent_id, customer_charge, payment_status').eq('id', order.data.id).single()
const groceryPi = orderRow.stripe_payment_intent_id ? await stripe.paymentIntents.retrieve(orderRow.stripe_payment_intent_id) : null
ok(delivered.status === 200 && groceryPi?.status === 'succeeded' && groceryPi.amount === Math.round(orderRow.customer_charge * 100) && groceryPi.payment_method === visa.pm, 'delivered → one charge (fee + Publix) on the checkout card', `$${groceryPi?.amount / 100}`)

// ---- 7. holiday fee after booking: hold captured + difference charged ----
const hol = await call('POST', '/api/guest/transfers', { token: G, body: transferBody(30, { payment_method_id: visa.pm, checkout_key: `h-${Date.now()}` }) })
await call('POST', `/api/transfers/${hol.data.id}/holiday-fee`, { token: A, body: { apply: true } })
await call('POST', `/api/transfers/${hol.data.id}/assign`, { token: A, body: { driver_id: driver.id, vehicle_id: vehicle.id } })
await call('POST', `/api/transfers/${hol.data.id}/start`, { token: D })
const holDone = await call('POST', `/api/transfers/${hol.data.id}/complete`, { token: D, body: { payment_method: 'card_on_file', tip_amount: 0 } })
const { data: holRow } = await db.from('transfers').select('customer_charge, stripe_payment_intent_id, notes').eq('id', hol.data.id).single()
const extra = holRow.notes?.match(/extra charged \((pi_[A-Za-z0-9]+)\)/)?.[1]
const extraPi = extra ? await stripe.paymentIntents.retrieve(extra) : null
const holdPi = await stripe.paymentIntents.retrieve(holRow.stripe_payment_intent_id)
ok(holDone.status === 200 && holdPi.status === 'succeeded' && extraPi?.status === 'succeeded' && (holdPi.amount_received + extraPi.amount) === Math.round(holRow.customer_charge * 100), 'holiday fee → hold captured + $40 difference charged', `$${holdPi.amount_received / 100} + $${(extraPi?.amount || 0) / 100}`)

console.log(`\n${pass}/${pass + fail} checkout checks passed${fail ? `, ${fail} FAILED` : ''}.`)
process.exit(fail ? 1 : 0)
