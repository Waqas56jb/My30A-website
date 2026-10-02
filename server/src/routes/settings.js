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
    const PAUSE = ['transfer', 'grocery'].flatMap((k) => [`${k}_paused`, `${k}_pause_message`, `${k}_resume_at`])
    const HOST_PRICES = ['host_price_monthly', 'host_price_semiannual', 'host_price_annual']
    const GROCERY = ['grocery_buffer_percent', 'grocery_rush_fee_percent', 'grocery_min_notice_hours', 'grocery_instant_payouts', 'alert_emails', ...PAUSE, ...HOST_PRICES]

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
    // Where new-order / cancellation alert emails go (services/adminAlerts.js).
    if (body.alert_emails !== undefined) {
      const list = String(body.alert_emails || '').split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean)
      const bad = list.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
      if (bad) return res.status(400).json({ error: `"${bad}" is not a valid email address` })
      updates.alert_emails = list.join(', ') || null
    }

    // Host Version plan prices per property (new signups; existing subscribers keep their price).
    for (const key of HOST_PRICES) {
      if (body[key] === undefined) continue
      const price = Number(body[key])
      if (!Number.isFinite(price) || price < 1 || price > 10000) return res.status(400).json({ error: 'Host plan prices must be between $1 and $10,000' })
      updates[key] = Number(price.toFixed(2))
    }

    // Service availability: pause Transfer / Grocery with a message and optional return time.
    for (const kind of ['transfer', 'grocery']) {
      if (body[`${kind}_paused`] !== undefined) updates[`${kind}_paused`] = Boolean(body[`${kind}_paused`])
      if (body[`${kind}_pause_message`] !== undefined) {
        const text = String(body[`${kind}_pause_message`] || '').trim().slice(0, 400)
        if (!text) return res.status(400).json({ error: 'Please write the message guests will see while the service is paused' })
        updates[`${kind}_pause_message`] = text
      }
      if (body[`${kind}_resume_at`] !== undefined) {
        const value = body[`${kind}_resume_at`]
        if (value && Number.isNaN(new Date(value).getTime())) return res.status(400).json({ error: 'Back-online time is not a valid date' })
        updates[`${kind}_resume_at`] = value ? new Date(value).toISOString() : null
      }
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
