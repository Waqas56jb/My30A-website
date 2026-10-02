// Host Version subscription billing (Stripe Billing). One subscription per host; its quantity is the
// number of properties. Plans: monthly, semi-annual (every 6 months) and annual, priced per
// property in Admin → Settings. Status is read back from Stripe (on dashboard load and daily), so
// no extra webhook events are needed: a lapsed subscription switches the host's QR codes off.
import { supabase } from '../lib/supabase.js'
import { getStripe } from '../lib/stripe.js'
import { pickPublicUrl } from '../lib/urls.js'

export const PLANS = {
  monthly: { label: 'Monthly', interval: 'month', interval_count: 1, months: 1 },
  semiannual: { label: 'Every 6 months', interval: 'month', interval_count: 6, months: 6 },
  annual: { label: 'Annual', interval: 'year', interval_count: 1, months: 12 },
}

// Statuses that keep a host's properties live (past_due = Stripe is still retrying the card).
export const LIVE_STATUSES = ['active', 'trialing', 'past_due']

export function siteUrl() {
  return (pickPublicUrl(process.env.CLIENT_APP_URL, process.env.PUBLIC_APP_URL) || 'https://www.my30ahost.com').replace(/\/$/, '')
}

// Where Stripe sends the host back: the site they came from when it's ours (local dev uses
// localhost), else the live site.
export function returnBase(origin) {
  const o = String(origin || '').replace(/\/$/, '')
  if (/^https:\/\/([a-z0-9-]+\.)*my30ahost\.com$/.test(o) || /^http:\/\/localhost:\d+$/.test(o)) return o
  return siteUrl()
}

export async function hostPrices() {
  const { data } = await supabase.from('settings').select('host_price_monthly, host_price_semiannual, host_price_annual').eq('id', 1).maybeSingle()
  return {
    monthly: Number(data?.host_price_monthly ?? 14.99),
    semiannual: Number(data?.host_price_semiannual ?? 79.99),
    annual: Number(data?.host_price_annual ?? 149.99),
  }
}

export async function planCatalog() {
  const prices = await hostPrices()
  return Object.entries(PLANS).map(([key, plan]) => ({
    key,
    label: plan.label,
    price: prices[key],
    per_month: Number((prices[key] / plan.months).toFixed(2)),
    months: plan.months,
    savings_percent: key === 'monthly' ? 0 : Math.max(0, Math.round((1 - prices[key] / (prices.monthly * plan.months)) * 100)),
  }))
}

async function stripeOrThrow() {
  const stripe = await getStripe()
  if (!stripe) throw Object.assign(new Error('Payments are not set up yet'), { status: 503 })
  return stripe
}

async function ensureCustomer(stripe, sub, profile) {
  if (sub.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(sub.stripe_customer_id)
      if (!existing.deleted) return existing.id
    } catch {
      /* stale id (other Stripe mode) — create a new one */
    }
  }
  const customer = await stripe.customers.create({
    email: profile.email,
    name: sub.company_name || profile.name || undefined,
    metadata: { my30a_host_id: profile.id, kind: 'host' },
  })
  await supabase.from('host_subscriptions').update({ stripe_customer_id: customer.id }).eq('id', sub.id)
  return customer.id
}

// Stripe Checkout (subscription mode) for a host's plan × properties. Returns the hosted page URL.
export async function startCheckout(sub, profile, base = siteUrl()) {
  const stripe = await stripeOrThrow()
  const plan = PLANS[sub.plan] || PLANS.monthly
  const price = (await hostPrices())[sub.plan] ?? 14.99
  const customer = await ensureCustomer(stripe, sub, profile)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [
      {
        quantity: sub.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(price * 100),
          recurring: { interval: plan.interval, interval_count: plan.interval_count },
          product_data: { name: `My30A Host — Host Version (${plan.label.toLowerCase()}, per property)` },
        },
      },
    ],
    allow_promotion_codes: true,
    // Always bill in US dollars (no local-currency conversion for visitors abroad).
    adaptive_pricing: { enabled: false },
    subscription_data: { metadata: { my30a_host_id: profile.id, plan: sub.plan } },
    metadata: { my30a_host_id: profile.id, kind: 'host_subscription' },
    success_url: `${base}/host/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/host?checkout=canceled`,
  })
  await supabase
    .from('host_subscriptions')
    .update({ stripe_checkout_session_id: session.id, unit_amount: price, updated_at: new Date().toISOString() })
    .eq('id', sub.id)
  return session.url
}

function periodEnd(subscription) {
  const end = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end
  return end ? new Date(end * 1000).toISOString() : null
}

async function saveFromStripe(subId, subscription) {
  const item = subscription.items?.data?.[0]
  const { data } = await supabase
    .from('host_subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      quantity: item?.quantity || undefined,
      unit_amount: item?.price?.unit_amount ? item.price.unit_amount / 100 : undefined,
      current_period_end: periodEnd(subscription),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subId)
    .select('*')
    .single()
  return data
}

// After Stripe Checkout redirects back: confirm the session belongs to this host and record it.
export async function confirmCheckout(sub, sessionId) {
  const stripe = await stripeOrThrow()
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
  if (session.metadata?.my30a_host_id !== sub.host_id) throw Object.assign(new Error('This payment belongs to another account'), { status: 403 })
  if (session.status !== 'complete' || !session.subscription) return { sub, paid: false }
  const saved = await saveFromStripe(sub.id, session.subscription)
  return { sub: saved, paid: true }
}

// Re-reads the subscription from Stripe (status, renewal date, quantity).
export async function syncSubscription(sub, { force = false } = {}) {
  if (!sub?.stripe_subscription_id) return sub
  if (!force && sub.synced_at && Date.now() - new Date(sub.synced_at).getTime() < 15 * 60 * 1000) return sub
  const stripe = await getStripe()
  if (!stripe) return sub
  try {
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    return (await saveFromStripe(sub.id, subscription)) || sub
  } catch (error) {
    if (error?.code === 'resource_missing') {
      const { data } = await supabase.from('host_subscriptions').update({ status: 'canceled', synced_at: new Date().toISOString() }).eq('id', sub.id).select('*').single()
      return data || sub
    }
    return sub
  }
}

export async function syncAllSubscriptions() {
  const { data } = await supabase.from('host_subscriptions').select('*').not('stripe_subscription_id', 'is', null)
  let synced = 0
  for (const sub of data || []) {
    await syncSubscription(sub, { force: true })
    synced += 1
  }
  return { synced }
}

// More or fewer properties on the plan (prorated by Stripe on the next invoice).
export async function changeQuantity(sub, quantity) {
  const stripe = await stripeOrThrow()
  if (!sub.stripe_subscription_id) throw Object.assign(new Error('Finish the payment first'), { status: 400 })
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const item = subscription.items.data[0]
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, quantity }],
    proration_behavior: 'create_prorations',
  })
  return saveFromStripe(sub.id, updated)
}

// Stripe's billing page: update card, see invoices, cancel. Creates the portal configuration the
// first time (each Stripe mode / account needs one).
export async function billingPortalUrl(sub, base = siteUrl()) {
  const stripe = await stripeOrThrow()
  if (!sub.stripe_customer_id) throw Object.assign(new Error('No billing account yet — finish the payment first'), { status: 400 })
  const configs = await stripe.billingPortal.configurations.list({ limit: 10, active: true })
  let configuration = configs.data.find((c) => c.metadata?.my30a === 'host')?.id
  if (!configuration) {
    const created = await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'My30A Host — Host Version billing' },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
      },
      metadata: { my30a: 'host' },
    })
    configuration = created.id
  }
  const session = await stripe.billingPortal.sessions.create({ customer: sub.stripe_customer_id, configuration, return_url: `${base}/host` })
  return session.url
}
