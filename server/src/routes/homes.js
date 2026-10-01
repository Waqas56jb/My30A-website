// Admin: Host version properties (Admin → Host homes). Each property gets a QR link
// my30ahost.com/h/<slug> that opens the guest app with the host's logo and a "My Home" tab.
import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase.js'
import { uploadPublicImage } from '../lib/storage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { homeRowFromBody, newHomeSlug } from '../services/hostHomes.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      cb(new Error('Please upload a JPG, PNG, WebP or SVG image'))
      return
    }
    cb(null, true)
  },
})

const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg' }

async function withGuestCounts(homes) {
  if (!homes.length) return homes
  const { data } = await supabase.from('profiles').select('host_home_id').in('host_home_id', homes.map((h) => h.id))
  const counts = {}
  for (const row of data || []) counts[row.host_home_id] = (counts[row.host_home_id] || 0) + 1
  return homes.map((home) => ({ ...home, guest_count: counts[home.id] || 0 }))
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('host_homes').select('*').order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    res.json(await withGuestCounts(data || []))
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { row, error } = homeRowFromBody(req.body, { creating: true })
    if (error) return res.status(400).json({ error })
    const { data, error: insertError } = await supabase
      .from('host_homes')
      .insert({ ...row, slug: newHomeSlug(row.home_name) })
      .select('*')
      .single()
    if (insertError) return res.status(400).json({ error: insertError.message })
    res.status(201).json({ ...data, guest_count: 0 })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { row, error } = homeRowFromBody(req.body)
    if (error) return res.status(400).json({ error })
    if (!Object.keys(row).length) return res.status(400).json({ error: 'Nothing to update' })
    const { data, error: updateError } = await supabase
      .from('host_homes')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (updateError) return res.status(400).json({ error: updateError.message })
    const [withCount] = await withGuestCounts([data])
    res.json(withCount)
  } catch (error) {
    next(error)
  }
})

// A new QR link (e.g. the old one was shared outside the house). Old printed codes stop working.
router.post('/:id/new-link', async (req, res, next) => {
  try {
    const { data: home } = await supabase.from('host_homes').select('home_name').eq('id', req.params.id).maybeSingle()
    if (!home) return res.status(404).json({ error: 'Property not found' })
    const { data, error } = await supabase
      .from('host_homes')
      .update({ slug: newHomeSlug(home.home_name), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    const [withCount] = await withGuestCounts([data])
    res.json(withCount)
  } catch (error) {
    next(error)
  }
})

// ?kind=logo | cover — stored in the public 'brand' bucket.
router.post('/:id/image', upload.single('image'), async (req, res, next) => {
  try {
    const kind = req.query.kind === 'cover' ? 'cover' : 'logo'
    if (!req.file) return res.status(400).json({ error: 'image is required' })
    const url = await uploadPublicImage(
      'brand',
      req.file.buffer,
      `homes/${req.params.id}/${kind}-${Date.now()}.${EXT[req.file.mimetype] || 'jpg'}`,
      req.file.mimetype
    )
    const { data, error } = await supabase
      .from('host_homes')
      .update({ [`${kind}_url`]: url, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    const [withCount] = await withGuestCounts([data])
    res.json(withCount)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { error, count } = await supabase.from('host_homes').delete({ count: 'exact' }).eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    if (!count) return res.status(404).json({ error: 'Property not found' })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
