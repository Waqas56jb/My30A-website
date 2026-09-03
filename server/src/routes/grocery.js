import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { calculateGrocerySplit } from '../services/earnings.js'
import { notify } from '../services/notifications.js'
import { capturePaymentIntent, refundPaymentIntent } from '../lib/stripe.js'
import { getSignedUrl, uploadFile } from '../lib/storage.js'

const router = Router()
router.use(requireAuth)

const ORDER_SELECT = `
  *,
  shopper:profiles!shopper_id (id, name, email, roles, is_active)
`

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Images only'))
      return
    }
    cb(null, true)
  },
})

function money(value) {
  if (value === null || value === undefined || value === '') return value
  return Number(value)
}

function appendNote(existing, extra) {
  return [existing, extra].filter(Boolean).join('\n')
}

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

function dayRange(date) {
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

function extensionFor(mimetype) {
  if (mimetype === 'image/png') return 'png'
  if (mimetype === 'image/webp') return 'webp'
  if (mimetype === 'image/gif') return 'gif'
  return 'jpg'
}

async function logStatus(orderId, status, userId) {
  await supabase.from('grocery_status_log').insert({
    order_id: orderId,
    status,
    updated_by: userId,
  })
}

async function loadOrder(id) {
  const { data, error } = await supabase
    .from('grocery_orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .single()
  if (error) return { error }
  return { order: data }
}

async function loadStatusLog(orderId) {
  const { data } = await supabase
    .from('grocery_status_log')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return data || []
}

async function withSignedUrls(order) {
  return {
    ...order,
    receipt_signed_url: await getSignedUrl(order.receipt_url),
    kitchen_signed_url: await getSignedUrl(order.kitchen_photo_url),
  }
}

function adminView(order, extra = {}) {
  return {
    ...order,
    service_fee: money(order.service_fee),
    grocery_total: money(order.grocery_total),
    customer_charge: money(order.customer_charge),
    shopper_payout: money(order.shopper_payout),
    tip_amount: money(order.tip_amount),
    my30ahost_amount: money(order.my30ahost_amount),
    shopper_name: order.shopper?.name || null,
    ...extra,
  }
}

function shopperView(order) {
  const shopper_payout = money(order.shopper_payout) || 0
  const tip_amount = money(order.tip_amount) || 0
  return {
    id: order.id,
    order_number: order.order_number,
    delivery_time: order.delivery_time,
    delivery_address: order.delivery_address,
    package: order.package,
    items: order.items,
    guest_name: order.guest_name,
    guest_phone: order.guest_phone,
    status: order.status,
    shopper_payout,
    tip_amount,
    total: Number((shopper_payout + tip_amount).toFixed(2)),
  }
}

async function getShopper(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, roles, is_active')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function getLatestAgreement(userId, onDate) {
  const { data, error } = await supabase
    .from('compensation_agreements')
    .select('type, value, effective_from')
    .eq('user_id', userId)
    .lte('effective_from', onDate)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { type: data.type, value: Number(data.value) }
}

async function notifyAdmins({ message, grocery_order_id }) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .contains('roles', ['admin'])
    .eq('is_active', true)

  for (const admin of admins || []) {
    await notify({ user_id: admin.id, message, grocery_order_id, email: false })
  }
}

router.get('/mine', requireRole('shopper'), async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    const { start, end } = dayRange(date)
    const { data, error } = await supabase
      .from('grocery_orders')
      .select(ORDER_SELECT)
      .eq('shopper_id', req.user.id)
      .gte('delivery_time', start)
      .lt('delivery_time', end)
      .order('delivery_time', { ascending: true })

    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map(shopperView))
  } catch (error) {
    next(error)
  }
})

router.get('/mine/history', requireRole('shopper'), async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const { start, end } = monthRange(month)
    const { data, error } = await supabase
      .from('grocery_orders')
      .select(ORDER_SELECT)
      .eq('shopper_id', req.user.id)
      .gte('delivery_time', start)
      .lt('delivery_time', end)
      .order('delivery_time', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map(shopperView))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {}
    const required = [
      'guest_name',
      'guest_phone',
      'delivery_address',
      'package',
      'items',
      'delivery_time',
      'shopper_id',
      'service_fee',
      'payment_method',
    ]
    const missing = required.filter((field) => body[field] === undefined || body[field] === '')
    if (missing.length) {
      return res.status(400).json({ error: `Missing: ${missing.join(', ')}` })
    }

    if (!Array.isArray(body.items)) {
      return res.status(400).json({ error: 'items must be an array' })
    }

    const service_fee = money(body.service_fee)
    if (!Number.isFinite(service_fee) || service_fee < 0) {
      return res.status(400).json({ error: 'service_fee must be a number >= 0' })
    }

    const shopper = await getShopper(body.shopper_id)
    if (!shopper || !shopper.is_active || !(shopper.roles || []).includes('shopper')) {
      return res.status(400).json({ error: 'shopper must be an active shopper' })
    }

    const { data, error } = await supabase
      .from('grocery_orders')
      .insert({
        guest_name: body.guest_name,
        guest_phone: body.guest_phone,
        guest_email: body.guest_email || null,
        delivery_address: body.delivery_address,
        community_id: body.community_id || null,
        package: body.package,
        items: body.items,
        delivery_time: body.delivery_time,
        shopper_id: body.shopper_id,
        service_fee,
        grocery_total: 0,
        customer_charge: service_fee,
        payment_method: body.payment_method,
        status: 'assigned',
        notes: body.notes || null,
        created_by: req.user.id,
      })
      .select(ORDER_SELECT)
      .single()

    if (error) return res.status(400).json({ error: error.message })

    await logStatus(data.id, 'assigned', req.user.id)
    await notify({
      user_id: data.shopper_id,
      grocery_order_id: data.id,
      message: `New grocery order #${data.order_number} · ${formatWhen(data.delivery_time)} · ${data.package} · ${data.delivery_address}`,
    })

    res.status(201).json(adminView(await withSignedUrls(data)))
  } catch (error) {
    next(error)
  }
})

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    let query = supabase.from('grocery_orders').select(ORDER_SELECT).order('delivery_time', {
      ascending: false,
    })

    if (req.query.status) query = query.eq('status', req.query.status)
    if (req.query.shopper_id) query = query.eq('shopper_id', req.query.shopper_id)
    if (req.query.is_flagged === 'true') query = query.eq('is_flagged', true)
    if (req.query.is_flagged === 'false') query = query.eq('is_flagged', false)
    if (req.query.date_from) query = query.gte('delivery_time', req.query.date_from)
    if (req.query.date_to) query = query.lte('delivery_time', req.query.date_to)

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })

    const rows = []
    for (const order of data || []) {
      rows.push(adminView(await withSignedUrls(order)))
    }
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/shopping', requireRole('shopper'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (order.shopper_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (order.status !== 'assigned') {
      return res.status(400).json({ error: 'Order must be assigned to start shopping' })
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update({ status: 'shopping', started_at: new Date().toISOString() })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(order.id, 'shopping', req.user.id)
    res.json(shopperView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/on-the-way', requireRole('shopper'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (order.shopper_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (order.status !== 'shopping') {
      return res.status(400).json({ error: 'Order must be shopping to mark on the way' })
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update({ status: 'on_the_way' })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(order.id, 'on_the_way', req.user.id)
    res.json(shopperView(data))
  } catch (error) {
    next(error)
  }
})

router.post(
  '/:id/deliver',
  requireRole('shopper'),
  upload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'kitchen_photo', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { order, error } = await loadOrder(req.params.id)
      if (error || !order) return res.status(404).json({ error: 'Order not found' })
      if (order.shopper_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
      if (order.status !== 'on_the_way') {
        return res.status(400).json({ error: 'Order must be on the way to deliver' })
      }

      const grocery_total = money(req.body?.grocery_total)
      if (!Number.isFinite(grocery_total) || grocery_total < 0) {
        return res.status(400).json({ error: 'grocery_total is required' })
      }

      const payment_method = req.body?.payment_method || order.payment_method
      const receipt = req.files?.receipt?.[0]
      const kitchen = req.files?.kitchen_photo?.[0]
      if (!receipt || !kitchen) {
        return res.status(400).json({ error: 'receipt and kitchen_photo files are required' })
      }

      const receiptPath = `${order.id}/receipt.${extensionFor(receipt.mimetype)}`
      const kitchenPath = `${order.id}/kitchen.${extensionFor(kitchen.mimetype)}`
      await uploadFile(receipt.buffer, receiptPath, receipt.mimetype)
      await uploadFile(kitchen.buffer, kitchenPath, kitchen.mimetype)

      const delivered_at = new Date().toISOString()
      const duration_minutes = Math.max(
        0,
        Math.round((new Date(delivered_at) - new Date(order.started_at)) / 60000)
      )
      const agreement = await getLatestAgreement(order.shopper_id, delivered_at.slice(0, 10))
      if (!agreement) {
        return res.status(400).json({ error: 'Shopper agreement is required' })
      }

      const split = calculateGrocerySplit({
        service_fee: money(order.service_fee),
        agreement,
        duration_minutes,
      })

      const tip = money(req.body?.tip_amount) || 0
      const updates = {
        status: 'delivered',
        delivered_at,
        grocery_total,
        customer_charge: Number((money(order.service_fee) + grocery_total).toFixed(2)),
        shopper_payout: split.shopper_payout,
        my30ahost_amount: split.my30ahost_amount,
        comp_snapshot: split.snapshot,
        tip_amount: tip,
        receipt_url: receiptPath,
        kitchen_photo_url: kitchenPath,
        payment_method,
        is_flagged: false,
        flag_reason: null,
      }

      if (split.warnings.includes('NEGATIVE_PLATFORM_AMOUNT')) {
        updates.is_flagged = true
        updates.flag_reason = 'NEGATIVE_PLATFORM_AMOUNT'
      }

      if (payment_method === 'card_on_file') {
        const capture = await capturePaymentIntent(order.stripe_payment_intent_id)
        if (capture?.skipped) {
          updates.payment_status = 'pending'
          updates.notes = appendNote(order.notes, `Stripe capture skipped: ${capture.reason}`)
        } else {
          updates.payment_status = 'captured'
        }
      } else if (['card', 'apple_pay', 'google_pay', 'cash'].includes(payment_method)) {
        updates.payment_status = 'captured'
      } else {
        return res.status(400).json({ error: 'invalid payment_method' })
      }

      const { data, error: updateError } = await supabase
        .from('grocery_orders')
        .update(updates)
        .eq('id', order.id)
        .select(ORDER_SELECT)
        .single()

      if (updateError) return res.status(400).json({ error: updateError.message })
      await logStatus(order.id, 'delivered', req.user.id)
      await notifyAdmins({
        grocery_order_id: data.id,
        message: `Grocery order #${data.order_number} delivered · Shopper fee: $${split.shopper_payout}`,
      })

      res.json(shopperView(data))
    } catch (error) {
      if (error.message === 'Images only' || error.message === 'Agreement is required') {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  }
)

router.post('/:id/tip', requireRole('shopper', 'admin'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    const isAdmin = (req.user.roles || []).includes('admin')
    if (!isAdmin && order.shopper_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered to add a tip' })
    }

    const tip = money(req.body?.tip_amount)
    if (!Number.isFinite(tip) || tip < 0) {
      return res.status(400).json({ error: 'tip_amount must be a number >= 0' })
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update({ tip_amount: tip })
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    res.json(isAdmin ? adminView(await withSignedUrls(data)) : shopperView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/cancel', requireRole('admin'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (!['assigned', 'shopping', 'on_the_way'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled in this status' })
    }

    const updates = { status: 'cancelled' }
    if (order.status !== 'assigned') {
      updates.is_flagged = true
      updates.flag_reason = 'CANCELLED_AFTER_START'
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update(updates)
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(order.id, 'cancelled', req.user.id)
    res.json(adminView(await withSignedUrls(data)))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/refund', requireRole('admin'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order can only be refunded if delivered' })
    }

    const updates = {
      status: 'refunded',
      payment_status: 'refunded',
    }

    if (order.stripe_payment_intent_id) {
      const refund = await refundPaymentIntent(order.stripe_payment_intent_id)
      if (refund?.skipped) {
        updates.notes = appendNote(order.notes, `Stripe refund skipped: ${refund.reason}`)
      }
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update(updates)
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })
    await logStatus(order.id, 'refunded', req.user.id)
    res.json(adminView(await withSignedUrls(data), { status_log: await loadStatusLog(data.id) }))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/flag', requireRole('admin'), async (req, res, next) => {
  try {
    const reason = req.body?.reason
    if (!reason) return res.status(400).json({ error: 'reason is required' })
    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ is_flagged: true, flag_reason: reason })
      .eq('id', req.params.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(adminView(await withSignedUrls(data)))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/unflag', requireRole('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('grocery_orders')
      .update({ is_flagged: false, flag_reason: null })
      .eq('id', req.params.id)
      .select(ORDER_SELECT)
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(adminView(await withSignedUrls(data)))
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'assigned') {
      return res.status(400).json({ error: 'Order can only be edited while assigned' })
    }

    const body = req.body || {}
    const updates = {}
    const fields = [
      'guest_name',
      'guest_phone',
      'guest_email',
      'delivery_address',
      'community_id',
      'package',
      'items',
      'delivery_time',
      'notes',
      'payment_method',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (body.shopper_id !== undefined) {
      const shopper = await getShopper(body.shopper_id)
      if (!shopper || !shopper.is_active || !(shopper.roles || []).includes('shopper')) {
        return res.status(400).json({ error: 'shopper must be an active shopper' })
      }
      updates.shopper_id = body.shopper_id
    }

    if (body.service_fee !== undefined) {
      const service_fee = money(body.service_fee)
      if (!Number.isFinite(service_fee) || service_fee < 0) {
        return res.status(400).json({ error: 'service_fee must be a number >= 0' })
      }
      updates.service_fee = service_fee
      updates.customer_charge = service_fee
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error: updateError } = await supabase
      .from('grocery_orders')
      .update(updates)
      .eq('id', order.id)
      .select(ORDER_SELECT)
      .single()

    if (updateError) return res.status(400).json({ error: updateError.message })

    if (updates.shopper_id && updates.shopper_id !== order.shopper_id) {
      await notify({
        user_id: updates.shopper_id,
        grocery_order_id: data.id,
        message: `New grocery order #${data.order_number} · ${formatWhen(data.delivery_time)} · ${data.package} · ${data.delivery_address}`,
      })
    }

    res.json(adminView(await withSignedUrls(data)))
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { order, error } = await loadOrder(req.params.id)
    if (error || !order) return res.status(404).json({ error: 'Order not found' })
    res.json(
      adminView(await withSignedUrls(order), { status_log: await loadStatusLog(order.id) })
    )
  } catch (error) {
    next(error)
  }
})

export default router
