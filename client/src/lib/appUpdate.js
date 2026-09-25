import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// A tab left open on a phone keeps running the build it first loaded, for days, so guests
// kept seeing screens we had already replaced. Compare our script bundle with the one the
// live index.html points to (on focus and every 10 minutes); once a newer build is out, the
// next screen change loads it. Nobody loses a half-filled form: we never reload in place.
const BUNDLE = /src="(\/assets\/index-[^"]+\.js)"/
let stale = false

function runningBundle() {
  return document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') || null
}

async function check() {
  const mine = runningBundle()
  if (!mine || stale) return
  try {
    const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
    const live = (await res.text()).match(BUNDLE)?.[1]
    if (live && live !== mine) stale = true
  } catch {
    /* offline: try again later */
  }
}

export function useFreshBuild() {
  const location = useLocation()
  const first = useRef(true)

  useEffect(() => {
    if (import.meta.env.DEV) return undefined
    const onVisible = () => document.visibilityState === 'visible' && check()
    const timer = setInterval(check, 10 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // The URL has already changed to the new screen, so a reload lands right there.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (stale) window.location.reload()
  }, [location.pathname])
}
