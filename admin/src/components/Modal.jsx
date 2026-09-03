import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focusTrap.js'

export default function Modal({ open, onClose, title, width, children }) {
  const panelRef = useRef(null)
  const [present, setPresent] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setPresent(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = window.setTimeout(() => setPresent(false), 220)
    return () => window.clearTimeout(timer)
  }, [open])

  useFocusTrap(panelRef, visible, onClose)

  if (!present) return null

  return (
    <div
      className={`modal${visible ? ' open' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        style={width ? { width } : undefined}
      >
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    </div>
  )
}
