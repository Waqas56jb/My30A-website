// Admin CRUD for guest-app content: Explore 30A categories/guides/vendors, Public Information,
// and the service catalog the guest app quotes from.
import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const RESOURCES = {
  categories: {
    table: 'explore_categories',
    pk: 'key',
    columns: ['key', 'label', 'tone', 'icon', 'target', 'sort_order', 'is_active'],
  },
  guides: {
    table: 'explore_guides',
    pk: 'id',
    uniqueKey: 'slug',
    columns: [
      'id', 'slug', 'title', 'kind', 'detail_slug', 'image_url', 'price_from', 'vendor_count',
      'place', 'filters', 'is_pick', 'sort_order', 'is_active',
    ],
  },
  vendors: {
    table: 'explore_vendors',
    pk: 'id',
    uniqueKey: 'slug',
    columns: [
      'id', 'guide_slug', 'slug', 'kind', 'name', 'subtitle', 'place', 'community', 'cuisine',
      'rating', 'review_count', 'description', 'about', 'services', 'tags', 'amenities', 'rules',
      'hours', 'hours_today', 'map_name', 'map_line1', 'map_line2', 'phone', 'website_url',
      'booking_url', 'directions_url', 'image_url', 'price_from', 'sort_order', 'is_active',
    ],
  },
  info: {
    table: 'public_info_sections',
    pk: 'key',
    columns: ['key', 'title', 'sort_order', 'items', 'is_active'],
  },
  catalog: {
    table: 'service_catalog',
    pk: 'key',
    columns: ['key', 'kind', 'name', 'sub', 'price', 'unit', 'tone', 'icon', 'sort_order', 'is_active'],
  },
}

function resource(req, res) {
  const def = RESOURCES[req.params.resource]
  if (!def) {
    res.status(404).json({ error: `Unknown content resource: ${req.params.resource}` })
    return null
  }
  return def
}

function pick(body, columns) {
  const row = {}
  for (const column of columns) {
    if (body[column] !== undefined) row[column] = body[column]
  }
  return row
}

router.get('/', (_req, res) => {
  res.json({ resources: Object.keys(RESOURCES) })
})

router.get('/:resource', async (req, res, next) => {
  try {
    const def = resource(req, res)
    if (!def) return
    let query = supabase.from(def.table).select('*').order('sort_order', { ascending: true })
    if (def.uniqueKey) query = query.order(def.uniqueKey, { ascending: true })
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json(data || [])
  } catch (error) {
    next(error)
  }
})

// Create or update (upsert on the primary key, or on the unique slug when no id is sent).
router.post('/:resource', async (req, res, next) => {
  try {
    const def = resource(req, res)
    if (!def) return
    const row = pick(req.body || {}, def.columns)
    if (Object.keys(row).length === 0) {
      return res.status(400).json({ error: 'No valid fields' })
    }
    const conflictKey = row[def.pk] !== undefined ? def.pk : def.uniqueKey || def.pk
    if (row[conflictKey] === undefined) {
      return res.status(400).json({ error: `${conflictKey} is required` })
    }
    const { data, error } = await supabase
      .from(def.table)
      .upsert(row, { onConflict: conflictKey })
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

router.patch('/:resource/:id', async (req, res, next) => {
  try {
    const def = resource(req, res)
    if (!def) return
    const updates = pick(req.body || {}, def.columns)
    delete updates[def.pk]
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    const { data, error } = await supabase
      .from(def.table)
      .update(updates)
      .eq(def.pk, req.params.id)
      .select('*')
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.delete('/:resource/:id', async (req, res, next) => {
  try {
    const def = resource(req, res)
    if (!def) return
    const { error, count } = await supabase
      .from(def.table)
      .delete({ count: 'exact' })
      .eq(def.pk, req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    if (!count) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, deleted: count })
  } catch (error) {
    next(error)
  }
})

export default router
