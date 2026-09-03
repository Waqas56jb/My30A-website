import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getBasePrice } from '../services/pricing.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/pricing/all', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transfer_pricing')
      .select('*, community:communities(name, zone, default_airport)')
      .order('airport')
      .order('vehicle_type')

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

router.get('/pricing', async (req, res, next) => {
  try {
    const { community_id, airport, vehicle_type } = req.query
    const row = await getBasePrice({ community_id, airport, vehicle_type })
    res.json(row)
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
})

export default router
