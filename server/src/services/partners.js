// Partner registration + listing management. A business applies at my30ahost.com/partners/join;
// the admin approves it in Admin → Partners and it becomes an explore_vendors row in the right
// place: the Dining guide (restaurant / bar / coffee) or a Local Guide category (vendor).
import sharp from 'sharp'
import { supabase } from '../lib/supabase.js'
import { uploadPublicImage } from '../lib/storage.js'
import { clearMemo } from '../lib/memo.js'
import { invalidateVitoriaKnowledge } from './vitoria.js'

export const LISTING_TYPES = {
  restaurant: 'Restaurant',
  bar: 'Bar & Nightlife',
  coffee: 'Coffee & Breakfast',
  vendor: 'Local Guide',
}

export const DINING_TYPES = ['restaurant', 'bar', 'coffee']

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function cleanUrl(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('.') ? parsed.toString().replace(/\/$/, '') : null
  } catch {
    return null
  }
}

export async function activeGuides() {
  const { data } = await supabase
    .from('explore_guides')
    .select('slug, title, category_key, sort_order')
    .eq('kind', 'vendors')
    .eq('is_active', true)
    .order('sort_order')
  return data || []
}

export async function activeCommunities() {
  const { data } = await supabase.from('communities').select('name').eq('is_active', true).order('name')
  return (data || []).map((c) => c.name)
}

// Listing photo: 4:3, 960px WebP in the public 'listings' bucket (same look as the imported ones).
export async function saveListingPhoto(buffer, slug) {
  const img = sharp(buffer).rotate()
  const { width, height } = await img.metadata()
  if (!width || !height) throw Object.assign(new Error('That photo could not be read'), { status: 400 })
  const h = Math.min(height, Math.round((width * 3) / 4))
  const w = Math.min(width, Math.round((h * 4) / 3))
  const out = await img
    .extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2.6), width: w, height: h })
    .resize(960)
    .webp({ quality: 82 })
    .toBuffer()
  return uploadPublicImage('listings', out, `vendors/${slug || 'listing'}-${Date.now()}.webp`, 'image/webp')
}

async function uniqueSlug(name) {
  const base = slugify(name) || 'partner'
  for (let n = 1; n < 50; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`
    const { data } = await supabase.from('explore_vendors').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
  }
  return `${base}-${Date.now()}`
}

// Guide pages show a stored vendor_count — keep it true after adds / hides / moves.
export async function recountGuides(slugs) {
  for (const slug of [...new Set(slugs.filter(Boolean))]) {
    const { count } = await supabase
      .from('explore_vendors')
      .select('id', { count: 'exact', head: true })
      .eq('guide_slug', slug)
      .eq('kind', 'vendor')
      .eq('is_active', true)
    await supabase.from('explore_guides').update({ vendor_count: count || 0 }).eq('slug', slug)
  }
}

// Guests (and Vitoria) see the change right away on this server; other instances within 5 min.
export function refreshListingCaches() {
  clearMemo('explore:')
  invalidateVitoriaKnowledge()
}

function directionsUrl(name, address, community) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address || community, 'FL'].filter(Boolean).join(' '))}`
}

// Fields shared by a partner request and a direct admin listing → an explore_vendors row.
export function listingFields(src) {
  const type = src.listing_type
  const community = src.community || null
  const common = {
    name: String(src.business_name || src.name || '').trim(),
    description: String(src.description || '').trim() || null,
    about: String(src.description || '').trim() || null,
    phone: String(src.phone || '').trim() || null,
    website_url: cleanUrl(src.website_url),
    place: community,
    community,
    address: String(src.address || '').trim() || null,
    hours: String(src.hours || '').trim() || null,
  }
  if (DINING_TYPES.includes(type)) {
    return {
      ...common,
      kind: 'restaurant',
      guide_slug: null,
      venue_type: type,
      venue_types: Array.isArray(src.venue_types) && src.venue_types.length ? src.venue_types.filter((t) => DINING_TYPES.includes(t)) : [type],
      cuisine: String(src.cuisine || '').trim() || null,
      map_name: community,
      map_line1: common.address,
      directions_url: directionsUrl(common.name, common.address, community),
      booking_platform: 'phone_only',
    }
  }
  return {
    ...common,
    kind: 'vendor',
    guide_slug: src.guide_slug,
    venue_type: null,
    venue_types: null,
    directions_url: common.address ? directionsUrl(common.name, common.address, community) : null,
  }
}

export function validateListing(src, guides) {
  if (!LISTING_TYPES[src.listing_type]) return 'Please choose what kind of business this is'
  if (src.listing_type === 'vendor' && !guides.some((g) => g.slug === src.guide_slug)) return 'Please choose a category'
  if (String(src.business_name || src.name || '').trim().length < 2) return 'Please add the business name'
  if (src.website_url && !cleanUrl(src.website_url)) return 'That website address doesn’t look right'
  return null
}

export async function createListing(src, { photoUrl = null } = {}) {
  const fields = listingFields(src)
  const slug = await uniqueSlug(fields.name)
  const { data: last } = await supabase
    .from('explore_vendors')
    .select('sort_order')
    .eq('kind', fields.kind)
    .order('sort_order', { ascending: false })
    .limit(1)
  const { data, error } = await supabase
    .from('explore_vendors')
    .insert({
      ...fields,
      slug,
      image_url: photoUrl || src.photo_url || null,
      sort_order: (last?.[0]?.sort_order || 0) + 1,
      last_verified_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    })
    .select('*')
    .single()
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  await recountGuides([data.guide_slug])
  refreshListingCaches()
  return data
}

export const LISTING_SELECT =
  'id, slug, kind, name, guide_slug, venue_type, venue_types, cuisine, community, place, address, phone, website_url, description, hours, image_url, is_active, created_at'

export function listingView(row) {
  return {
    ...row,
    listing_type: row.kind === 'restaurant' ? row.venue_type || 'restaurant' : 'vendor',
  }
}
