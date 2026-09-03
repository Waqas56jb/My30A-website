import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const current_password = req.body?.current_password
    const new_password = req.body?.new_password

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' })
    }
    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    if (!req.user?.email) {
      return res.status(400).json({ error: 'Account email is missing' })
    }

    const verifier = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signError } = await verifier.auth.signInWithPassword({
      email: req.user.email,
      password: String(current_password),
    })
    if (signError) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: String(new_password),
    })
    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
