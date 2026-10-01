// Host version: a vacation-rental host's property, reached by the QR code in the house
// (my30ahost.com/h/<slug>). See supabase/migrations/033_host_homes.sql.
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'

export const HOME_TEXT_FIELDS = [
  'host_name', 'host_tagline', 'logo_url', 'home_name', 'address', 'area', 'cover_url',
  'wifi_network', 'wifi_password', 'door_code', 'parking', 'check_in_time', 'check_out_time', 'pets',
  'contact_label', 'contact_phone', 'instagram', 'facebook', 'tiktok', 'website_url',
  'properties_label', 'airbnb_url', 'vrbo_url', 'notes',
]

export const INSTRUCTION_ICONS = ['tv', 'thermostat', 'kitchen', 'trash', 'laundry', 'pool', 'grill', 'beach', 'bike', 'key', 'info']

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// "the-blue-heron-house-k3x9q": readable, but not guessable — the page shows the door code.
export function newHomeSlug(homeName) {
  const suffix = crypto.randomBytes(4).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5)
  return `${slugify(homeName) || 'home'}-${suffix || crypto.randomInt(10000, 99999)}`
}

function cleanText(value, max = 500) {
  if (value === undefined) return undefined
  const text = String(value ?? '').trim().slice(0, max)
  return text || null
}

// Validates an admin create/update body. Returns { row } or { error }.
export function homeRowFromBody(body = {}, { creating = false } = {}) {
  const row = {}
  for (const field of HOME_TEXT_FIELDS) {
    const value = cleanText(body[field], field === 'notes' ? 2000 : 500)
    if (value !== undefined) row[field] = value
  }
  if (body.max_guests !== undefined) {
    const n = body.max_guests === '' || body.max_guests === null ? null : Number(body.max_guests)
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 100)) return { error: 'Max guests must be a whole number' }
    row.max_guests = n
  }
  if (body.instructions !== undefined) {
    if (!Array.isArray(body.instructions)) return { error: 'instructions must be a list' }
    row.instructions = body.instructions
      .map((item) => ({
        icon: INSTRUCTION_ICONS.includes(item?.icon) ? item.icon : 'info',
        label: String(item?.label || '').trim().slice(0, 60),
        value: String(item?.value || '').trim().slice(0, 300),
      }))
      .filter((item) => item.label || item.value)
      .slice(0, 20)
  }
  if (body.rules !== undefined) {
    const list = Array.isArray(body.rules) ? body.rules : String(body.rules || '').split('\n')
    row.rules = list.map((rule) => String(rule).trim().slice(0, 200)).filter(Boolean).slice(0, 20)
  }
  if (body.plan !== undefined) {
    if (!['monthly', 'annual'].includes(body.plan)) return { error: 'Plan must be monthly or annual' }
    row.plan = body.plan
  }
  if (body.paid_until !== undefined) {
    const value = body.paid_until || null
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Paid until must be a date' }
    row.paid_until = value
  }
  if (body.is_active !== undefined) row.is_active = Boolean(body.is_active)
  if (creating) {
    if (!row.host_name) return { error: 'Host name is required (e.g. StayOn30A)' }
    if (!row.home_name) return { error: 'Property name is required (e.g. The Blue Heron House)' }
  } else {
    if ('host_name' in row && !row.host_name) return { error: 'Host name is required' }
    if ('home_name' in row && !row.home_name) return { error: 'Property name is required' }
  }
  return { row }
}

// What anyone holding the QR link sees before signing in: branding only, no access details.
export function brandView(home) {
  if (!home) return null
  return {
    slug: home.slug,
    host_name: home.host_name,
    host_tagline: home.host_tagline || null,
    logo_url: home.logo_url || null,
    home_name: home.home_name,
    area: home.area || null,
    cover_url: home.cover_url || null,
  }
}

// The full "My Home" tab for a signed-in guest of this property (no admin bookkeeping).
export function guestHomeView(home) {
  if (!home) return null
  const { plan, paid_until, notes, is_active, created_at, updated_at, ...rest } = home
  return rest
}

export async function loadHomeBySlug(slug) {
  if (!/^[a-z0-9-]{3,60}$/.test(String(slug || ''))) return null
  const { data } = await supabase.from('host_homes').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()
  return data || null
}

export async function loadHomeForGuest(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('host_home:host_homes!host_home_id (*)')
    .eq('id', userId)
    .maybeSingle()
  const home = data?.host_home
  return home && home.is_active ? home : null
}

// One block of plain text for Vitoria, so she can answer "what's the WiFi?" or "when is checkout?".
export function homeForVitoria(home) {
  if (!home) return null
  const lines = [
    `${home.home_name}${home.address ? `, ${home.address}` : ''}${home.area ? `, ${home.area}` : ''} — a ${home.host_name} rental.`,
  ]
  const facts = [
    home.wifi_network && `WiFi network ${home.wifi_network}`,
    home.wifi_password && `WiFi password ${home.wifi_password}`,
    home.door_code && `door code ${home.door_code}`,
    home.parking && `parking: ${home.parking}`,
    home.check_in_time && `check-in ${home.check_in_time}`,
    home.check_out_time && `check-out ${home.check_out_time}`,
    home.max_guests && `up to ${home.max_guests} guests`,
    home.pets && `pets: ${home.pets}`,
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join('; ') + '.')
  for (const item of home.instructions || []) lines.push(`${item.label}: ${item.value}`)
  if ((home.rules || []).length) lines.push(`House rules: ${home.rules.join('; ')}`)
  if (home.contact_phone) lines.push(`Host contact: ${home.contact_label || home.host_name} ${home.contact_phone}`)
  return lines.join('\n')
}
