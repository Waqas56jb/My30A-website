const notConfigured = { skipped: true, reason: 'STRIPE_NOT_CONFIGURED' }

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  const { default: Stripe } = await import('stripe')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function capturePaymentIntent(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.paymentIntents.capture(id)
}

export async function refundPaymentIntent(id) {
  const stripe = await getStripe()
  if (!stripe) return notConfigured
  return stripe.refunds.create({ payment_intent: id })
}
