import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BellOff,
  Check,
  Compass,
  Home,
  KeyRound,
  MessageCircle,
  Minus,
  Palette,
  Plus,
  Printer,
  QrCode,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react'
import { hostPortal, money } from '../../lib/hostPortal.js'
import '../../styles/hosts-landing.css'

// Host Version landing page (my30ahost.com/hosts): what a vacation-rental host gets, the plans
// (prices from Admin → Settings) and the way in to sign up and pay.
const FALLBACK_PLANS = [
  { key: 'monthly', label: 'Monthly', price: 14.99, per_month: 14.99, months: 1, savings_percent: 0 },
  { key: 'semiannual', label: 'Every 6 months', price: 79.99, per_month: 13.33, months: 6, savings_percent: 11 },
  { key: 'annual', label: 'Annual', price: 149.99, per_month: 12.5, months: 12, savings_percent: 17 },
]

const GUEST_FEATURES = [
  { Icon: KeyRound, title: 'My Home', text: 'WiFi, door code, parking, check-in/out, house instructions and rules — one tap, with copy buttons.' },
  { Icon: Sparkles, title: 'Vitória, AI concierge', text: 'Answers “what’s the WiFi?” or “where should we eat tonight?” 24/7, by text or voice.' },
  { Icon: ShoppingBag, title: 'Groceries & airport rides', text: 'Publix delivery before arrival and private transfers to ECP, VPS and PNS — booked in the app.' },
  { Icon: Compass, title: 'Explore 30A', text: '400+ restaurants, bars, beaches, events and vetted local partners, with real photos and hours.' },
]

const HOST_BENEFITS = [
  { Icon: Palette, title: 'Your brand, front and center', text: 'Guests see your logo on the welcome and sign-in screens and your name on every property.' },
  { Icon: BellOff, title: 'Fewer 11pm texts', text: 'WiFi, door codes, trash day and checkout time are answered by My Home and Vitória — not your phone.' },
  { Icon: BarChart3, title: 'See what guests use', text: 'Scans, My Home opens and the topics guests ask Vitória about — counts only, never private messages.' },
  { Icon: Star, title: 'More five-star stays', text: 'A concierge in every pocket, links back to your Airbnb, VRBO and website for the next booking.' },
]

const STEPS = [
  { Icon: Home, title: 'Add your property', text: 'Sign up, pick a plan, then enter WiFi, door code, rules and your logo — about 10 minutes.' },
  { Icon: Printer, title: 'Print the QR code', text: 'We generate a branded poster for each property. Put it on the fridge or by the entry.' },
  { Icon: QrCode, title: 'Guests scan & relax', text: 'They open your branded app with My Home, Vitória, groceries, rides and all of 30A.' },
]

const FAQ = [
  ['Do my guests pay anything?', 'No. The guest app is free for guests. They only pay for services they choose, like grocery delivery or an airport transfer.'],
  ['Can I change the info later?', 'Any time, from your host dashboard. Changes show up for guests instantly — no reprinting needed.'],
  ['What if I add or sell a property?', 'Change the number of properties on your plan in the dashboard. Stripe prorates the difference automatically.'],
  ['Can I cancel?', 'Yes. Cancel from the billing page in your dashboard; your plan stays active until the end of the period you paid for.'],
  ['Is my guests’ privacy protected?', 'Yes. You see counts and topics (for example “3 questions about WiFi”), never who a guest is or what they wrote.'],
  ['How is payment handled?', 'Securely by Stripe. We never see your card number. You get invoices by email and can update your card any time.'],
]

export default function Hosts() {
  const [plans, setPlans] = useState(FALLBACK_PLANS)
  const [planKey, setPlanKey] = useState('annual')
  const [qty, setQty] = useState(1)
  const [open, setOpen] = useState(0)

  useEffect(() => {
    document.title = 'Host Version — your branded guest app · My30A Host'
    hostPortal
      .plans()
      .then((r) => r.plans?.length && setPlans(r.plans))
      .catch(() => {})
  }, [])

  const plan = plans.find((p) => p.key === planKey) || plans[0]
  const total = useMemo(() => Number((plan.price * qty).toFixed(2)), [plan, qty])
  const period = { monthly: 'month', semiannual: '6 months', annual: 'year' }[plan.key]
  const signupLink = `/hosts/signup?plan=${plan.key}&qty=${qty}`

  return (
    <div className="hl">
      <header className="hl-nav">
        <Link to="/" className="hl-logo">
          <img src="/brand/my30a-logo.webp" alt="My30A Host" />
        </Link>
        <nav className="hl-links" aria-label="Host Version">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="hl-nav-cta">
          <Link to="/host/login" className="hl-signin">
            Host sign in
          </Link>
          <Link to={signupLink} className="hl-btn is-gold is-sm">
            Get started
          </Link>
        </div>
      </header>

      <section className="hl-hero">
        <div className="hl-hero-bg" aria-hidden="true" />
        <div className="hl-wrap hl-hero-inner">
          <div className="hl-hero-copy">
            <p className="hl-eyebrow">Host Version · for 30A vacation rentals</p>
            <h1>
              Your brand.
              <br />
              <em>Our concierge.</em>
            </h1>
            <p className="hl-lead">
              Give every guest a branded app the moment they walk in: WiFi and door code in one tap, Vitória the AI concierge 24/7, groceries and airport rides on demand, and the best of
              30A at their fingertips.
            </p>
            <div className="hl-hero-ctas">
              <Link to={signupLink} className="hl-btn is-gold">
                Start for {money(plans[0].price)}/property <ArrowRight size={18} />
              </Link>
              <a href="#how" className="hl-btn is-ghost">
                See how it works
              </a>
            </div>
            <ul className="hl-trust">
              <li>
                <Check size={15} /> Live in 10 minutes
              </li>
              <li>
                <Check size={15} /> Free for your guests
              </li>
              <li>
                <Check size={15} /> Cancel anytime
              </li>
            </ul>
          </div>
          <div className="hl-phones" aria-hidden="true">
            <figure className="hl-phone is-back">
              <img src="/marketing/host-welcome.webp" alt="" />
            </figure>
            <figure className="hl-phone is-front">
              <img src="/marketing/host-myhome.webp" alt="" />
            </figure>
            <div className="hl-float is-a">
              <MessageCircle size={16} /> “What’s the WiFi password?”
            </div>
            <div className="hl-float is-b">
              <Sparkles size={16} /> Answered by Vitória in 2 sec
            </div>
          </div>
        </div>
      </section>

      <section className="hl-section">
        <div className="hl-wrap">
          <p className="hl-kicker">What your guests get</p>
          <h2 className="hl-h2">Everything about their stay, one scan away.</h2>
          <div className="hl-cards">
            {GUEST_FEATURES.map(({ Icon, title, text }) => (
              <article key={title} className="hl-card">
                <span className="hl-card-ico">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hl-section is-sand">
        <div className="hl-wrap hl-split">
          <div>
            <p className="hl-kicker">What you get</p>
            <h2 className="hl-h2">A five-star concierge — without the five-star payroll.</h2>
            <ul className="hl-benefits">
              {HOST_BENEFITS.map(({ Icon, title, text }) => (
                <li key={title}>
                  <span>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="hl-dash" aria-hidden="true">
            <p className="hl-dash-title">The Blue Heron House · last 30 days</p>
            <div className="hl-dash-stats">
              <div>
                <b>38</b>
                <small>Guests</small>
              </div>
              <div>
                <b>126</b>
                <small>My Home opens</small>
              </div>
              <div>
                <b>54</b>
                <small>Vitória questions</small>
              </div>
            </div>
            {[
              ['WiFi', 92],
              ['Restaurants & bars', 74],
              ['Check-out', 48],
              ['Beaches', 36],
              ['Airport transfers', 22],
            ].map(([label, w]) => (
              <div key={label} className="hl-dash-bar">
                <span>{label}</span>
                <i style={{ '--w': `${w}%` }} />
              </div>
            ))}
            <p className="hl-dash-note">Sample dashboard — counts and topics only.</p>
          </div>
        </div>
      </section>

      <section className="hl-section" id="how">
        <div className="hl-wrap">
          <p className="hl-kicker">How it works</p>
          <h2 className="hl-h2">Three steps. Then it runs itself.</h2>
          <ol className="hl-steps">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title}>
                <span className="hl-step-n">{i + 1}</span>
                <Icon size={24} className="hl-step-ico" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hl-section is-navy" id="pricing">
        <div className="hl-wrap">
          <p className="hl-kicker is-gold">Pricing</p>
          <h2 className="hl-h2">Simple, per property.</h2>
          <div className="hl-toggle" role="radiogroup" aria-label="Billing period">
            {plans.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={p.key === planKey} className={p.key === planKey ? 'is-on' : ''} onClick={() => setPlanKey(p.key)}>
                {p.label}
                {p.savings_percent ? <em>-{p.savings_percent}%</em> : null}
              </button>
            ))}
          </div>
          <div className="hl-price-card">
            <div className="hl-price">
              <span className="hl-price-big">{money(plan.price)}</span>
              <span className="hl-price-per">
                per property
                <br />
                every {period}
              </span>
            </div>
            {plan.months > 1 ? <p className="hl-price-month">= {money(plan.per_month)} per property per month</p> : null}
            <div className="hl-qty">
              <span>Properties</span>
              <div className="hl-stepper">
                <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus size={16} />
                </button>
                <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} aria-label="Number of properties" />
                <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(500, q + 1))}>
                  <Plus size={16} />
                </button>
              </div>
              <b>
                {money(total)} / {period}
              </b>
            </div>
            <ul className="hl-includes">
              {['Branded welcome & sign-in screens', 'My Home tab per property', 'Vitória knows each house', 'Printable QR poster', 'Guest activity dashboard', 'Change properties any time'].map((t) => (
                <li key={t}>
                  <Check size={15} /> {t}
                </li>
              ))}
            </ul>
            <Link to={signupLink} className="hl-btn is-gold is-wide">
              Get started <ArrowRight size={18} />
            </Link>
            <p className="hl-secure">Secure payment by Stripe · cancel anytime</p>
          </div>
        </div>
      </section>

      <section className="hl-section" id="faq">
        <div className="hl-wrap hl-faq">
          <div>
            <p className="hl-kicker">FAQ</p>
            <h2 className="hl-h2">Questions hosts ask.</h2>
            <p className="hl-muted">
              Something else? Email <a href="mailto:my30ahost@gmail.com">my30ahost@gmail.com</a> or call <a href="tel:+18509554577">(850) 955-4577</a>.
            </p>
          </div>
          <div className="hl-faq-list">
            {FAQ.map(([q, a], i) => (
              <div key={q} className={`hl-faq-item${open === i ? ' is-open' : ''}`}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  {q}
                  <Plus size={18} />
                </button>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hl-cta">
        <div className="hl-wrap">
          <h2>Ready to give your guests the 30A concierge?</h2>
          <div className="hl-hero-ctas">
            <Link to={signupLink} className="hl-btn is-gold">
              Get started <ArrowRight size={18} />
            </Link>
            <Link to="/host/login" className="hl-btn is-ghost">
              Host sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="hl-foot">
        <div className="hl-wrap">
          <span>© 2026 My30A Host · Scenic Highway 30A, Florida</span>
          <span>
            <Link to="/">Guest app</Link> · <Link to="/partners/join">List your business</Link> · <Link to="/host/login">Host sign in</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
