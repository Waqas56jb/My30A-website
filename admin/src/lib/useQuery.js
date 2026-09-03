import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

const cache = new Map()
const inflight = new Map()
const listeners = new Map()

function notify(key) {
  const entry = cache.get(key)
  for (const fn of listeners.get(key) || []) fn(entry)
}

function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(fn)
  return () => listeners.get(key)?.delete(fn)
}

export function peekQuery(key) {
  return cache.get(key)?.data ?? null
}

export async function fetchQuery(key) {
  if (inflight.has(key)) return inflight.get(key)

  const promise = api(key)
    .then((data) => {
      cache.set(key, { data, error: null, at: Date.now() })
      notify(key)
      return data
    })
    .catch((error) => {
      const prev = cache.get(key)
      cache.set(key, { data: prev?.data ?? null, error, at: Date.now() })
      notify(key)
      throw error
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

export function invalidateQuery(key) {
  if (!key) {
    cache.clear()
    return
  }
  for (const cachedKey of [...cache.keys()]) {
    if (cachedKey === key || cachedKey.startsWith(key)) cache.delete(cachedKey)
  }
}

export function useQuery(path, { enabled = true } = {}) {
  const cached = path ? cache.get(path) : null
  const [data, setData] = useState(cached?.data ?? null)
  const [error, setError] = useState(cached?.error ?? null)
  const [loading, setLoading] = useState(Boolean(enabled && path && !cached?.data))

  const refetch = useCallback(
    async ({ silent = false } = {}) => {
      if (!path) return null
      if (!silent && !cache.get(path)?.data) setLoading(true)
      try {
        const next = await fetchQuery(path)
        setData(next)
        setError(null)
        return next
      } catch (err) {
        setError(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [path]
  )

  useEffect(() => {
    if (!path) {
      setData(null)
      setError(null)
      setLoading(false)
      return undefined
    }

    const unsub = subscribe(path, (entry) => {
      if (!entry) return
      setData(entry.data)
      setError(entry.error)
      if (entry.data) setLoading(false)
    })

    if (!enabled) return unsub

    const hit = cache.get(path)
    setData(hit?.data ?? null)
    setError(hit?.error ?? null)
    if (hit?.data) {
      setLoading(false)
      refetch({ silent: true }).catch(() => {})
    } else {
      refetch().catch(() => {})
    }

    return unsub
  }, [path, enabled, refetch])

  return {
    data,
    error,
    loading: loading && !data,
    refetch: () => refetch({ silent: false }),
  }
}
