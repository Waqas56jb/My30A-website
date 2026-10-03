import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail } from '../lib/email.js'
import { pickPublicUrl } from '../lib/urls.js'

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

// Forgot password (staff /login, guest app, host and Admin sign-in): emails a one-time link to
// my30ahost.com/reset-password where the person picks a new password. Always answers the same way
// so it can't be used to find out which emails have accounts.
const forgotLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests — please try again later.' } })
const APPS = { staff: 'the My30A Host staff app', guest: 'the My30A Host app', host: 'your My30A Host dashboard', admin: 'My30A Host Admin' }

router.post('/forgot-password', forgotLimit, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const app = APPS[req.body?.app] ? req.body.app : 'staff'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' })
    const { data: profile } = await supabase.from('profiles').select('id, name, is_active').ilike('email', email).maybeSingle()
    if (profile && profile.is_active !== false) {
      const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email })
      const token = data?.properties?.hashed_token
      if (!error && token) {
        const base = (pickPublicUrl(process.env.CLIENT_APP_URL, process.env.PUBLIC_APP_URL) || 'https://www.my30ahost.com').replace(/\/$/, '')
        const link = `${base}/reset-password?token=${encodeURIComponent(token)}&app=${app}`
        await sendEmail({
          to: email,
          subject: 'Reset your My30A Host password',
          text: [
            `Hi ${profile.name || 'there'},`,
            '',
            `Someone (hopefully you) asked to reset the password for ${APPS[app]}.`,
            '',
            `Choose a new password here: ${link}`,
            '',
            'This link works once and expires in about an hour. If you didn’t ask for it, you can ignore this email — your password stays the same.',
            '',
            '— My30A Host',
          ].join('\n'),
        })
      }
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
