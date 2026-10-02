// Native-app feel (client request): inside the guest app, the staff apps and the QR welcome, the
// screen must not zoom or drift — no pinch zoom, no double-tap zoom, no iPhone auto-zoom when a text
// box is tapped, no whole-page bounce or sideways pan. The public website keeps normal zoom.
const APP_PATHS = /^\/(app|h|driver|shopper|partner|login|trip|tip)(\/|$)/

const LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
const FREE = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

let listening = false
let locked = false
let lastTouchEnd = 0

function blockGesture(event) {
  if (locked) event.preventDefault()
}

function blockPinch(event) {
  if (locked && event.touches && event.touches.length > 1) event.preventDefault()
}

// iOS Safari ignores user-scalable=no, so double-tap zoom is stopped here.
function blockDoubleTap(event) {
  if (!locked) return
  const now = Date.now()
  if (now - lastTouchEnd < 300 && !event.target.closest?.('input, textarea, select')) event.preventDefault()
  lastTouchEnd = now
}

export function applyViewportLock(pathname) {
  locked = APP_PATHS.test(pathname || '')
  const meta = document.querySelector('meta[name="viewport"]')
  const content = locked ? LOCKED : FREE
  if (meta && meta.getAttribute('content') !== content) meta.setAttribute('content', content)
  document.documentElement.classList.toggle('is-app-locked', locked)
  if (!listening) {
    listening = true
    document.addEventListener('gesturestart', blockGesture, { passive: false })
    document.addEventListener('gesturechange', blockGesture, { passive: false })
    document.addEventListener('touchmove', blockPinch, { passive: false })
    document.addEventListener('touchend', blockDoubleTap, { passive: false })
  }
}
