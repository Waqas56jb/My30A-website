// Guest notifications: one shared watcher for the whole guest app.
//  - polls the unread count every 20s and whenever the app returns to the foreground
//  - when something new arrives: plays a soft two-tone chime (Web Audio, no file to load),
//    vibrates on phones that support it, and shows an in-app banner with the message
//  - exposes the unread count to every bell (useUnreadCount)
// Sound can be turned off in Profile → Settings (stored per device).
import { useEffect, useState } from 'react'
import { guest } from './guestApi.js'

const SOUND_KEY = 'my30a-notification-sound'
const listeners = new Set()
let state = { unread: 0, latest: null, banner: null }
let started = false
let timer = null
let lastSeenId = null
let audioCtx = null

function emit(patch) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state)
}

export function soundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
}

// Browsers (iOS especially) only allow audio after a user gesture — unlock on the first touch.
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    /* no audio */
  }
}

export function playChime() {
  if (!soundEnabled()) return
  try {
    unlockAudio()
    if (!audioCtx) return
    const now = audioCtx.currentTime
    // Two soft bell tones (E6 → A6), like a concierge desk bell.
    for (const [freq, at] of [[1318.5, 0], [1760, 0.14]]) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.7)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.75)
    }
  } catch {
    /* no audio */
  }
  try {
    navigator.vibrate?.([30, 60, 30])
  } catch {
    /* no vibration */
  }
}

async function check() {
  try {
    const data = await guest.unreadNotifications()
    const list = data.notifications || []
    const newest = list[0] || null
    const isNew = newest && lastSeenId !== null && newest.id !== lastSeenId && data.unread_count >= state.unread
    if (lastSeenId === null || newest?.id !== lastSeenId) lastSeenId = newest?.id || lastSeenId || ''
    emit({ unread: data.unread_count || 0, latest: newest })
    if (isNew) {
      playChime()
      emit({ banner: newest })
    }
  } catch {
    /* offline or signed out — try again next tick */
  }
}

export function startNotificationWatcher() {
  if (started) return
  started = true
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  check()
  timer = setInterval(check, 20000)
}

export function stopNotificationWatcher() {
  started = false
  clearInterval(timer)
  lastSeenId = null
  emit({ unread: 0, latest: null, banner: null })
}

export function refreshNotifications() {
  return check()
}

export function setUnread(count) {
  emit({ unread: count })
}

export function dismissBanner() {
  emit({ banner: null })
}

export function useNotificationState() {
  const [snap, setSnap] = useState(state)
  useEffect(() => {
    listeners.add(setSnap)
    setSnap(state)
    return () => listeners.delete(setSnap)
  }, [])
  return snap
}

export function useUnreadCount() {
  return useNotificationState().unread
}

// Where a notification should take the guest.
export function notificationLink(n) {
  if (n?.transfer_id) return `/app/transfer/track?id=${n.transfer_id}`
  if (n?.grocery_order_id) return `/app/grocery/track?id=${n.grocery_order_id}`
  return '/app/notifications'
}
