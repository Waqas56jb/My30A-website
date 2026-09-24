// Tiny in-process cache for data that is identical for every guest (Explore categories, guides,
// vendor lists, public info). Each Supabase round trip costs ~0.5–1s from here, so serving these
// from memory makes Explore feel instant. Admin content writes call clearMemo() so edits show up
// immediately; the TTL only bounds staleness from direct DB edits.
const store = new Map()
const TTL_MS = 5 * 60 * 1000

export async function memo(key, loader, ttlMs = TTL_MS) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const pending = loader()
  store.set(key, { at: Date.now(), value: pending })
  try {
    const value = await pending
    store.set(key, { at: Date.now(), value })
    return value
  } catch (error) {
    store.delete(key)
    throw error
  }
}

export function clearMemo(prefix = '') {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key)
}
