// End-to-end test of the booking CHECKOUT (card on file) against Stripe TEST mode:
//   near trip → card saved + hold placed before booking → captured at ride completion
//   far trip → card saved, no hold, no "authorize" prompt, not auto-expired
//   declined card → 402 and NO booking created
//   3-D Secure card → 402 requires_action with a client secret (the app shows the bank check)
//   someone else's card → rejected
//   grocery → Publix cart + buffer prepaid at checkout; one settlement at delivery (charge or refund);
//             rush orders pay a rush fee + trigger an Instant Payout; cancel refunds the prepayment
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

// ---- 6. grocery prepayment: cart + buffer charged at checkout, one settlement at delivery ----
const policyRow = (await db.from('settings').select('grocery_buffer_percent, grocery_rush_fee_percent, grocery_min_notice_hours').eq('id', 1).single()).data
const BUF = Number(policyRow.grocery_buffer_percent)
const RUSH = Number(policyRow.grocery_rush_fee_percent)
const r2 = (n) => Math.round(n * 100) / 100
const groceryBody = (hours, extra = {}) => ({ package: 'full', stocking: 'full-kitchen', delivery_time: inHours(hours), items: ['Eggs'], payment_method: 'card_on_file', payment_method_id: visa.pm, checkout_key: `g-${Date.now()}-${Math.random()}`, ...extra })
const countOrders = async () => (await call('GET', '/api/guest/grocery', { token: G })).data.length
async function deliverOrder(id, total) {
  await call('POST', `/api/grocery/${id}/assign`, { token: A, body: { shopper_id: shopper.id } })
  await call('POST', `/api/grocery/${id}/shopping`, { token: S })
  await call('POST', `/api/grocery/${id}/on-the-way`, { token: S })
  const f = new FormData()
  f.append('grocery_total', String(total))
  f.append('payment_method', 'card_on_file')
  f.append('receipt', tinyPng(), 'r.png')
  f.append('kitchen_photo', tinyPng(), 'k.png')
  return call('POST', `/api/grocery/${id}/deliver`, { token: S, form: f })
}
const orderRow = async (id) => (await db.from('grocery_orders').select('*').eq('id', id).single()).data

// quote shows the same numbers the app shows
const gq = await call('POST', '/api/guest/grocery/quote', { token: G, body: { package: 'full', stocking: 'full-kitchen', cart_estimate: 300, delivery_time: inHours(24 * 5) } })
ok(gq.status === 200 && gq.data.prepay?.prepay_amount === r2(300 * (1 + BUF / 100)) && gq.data.prepay.is_rush === false && gq.data.policy.buffer_percent === BUF, 'grocery quote: cart + buffer, not rush at 5 days', `$${gq.data.prepay?.prepay_amount}`)

// no cart total → rejected, nothing created
const beforeNoCart = await countOrders()
const noCart = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5) })
ok(noCart.status === 400 && /cart total/i.test(noCart.data.error) && (await countOrders()) === beforeNoCart, 'grocery without Publix cart total → 400, no order', `${noCart.status}`)

// standard order: prepaid now, receipt below the estimate → fee minus the unused buffer
const std = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5, { cart_estimate: 300 }) })
const stdRow = await orderRow(std.data.id)
const stdPi = stdRow?.stripe_grocery_payment_intent_id ? await stripe.paymentIntents.retrieve(stdRow.stripe_grocery_payment_intent_id) : null
ok(std.status === 201 && stdPi?.status === 'succeeded' && stdPi.amount === Math.round(r2(300 * (1 + BUF / 100)) * 100) && stdPi.payment_method === visa.pm && stdRow.is_rush === false && Number(stdRow.rush_fee) === 0 && !stdRow.instant_payout_status, `standard order → $300 cart + ${BUF}% charged at checkout, no rush fee`, `$${stdPi?.amount / 100}`)
const stdDone = await deliverOrder(std.data.id, 305.4)
const stdAfter = await orderRow(std.data.id)
const stdDue = r2(Number(stdAfter.service_fee) + 305.4 - Number(stdAfter.grocery_prepaid))
const stdSettle = stdAfter.stripe_payment_intent_id ? await stripe.paymentIntents.retrieve(stdAfter.stripe_payment_intent_id) : null
ok(stdDone.status === 200 && Number(stdAfter.settlement_amount) === stdDue && stdSettle?.status === 'succeeded' && stdSettle.amount === Math.round(stdDue * 100) && stdAfter.payment_status === 'captured', 'delivered under estimate → one settlement = fee − unused buffer', `fee $${stdAfter.service_fee} → charged $${stdDue}`)
ok(Number(stdAfter.customer_charge) === r2(Number(stdAfter.service_fee) + 305.4) && stdPi.amount + stdSettle.amount === Math.round(Number(stdAfter.customer_charge) * 100), 'prepay + settlement = service fee + exact receipt (no double charge)', `$${(stdPi.amount + stdSettle.amount) / 100}`)

// receipt above the estimate → fee + the difference
const over = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5, { cart_estimate: 100 }) })
await deliverOrder(over.data.id, 130)
const overAfter = await orderRow(over.data.id)
const overSettle = overAfter.stripe_payment_intent_id ? await stripe.paymentIntents.retrieve(overAfter.stripe_payment_intent_id) : null
ok(overSettle?.status === 'succeeded' && overSettle.amount === Math.round(r2(Number(overAfter.service_fee) + 130 - r2(100 * (1 + BUF / 100))) * 100), 'receipt over the estimate → fee + difference charged', `$${overSettle?.amount / 100}`)

// huge cart where the unused buffer is bigger than the fee → only then a partial refund
const big = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5, { cart_estimate: 5000 }) })
await deliverOrder(big.data.id, 4600)
const bigAfter = await orderRow(big.data.id)
const bigPi = await stripe.paymentIntents.retrieve(bigAfter.stripe_grocery_payment_intent_id, { expand: ['latest_charge'] })
const bigDue = r2(Number(bigAfter.service_fee) + 4600 - Number(bigAfter.grocery_prepaid))
ok(bigDue < 0 && Number(bigAfter.settlement_amount) === bigDue && bigPi.latest_charge.amount_refunded === Math.round(-bigDue * 100) && !bigAfter.stripe_payment_intent_id, 'credit bigger than the fee → the rest refunded, no extra charge', `refunded $${bigPi.latest_charge.amount_refunded / 100}`)

// rush order: rush fee shown + charged, Instant Payout attempted and recorded
const rush = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(28, { cart_estimate: 200 }) })
const rushRow = await orderRow(rush.data.id)
const rushPi = await stripe.paymentIntents.retrieve(rushRow.stripe_grocery_payment_intent_id)
ok(rush.status === 201 && rushRow.is_rush && Number(rushRow.rush_fee) === r2(200 * RUSH / 100) && rushPi.amount === Math.round(r2(200 * (1 + BUF / 100) + 200 * RUSH / 100) * 100), `rush order (<${policyRow.grocery_min_notice_hours}h) → ${RUSH}% rush fee added to the prepayment`, `$${rushPi.amount / 100} incl. $${rushRow.rush_fee}`)
const { data: payoutNote } = await db.from('notifications').select('message').eq('grocery_order_id', rush.data.id).ilike('message', '%Instant Payout%').limit(1)
ok(['sent', 'failed'].includes(rushRow.instant_payout_status) && payoutNote?.length === 1, 'rush → Instant Payout attempted, result saved + admin notified', `${rushRow.instant_payout_status}${rushRow.instant_payout_error ? `: ${rushRow.instant_payout_error}` : ''}`)

// guest cancels before shopping → prepayment refunded in full
const cancelled = await call('POST', `/api/guest/grocery/${rush.data.id}/cancel`, { token: G })
const rushRefund = await stripe.paymentIntents.retrieve(rushRow.stripe_grocery_payment_intent_id, { expand: ['latest_charge'] })
const cancelRow = await orderRow(rush.data.id)
ok(cancelled.status === 200 && cancelRow.grocery_payment_status === 'refunded' && rushRefund.latest_charge.refunded === true, 'cancelled before shopping → prepayment refunded in full', `$${rushRefund.latest_charge.amount_refunded / 100}`)

// declined card → 402, no order
const beforeDecl = await countOrders()
const declined2 = await saveCard(G, 'pm_card_chargeCustomerFail') // the transfer test above removed the first one
const gBad = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5, { cart_estimate: 120, payment_method_id: declined2.pm }) })
ok(gBad.status === 402 && (await countOrders()) === beforeDecl, 'grocery with declined card → 402, no order created', `${gBad.status} "${gBad.data.error}"`)

// 3-D Secure → requires_action, then no order until approved
if (sca.status === 'succeeded') {
  const gSca = await call('POST', '/api/guest/grocery', { token: G, body: groceryBody(24 * 5, { cart_estimate: 90, payment_method_id: sca.pm }) })
  ok(gSca.status === 402 && gSca.data.requires_action && gSca.data.client_secret?.includes('_secret_'), 'grocery 3-D Secure → requires_action for the bank check', `${gSca.status}`)
  if (gSca.data.client_secret) await stripe.paymentIntents.cancel(gSca.data.client_secret.split('_secret_')[0]).catch(() => {})
}

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
