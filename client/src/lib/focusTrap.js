import { useEffect } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(ref, active, onClose) {
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
        onClose?.()
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
  }, [active, onClose, ref])
}
