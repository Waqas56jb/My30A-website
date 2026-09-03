import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { sendWelcomeLogin } from '../lib/email.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let value = ''
  for (let i = 0; i < 10; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)]
  }
  return value
}

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, roles, send_email } = req.body || {}
    let { password } = req.body || {}

    if (!name || !email || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: 'name, email, and roles are required' })
    }

    if (!password) password = randomPassword()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({ name, phone: phone || null, roles, email })
      .eq('id', data.user.id)
      .select('id, name, email, phone, roles, is_active, created_at')
      .single()

    if (profileError) {
      return res.status(400).json({ error: profileError.message })
    }

    if (send_email) {
      await sendWelcomeLogin({
        name: profile.name,
        email: profile.email,
        password,
        roles: profile.roles,
      })
    }

    res.status(201).json({ ...profile, password })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('profiles')
      .select('id, name, email, phone, roles, is_active, created_at')
      .order('created_at', { ascending: false })

    if (req.query.role) {
      query = query.contains('roles', [req.query.role])
    }

    const [{ data, error }, agreementsResult] = await Promise.all([
      query,
      supabase
        .from('compensation_agreements')
        .select('*')
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (error) {
      return res.status(400).json({ error: error.message })
    }
    if (agreementsResult.error) {
      return res.status(400).json({ error: agreementsResult.error.message })
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const byUser = new Map()
    for (const row of agreementsResult.data || []) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
      byUser.get(row.user_id).push(row)
    }

    res.json(
      (data || []).map((user) => {
        const all = byUser.get(user.id) || []
        const current = all.find((row) => row.effective_from <= today) || null
        const latest = all[0] || null
        const upcoming =
          latest && latest.id !== current?.id && latest.effective_from > today ? latest : null
        return {
          ...user,
          compensation: current,
          compensation_upcoming: upcoming,
        }
      })
    )
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {}
    const { name, phone, roles, is_active } = req.body || {}

    if (name !== undefined) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (roles !== undefined) updates.roles = roles
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, email, phone, roles, is_active, created_at')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const password = randomPassword()
    const { error } = await supabase.auth.admin.updateUserById(req.params.id, {
      password,
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (req.body?.send_email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email, roles')
        .eq('id', req.params.id)
        .single()
      if (profile) {
        await sendWelcomeLogin({
          name: profile.name,
          email: profile.email,
          password,
          roles: profile.roles,
        })
      }
    }

    res.json({ id: req.params.id, password })
  } catch (error) {
    next(error)
  }
})

export default router
