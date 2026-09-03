import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'

const TOKEN_TTL_MS = 5 * 60 * 1000
const PROFILE_TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 500

const tokenCache = new Map()
const profileCache = new Map()

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || ''

function prune(map) {
  const now = Date.now()
  for (const [key, entry] of map) {
    if (entry.expiresAt <= now) map.delete(key)
  }
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value
    map.delete(oldest)
  }
}

function cacheGet(map, key) {
  const entry = map.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    map.delete(key)
    return null
  }
  return entry.value
}

function cacheSet(map, key, value, ttl = TOKEN_TTL_MS) {
  if (map.has(key)) map.delete(key)
  map.set(key, { value, expiresAt: Date.now() + ttl })
  prune(map)
}

export function invalidateAuthToken(token) {
  if (token) tokenCache.delete(token)
}

function b64urlJson(part) {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/')
  const buf = Buffer.from(padded, 'base64')
  return JSON.parse(buf.toString('utf8'))
}

function verifyHs256(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest()
  const actual = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null
  }
  const header = b64urlJson(headerB64)
  if (header.alg !== 'HS256') return null
  const payload = b64urlJson(payloadB64)
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) return null
  if (!payload.sub) return null
  return payload
}

async function loadProfile(userId) {
  const cached = cacheGet(profileCache, userId)
  if (cached) return cached

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, name, roles, is_active')
    .eq('id', userId)
    .single()

  if (error || !profile) return null
  cacheSet(profileCache, userId, profile, PROFILE_TTL_MS)
  return profile
}

async function userFromToken(token) {
  const cached = cacheGet(tokenCache, token)
  if (cached) return cached

  let userId = null

  if (JWT_SECRET) {
    const payload = verifyHs256(token, JWT_SECRET)
    if (!payload) return null
    userId = payload.sub
  } else {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    userId = data.user.id
  }

  const profile = await loadProfile(userId)
  if (!profile) return null

  const user = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    roles: profile.roles || [],
    is_active: profile.is_active,
  }
  cacheSet(tokenCache, token, user, TOKEN_TTL_MS)
  return user
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await userFromToken(token)
    if (!user) {
      invalidateAuthToken(token)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account disabled' })
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles || [],
    }

    next()
  } catch (error) {
    next(error)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || []
    const allowed = roles.some((role) => userRoles.includes(role))
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
