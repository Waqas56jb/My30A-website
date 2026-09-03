import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getUnpaidItems, getOwedForUser, getOwedRows, summarize } from '../services/payouts.js'

const router = Router()
router.use(requireAuth)

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

async function loadPayout(id) {
  const { data, error } = await supabase
    .from('payouts')
    .select('*, user:profiles!user_id(id, name, email, roles)')
    .eq('id', id)
    .single()
  if (error) return { error }
  return { payout: data }
}

async function loadItems(payoutId) {
  const { data, error } = await supabase
    .from('payout_items')
    .select(
      `*,
      transfer:transfers(
        trip_number, scheduled_at, completed_at, airport, direction,
        pickup_address, dropoff_address, community:communities(name)
      ),
      grocery_order:grocery_orders(order_number, delivery_time, delivered_at, delivery_address)`
    )
    .eq('payout_id', payoutId)
    .order('created_at')

  if (error) throw error
  return (data || []).map((item) => {
    const transfer = item.transfer
    const grocery = item.grocery_order
    let detail = null
    if (grocery?.delivery_address) {
      detail = grocery.delivery_address
    } else if (transfer) {
      const community = transfer.community?.name || 'Community'
      const airport = transfer.airport || 'Airport'
      if (transfer.direction === 'from_airport') detail = `${airport} → ${community}`
      else if (transfer.direction === 'to_airport') detail = `${community} → ${airport}`
      else if (transfer.pickup_address && transfer.dropoff_address) {
        detail = `${transfer.pickup_address} → ${transfer.dropoff_address}`
      }
    }
    return {
      id: item.id,
      item_type: item.item_type,
      transfer_id: item.transfer_id,
      grocery_order_id: item.grocery_order_id,
      trip_number: transfer?.trip_number || null,
      order_number: grocery?.order_number || null,
      date:
        transfer?.completed_at ||
        transfer?.scheduled_at ||
        grocery?.delivered_at ||
        grocery?.delivery_time ||
        item.created_at,
      detail,
      trip_earnings: money(item.trip_earnings),
      tip_earnings: money(item.tip_earnings),
    }
  })
}

router.get('/owed/:userId', requireRole('admin'), async (req, res, next) => {
  try {
    res.json(await getOwedForUser(req.params.userId))
  } catch (error) {
    next(error)
  }
})

router.get('/owed', requireRole('admin'), async (req, res, next) => {
  try {
    res.json(await getOwedRows())
  } catch (error) {
    next(error)
  }
})

router.get('/mine', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('payouts')
      .select('*')
      .eq('user_id', req.user.id)
      .in('status', ['pending', 'paid'])
      .order('created_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })

    const payouts = []
    for (const payout of data || []) {
      payouts.push({
        ...payout,
        trip_earnings: money(payout.trip_earnings),
        tip_earnings: money(payout.tip_earnings),
        total_amount: money(payout.total_amount),
        cash_collected: money(payout.cash_collected),
        cash_owed_to_admin: money(payout.cash_owed_to_admin),
        items: await loadItems(payout.id),
      })
    }
    res.json(payouts)
  } catch (error) {
    next(error)
  }
})

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { user_id, period_start, period_end, notes } = req.body || {}
    if (!user_id) return res.status(400).json({ error: 'user_id is required' })

    const items = await getUnpaidItems(user_id)
    if (!items.length) return res.status(400).json({ error: 'Nothing owed' })

    const summary = summarize(items)
    const { data: payout, error } = await supabase
      .from('payouts')
      .insert({
        user_id,
        period_start: period_start || null,
        period_end: period_end || null,
        notes: notes || null,
        status: 'pending',
        ...summary,
      })
      .select('*')
      .single()

    if (error) return res.status(400).json({ error: error.message })

    const rows = items.map((item) => ({
      payout_id: payout.id,
      item_type: item.item_type,
      transfer_id: item.transfer_id,
      grocery_order_id: item.grocery_order_id,
      trip_earnings: item.trip_earnings,
      tip_earnings: item.tip_earnings,
    }))

    const { error: itemsError } = await supabase.from('payout_items').insert(rows)
    if (itemsError) return res.status(400).json({ error: itemsError.message })

    res.status(201).json({
      ...payout,
      ...summary,
      items: await loadItems(payout.id),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    let query = supabase
      .from('payouts')
      .select('*, user:profiles!user_id(id, name, email, roles)')
      .order('created_at', { ascending: false })

    if (req.query.user_id) query = query.eq('user_id', req.query.user_id)
    if (req.query.status) query = query.eq('status', req.query.status)

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json(
      (data || []).map((payout) => ({
        ...payout,
        trip_earnings: money(payout.trip_earnings),
        tip_earnings: money(payout.tip_earnings),
        total_amount: money(payout.total_amount),
        cash_collected: money(payout.cash_collected),
        cash_owed_to_admin: money(payout.cash_owed_to_admin),
      }))
    )
  } catch (error) {
    next(error)
  }
})

router.post('/:id/mark-paid', requireRole('admin'), async (req, res, next) => {
  try {
    const { payout, error } = await loadPayout(req.params.id)
    if (error || !payout) return res.status(404).json({ error: 'Payout not found' })
    if (payout.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payouts can be marked paid' })
    }

    const payment_method = req.body?.payment_method
    if (!['zelle', 'cash', 'stripe'].includes(payment_method)) {
      return res.status(400).json({ error: 'payment_method must be zelle, cash, or stripe' })
    }

    const updates = {
      status: 'paid',
      payment_method,
      paid_at: req.body?.paid_at || new Date().toISOString(),
    }
    if (req.body?.notes !== undefined) updates.notes = req.body.notes

    const { data, error: updateError } = await supabase
      .from('payouts')
      .update(updates)
      .eq('id', payout.id)
      .select('*')
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    res.json({ ...data, items: await loadItems(data.id) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { payout, error } = await loadPayout(req.params.id)
    if (error || !payout) return res.status(404).json({ error: 'Payout not found' })
    if (payout.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payouts can be deleted' })
    }

    const { error: deleteError } = await supabase.from('payouts').delete().eq('id', payout.id)
    if (deleteError) return res.status(400).json({ error: deleteError.message })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { payout, error } = await loadPayout(req.params.id)
    if (error || !payout) return res.status(404).json({ error: 'Payout not found' })
    res.json({
      ...payout,
      trip_earnings: money(payout.trip_earnings),
      tip_earnings: money(payout.tip_earnings),
      total_amount: money(payout.total_amount),
      cash_collected: money(payout.cash_collected),
      cash_owed_to_admin: money(payout.cash_owed_to_admin),
      items: await loadItems(payout.id),
    })
  } catch (error) {
    next(error)
  }
})

export default router
