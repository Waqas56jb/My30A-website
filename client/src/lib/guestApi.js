// Guest mobile-app API client (wraps /api/guest/* and the shared notification routes).
import { useCallback, useEffect, useState } from 'react'
import { api, apiUpload, setAccessToken, withQuery } from './api.js'
import { supabase } from './supabase.js'

const NAME_KEY = 'my30a-guest-name'

async function adoptSession(result) {
  if (result?.session?.access_token) {
    setAccessToken(result.session.access_token)
    if (supabase) {
      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })
      if (error) throw error
    }
  }
  try {
    if (result?.user?.first_name) localStorage.setItem(NAME_KEY, result.user.first_name)
  } catch {
    /* ignore */
  }
  return result
}

export function rememberedName() {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function errorText(error, fallback = 'Something went wrong. Please try again.') {
  return error?.data?.error || error?.message || fallback
}

export const guest = {
  // auth
  signup: (body) => api('/api/guest/signup', { method: 'POST', body }).then((r) => (queryCache.clear(), adoptSession(r))),
  login: (body) => api('/api/guest/login', { method: 'POST', body }).then((r) => (queryCache.clear(), adoptSession(r))),
  signOut: async () => {
    queryCache.clear()
    setAccessToken(null)
    if (supabase) await supabase.auth.signOut()
  },

  // profile & stay
  me: () => api('/api/guest/me'),
  updateMe: (body) => api('/api/guest/me', { method: 'PATCH', body }),
  home: () => api('/api/guest/home'),
  booking: () => api('/api/guest/booking'),
  saveBooking: (body) => api('/api/guest/booking', { method: 'PUT', body }),
  communities: () => api('/api/guest/communities'),
  catalog: () => api('/api/guest/catalog'),
  addressAutocomplete: (q) => api(withQuery('/api/guest/address-autocomplete', { q })),
  addressCheck: (body) => api('/api/guest/address-check', { method: 'POST', body }),
  notifications: () => api('/api/notifications/mine'),

  // explore
  explore: () => api('/api/guest/explore'),
  guide: (c) => api(withQuery('/api/guest/explore/guide', { c })),
  search: (q) => api(withQuery('/api/guest/explore/search', { q })),
  vendors: (slug) => api(`/api/guest/explore/vendors/${encodeURIComponent(slug)}`),
  vendor: (key) => api(`/api/guest/explore/vendor/${encodeURIComponent(key)}`),
  info: () => api('/api/guest/explore/info'),
  dining: () => api('/api/guest/explore/dining'),
  beaches: () => api('/api/guest/explore/beaches'),
  events: () => api('/api/guest/explore/events'),
  saved: () => api('/api/guest/saved'),
  save: (key) => api(`/api/guest/saved/${encodeURIComponent(key)}`, { method: 'POST' }),
  unsave: (key) => api(`/api/guest/saved/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  // airport transfers
  transferQuote: (body) => api('/api/guest/transfers/quote', { method: 'POST', body }),
  createTransfer: (body) => api('/api/guest/transfers', { method: 'POST', body }),
  transfers: (params) => api(withQuery('/api/guest/transfers', params)),
  transfer: (id) => api(`/api/guest/transfers/${id}`),
  payTransfer: (id, payment_method) =>
    api(`/api/guest/transfers/${id}/pay`, { method: 'POST', body: { payment_method } }),
  syncTransferPayment: (id) => api(`/api/guest/transfers/${id}/sync-payment`, { method: 'POST' }),
  cancelTransfer: (id) => api(`/api/guest/transfers/${id}/cancel`, { method: 'POST' }),
  tipTransfer: (id, tip_amount) =>
    api(`/api/guest/transfers/${id}/tip`, { method: 'POST', body: { tip_amount } }),
  cancellationPreview: (id) => api(`/api/guest/transfers/${id}/cancellation-preview`),
  messages: (id) => api(`/api/guest/transfers/${id}/messages`),
  sendMessage: (id, body) =>
    api(`/api/guest/transfers/${id}/messages`, { method: 'POST', body: { body } }),

  // grocery
  groceryQuote: (body) => api('/api/guest/grocery/quote', { method: 'POST', body }),
  createGrocery: (body) => api('/api/guest/grocery', { method: 'POST', body }),
  groceries: (params) => api(withQuery('/api/guest/grocery', params)),
  grocery: (id) => api(`/api/guest/grocery/${id}`),
  uploadList: (id, file) => {
    const form = new FormData()
    form.append('list_file', file)
    return apiUpload(`/api/guest/grocery/${id}/list-file`, form)
  },
  payGrocery: (id, payment_method) =>
    api(`/api/guest/grocery/${id}/pay`, { method: 'POST', body: { payment_method } }),
  syncGroceryPayment: (id) => api(`/api/guest/grocery/${id}/sync-payment`, { method: 'POST' }),
  markGroceryCardSaved: (id) => api(`/api/guest/grocery/${id}/card-saved`, { method: 'POST' }),
  cancelGrocery: (id) => api(`/api/guest/grocery/${id}/cancel`, { method: 'POST' }),
  tipGrocery: (id, tip_amount) =>
    api(`/api/guest/grocery/${id}/tip`, { method: 'POST', body: { tip_amount } }),

  // Vitoria
  vitoria: () => api('/api/guest/vitoria/messages'),
  ask: (content) => api('/api/guest/vitoria/messages', { method: 'POST', body: { content } }),
  voiceSession: () => api('/api/guest/vitoria/voice/session', { method: 'POST' }),
  voiceTool: (name, args) => api('/api/guest/vitoria/voice/tool', { method: 'POST', body: { name, arguments: args } }),
  voiceLog: (turns) => api('/api/guest/vitoria/voice/log', { method: 'POST', body: { turns } }),
  clearVitoria: () => api('/api/guest/vitoria/messages', { method: 'DELETE' }),
}

// Secret-link pages (no login): my30ahost.com/trip/<token> and /tip/<token>, reached by SMS.
export const pub = {
  trip: (token) => api(`/api/public/trip/${token}`),
  sendMessage: (token, body) => api(`/api/public/trip/${token}/messages`, { method: 'POST', body: { body } }),
  tip: (token) => api(`/api/public/tip/${token}`),
  sendTip: (token, tip_amount) => api(`/api/public/tip/${token}`, { method: 'POST', body: { tip_amount } }),
  confirmTip: (token, session_id) =>
    api(`/api/public/tip/${token}/confirm`, { method: 'POST', body: { session_id } }),
}

// Small data hook: { data, loading, error, reload }. `loader` is re-run when deps change.
// Stale-while-revalidate: a screen the guest has already opened renders its last data instantly
// (no blank flash when hopping between tabs) while a fresh copy loads in the background. Keyed by
// the loader's source plus its deps, so `() => guest.vendor(slug)` caches per slug. Cleared on
// login/logout so one account never sees another's data.
const queryCache = new Map()
const MAX_ENTRIES = 60

function cacheKey(loader, deps) {
  try {
    return `${loader.toString()}|${JSON.stringify(deps)}`
  } catch {
    return null
  }
}

export function useGuestQuery(loader, deps = [], { enabled = true } = {}) {
  const key = cacheKey(loader, deps)
  const cached = key ? queryCache.get(key) : undefined
  const [tick, setTick] = useState(0)
  const [state, setState] = useState(() =>
    cached !== undefined
      ? { data: cached, loading: false, error: null }
      : { data: null, loading: enabled, error: null }
  )
  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return undefined
    let ignore = false
    const hit = key ? queryCache.get(key) : undefined
    // With cached data, refresh silently; only a cold load shows the loading state.
    setState((current) =>
      hit !== undefined && tick === 0
        ? { data: hit, loading: false, error: null }
        : { ...current, loading: true, error: null }
    )
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (key) {
          queryCache.delete(key)
          queryCache.set(key, data)
          if (queryCache.size > MAX_ENTRIES) queryCache.delete(queryCache.keys().next().value)
        }
        if (!ignore) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!ignore) setState((current) => (current.data && hit !== undefined ? { ...current, loading: false } : { data: null, loading: false, error }))
      })
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled])

  return { ...state, reload }
}

export function initials(name, email) {
  const clean = String(name || '').trim()
  if (clean) {
    return clean
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('')
  }
  return String(email || 'G')[0].toUpperCase()
}
