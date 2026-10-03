import { Router } from 'express'
import { deleteVehicle, sendResult } from '../services/adminDelete.js'
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

// Co-owners (shared car): partners other than the main owner, validated and de-duplicated.
async function cleanCoOwners(ids, ownerId) {
  if (!Array.isArray(ids)) return { error: 'co_owner_ids must be a list' }
  const list = [...new Set(ids.filter((id) => id && id !== ownerId))]
  if (!list.length) return { value: [] }
  const { data } = await supabase.from('profiles').select('id, roles').in('id', list)
  const bad = list.find((id) => !(data || []).some((p) => p.id === id && canOwnVehicle(p.roles)))
  if (bad) return { error: 'Every co-owner must be a partner' }
  return { value: list }
}

async function withCoOwnerNames(rows) {
  const ids = [...new Set(rows.flatMap((v) => v.co_owner_ids || []))]
  if (!ids.length) return rows.map((v) => ({ ...v, co_owners: [] }))
  const { data } = await supabase.from('profiles').select('id, name').in('id', ids)
  const names = Object.fromEntries((data || []).map((p) => [p.id, p.name]))
  return rows.map((v) => ({ ...v, co_owners: (v.co_owner_ids || []).map((id) => ({ id, name: names[id] || '—' })) }))
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
      await withCoOwnerNames(
        (data || []).map((vehicle) => ({
          ...vehicle,
          owner_name: vehicle.owner?.name || null,
        }))
      )
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

    const coOwners = await cleanCoOwners(req.body?.co_owner_ids || [], owner_id)
    if (coOwners.error) return res.status(400).json({ error: coOwners.error })

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        co_owner_ids: coOwners.value,
        owner_id,
        make,
        model,
        year: yearNumber,
        vehicle_type,
        capacity: capacityNumber,
        plate,
        owner_fee_percent: fee,
        show_name: req.body?.show_name === undefined ? true : Boolean(req.body.show_name),
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
    // OFF shows guests "Private transfer · Up to N passengers" instead of the model name.
    if (body.show_name !== undefined) updates.show_name = Boolean(body.show_name)

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

    if (body.co_owner_ids !== undefined) {
      let ownerId = body.owner_id
      if (ownerId === undefined) {
        const { data: current } = await supabase.from('vehicles').select('owner_id').eq('id', req.params.id).maybeSingle()
        ownerId = current?.owner_id
      }
      const coOwners = await cleanCoOwners(body.co_owner_ids, ownerId)
      if (coOwners.error) return res.status(400).json({ error: coOwners.error })
      updates.co_owner_ids = coOwners.value
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

// Admin delete: only vehicles never used on a trip (others: set Inactive).
router.delete('/:id', async (req, res, next) => {
  try {
    sendResult(res, await deleteVehicle(req.params.id))
  } catch (error) {
    next(error)
  }
})

export default router
