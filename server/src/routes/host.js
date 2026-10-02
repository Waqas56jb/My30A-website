// Host dashboard API (my30ahost.com/host): a property manager on the Host Version subscription
// manages their own properties (My Home info, logo, photo, QR codes), sees guest activity and
// handles billing. Admin keeps full access through /api/homes.
import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase.js'
import { uploadPublicImage } from '../lib/storage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { homeRowFromBody, newHomeSlug } from '../services/hostHomes.js'
import { TOPIC_LABELS, homeStats } from '../services/hostActivity.js'
import { LIVE_STATUSES, PLANS, billingPortalUrl, changeQuantity, confirmCheckout, planCatalog, returnBase, startCheckout, syncSubscription } from '../services/hostBilling.js'

const router = Router()
router.use(requireAuth, requireRole('host'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      cb(Object.assign(new Error('Please upload a JPG, PNG, WebP or SVG image'), { status: 400 }))
      return
    }
    cb(null, true)
  },
})
const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg' }

// Fields a host may set — subscription bookkeeping (plan / paid_until / notes) stays admin-only.
const HOST_FIELDS = [
  'host_name', 'host_tagline', 'home_name', 'address', 'area', 'wifi_network', 'wifi_password', 'door_code', 'parking',
  'check_in_time', 'check_out_time', 'max_guests', 'pets', 'instructions', 'rules', 'contact_label', 'contact_phone',
  'instagram', 'facebook', 'tiktok', 'website_url', 'properties_label', 'airbnb_url', 'vrbo_url', 'is_active',
]
const hostBody = (body = {}) => Object.fromEntries(HOST_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]))

async function loadSub(userId) {
  const { data } = await supabase.from('host_subscriptions').select('*').eq('host_id', userId).maybeSingle()
  return data
}

async function ownedHome(req, res) {
  const { data } = await supabase.from('host_homes').select('*').eq('id', req.params.id).eq('owner_id', req.user.id).maybeSingle()
  if (!data) res.status(404).json({ error: 'Property not found' })
  return data
}

function subView(sub) {
  if (!sub) return null
  return {
    company_name: sub.company_name,
    plan: sub.plan,
    plan_label: PLANS[sub.plan]?.label || sub.plan,
    quantity: sub.quantity,
    status: sub.status,
    live: LIVE_STATUSES.includes(sub.status),
    unit_amount: sub.unit_amount === null ? null : Number(sub.unit_amount),
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
    has_billing: Boolean(sub.stripe_customer_id && sub.stripe_subscription_id),
  }
}

// Dashboard: subscription, properties (with live/over-limit state) and 30-day guest activity.
router.get('/me', async (req, res, next) => {
  try {
    let sub = await loadSub(req.user.id)
    sub = await syncSubscription(sub)
    const { data: homes } = await supabase.from('host_homes').select('*').eq('owner_id', req.user.id).order('created_at')
    const list = homes || []
    const stats = await homeStats(list.map((h) => h.id))
    const live = sub && LIVE_STATUSES.includes(sub.status)
    let slot = 0
    res.json({
      profile: { name: req.user.name, email: req.user.email },
      subscription: subView(sub),
      plans: await planCatalog(),
      topics: TOPIC_LABELS,
      homes: list.map((h) => {
        const covered = h.is_active && slot < (sub?.quantity || 0)
        if (h.is_active) slot += 1
        return { ...h, live: Boolean(live && covered), over_limit: h.is_active && !covered, stats: stats[h.id] }
      }),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/homes/:id/activity', async (req, res, next) => {
  try {
    const home = await ownedHome(req, res)
    if (!home) return
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30))
    const stats = await homeStats([home.id], { days, recent: 40 })
    const { topics, ...rest } = stats[home.id]
    res.json({ days, topic_labels: TOPIC_LABELS, vitoria_topics: topics, ...rest })
  } catch (error) {
    next(error)
  }
})

router.post('/homes', async (req, res, next) => {
  try {
    const sub = await loadSub(req.user.id)
    if (!sub) return res.status(400).json({ error: 'No Host Version plan on this account' })
    const { row, error } = homeRowFromBody({ host_name: sub.company_name, ...hostBody(req.body) }, { creating: true })
    if (error) return res.status(400).json({ error })
    const { data, error: insertError } = await supabase
      .from('host_homes')
      .insert({ ...row, owner_id: req.user.id, plan: sub.plan === 'annual' ? 'annual' : 'monthly', slug: newHomeSlug(row.home_name) })
      .select('*')
      .single()
    if (insertError) return res.status(400).json({ error: insertError.message })
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

router.patch('/homes/:id', async (req, res, next) => {
  try {
    const home = await ownedHome(req, res)
    if (!home) return
    const { row, error } = homeRowFromBody(hostBody(req.body))
    if (error) return res.status(400).json({ error })
    if (!Object.keys(row).length) return res.status(400).json({ error: 'Nothing to update' })
    const { data, error: updateError } = await supabase
      .from('host_homes')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', home.id)
      .select('*')
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/homes/:id/image', upload.single('image'), async (req, res, next) => {
  try {
    const home = await ownedHome(req, res)
    if (!home) return
    const kind = req.query.kind === 'cover' ? 'cover' : 'logo'
    if (!req.file) return res.status(400).json({ error: 'image is required' })
    const url = await uploadPublicImage('brand', req.file.buffer, `homes/${home.id}/${kind}-${Date.now()}.${EXT[req.file.mimetype] || 'jpg'}`, req.file.mimetype)
    const { data, error } = await supabase
      .from('host_homes')
      .update({ [`${kind}_url`]: url, updated_at: new Date().toISOString() })
      .eq('id', home.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/homes/:id/new-link', async (req, res, next) => {
  try {
    const home = await ownedHome(req, res)
    if (!home) return
    const { data, error } = await supabase
      .from('host_homes')
      .update({ slug: newHomeSlug(home.home_name), updated_at: new Date().toISOString() })
      .eq('id', home.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.delete('/homes/:id', async (req, res, next) => {
  try {
    const home = await ownedHome(req, res)
    if (!home) return
    const { error } = await supabase.from('host_homes').delete().eq('id', home.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// ---------- billing ----------

// Pay (or finish paying) for the plan on Stripe Checkout.
router.post('/billing/checkout', async (req, res, next) => {
  try {
    const sub = await loadSub(req.user.id)
    if (!sub) return res.status(400).json({ error: 'No Host Version plan on this account' })
    if (LIVE_STATUSES.includes(sub.status)) return res.status(400).json({ error: 'Your plan is already active' })
    const updates = {}
    if (PLANS[req.body?.plan]) updates.plan = req.body.plan
    const qty = Number(req.body?.quantity)
    if (Number.isInteger(qty) && qty >= 1 && qty <= 500) updates.quantity = qty
    let current = sub
    if (Object.keys(updates).length) {
      const { data } = await supabase.from('host_subscriptions').update(updates).eq('id', sub.id).select('*').single()
      current = data
    }
    res.json({ url: await startCheckout(current, { id: req.user.id, email: req.user.email, name: req.user.name }, returnBase(req.headers.origin)) })
  } catch (error) {
    next(error)
  }
})

router.post('/billing/confirm', async (req, res, next) => {
  try {
    const sub = await loadSub(req.user.id)
    if (!sub) return res.status(400).json({ error: 'No Host Version plan on this account' })
    const sessionId = String(req.body?.session_id || '')
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ error: 'session_id is required' })
    const { sub: saved, paid } = await confirmCheckout(sub, sessionId)
    res.json({ paid, subscription: subView(saved) })
  } catch (error) {
    next(error)
  }
})

router.post('/billing/quantity', async (req, res, next) => {
  try {
    const sub = await loadSub(req.user.id)
    const quantity = Number(req.body?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return res.status(400).json({ error: 'Number of properties must be 1–500' })
    if (!sub || !LIVE_STATUSES.includes(sub.status)) return res.status(400).json({ error: 'Your plan isn’t active yet' })
    res.json({ subscription: subView(await changeQuantity(sub, quantity)) })
  } catch (error) {
    next(error)
  }
})

router.post('/billing/portal', async (req, res, next) => {
  try {
    const sub = await loadSub(req.user.id)
    if (!sub) return res.status(400).json({ error: 'No Host Version plan on this account' })
    res.json({ url: await billingPortalUrl(sub, returnBase(req.headers.origin)) })
  } catch (error) {
    next(error)
  }
})

export default router
