// Grocery money flow (client decision, Sep 2026) — My30A Host never shops with its own money:
//   1. Checkout: the guest enters their Publix cart total (tax included). We charge it + a buffer
//      (default 5%, for weighed items and substitutions) right away. Orders with less than the
//      minimum notice (default 72h) are rush orders: + a rush fee (default 2% of the cart) that
//      covers a Stripe Instant Payout of the prepayment to the owner's bank.
//   2. Delivery: one settlement against the real receipt — service fee + receipt − prepaid. The
//      unused buffer is netted against the service fee, so there's normally nothing to refund
//      (Stripe keeps its fee on refunds); only if the credit ever exceeds the fee is the rest refunded.
//   3. Cancelled before shopping: the prepayment is refunded in full.
// The percentages live in the settings row (Admin → Settings).
import { supabase } from '../lib/supabase.js'
import { instantPayout, refundAmount } from '../lib/stripe.js'
import { notify } from './notifications.js'

const round2 = (n) => Math.round(Number(n) * 100) / 100
export const STRIPE_MIN_CHARGE = 0.5

export async function groceryPolicy() {
  const { data } = await supabase
    .from('settings')
    .select('grocery_buffer_percent, grocery_rush_fee_percent, grocery_min_notice_hours, grocery_instant_payouts')
    .eq('id', 1)
    .maybeSingle()
  return {
    buffer_percent: Number(data?.grocery_buffer_percent ?? 5),
    rush_fee_percent: Number(data?.grocery_rush_fee_percent ?? 2),
    min_notice_hours: Number(data?.grocery_min_notice_hours ?? 72),
    instant_payouts: data?.grocery_instant_payouts ?? true,
  }
}

// What the guest pays at checkout. `cart_estimate` is the Publix cart total they entered.
export function prepayQuote({ cart_estimate, delivery_time, policy, now = Date.now() }) {
  const cart = round2(cart_estimate)
  const hours = (new Date(delivery_time).getTime() - now) / 3600000
  const is_rush = Number.isFinite(hours) && hours < policy.min_notice_hours
  const buffer_amount = round2((cart * policy.buffer_percent) / 100)
  const grocery_prepaid = round2(cart + buffer_amount)
  const rush_fee = is_rush ? round2((cart * policy.rush_fee_percent) / 100) : 0
  return {
    cart_estimate: cart,
    buffer_percent: policy.buffer_percent,
    buffer_amount,
    grocery_prepaid,
    is_rush,
    rush_fee_percent: policy.rush_fee_percent,
    rush_fee,
    prepay_amount: round2(grocery_prepaid + rush_fee),
    min_notice_hours: policy.min_notice_hours,
    hours_notice: Number.isFinite(hours) ? Math.round(hours) : null,
  }
}

// Delivery settlement: positive = charge the saved card, negative = refund part of the prepayment.
export function settlement({ service_fee, grocery_total, grocery_prepaid }) {
  return round2(Number(service_fee) + Number(grocery_total) - Number(grocery_prepaid))
}

export const isPrepaid = (order) => Boolean(order?.stripe_grocery_payment_intent_id) && Number(order?.grocery_prepaid) > 0

// Refunds whatever is left of the prepayment (cancellation before shopping). Never throws.
export async function refundPrepayment(order) {
  if (!isPrepaid(order) || order.grocery_payment_status !== 'captured') return { skipped: true, reason: 'NOT_PREPAID' }
  const refund = await refundAmount(order.stripe_grocery_payment_intent_id, order.prepay_amount, {
    my30a_grocery_order_id: order.id,
    kind: 'grocery_prepay_refund',
  })
  return refund
}

async function notifyAdmins(message, grocery_order_id) {
  const { data: admins } = await supabase.from('profiles').select('id').contains('roles', ['admin']).eq('is_active', true)
  for (const admin of admins || []) await notify({ user_id: admin.id, message, grocery_order_id })
}

// Rush order: move the prepayment to the owner's bank within minutes so the shopper has the money
// on shopping day. Records the result on the order and tells the admins either way.
export async function runInstantPayout(order, policy) {
  if (!order?.is_rush || !isPrepaid(order)) return null
  if (!policy.instant_payouts) {
    await supabase.from('grocery_orders').update({ instant_payout_status: 'skipped', instant_payout_error: 'Instant Payouts are turned off in Settings.' }).eq('id', order.id)
    return null
  }
  const result = await instantPayout({
    amount: order.grocery_prepaid,
    description: `My30A grocery #${order.order_number}`,
    metadata: { my30a_grocery_order_id: order.id, kind: 'grocery_rush_payout' },
  })
  if (result?.payout) {
    await supabase
      .from('grocery_orders')
      .update({ instant_payout_id: result.payout.id, instant_payout_status: 'sent', instant_payout_amount: result.amount, instant_payout_error: null })
      .eq('id', order.id)
    await notifyAdmins(`Rush grocery #${order.order_number}: Instant Payout $${result.amount.toFixed(2)} sent to your bank for shopping.`, order.id)
  } else {
    const reason = result?.reason || 'Unknown error'
    await supabase.from('grocery_orders').update({ instant_payout_status: 'failed', instant_payout_error: reason }).eq('id', order.id)
    await notifyAdmins(
      `⚠️ Rush grocery #${order.order_number}: the Instant Payout did not go through (${reason}). The guest has prepaid $${Number(order.grocery_prepaid).toFixed(2)} — it will reach your bank with Stripe's normal payout, or send it instantly from the Stripe dashboard.`,
      order.id
    )
  }
  return result
}
