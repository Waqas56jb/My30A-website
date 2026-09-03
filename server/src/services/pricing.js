import { supabase } from '../lib/supabase.js'

export async function getBasePrice({ community_id, airport, vehicle_type }) {
  if (!community_id || !airport || !vehicle_type) {
    const error = new Error('community_id, airport, and vehicle_type are required')
    error.status = 400
    throw error
  }

  const { data, error } = await supabase
    .from('transfer_pricing')
    .select('id, community_id, airport, vehicle_type, base_price')
    .eq('community_id', community_id)
    .eq('airport', airport)
    .eq('vehicle_type', vehicle_type)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    const missing = new Error('Pricing not found')
    missing.status = 404
    throw missing
  }

  return data
}
