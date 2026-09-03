import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const TYPES = ['fixed', 'percentage', 'hourly']

router.get('/user/:userId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('compensation_agreements')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const current =
      (data || []).find((row) => row.effective_from <= today) || null

    res.json({ agreements: data || [], current })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { user_id, type, value, effective_from } = req.body || {}

    if (!user_id || !type || value === undefined) {
      return res.status(400).json({ error: 'user_id, type, and value are required' })
    }

    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: 'type must be fixed, percentage, or hourly' })
    }

    const number = Number(value)
    if (!Number.isFinite(number)) {
      return res.status(400).json({ error: 'value must be a number' })
    }

    if (type === 'percentage' && (number < 0 || number > 100)) {
      return res.status(400).json({ error: 'percentage value must be between 0 and 100' })
    }

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, roles')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return res.status(400).json({ error: 'user not found' })
    }

    const roles = user.roles || []
    if (!roles.includes('driver') && !roles.includes('shopper')) {
      return res.status(400).json({ error: 'user must have role driver or shopper' })
    }

    const insert = {
      user_id,
      type,
      value: number,
      created_by: req.user.id,
    }

    if (effective_from) {
      insert.effective_from = effective_from
    }

    const { data, error } = await supabase
      .from('compensation_agreements')
      .insert(insert)
      .select('*')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

export default router
