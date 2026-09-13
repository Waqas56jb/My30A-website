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
  signup: (body) => api('/api/guest/signup', { method: 'POST', body }).then(adoptSession),
  login: (body) => api('/api/guest/login', { method: 'POST', body }).then(adoptSession),
  signOut: async () => {
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
  notifications: () => api('/api/notifications/mine'),

  // explore
  explore: () => api('/api/guest/explore'),
  guide: (c) => api(withQuery('/api/guest/explore/guide', { c })),
  search: (q) => api(withQuery('/api/guest/explore/search', { q })),
  vendors: (slug) => api(`/api/guest/explore/vendors/${encodeURIComponent(slug)}`),
  vendor: (key) => api(`/api/guest/explore/vendor/${encodeURIComponent(key)}`),
  info: () => api('/api/guest/explore/info'),
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
  cancelGrocery: (id) => api(`/api/guest/grocery/${id}/cancel`, { method: 'POST' }),
  tipGrocery: (id, tip_amount) =>
    api(`/api/guest/grocery/${id}/tip`, { method: 'POST', body: { tip_amount } }),

  // Vitoria
  vitoria: () => api('/api/guest/vitoria/messages'),
  ask: (content) => api('/api/guest/vitoria/messages', { method: 'POST', body: { content } }),
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
export function useGuestQuery(loader, deps = [], { enabled = true } = {}) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ data: null, loading: enabled, error: null })
  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return undefined
    let ignore = false
    setState((current) => ({ ...current, loading: true, error: null }))
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!ignore) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!ignore) setState({ data: null, loading: false, error })
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
