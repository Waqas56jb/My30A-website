import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(ref, active, onClose) {
  // onClose is usually an inline arrow, i.e. a new function on every render (every keystroke in the
  // form). Keeping it in a ref means the trap is set up once per opening — before this, each
  // re-render re-ran the effect and yanked focus back to the first field while the admin typed.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    if (!node) return undefined

    const trigger = document.activeElement
    const items = () => [...node.querySelectorAll(FOCUSABLE)]

    const first = items()[0]
    if (first) first.focus()
    else node.focus()

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const list = items()
      if (!list.length) return
      const start = list[0]
      const end = list[list.length - 1]
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault()
        end.focus()
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault()
        start.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (trigger && typeof trigger.focus === 'function') trigger.focus()
    }
  }, [active, ref])
}
