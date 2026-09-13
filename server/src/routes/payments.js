// Stripe webhook: keeps payment_status in sync even if the guest closes the app mid-payment or
// a capture happens outside a normal request. Mounted with a raw body parser BEFORE the global
// express.json() middleware (see app.js) because Stripe signature verification needs the exact
// raw bytes Stripe signed.
import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { constructWebhookEvent, mapIntentStatus } from '../lib/stripe.js'
import { recordTip } from '../services/tripFlow.js'

// Hosted Checkout pages: on-the-spot card payments shown by the driver, and tips paid from the
// no-login tip link. The client-side confirm endpoints do the same thing; this makes it robust
// when the guest closes the page before being redirected back.
async function syncCheckoutSession(session) {
  const transferId = session.metadata?.my30a_transfer_id
  const kind = session.metadata?.kind
  if (!transferId || session.payment_status !== 'paid') return
  const { data: transfer } = await supabase.from('transfers').select('*').eq('id', transferId).maybeSingle()
  if (!transfer) return
  if (kind === 'tip') {
    if (Number(transfer.tip_amount || 0) > 0) return
    await recordTip({ transfer, tip_amount: session.amount_total / 100, via: 'checkout', select: '*' })
  } else if (kind === 'on_the_spot') {
    await supabase
      .from('transfers')
      .update({
        payment_status: 'captured',
        stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : transfer.stripe_payment_intent_id,
      })
      .eq('id', transfer.id)
  }
}

const router = Router()

async function syncByPaymentIntent(paymentIntent, status) {
  const id = paymentIntent.id
  const { data: transfer } = await supabase
    .from('transfers')
    .select('id, status, payment_status')
    .eq('stripe_payment_intent_id', id)
    .maybeSingle()
  if (transfer && transfer.payment_status !== 'captured') {
    await supabase.from('transfers').update({ payment_status: status }).eq('id', transfer.id)
    return
  }

  const { data: order } = await supabase
    .from('grocery_orders')
    .select('id, status, payment_status')
    .eq('stripe_payment_intent_id', id)
    .maybeSingle()
  if (order && order.payment_status !== 'captured') {
    await supabase.from('grocery_orders').update({ payment_status: status }).eq('id', order.id)
  }
}

router.post('/webhook', async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Not configured yet (no public URL / whsec_ key from Stripe) — ack so Stripe doesn't retry
    // forever; the /sync-payment fallback endpoints keep local dev/testing working meanwhile.
    return res.status(200).json({ skipped: true, reason: 'STRIPE_WEBHOOK_SECRET not set' })
  }

  let event
  try {
    event = await constructWebhookEvent(req.body, req.headers['stripe-signature'])
  } catch (error) {
    console.log('Stripe webhook signature check failed:', error.message)
    return res.status(400).send(`Webhook Error: ${error.message}`)
  }

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
      case 'payment_intent.succeeded':
      case 'payment_intent.canceled':
      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        const status =
          event.type === 'payment_intent.payment_failed' ? 'failed' : mapIntentStatus(intent.status)
        await syncByPaymentIntent(intent, status)
        break
      }
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await syncCheckoutSession(event.data.object)
        break
      default:
        break
    }
    res.json({ received: true })
  } catch (error) {
    console.log('Stripe webhook handling error:', error.message)
    res.status(500).json({ error: 'Webhook handling failed' })
  }
})

export default router
