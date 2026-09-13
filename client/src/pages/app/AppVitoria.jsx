import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Mic, Paperclip, Plus } from 'lucide-react'
import { errorText, guest } from '../../lib/guestApi.js'

const CHIPS = ['Best beach today', 'Dinner tonight', 'Things to do', 'Top 5 Restaurants']
const FOLLOW_UP = 'How can I help to make your stay even better?'

// Collapse consecutive messages from the same side into one bubble group.
function groupMessages(messages) {
  const groups = []
  for (const m of messages) {
    const from = m.role === 'assistant' ? 'vitoria' : 'user'
    const last = groups[groups.length - 1]
    if (last && last.from === from) last.lines.push(m.content)
    else groups.push({ from, lines: [m.content], key: m.id })
  }
  return groups
}

export default function AppVitoria() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [greeting, setGreeting] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    let ignore = false
    guest
      .vitoria()
      .then((data) => {
        if (ignore) return
        setGreeting(data.greeting || '')
        setMessages(data.messages || [])
      })
      .catch((err) => !ignore && setError(errorText(err)))
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const send = async (text) => {
    const clean = text.trim()
    if (!clean || thinking) return
    setError('')
    setDraft('')
    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: clean }
    setMessages((prev) => [...prev, optimistic])
    setThinking(true)
    try {
      const reply = await guest.ask(clean)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        reply.user,
        reply.assistant,
      ])
    } catch (err) {
      setError(errorText(err))
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setThinking(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    send(draft)
  }

  const groups = groupMessages(messages)
  const thread = messages.length
    ? [{ from: 'vitoria', lines: [greeting || 'Hello', FOLLOW_UP], key: 'greeting' }, ...groups]
    : []

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-vitoria">
          <span className="app-vitoria-glow" aria-hidden="true" />

          <header className="app-vitoria-head">
            <div className="app-vitoria-who">
              <button
                type="button"
                className="app-vitoria-back"
                aria-label="Back"
                onClick={() => navigate('/app/home')}
              >
                <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <span className="app-vitoria-avatar" role="img" aria-label="Vitoria" />
              <div className="app-vitoria-name">
                <h1>Vitoria</h1>
                <p>Your AI Concierge</p>
              </div>
            </div>
            <button
              type="button"
              className="app-home-bell app-home-bell-soft"
              aria-label="Notifications"
              onClick={() => navigate('/app/profile')}
            >
              <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </header>

          <div className="app-vitoria-body" ref={bodyRef}>
            {thread.length === 0 ? (
              <div className="app-vitoria-empty">
                <img
                  src="/victoria-logo.png"
                  alt={`${greeting || 'Hello'}, what can I help you with?`}
                  width={209}
                  height={258}
                />
              </div>
            ) : (
              <div className="app-vitoria-thread" aria-live="polite">
                {thread.map((m) => (
                  <div
                    key={m.key}
                    className={`app-vitoria-group${m.from === 'user' ? ' is-user' : ''}`}
                  >
                    {m.from === 'vitoria' ? (
                      <span className="app-vitoria-avatar is-dark" aria-hidden="true" />
                    ) : null}
                    <div className="app-vitoria-bubbles">
                      {m.lines.map((line, i) => (
                        <p key={`${m.key}-${i}`} className="app-vitoria-bubble">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {thinking ? (
                  <div className="app-vitoria-group">
                    <span className="app-vitoria-avatar is-dark" aria-hidden="true" />
                    <div className="app-vitoria-bubbles">
                      <p className="app-vitoria-bubble is-thinking">Vitoria is typing…</p>
                    </div>
                  </div>
                ) : null}
                {error ? <p className="app-inline-error">{error}</p> : null}
              </div>
            )}
          </div>

          <div className="app-vitoria-dock">
            <div className="app-vitoria-chips">
              {CHIPS.map((c) => (
                <button key={c} type="button" className="app-vitoria-chip" onClick={() => send(c)}>
                  {c}
                </button>
              ))}
            </div>

            <form className="app-vitoria-input" onSubmit={onSubmit}>
              <label className="app-vitoria-input-left">
                <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
                <input
                  type="text"
                  name="ask"
                  placeholder="Ask Anything"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div className="app-vitoria-input-right">
                <button type="button" className="app-vitoria-attach" aria-label="Attach">
                  <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button type="submit" className="app-vitoria-mic" aria-label="Send">
                  <Mic size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
