import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Bell,
  Car,
  Clock,
  Globe,
  Leaf,
  MapPin,
  Mic,
  Navigation,
  Phone,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  Umbrella,
  UtensilsCrossed,
  Waves,
} from 'lucide-react'
import { errorText, guest } from '../../lib/guestApi.js'

const CHIPS = ['Best beach today', 'Dinner tonight', 'Things to do', 'Top 5 Restaurants']
const FOLLOW_UP = 'How can I help to make your stay even better?'

// A reply is written as real paragraphs separated by a blank line (see the server's system
// prompt) — each paragraph becomes its own rounded bubble, the way a person sends a few short
// texts in a row rather than one dense block.
function paragraphsOf(content) {
  return String(content || '')
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
}

// Server history first, then any local messages it doesn't know about yet (an optimistic send
// or a reply that landed while the history was still loading) — never the same id twice.
function mergeById(base, extra) {
  const seen = new Set(base.map((m) => m.id))
  return [...base, ...extra.filter((m) => m && !seen.has(m.id))]
}

// Collapse consecutive messages from the same side into one bubble group; place cards attached to
// an assistant message ride along with its group and render under its bubbles.
function groupMessages(messages) {
  const groups = []
  for (const m of messages) {
    const from = m.role === 'assistant' ? 'vitoria' : 'user'
    const last = groups[groups.length - 1]
    const paragraphs = paragraphsOf(m.content)
    const places = Array.isArray(m.places) ? m.places : []
    if (last && last.from === from) {
      last.lines.push(...paragraphs)
      last.places.push(...places)
    } else groups.push({ from, lines: paragraphs, places, key: m.id })
  }
  return groups
}

// Card header: a real partner photo when we have one, otherwise a themed gradient + icon —
// never a mismatched stock photo (a beach picture on a restaurant).
const THEMES = [
  { test: /restaurant|dining|seafood|sushi|italian|grill|bar|cafe|café|pizza|tapas|brunch|breakfast|bistro|steak|food|wine|cocktail/i, Icon: UtensilsCrossed, tone: 'is-dine' },
  { test: /beach|access|bonfire|chair|umbrella/i, Icon: Umbrella, tone: 'is-beach' },
  { test: /water|boat|kayak|paddle|charter|fishing|jet|yacht|surf/i, Icon: Waves, tone: 'is-water' },
  { test: /golf|cart|bike|rental/i, Icon: Car, tone: 'is-ride' },
  { test: /spa|yoga|wellness|massage|pilates|fitness/i, Icon: Leaf, tone: 'is-well' },
  { test: /shop|boutique|market|gallery|store/i, Icon: ShoppingBag, tone: 'is-shop' },
]
const themeFor = (place) =>
  THEMES.find((t) => t.test.test(`${place.category} ${place.name}`)) || { Icon: Sparkles, tone: 'is-misc' }

function PlaceCard({ place }) {
  const { Icon, tone } = themeFor(place)
  const tel = place.phone ? `tel:${place.phone.replace(/[^\d+]/g, '')}` : null
  const hours = String(place.hours || '')
  const [status, ...rest] = hours.split(' · ')
  const hasStatus = place.open_now === true || place.open_now === false
  return (
    <article className="app-vit-card">
      {place.to ? <Link to={place.to} className="app-vit-card-hit" aria-label={`Open ${place.name}`} /> : null}
      <div className={`app-vit-card-top ${place.image ? 'has-photo' : tone}`}>
        {place.image ? (
          <img src={place.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <Icon size={26} strokeWidth={1.4} aria-hidden="true" />
        )}
        {hasStatus ? (
          <span className={`app-vit-card-open${place.open_now ? ' is-open' : ''}`}>
            {place.open_now ? <span className="app-live-dot" aria-hidden="true" /> : null}
            {status}
          </span>
        ) : null}
        {place.price ? <span className="app-vit-card-price">{place.price}</span> : null}
        {place.partner ? (
          <span className="app-vit-card-badge">
            <BadgeCheck size={12} strokeWidth={2} aria-hidden="true" />
            My30A Partner
          </span>
        ) : place.in_guide ? (
          <span className="app-vit-card-badge is-fav">
            <Star size={12} strokeWidth={2} aria-hidden="true" />
            Local Favorite
          </span>
        ) : null}
      </div>
      <div className="app-vit-card-body">
        <h3>{place.name}</h3>
        <p className="app-vit-card-meta">
          <MapPin size={12} strokeWidth={1.8} aria-hidden="true" />
          {[place.area, place.category].filter(Boolean).join(' · ')}
        </p>
        {place.why ? <p className="app-vit-card-why">{place.why}</p> : null}
        {hours && (!hasStatus || rest.length) ? (
          <p className="app-vit-card-hours">
            <Clock size={12} strokeWidth={1.8} aria-hidden="true" />
            {hasStatus ? rest.join(' · ') : hours}
          </p>
        ) : null}
        <div className="app-vit-card-actions">
          {place.booking ? (
            <a href={place.booking} target="_blank" rel="noreferrer" className="app-vit-card-btn is-primary">
              <CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" />
              Reserve
            </a>
          ) : null}
          {tel ? (
            <a href={tel} className={`app-vit-card-btn${place.booking ? '' : ' is-primary'}`}>
              <Phone size={13} strokeWidth={1.8} aria-hidden="true" />
              Call
            </a>
          ) : null}
          {place.website ? (
            <a href={place.website} target="_blank" rel="noreferrer" className="app-vit-card-btn">
              <Globe size={13} strokeWidth={1.8} aria-hidden="true" />
              Website
            </a>
          ) : null}
          <a href={place.directions} target="_blank" rel="noreferrer" className={`app-vit-card-btn${tel || place.booking ? '' : ' is-primary'}`}>
            <Navigation size={13} strokeWidth={1.8} aria-hidden="true" />
            Map
          </a>
        </div>
        {place.to || place.slug ? (
          <Link to={place.to || `/app/explore/vendor/${place.slug}`} className="app-vit-card-more">
            View full profile
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export default function AppVitoria() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [greeting, setGreeting] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const bodyRef = useRef(null)
  const recognitionRef = useRef(null)

  // Voice dictation via the browser's Web Speech API — fills the box, the guest taps send.
  const SpeechRecognition =
    typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
  const voiceSupported = Boolean(SpeechRecognition)

  useEffect(() => () => recognitionRef.current?.stop?.(), [])

  const toggleVoice = () => {
    if (!voiceSupported || thinking) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim()
      setDraft(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  useEffect(() => {
    let ignore = false
    guest
      .vitoria()
      .then((data) => {
        if (ignore) return
        setGreeting(data.greeting || '')
        // The guest may already have sent something while this was loading — keep it.
        setMessages((prev) => mergeById(data.messages || [], prev))
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
      setMessages((prev) =>
        mergeById(
          prev.filter((m) => m.id !== optimistic.id),
          [reply.user, reply.assistant]
        )
      )
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
    ? [{ from: 'vitoria', lines: [greeting || 'Hello', FOLLOW_UP], places: [], key: 'greeting' }, ...groups]
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
                      {m.places?.length ? (
                        <div className="app-vit-cards" role="list" aria-label="Recommended places">
                          {m.places.map((place, i) => (
                            <PlaceCard key={`${m.key}-p${i}`} place={place} />
                          ))}
                        </div>
                      ) : null}
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
                  placeholder={listening ? 'Listening…' : 'Ask Anything'}
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div className="app-vitoria-input-right">
                {voiceSupported ? (
                  <button
                    type="button"
                    className={`app-vitoria-mic${listening ? ' is-listening' : ''}`}
                    aria-label={listening ? 'Stop listening' : 'Speak your question'}
                    aria-pressed={listening}
                    onClick={toggleVoice}
                  >
                    <Mic size={15} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="app-vitoria-send"
                  aria-label="Send"
                  disabled={!draft.trim() || thinking}
                >
                  <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
