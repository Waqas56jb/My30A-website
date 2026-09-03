import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const VEHICLE_TYPES = ['4pax', '6pax', '14pax']
const STATUSES = ['active', 'inactive']

function parsePercent(value, field) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return { error: `${field} must be a number between 0 and 100` }
  }
  return { value: number }
}

async function getOwner(ownerId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, roles')
    .eq('id', ownerId)
    .single()

  if (error || !data) return null
  return data
}

function canOwnVehicle(roles) {
  return (roles || []).includes('admin') || (roles || []).includes('partner')
}

router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('vehicles')
      .select('*, owner:profiles!owner_id(name)')
      .order('created_at', { ascending: false })

    if (req.query.owner_id) {
      query = query.eq('owner_id', req.query.owner_id)
    }

    const { data, error } = await query
    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(
      (data || []).map((vehicle) => ({
        ...vehicle,
        owner_name: vehicle.owner?.name || null,
      }))
    )
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { owner_id, make, model, year, vehicle_type, capacity, plate, owner_fee_percent } =
      req.body || {}

    if (!owner_id || !make || !model || year === undefined || !vehicle_type || capacity === undefined || !plate) {
      return res.status(400).json({
        error: 'owner_id, make, model, year, vehicle_type, capacity, and plate are required',
      })
    }

    if (!VEHICLE_TYPES.includes(vehicle_type)) {
      return res.status(400).json({ error: 'vehicle_type must be 4pax, 6pax, or 14pax' })
    }

    const yearNumber = Number(year)
    const capacityNumber = Number(capacity)
    if (!Number.isInteger(yearNumber) || !Number.isInteger(capacityNumber)) {
      return res.status(400).json({ error: 'year and capacity must be integers' })
    }

    const owner = await getOwner(owner_id)
    if (!owner || !canOwnVehicle(owner.roles)) {
      return res.status(400).json({ error: 'owner must have role admin or partner' })
    }

    let fee = owner_fee_percent
    if (fee === undefined) {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('default_owner_fee_percent')
        .eq('id', 1)
        .single()
      if (settingsError) {
        return res.status(400).json({ error: settingsError.message })
      }
      fee = settings.default_owner_fee_percent
    } else {
      const parsed = parsePercent(fee, 'owner_fee_percent')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      fee = parsed.value
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        owner_id,
        make,
        model,
        year: yearNumber,
        vehicle_type,
        capacity: capacityNumber,
        plate,
        owner_fee_percent: fee,
      })
      .select('*, owner:profiles!owner_id(name)')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.status(201).json({ ...data, owner_name: data.owner?.name || null })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body || {}
    const updates = {}

    if (body.owner_id !== undefined) {
      const owner = await getOwner(body.owner_id)
      if (!owner || !canOwnVehicle(owner.roles)) {
        return res.status(400).json({ error: 'owner must have role admin or partner' })
      }
      updates.owner_id = body.owner_id
    }

    if (body.make !== undefined) updates.make = body.make
    if (body.model !== undefined) updates.model = body.model
    if (body.plate !== undefined) updates.plate = body.plate

    if (body.year !== undefined) {
      const yearNumber = Number(body.year)
      if (!Number.isInteger(yearNumber)) {
        return res.status(400).json({ error: 'year must be an integer' })
      }
      updates.year = yearNumber
    }

    if (body.capacity !== undefined) {
      const capacityNumber = Number(body.capacity)
      if (!Number.isInteger(capacityNumber)) {
        return res.status(400).json({ error: 'capacity must be an integer' })
      }
      updates.capacity = capacityNumber
    }

    if (body.vehicle_type !== undefined) {
      if (!VEHICLE_TYPES.includes(body.vehicle_type)) {
        return res.status(400).json({ error: 'vehicle_type must be 4pax, 6pax, or 14pax' })
      }
      updates.vehicle_type = body.vehicle_type
    }

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return res.status(400).json({ error: "status must be 'active' or 'inactive'" })
      }
      updates.status = body.status
    }

    if (body.owner_fee_percent !== undefined) {
      const parsed = parsePercent(body.owner_fee_percent, 'owner_fee_percent')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      updates.owner_fee_percent = parsed.value
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, owner:profiles!owner_id(name)')
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ ...data, owner_name: data.owner?.name || null })
  } catch (error) {
    next(error)
  }
})

export default router
