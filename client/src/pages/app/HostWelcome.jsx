import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { hostApi, rememberPendingHome, setHostBrand } from '../../lib/hostHome.js'
import { errorText } from '../../lib/guestApi.js'

// Host version welcome — what a guest sees after scanning the QR code in the rental
// (my30ahost.com/h/<slug>): the host's logo and the property, then into the app ("My Home" tab).
export default function HostWelcome() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [brand, setBrand] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ignore = false
    hostApi
      .brand(slug)
      .then((data) => {
        if (ignore) return
        setBrand(data)
        const { partners, ...keep } = data
        setHostBrand(keep)
        rememberPendingHome(slug)
      })
      .catch((err) => {
        if (!ignore) setError(errorText(err, 'This QR code could not be opened. Please try again.'))
      })
    return () => {
      ignore = true
    }
  }, [slug])

  const isGuest = Boolean(session && (profile?.roles || []).includes('guest'))

  async function start() {
    if (!isGuest) {
      navigate('/app/signup', { state: { from: '/app/my-home' } })
      return
    }
    setBusy(true)
    try {
      const result = await hostApi.claim(slug)
      setHostBrand(result.brand)
      navigate('/app/my-home')
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const photo = brand?.cover_url || '/marketing/hero-poster.webp'

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="hw">
          <div className="hw-photo" style={{ backgroundImage: `url("${photo}")` }} aria-hidden="true" />
          <div className="hw-wash" aria-hidden="true" />

          <div className="hw-body">
            {error ? (
              <div className="hw-error" role="alert">
                <img src="/brand/my30a-logo.webp" alt="My30A Host" />
                <p>{error}</p>
                <Link to="/app" className="hw-link">
                  Open My30A Host
                </Link>
              </div>
            ) : !brand ? (
              <div className="hw-loading" aria-busy="true">
                <span className="hw-logo hw-skel" />
                <span className="hw-skel hw-skel-line" />
              </div>
            ) : (
              <>
                <div className="hw-logo">
                  {brand.logo_url ? <img src={brand.logo_url} alt={brand.host_name} /> : <strong>{brand.host_name}</strong>}
                </div>
                {brand.host_tagline ? <p className="hw-tagline">{brand.host_tagline}</p> : null}

                <h1 className="hw-title">Your Home On 30A, Taken Care Of.</h1>
                <p className="hw-copy">
                  Grocery delivery, airport transfers, {brand.partners ? `${brand.partners} local partners` : 'local partners'}, and
                  Vitoria — your AI concierge, available 24/7.
                </p>

                <div className="hw-home">
                  <span className="hw-home-ico" aria-hidden="true">
                    <MapPin size={16} strokeWidth={1.9} />
                  </span>
                  <span>
                    <small>Welcome to</small>
                    <strong>{brand.home_name}</strong>
                    {brand.area ? <em>{brand.area}</em> : null}
                  </span>
                </div>
              </>
            )}
          </div>

          {brand && !error ? (
            <div className="hw-sheet">
              <button type="button" className="hw-cta" onClick={start} disabled={busy}>
                {busy ? 'Opening…' : 'Start exploring'}
                {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
              </button>
              {!isGuest ? (
                <p className="hw-login">
                  Already have an account?{' '}
                  <Link to="/app/login" state={{ from: '/app/my-home' }}>
                    Log in
                  </Link>
                </p>
              ) : null}
              <p className="hw-powered">
                Concierge powered by <b>My30A Host</b>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
