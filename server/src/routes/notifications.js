import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/mine', async (req, res, next) => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (req.query.unread === 'true') {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })

    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    if (countError) return res.status(400).json({ error: countError.message })

    res.json({ notifications: data || [], unread_count: count || 0 })
  } catch (error) {
    next(error)
  }
})

router.post('/read-all', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true, unread_count: 0 })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/read', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

export default router
