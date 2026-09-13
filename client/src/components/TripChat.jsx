import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import Spinner from './Spinner.jsx'
import { api } from '../lib/api.js'
import { errorMessage, formatTime } from '../lib/format.js'

// Per-trip chat thread for the driver dashboard. Polls while open so guest replies show up
// without a refresh. Guest side lives in TransferTrack (app) and pages/public/TripPage (SMS link).
export default function TripChat({ trip, me = 'driver', pollMs = 8000 }) {
  const [messages, setMessages] = useState([])
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        const data = await api(`/api/transfers/${trip.id}/messages`)
        if (ignore) return
        setMessages(data.messages || [])
        setOpen(Boolean(data.chat_open))
      } catch (err) {
        if (!ignore) setError(errorMessage(err))
      }
    }
    load()
    const timer = window.setInterval(load, pollMs)
    return () => {
      ignore = true
      window.clearInterval(timer)
    }
  }, [trip.id, pollMs])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function send(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const saved = await api(`/api/transfers/${trip.id}/messages`, { method: 'POST', body: { body } })
      // The poll may have fetched this message before the POST resolved — never append twice.
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]))
      setDraft('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say where you’ll meet the guest.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-msg${m.sender_role === me ? ' me' : ''}${m.sender_role === 'admin' ? ' admin' : ''}`}>
              <div className="chat-body">{m.body}</div>
              <div className="chat-meta">
                {m.sender_role === me ? 'You' : m.sender_name || m.sender_role} · {formatTime(m.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
      {error ? <p className="sheet-error">{error}</p> : null}
      {open ? (
        <form className="chat-input" onSubmit={send}>
          <input
            value={draft}
            placeholder="Message the guest…"
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn" disabled={sending || !draft.trim()} aria-label="Send">
            {sending ? <Spinner size={16} /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <p className="chat-empty">This trip has ended — chat is closed.</p>
      )}
    </div>
  )
}
