import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focusTrap.js'

export default function BottomSheet({ open, onClose, title, sub, children }) {
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

  useEffect(() => {
    if (!visible) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!present) return null

  return (
    <div
      className={`sheet-bg${visible ? ' open' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        {title ? <h3 id="sheet-title">{title}</h3> : null}
        {sub ? <div className="sub">{sub}</div> : null}
        {children}
      </div>
    </div>
  )
}
