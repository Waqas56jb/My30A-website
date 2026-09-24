// Switches PRODUCTION (Vercel) from Stripe test mode to LIVE payments in one run.
// Reads STRIPE_LIVE_SECRET_KEY + STRIPE_LIVE_PUBLISHABLE_KEY from server/.env (local dev and the
// e2e suite keep using the sk_test_/pk_test_ keys), then:
//   1. checks the Stripe account is activated for live card payments and payouts
//   2. creates (or reuses) the LIVE webhook endpoint for the production API
//   3. sets the live keys + webhook secret on Vercel — Production only; Preview stays in test mode
//   4. redeploys the production server and client so they pick them up
//   5. verifies: /api/health reports stripe "live", unsigned webhooks are rejected, and the client
//      bundle carries the live publishable key
// Secret values are never printed — only prefixes.
//   cd server && node scripts/stripe-go-live.js            (add --dry-run to only run the checks)
//   node scripts/stripe-go-live.js --rollback              (Production back to the test keys)
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import Stripe from 'stripe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const API_URL = 'https://my30-a-website-server.vercel.app'
const CLIENT_URL = 'https://www.my30ahost.com'
const PROJECTS = { server: 'my30-a-website-server', client: 'my30-a-website-client' }
const WEBHOOK_EVENTS = [
  'payment_intent.amount_capturable_updated',
  'payment_intent.succeeded',
  'payment_intent.canceled',
  'payment_intent.payment_failed',
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]
const dryRun = process.argv.includes('--dry-run')
const rollback = process.argv.includes('--rollback')
const mask = (v) => (v ? `${String(v).slice(0, 12)}…` : '(missing)')
const step = (msg) => console.log(`\n▶ ${msg}`)
const fail = (msg) => {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

// ---- Vercel CLI helpers (each project linked in its own temp dir; values go in via stdin) ----
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const linked = {}
function vercel(project, args, input) {
  if (!linked[project]) {
    linked[project] = fs.mkdtempSync(path.join(os.tmpdir(), `vl-${project}-`))
    execFileSync(npx, ['vercel', 'link', '--yes', '--project', project], { cwd: linked[project], stdio: 'pipe', shell: process.platform === 'win32' })
  }
  return execFileSync(npx, ['vercel', ...args], {
    cwd: linked[project],
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
}
function setEnv(project, name, value, { sensitive = true } = {}) {
  try {
    vercel(project, ['env', 'rm', name, 'production', '--yes'])
  } catch {
    /* not set yet */
  }
  vercel(project, ['env', 'add', name, 'production', ...(sensitive ? ['--sensitive'] : [])], value)
  console.log(`  ${project}: ${name} = ${mask(value)} (production)`)
}
function redeploy(project) {
  const list = vercel(project, ['ls', '--prod'])
  const url = list.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/)?.[0]
  if (!url) fail(`could not find the current production deployment of ${project}`)
  vercel(project, ['redeploy', url, '--target', 'production'])
  console.log(`  ${project}: redeployed from ${url}`)
}

async function main() {
  const secret = rollback ? process.env.STRIPE_SECRET_KEY : process.env.STRIPE_LIVE_SECRET_KEY
  const publishable = rollback ? process.env.STRIPE_PUBLISHABLE_KEY : process.env.STRIPE_LIVE_PUBLISHABLE_KEY

  step(rollback ? 'Rolling production back to TEST keys' : 'Checking live keys in server/.env')
  if (!secret || !publishable) {
    fail('Add STRIPE_LIVE_SECRET_KEY=sk_live_… and STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_… to server/.env first.')
  }
  const wantPrefix = rollback ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/
  const wantPk = rollback ? /^pk_test_/ : /^pk_live_/
  if (!wantPrefix.test(secret)) fail(`secret key should start with ${rollback ? 'sk_test_' : 'sk_live_'} — got ${mask(secret)}`)
  if (!wantPk.test(publishable)) fail(`publishable key should start with ${rollback ? 'pk_test_' : 'pk_live_'} — got ${mask(publishable)}`)
  console.log(`  secret ${mask(secret)} · publishable ${mask(publishable)}`)

  const stripe = new Stripe(secret)
  const account = await stripe.accounts.retrieve().catch((e) => fail(`Stripe rejected the secret key: ${e.message}`))
  console.log(`  account ${account.id} · ${account.settings?.dashboard?.display_name || account.business_profile?.name || ''}`)
  if (!rollback) {
    const cards = account.capabilities?.card_payments
    console.log(`  charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled} card_payments=${cards}`)
    if (!account.charges_enabled || cards !== 'active') {
      fail('This Stripe account is not activated for live card payments yet. Finish account activation in the Stripe Dashboard (business details, bank account, identity) and run again.')
    }
    if (!account.payouts_enabled) console.log('  ⚠ payouts are not enabled yet — charges work, but Stripe holds the money until a bank account is verified.')
  }

  step('Webhook endpoint for the production API')
  const url = `${API_URL}/api/payments/webhook`
  const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === url)
  let webhookSecret = null
  if (dryRun) {
    console.log(`  ${existing.length ? `exists: ${existing[0].id}` : 'would create'} → ${url}`)
  } else {
    // A signing secret is only shown at creation, so replace any earlier endpoint for this URL.
    for (const old of existing) await stripe.webhookEndpoints.del(old.id)
    const endpoint = await stripe.webhookEndpoints.create({
      url,
      enabled_events: WEBHOOK_EVENTS,
      description: `My30A Host production API (Vercel) — ${rollback ? 'test' : 'LIVE'} mode`,
    })
    webhookSecret = endpoint.secret
    console.log(`  ${endpoint.id} (${endpoint.livemode ? 'live' : 'test'}) → ${url}`)
  }
  if (dryRun) {
    console.log('\nDry run only — nothing changed.')
    return
  }

  step('Vercel environment (Production)')
  setEnv(PROJECTS.server, 'STRIPE_SECRET_KEY', secret)
  setEnv(PROJECTS.server, 'STRIPE_PUBLISHABLE_KEY', publishable)
  setEnv(PROJECTS.server, 'STRIPE_WEBHOOK_SECRET', webhookSecret)
  setEnv(PROJECTS.client, 'VITE_STRIPE_PUBLISHABLE_KEY', publishable)

  step('Redeploying production')
  redeploy(PROJECTS.server)
  redeploy(PROJECTS.client)

  step('Verifying production')
  const health = await fetch(`${API_URL}/api/health`).then((r) => r.json())
  const expected = rollback ? 'test' : 'live'
  console.log(`  ${API_URL}/api/health → stripe: ${health.stripe}`)
  if (health.stripe !== expected) fail(`production reports stripe "${health.stripe}", expected "${expected}" (the server code with /api/health stripe mode must be deployed — push it first)`)
  const unsigned = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  console.log(`  unsigned webhook → ${unsigned.status} (expected 400)`)
  const html = await fetch(`${CLIENT_URL}/app/login`).then((r) => r.text())
  const bundles = [...html.matchAll(/\/assets\/[^"]+\.js/g)].map((m) => m[0])
  let found = false
  for (const b of bundles) {
    const js = await fetch(CLIENT_URL + b).then((r) => r.text())
    if (js.includes(publishable.slice(0, 20))) found = true
  }
  console.log(`  client bundle carries the ${expected} publishable key: ${found}`)
  if (!found) fail('client bundle does not contain the new publishable key yet')
  console.log(`\n✔ Production is on Stripe ${expected.toUpperCase()} mode.`)
}

main().catch((error) => fail(error.message))
