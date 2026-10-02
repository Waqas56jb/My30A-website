// Host version: when a guest enters through the QR code in a host's rental (/h/<slug>), the app
// shows that host's logo (welcome, sign-in, home screen) and a "My Home" tab. The branding is kept
// on the device so it appears instantly, and the property is linked to the guest's account on
// sign-in so it follows them to other devices.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'

const BRAND_KEY = 'my30a-host-brand'
const PENDING_KEY = 'my30a-host-pending'

const listeners = new Set()
let brand = read(BRAND_KEY, true)

function read(key, json) {
  try {
    const value = localStorage.getItem(key)
    return json ? (value ? JSON.parse(value) : null) : value
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    /* private mode — branding just won't persist */
  }
}

export function setHostBrand(next) {
  brand = next || null
  write(BRAND_KEY, brand)
  listeners.forEach((fn) => fn())
}

export function useHostBrand() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => brand
  )
}

export const hostApi = {
  brand: (slug) => api(`/api/public/home/${encodeURIComponent(slug)}`),
  mine: () => api('/api/guest/my-home'),
  claim: (slug, open = false) => api('/api/guest/my-home', { method: 'POST', body: { slug, open } }),
  leave: () => api('/api/guest/my-home', { method: 'DELETE' }),
}

// QR scanned before signing in: remember the property and link it once the guest is signed in.
export function rememberPendingHome(slug) {
  write(PENDING_KEY, slug)
}

// Both the My Home tab and the sign-in sync may link the same scanned property at once — share one
// request so the host's "joined" count stays exact.
let claiming = null
let claimingOpen = false
function claimOnce(slug, open) {
  if (!claiming) {
    claimingOpen = open
    claiming = hostApi.claim(slug, open).finally(() => {
      window.setTimeout(() => {
        claiming = null
      }, 5000)
    })
  }
  return claiming
}

// The My Home tab's loader: links a QR code scanned before sign-in first (the GuestRoute sync may
// not have run yet on the first screen after logging in), then loads the property.
export async function loadMyHome() {
  const pending = read(PENDING_KEY, false)
  if (pending) {
    try {
      const counted = !claiming || claimingOpen
      const linked = await claimOnce(pending, true)
      write(PENDING_KEY, null)
      // If the sign-in sync made the link, load My Home normally so this view counts as an open.
      const result = counted ? linked : await hostApi.mine()
      setHostBrand(result?.brand || null)
      return result
    } catch (error) {
      if (error?.status !== 404) throw error
      write(PENDING_KEY, null)
    }
  }
  const result = await hostApi.mine()
  setHostBrand(result?.brand || null)
  return result
}

let syncing = null
let syncedFor = null
// Called once a guest session exists: links a pending QR property, else refreshes the branding
// from the account (a guest of a host property on a new phone gets the host's logo too).
export function syncHostHome(userId) {
  if (syncing && syncedFor === userId) return syncing
  syncedFor = userId
  const pending = read(PENDING_KEY, false)
  syncing = (pending ? claimOnce(pending, false) : hostApi.mine())
    .then((result) => {
      if (pending) write(PENDING_KEY, null)
      setHostBrand(result?.brand || null)
      return result
    })
    .catch((error) => {
      // A dead QR link shouldn't block the app — drop it and keep the normal version.
      if (pending && error?.status === 404) write(PENDING_KEY, null)
      return null
    })
    .finally(() => {
      window.setTimeout(() => {
        syncing = null
      }, 30000)
    })
  return syncing
}
