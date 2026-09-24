import { supabase } from './supabase.js'

const notConfigured = { skipped: true, reason: 'STRIPE_NOT_CONFIGURED' }

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  const { default: Stripe } = await import('stripe')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || null
}

// One Stripe Customer per guest profile, created lazily and cached on profiles.stripe_customer_id.
export async function ensureStripeCustomer({ userId, email, name }) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  if (error) throw error

  if (profile.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id)
      if (!existing.deleted) return existing.id
    } catch {
      // Customer id is stale (deleted in Stripe or from a different mode/key) — recreate below.
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { my30a_user_id: userId },
  })

  await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId)
  return customer.id
}

// Authorize now, capture later: the card is held (not charged) until the trip/order completes.
// setup_future_usage saves the card on the customer so grocery orders can bill the exact Publix
// total off-session once it's known (see chargeSavedCard below).
export async function createPaymentIntent({ amount, customerId, metadata }) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.paymentIntents.create({
    amount: Math.round(Number(amount) * 100),
    currency: 'usd',
    customer: customerId,
    capture_method: 'manual',
    // Cards only: a transfer is a hold captured after the ride, and only cards support manual
    // capture reliably — bank debits / Pix / wallets that settle later can't be held.
    payment_method_types: ['card'],
    setup_future_usage: 'off_session',
    metadata,
  })
}

// Saves a card for later, off-session use — no hold, no charge, just tokenizes the payment method
// against the customer. Used by grocery orders: the guest saves a card up front and the full
// total (service fee + exact Publix receipt) is charged in one off-session charge once the order
// is actually delivered — see chargeSavedCard below.
export async function createSetupIntent({ customerId }) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    // Cards only — chargeSavedCard bills the saved card off-session at delivery.
    payment_method_types: ['card'],
  })
}

// Charges the guest's most recently saved card without them present in the app — used once the
// exact Publix receipt total is known at grocery delivery. Never throws: a decline or missing
// saved card comes back as { skipped: true, reason } so delivery is never blocked on payment.
export async function chargeSavedCard({ customerId, amount, metadata }) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  if (!customerId) return { skipped: true, reason: 'NO_STRIPE_CUSTOMER' }
  if (!Number.isFinite(amount) || amount <= 0) return { skipped: true, reason: 'INVALID_AMOUNT' }

  try {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
    const paymentMethod = methods.data[0]
    if (!paymentMethod) return { skipped: true, reason: 'NO_SAVED_PAYMENT_METHOD' }

    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethod.id,
      off_session: true,
      confirm: true,
      metadata,
    })
  } catch (error) {
    return { skipped: true, reason: error.message }
  }
}

// null when the id doesn't exist for the current key — e.g. an order paid in TEST mode looked up
// after switching to LIVE keys. Callers treat that as "no payment yet" and start a fresh one.
export async function retrievePaymentIntent(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  if (!id) return null
  try {
    return await stripe.paymentIntents.retrieve(id)
  } catch (error) {
    if (error?.code === 'resource_missing') return null
    throw error
  }
}

export function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY || ''
  return key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : key ? 'test' : 'off'
}

// Captures the full authorized amount, or a partial amount (cancellation / no-show fee): Stripe
// releases whatever is not captured back to the guest's card automatically.
export async function capturePaymentIntent(id, amount) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  if (amount !== undefined && amount !== null) {
    return stripe.paymentIntents.capture(id, { amount_to_capture: Math.round(Number(amount) * 100) })
  }
  return stripe.paymentIntents.capture(id)
}

// Hosted Stripe Checkout page: used for on-the-spot card payments (driver shows the link/QR to
// the guest) and for tips from guests who have no saved card.
export async function createCheckoutSession({ amount, description, metadata, successUrl, cancelUrl, customerId, customerEmail }) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(amount) * 100),
          product_data: { name: description },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : customerEmail || undefined,
    metadata,
    payment_intent_data: { metadata },
  })
}

export async function retrieveCheckoutSession(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  if (!id) return null
  return stripe.checkout.sessions.retrieve(id)
}

export async function refundPaymentIntent(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.refunds.create({ payment_intent: id })
}

// Used when a booking is cancelled: refund if the card was already charged, otherwise just
// release the authorization hold so the guest's card isn't held for no reason.
export async function releasePaymentHold(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  if (!id) return { skipped: true, reason: 'NO_PAYMENT_INTENT' }

  const intent = await stripe.paymentIntents.retrieve(id)
  if (intent.status === 'succeeded') {
    return { action: 'refunded', refund: await stripe.refunds.create({ payment_intent: id }) }
  }
  if (['canceled'].includes(intent.status)) {
    return { action: 'already_canceled' }
  }
  if (['requires_payment_method', 'requires_confirmation'].includes(intent.status)) {
    // Nothing was ever authorized (guest never finished paying) — nothing to release.
    return { action: 'none', status: intent.status }
  }
  return { action: 'canceled', intent: await stripe.paymentIntents.cancel(id) }
}

export function mapIntentStatus(stripeStatus) {
  if (stripeStatus === 'requires_capture') return 'authorized'
  if (stripeStatus === 'succeeded') return 'captured'
  if (stripeStatus === 'canceled') return 'failed'
  return 'pending'
}

export async function constructWebhookEvent(rawBody, signature) {
  const stripe = await getStripe()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
}
