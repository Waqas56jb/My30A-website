// Host version: when a guest enters through the QR code in a host's rental (/h/<slug>), the app
// shows that host's logo (welcome, sign-in, home screen) and a "My Home" tab. Host mode belongs to
// this device + QR link only: it is never restored from the guest's account, every API request in
// host mode names the property (X-My30A-Home), and opening the main website switches back to the
// free app — so host info can't leak into the free app or across hosts.
import { useSyncExternalStore } from 'react'
import { api } from './api.js'
import { clearGuestCache } from './guestApi.js'

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

// Sign-in / sign-up show a host's logo only when this browser visit came through that host's QR
// link — never on the main website's "Get started" path, even with an old host mode on the device.
const ENTRY_KEY = 'my30a-host-entry'
export function markHostEntry(slug) {
  try {
    sessionStorage.setItem(ENTRY_KEY, slug)
  } catch {
    /* no session storage — auth screens stay My30A-branded */
  }
}
export function useAuthHostBrand() {
  const current = useHostBrand()
  let entry = null
  try {
    entry = sessionStorage.getItem(ENTRY_KEY)
  } catch {
    entry = null
  }
  return current && entry && entry === current.slug ? current : null
}

// Back to the free app (main website, "Get started" from my30ahost.com).
export function leaveHostMode() {
  write(PENDING_KEY, null)
  try {
    sessionStorage.removeItem(ENTRY_KEY)
  } catch {
    /* ignore */
  }
  if (brand) setHostBrand(null)
}

export function setHostBrand(next) {
  if ((brand?.slug || null) !== (next?.slug || null)) clearGuestCache()
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
  // No QR link on this device = free app: nothing to restore. In host mode, re-check the property
  // (switched off / plan lapsed → back to the free app).
  syncing = (pending ? claimOnce(pending, false) : brand ? hostApi.mine() : Promise.resolve({ brand: null }))
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
