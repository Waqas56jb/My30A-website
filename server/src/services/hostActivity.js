// Guest activity per host property, for the host dashboard. Hosts see counts and topics only
// ("a guest asked Vitoria about WiFi") — never who the guest is or what they wrote.
import { supabase } from '../lib/supabase.js'

const TOPICS = [
  ['wifi', /wi.?fi|internet|password|network/],
  ['door', /door|\bcode\b|lock|key|get in/],
  ['checkout', /check.?out|leave|departure|late checkout/],
  ['checkin', /check.?in|arriv|early/],
  ['parking', /park/],
  ['house', /\btv\b|thermostat|\bac\b|heat|kitchen|trash|laundry|washer|dryer|pool|grill|towel|rule|pet|smok|part(y|ies)/],
  ['dining', /restaurant|dinner|lunch|breakfast|brunch|eat|food|coffee|bar\b|drink|sushi|pizza|seafood/],
  ['beach', /beach|access|sand|swim|flag/],
  ['events', /event|happening|tonight|music|market|festival/],
  ['transfer', /airport|transfer|ride|driver|flight|shuttle/],
  ['grocery', /grocer|publix|stock|food delivery/],
  ['activities', /golf|bike|boat|kayak|paddle|fishing|spa|kids|things to do|activit/],
]

export const TOPIC_LABELS = {
  wifi: 'WiFi',
  door: 'Door code',
  checkout: 'Check-out',
  checkin: 'Check-in',
  parking: 'Parking',
  house: 'House questions',
  dining: 'Restaurants & bars',
  beach: 'Beaches',
  events: 'Events',
  transfer: 'Airport transfers',
  grocery: 'Groceries',
  activities: 'Activities',
  other: 'Other questions',
}

export function topicFor(text) {
  const q = String(text || '').toLowerCase()
  return TOPICS.find(([, re]) => re.test(q))?.[0] || 'other'
}

// Never throws: activity logging must not break the guest's request.
export async function logHomeEvent(homeId, guestId, kind, topic = null) {
  if (!homeId) return
  try {
    if (kind === 'opened' || kind === 'joined') {
      // One "opened My Home" per guest per 30 minutes, so refreshes don't inflate the count — and
      // one "joined" even when the app links the property from two places at once after sign-in.
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('host_home_events')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .eq('guest_id', guestId)
        .eq('kind', kind)
        .gte('created_at', kind === 'joined' ? new Date(Date.now() - 12 * 3600 * 1000).toISOString() : since)
      if (count) return
    }
    await supabase.from('host_home_events').insert({ home_id: homeId, guest_id: guestId || null, kind, topic })
  } catch (error) {
    console.log('Host activity skipped:', error.message)
  }
}

// The guest's linked property (profiles.host_home_id), for logging bookings and Vitoria questions.
export async function guestHomeId(guestId) {
  const { data } = await supabase.from('profiles').select('host_home_id').eq('id', guestId).maybeSingle()
  return data?.host_home_id || null
}

// Counts per property over the last `days` days, plus Vitoria topics and the newest events.
export async function homeStats(homeIds, { days = 30, recent = 0 } = {}) {
  const out = Object.fromEntries(homeIds.map((id) => [id, { guests: 0, joined: 0, opened: 0, vitoria: 0, transfer: 0, grocery: 0, topics: {}, recent: [] }]))
  if (!homeIds.length) return out
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data } = await supabase
    .from('host_home_events')
    .select('home_id, guest_id, kind, topic, created_at')
    .in('home_id', homeIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
  const guests = Object.fromEntries(homeIds.map((id) => [id, new Set()]))
  for (const e of data || []) {
    const s = out[e.home_id]
    if (!s) continue
    if (e.guest_id) guests[e.home_id].add(e.guest_id)
    if (s[e.kind] !== undefined) s[e.kind] += 1
    if (e.kind === 'vitoria') s.topics[e.topic || 'other'] = (s.topics[e.topic || 'other'] || 0) + 1
    if (recent && s.recent.length < recent) s.recent.push({ kind: e.kind, topic: e.topic, at: e.created_at })
  }
  // Events without a guest (the demo property's sample activity) count one guest per "joined".
  for (const id of homeIds) out[id].guests = guests[id].size + (data || []).filter((e) => e.home_id === id && !e.guest_id && e.kind === 'joined').length
  return out
}
