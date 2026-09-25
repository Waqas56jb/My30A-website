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
    const body = req.body || {}
    const { platform_fee_percent, default_owner_fee_percent } = body
    const GROCERY = ['grocery_buffer_percent', 'grocery_rush_fee_percent', 'grocery_min_notice_hours', 'grocery_instant_payouts']

    if (platform_fee_percent === undefined && default_owner_fee_percent === undefined && !GROCERY.some((k) => body[k] !== undefined)) {
      return res.status(400).json({
        error: 'platform_fee_percent, default_owner_fee_percent or a grocery setting is required',
      })
    }

    // Grocery prepayment policy (services/groceryPay.js).
    for (const key of ['grocery_buffer_percent', 'grocery_rush_fee_percent']) {
      if (body[key] === undefined) continue
      const parsed = parsePercent(body[key], key)
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      updates[key] = parsed.value
    }
    if (body.grocery_min_notice_hours !== undefined) {
      const hours = Number(body.grocery_min_notice_hours)
      if (!Number.isInteger(hours) || hours < 0 || hours > 720) {
        return res.status(400).json({ error: 'grocery_min_notice_hours must be a whole number of hours (0–720)' })
      }
      updates.grocery_min_notice_hours = hours
    }
    if (body.grocery_instant_payouts !== undefined) updates.grocery_instant_payouts = Boolean(body.grocery_instant_payouts)

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
