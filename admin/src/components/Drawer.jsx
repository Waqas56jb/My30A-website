import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/focusTrap.js'

export default function Drawer({ open, onClose, children }) {
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
    <div className={`drawer-root${visible ? ' open' : ''}`}>
      <button type="button" className="drawer-backdrop" aria-label="Close panel" onClick={onClose} />
      <aside
        className={`drawer${visible ? ' open' : ''}`}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </div>
  )
}
