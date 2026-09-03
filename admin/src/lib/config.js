function stripApiOrigin(url) {
  let value = String(url || '')
    .trim()
    .replace(/\/$/, '')
  if (value.toLowerCase().endsWith('/api')) value = value.slice(0, -4)
  return value
}

export const API_URL = stripApiOrigin(import.meta.env.VITE_API_URL)
export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
export const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const missingEnv = [
  !API_URL && 'VITE_API_URL',
  !SUPABASE_URL && 'VITE_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)
