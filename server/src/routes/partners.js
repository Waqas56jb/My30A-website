// Admin → Partners: review partner requests (approve = listed in the right Explore category) and
// manage every listing yourself — restaurants, bars, coffee shops and Local Guide vendors: edit
// details, replace photos, hide / show, add new ones.
import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/email.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  DINING_TYPES,
  LISTING_SELECT,
  LISTING_TYPES,
  activeCommunities,
  bookingFields,
  activeGuides,
  createListing,
  listingFields,
  listingView,
  recountGuides,
  refreshListingCaches,
  saveListingPhoto,
  validateListing,
} from '../services/partners.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(Object.assign(new Error('Please upload a JPG, PNG or WebP image'), { status: 400 }))
      return
    }
    cb(null, true)
  },
})

const REQUEST_FIELDS = [
  'listing_type', 'guide_slug', 'business_name', 'description', 'website_url', 'phone', 'email',
  'contact_name', 'address', 'community', 'hours', 'cuisine', 'instagram', 'admin_note',
]

function pick(body, fields) {
  const out = {}
  for (const f of fields) if (body?.[f] !== undefined) out[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  return out
}

// Options for the Admin forms (and the same lists the public form uses).
router.get('/options', async (_req, res, next) => {
  try {
    const [guides, communities] = await Promise.all([activeGuides(), activeCommunities()])
    res.json({ types: LISTING_TYPES, guides: guides.map(({ slug, title }) => ({ slug, title })), communities })
  } catch (error) {
    next(error)
  }
})

// ---------- requests ----------

router.get('/requests', async (req, res, next) => {
  try {
    let query = supabase.from('partner_requests').select('*').order('created_at', { ascending: false }).limit(200)
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) query = query.eq('status', req.query.status)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json(data || [])
  } catch (error) {
    next(error)
  }
})

router.patch('/requests/:id', async (req, res, next) => {
  try {
    const updates = pick(req.body, REQUEST_FIELDS)
    if (updates.listing_type && !LISTING_TYPES[updates.listing_type]) return res.status(400).json({ error: 'Unknown listing type' })
    const { data, error } = await supabase.from('partner_requests').update(updates).eq('id', req.params.id).select('*').single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// Replace the request's photo before approving (e.g. the partner sent a better one by email).
router.post('/requests/:id/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo is required' })
    const { data: request } = await supabase.from('partner_requests').select('business_name').eq('id', req.params.id).maybeSingle()
    if (!request) return res.status(404).json({ error: 'Request not found' })
    const url = await saveListingPhoto(req.file.buffer, request.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    const { data, error } = await supabase.from('partner_requests').update({ photo_url: url }).eq('id', req.params.id).select('*').single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

function partnerEmail(request, approved, note) {
  const where = DINING_TYPES.includes(request.listing_type) ? LISTING_TYPES[request.listing_type] : 'Local Guide'
  const lines = approved
    ? [
        `Hi ${request.contact_name || request.business_name},`,
        '',
        `Good news — ${request.business_name} is now listed in the My30A Host guest app (Explore → ${where}).`,
        'Guests staying along 30A can find you, call you and visit your website from the app, and Vitoria, our AI concierge, can recommend you.',
        '',
        'To update your details or photo, just reply to this email.',
      ]
    : [
        `Hi ${request.contact_name || request.business_name},`,
        '',
        `Thank you for your interest in My30A Host. We aren’t able to list ${request.business_name} right now.`,
        ...(note ? ['', note] : []),
      ]
  return { to: request.email, subject: approved ? `${request.business_name} is live on My30A Host` : 'Your My30A Host partner request', text: [...lines, '', '— My30A Host', 'www.my30ahost.com'].join('\n') }
}

router.post('/requests/:id/approve', async (req, res, next) => {
  try {
    const { data: request } = await supabase.from('partner_requests').select('*').eq('id', req.params.id).maybeSingle()
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (request.status === 'approved') return res.status(400).json({ error: 'Already approved' })
    const merged = { ...request, ...pick(req.body, REQUEST_FIELDS) }
    const problem = validateListing(merged, await activeGuides())
    if (problem) return res.status(400).json({ error: problem })
    const listing = await createListing(merged)
    const { data, error } = await supabase
      .from('partner_requests')
      .update({ ...pick(req.body, REQUEST_FIELDS), status: 'approved', vendor_id: listing.id, reviewed_at: new Date().toISOString(), reviewed_by: req.user.id })
      .eq('id', request.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    const emailed = req.body?.notify === false ? { skipped: true } : await sendEmail(partnerEmail(data, true))
    res.json({ request: data, listing: listingView(listing), emailed: Boolean(emailed?.sent) })
  } catch (error) {
    next(error)
  }
})

router.post('/requests/:id/reject', async (req, res, next) => {
  try {
    const note = String(req.body?.note || '').trim().slice(0, 600)
    const { data, error } = await supabase
      .from('partner_requests')
      .update({ status: 'rejected', admin_note: note || null, reviewed_at: new Date().toISOString(), reviewed_by: req.user.id })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()
    if (error) return res.status(400).json({ error: error.message })
    if (!data) return res.status(400).json({ error: 'Only pending requests can be declined' })
    const emailed = req.body?.notify ? await sendEmail(partnerEmail(data, false, note)) : { skipped: true }
    res.json({ request: data, emailed: Boolean(emailed?.sent) })
  } catch (error) {
    next(error)
  }
})

router.delete('/requests/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('partner_requests').delete().eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// ---------- listings (everything guests see in Explore / Dining) ----------

router.get('/listings', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('explore_vendors').select(LISTING_SELECT).in('kind', ['restaurant', 'vendor']).order('name')
    if (error) return res.status(400).json({ error: error.message })
    res.json((data || []).map(listingView))
  } catch (error) {
    next(error)
  }
})

router.post('/listings', upload.single('photo'), async (req, res, next) => {
  try {
    const body = req.body || {}
    const problem = validateListing(body, await activeGuides())
    if (problem) return res.status(400).json({ error: problem })
    const photoUrl = req.file ? await saveListingPhoto(req.file.buffer, body.business_name) : null
    const listing = await createListing(body, { photoUrl })
    res.status(201).json(listingView(listing))
  } catch (error) {
    next(error)
  }
})

router.patch('/listings/:id', async (req, res, next) => {
  try {
    const { data: current } = await supabase.from('explore_vendors').select(LISTING_SELECT).eq('id', req.params.id).maybeSingle()
    if (!current) return res.status(404).json({ error: 'Listing not found' })
    const body = req.body || {}
    const merged = {
      listing_type: body.listing_type || listingView(current).listing_type,
      guide_slug: body.guide_slug !== undefined ? body.guide_slug : current.guide_slug,
      business_name: body.name !== undefined ? body.name : current.name,
      description: body.description !== undefined ? body.description : current.description,
      website_url: body.website_url !== undefined ? body.website_url : current.website_url,
      phone: body.phone !== undefined ? body.phone : current.phone,
      address: body.address !== undefined ? body.address : current.address,
      community: body.community !== undefined ? body.community : current.community,
      hours: body.hours !== undefined ? body.hours : current.hours,
      cuisine: body.cuisine !== undefined ? body.cuisine : current.cuisine,
      // A new Dining tab replaces the old one unless the admin sent the full list.
      venue_types: body.venue_types !== undefined ? body.venue_types : body.listing_type ? null : current.venue_types,
    }
    const problem = validateListing(merged, await activeGuides())
    if (problem) return res.status(400).json({ error: problem })
    // Only write what was edited, so imported details (map lines, booking setup) stay intact.
    const full = listingFields(merged)
    const updates = {}
    const given = (k) => body[k] !== undefined
    if (given('name')) updates.name = full.name
    if (given('description')) Object.assign(updates, { description: full.description, about: full.about })
    for (const k of ['website_url', 'phone', 'address', 'hours', 'cuisine']) if (given(k)) updates[k] = full[k] ?? null
    if (given('community')) Object.assign(updates, { community: full.community, place: full.place, map_name: full.map_name ?? undefined })
    if (given('name') || given('address') || given('community')) updates.directions_url = full.directions_url
    if (given('address') && full.map_line1 !== undefined) updates.map_line1 = full.map_line1
    if (given('listing_type') || given('venue_types') || given('guide_slug')) {
      Object.assign(updates, { kind: full.kind, guide_slug: full.guide_slug, venue_type: full.venue_type, venue_types: full.venue_types })
    }
    if (full.kind === 'restaurant' || current.kind === 'restaurant') Object.assign(updates, bookingFields(body))
    for (const k of Object.keys(updates)) if (updates[k] === undefined) delete updates[k]
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)
    const { data, error } = await supabase.from('explore_vendors').update(updates).eq('id', req.params.id).select(LISTING_SELECT).single()
    if (error) return res.status(400).json({ error: error.message })
    await recountGuides([current.guide_slug, data.guide_slug])
    refreshListingCaches()
    res.json(listingView(data))
  } catch (error) {
    next(error)
  }
})

router.post('/listings/:id/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo is required' })
    const { data: current } = await supabase.from('explore_vendors').select('slug').eq('id', req.params.id).maybeSingle()
    if (!current) return res.status(404).json({ error: 'Listing not found' })
    const url = await saveListingPhoto(req.file.buffer, current.slug)
    const { data, error } = await supabase.from('explore_vendors').update({ image_url: url }).eq('id', req.params.id).select(LISTING_SELECT).single()
    if (error) return res.status(400).json({ error: error.message })
    refreshListingCaches()
    res.json(listingView(data))
  } catch (error) {
    next(error)
  }
})

export default router
