import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Mic, Paperclip, Plus } from 'lucide-react'

const CHIPS = ['Best beach today', 'Dinner tonight', 'Things to do', 'Top 5 Restaurants']

const GREETING = {
  from: 'vitoria',
  lines: ['Good Morning, Alex', 'How can I help to make your stay even better?'],
}

export default function AppVitoria() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])

  const send = (text) => {
    const clean = text.trim()
    if (!clean) return
    setMessages((prev) => {
      const next = prev.length === 0 ? [GREETING] : [...prev]
      next.push({ from: 'user', lines: [clean] })
      return next
    })
    setDraft('')
  }

  const onSubmit = (e) => {
    e.preventDefault()
    send(draft)
  }

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
            <button type="button" className="app-home-bell app-home-bell-soft" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="app-home-bell-dot" aria-hidden="true" />
            </button>
          </header>

          <div className="app-vitoria-body">
            {messages.length === 0 ? (
              <div className="app-vitoria-empty">
                <img
                  src="/victoria-logo.png"
                  alt="Hello Alex, what can I help you with?"
                  width={209}
                  height={258}
                />
              </div>
            ) : (
              <div className="app-vitoria-thread" aria-live="polite">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`app-vitoria-group${m.from === 'user' ? ' is-user' : ''}`}
                  >
                    {m.from === 'vitoria' ? (
                      <span className="app-vitoria-avatar is-dark" aria-hidden="true" />
                    ) : null}
                    <div className="app-vitoria-bubbles">
                      {m.lines.map((line) => (
                        <p key={line} className="app-vitoria-bubble">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
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
                <button type="button" className="app-vitoria-mic" aria-label="Voice">
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
