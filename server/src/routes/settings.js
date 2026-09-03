import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

function parsePercent(value, field) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return { error: `${field} must be a number between 0 and 100` }
  }
  return { value: number }
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.patch('/', async (req, res, next) => {
  try {
    const updates = { updated_at: new Date().toISOString() }
    const { platform_fee_percent, default_owner_fee_percent } = req.body || {}

    if (platform_fee_percent === undefined && default_owner_fee_percent === undefined) {
      return res.status(400).json({
        error: 'platform_fee_percent or default_owner_fee_percent is required',
      })
    }

    if (platform_fee_percent !== undefined) {
      const parsed = parsePercent(platform_fee_percent, 'platform_fee_percent')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      updates.platform_fee_percent = parsed.value
    }

    if (default_owner_fee_percent !== undefined) {
      const parsed = parsePercent(default_owner_fee_percent, 'default_owner_fee_percent')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      updates.default_owner_fee_percent = parsed.value
    }

    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', 1)
      .select('*')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

export default router
