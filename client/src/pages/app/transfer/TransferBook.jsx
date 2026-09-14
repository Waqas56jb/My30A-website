import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  Luggage,
  MapPin,
  Minus,
  Plane,
  Plus,
  TreePalm,
  User,
  Users,
  X,
} from 'lucide-react'
import { guest } from '../../../lib/guestApi.js'
import { Cta, TransferShell, VEHICLE_TYPES, pad } from './TransferShell.jsx'

const AIRPORTS = ['ECP', 'VPS', 'PNS']
const FALLBACK_COMMUNITIES = [
  'Rosemary Beach',
  'Alys Beach',
  'Seaside',
  'WaterColor',
  'Seagrove Beach',
  'Grayton Beach',
  'Inlet Beach',
  'Miramar Beach',
]
const VEHICLES = Object.keys(VEHICLE_TYPES)

export const fmtDate = (iso) =>
  new Date(`${iso}T00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export const fmtTime = (hm) => {
  const [h, m] = hm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${pad(m)} ${suffix}`
}

export const tomorrow = () => {
  const d = new Date(Date.now() + 86400 * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Local date + time → ISO string in the device's timezone (the guest's).
export const toIso = (date, time) => new Date(`${date}T${time}:00`).toISOString()

function CheckBox({ on }) {
  return (
    <span className={`app-xfer-cb${on ? ' is-on' : ''}`} aria-hidden="true">
      {on ? <Check size={12} strokeWidth={3} /> : null}
    </span>
  )
}

function Dropdown({ icon: Icon, placeholder, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="app-xfer-dd">
      <button
        type="button"
        className="app-xfer-box app-xfer-select"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="app-xfer-box-l">
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          {value ? <span>{value}</span> : <span className="app-xfer-ph">{placeholder}</span>}
        </span>
        {open ? (
          <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div className="app-xfer-sugg">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={`app-xfer-sugg-item${o === value ? ' is-on' : ''}`}
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
            >
              <strong>{o}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Picker({ icon: Icon, type, value, display, onChange, min }) {
  const ref = useRef(null)
  const open = () => {
    const el = ref.current
    if (!el) return
    try {
      if (el.showPicker) el.showPicker()
      else el.focus()
    } catch {
      el.focus()
    }
  }
  return (
    <label className="app-xfer-box app-xfer-select" onClick={open}>
      <span className="app-xfer-box-l">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>{display}</span>
      </span>
      <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
      <input
        ref={ref}
        className="app-xfer-native"
        type={type}
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label={type === 'date' ? 'Date' : 'Time'}
      />
    </label>
  )
}

function Counter({ icon: Icon, value, min, onChange, label }) {
  return (
    <div className="app-xfer-box app-xfer-counter">
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      <span className="app-xfer-count">
        <button
          type="button"
          aria-label={`Fewer ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <b>{pad(value)}</b>
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value + 1)}>
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

export default function TransferBook() {
  const navigate = useNavigate()
  const [tripType, setTripType] = useState('arrival')
  const [airport, setAirport] = useState('ECP')
  const [communities, setCommunities] = useState(FALLBACK_COMMUNITIES)
  const [community, setCommunity] = useState('')
  const [address, setAddress] = useState('')
  const [savedAddress, setSavedAddress] = useState('')
  // The stay prefill fetch can resolve after the guest has already interacted with the form (it's
  // a real network round trip, not instant) — never let it clobber a field they've already touched.
  const addressTouched = useRef(false)
  const communityTouched = useRef(false)
  const [showSugg, setShowSugg] = useState(false)
  const [liveSuggestions, setLiveSuggestions] = useState([])
  const [suggLoading, setSuggLoading] = useState(false)
  // lat/lon of a suggestion the guest actually picked — trusted over re-geocoding the typed text.
  const [addressPoint, setAddressPoint] = useState(null)
  const [addrCheck, setAddrCheck] = useState(null)
  const [addrChecking, setAddrChecking] = useState(false)
  const [date, setDate] = useState(tomorrow())
  const [time, setTime] = useState('17:50')
  const [passengers, setPassengers] = useState(2)
  const [bags, setBags] = useState(2)
  const [flight, setFlight] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [error, setError] = useState('')

  // Prefill from the guest's stay and load the live community list.
  useEffect(() => {
    let ignore = false
    guest
      .communities()
      .then((rows) => {
        if (!ignore && rows?.length) setCommunities(rows.map((c) => c.name))
      })
      .catch(() => {})
    guest
      .booking()
      .then((b) => {
        if (ignore || !b) return
        if (b.community_name && !communityTouched.current) setCommunity(b.community_name)
        if (b.default_airport) setAirport(b.default_airport)
        if (b.property_address) {
          if (!addressTouched.current) setAddress(b.property_address)
          setSavedAddress(b.property_address)
        }
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  // Live "as you type" address suggestions (debounced) from the 30A-corridor geocoder.
  useEffect(() => {
    const q = address.trim()
    if (!showSugg || q.length < 3) {
      setLiveSuggestions([])
      setSuggLoading(false)
      return
    }
    let ignore = false
    setSuggLoading(true)
    const t = setTimeout(() => {
      guest
        .addressAutocomplete(q)
        .then((rows) => {
          if (!ignore) setLiveSuggestions(rows || [])
        })
        .catch(() => {
          if (!ignore) setLiveSuggestions([])
        })
        .finally(() => {
          if (!ignore) setSuggLoading(false)
        })
    }, 350)
    return () => {
      ignore = true
      clearTimeout(t)
    }
  }, [address, showSugg])

  // Confirms the typed/selected address is actually inside the selected community — fixed
  // per-community pricing only applies when that's true. Debounced so it doesn't fire per keystroke.
  useEffect(() => {
    const q = address.trim()
    if (!community || q.length < 5) {
      setAddrCheck(null)
      return
    }
    let ignore = false
    setAddrChecking(true)
    const t = setTimeout(() => {
      guest
        .addressCheck({ address: q, lat: addressPoint?.lat, lon: addressPoint?.lon, community })
        .then((res) => {
          if (ignore) return
          setAddrCheck(res)
          // Clear a stale "address doesn't match" banner from an earlier Continue attempt once
          // the address checks out again — the green inline note above already confirms it.
          if (res?.ok) setError((prev) => (prev && prev.toLowerCase().includes('address') ? '' : prev))
        })
        .catch(() => {
          if (!ignore) setAddrCheck(null)
        })
        .finally(() => {
          if (!ignore) setAddrChecking(false)
        })
    }, 600)
    return () => {
      ignore = true
      clearTimeout(t)
    }
  }, [address, community, addressPoint])

  const suggestions = [
    savedAddress && savedAddress !== address
      ? { main: savedAddress, sub: `${community || 'Your stay'} · saved address`, full: savedAddress, lat: null, lon: null }
      : null,
    ...liveSuggestions.map((s) => ({
      main: s.address?.house_number && s.address?.road ? `${s.address.house_number} ${s.address.road}` : s.label,
      sub: [s.address?.city || s.address?.town || s.address?.village || s.address?.hamlet, s.address?.state]
        .filter(Boolean)
        .join(', ') || '30A, FL',
      full: s.label,
      lat: s.lat,
      lon: s.lon,
    })),
  ].filter(Boolean)

  const onContinue = () => {
    setError('')
    if (!address.trim()) {
      setError('Please enter your 30A property address.')
      return
    }
    if (!community) {
      setError('Please select your community.')
      return
    }
    if (addrCheck && addrCheck.ok === false) {
      setError(addrCheck.message || `That address doesn’t look like it’s inside ${community}.`)
      return
    }
    if (!flight.trim() && tripType === 'arrival') {
      setError('Flight number is required so your driver can track your flight.')
      return
    }
    const vehicleLabel = vehicle || '4 Passenger Vehicle'
    navigate('/app/transfer/review', {
      state: {
        booking: {
          tripType,
          airport,
          community: community || communities[0] || 'Rosemary Beach',
          address: address.trim(),
          addressLat: addressPoint?.lat ?? null,
          addressLon: addressPoint?.lon ?? null,
          date: fmtDate(date),
          time: fmtTime(time),
          scheduledAt: toIso(date, time),
          passengers,
          bags,
          flight: flight.trim(),
          vehicle: vehicleLabel,
          vehicleType: VEHICLE_TYPES[vehicleLabel] || '4pax',
          holiday: false,
        },
      },
    })
  }

  const airportSection = (
    <section className="app-xfer-section" key="airport">
      <h2 className="app-xfer-h">Airport</h2>
      <div className="app-xfer-row-3">
        {AIRPORTS.map((a) => (
          <button
            key={a}
            type="button"
            className={`app-xfer-seg${airport === a ? ' is-on' : ''}`}
            aria-pressed={airport === a}
            onClick={() => setAirport(a)}
          >
            {a}
          </button>
        ))}
      </div>
    </section>
  )

  const communitySection = (
    <section className="app-xfer-section" key="community">
      <h2 className="app-xfer-h">Select your Community</h2>
      <Dropdown
        icon={Home}
        placeholder="select your community"
        value={community}
        options={communities}
        onChange={(value) => {
          communityTouched.current = true
          setCommunity(value)
        }}
      />
    </section>
  )

  const addressSection = (
    <section className="app-xfer-section" key="address">
      <div className="app-xfer-h-group">
        <h2 className="app-xfer-h">Select Your Address</h2>
        <p className="app-xfer-hint-addr">Enter your 30A property address.</p>
      </div>
      <div className="app-xfer-dd">
        <label className="app-xfer-box app-xfer-addr">
          <span className="app-xfer-box-l">
            <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="text"
              value={address}
              placeholder="Enter your address"
              onChange={(e) => {
                addressTouched.current = true
                setAddress(e.target.value)
                setAddressPoint(null)
                setShowSugg(true)
              }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            />
          </span>
          <button
            type="button"
            className="app-xfer-clear"
            aria-label="Clear address"
            onClick={() => {
              addressTouched.current = true
              setAddress('')
              setAddressPoint(null)
              setShowSugg(true)
            }}
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </label>
        {showSugg && suggestions.length ? (
          <div className="app-xfer-sugg">
            {suggLoading ? <small className="app-xfer-sugg-loading">Searching…</small> : null}
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`app-xfer-sugg-item${s.full === address ? ' is-on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  addressTouched.current = true
                  setAddress(s.full)
                  setAddressPoint(s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null)
                  setShowSugg(false)
                }}
              >
                <strong>{s.main}</strong>
                <small>{s.sub}</small>
              </button>
            ))}
          </div>
        ) : null}
        {community && address.trim().length >= 5 ? (
          addrChecking ? (
            <p className="app-inline-muted">Checking address is inside {community}…</p>
          ) : addrCheck?.ok === false ? (
            <p className="app-inline-error">{addrCheck.message}</p>
          ) : addrCheck?.ok === true ? (
            <p className="app-inline-ok">This address is inside {community}.</p>
          ) : null
        ) : null}
      </div>
    </section>
  )

  const order =
    tripType === 'departure'
      ? [communitySection, addressSection, airportSection]
      : [airportSection, communitySection, addressSection]

  return (
    <TransferShell
      title="Book Airport Transfer"
      back="/app/services"
      step={1}
      footer={
        <>
          <div className="app-xfer-note">
            <TreePalm size={24} strokeWidth={1.5} className="is-green" aria-hidden="true" />
            <span>Your property is in {community || communities[0] || 'Rosemary Beach'}</span>
          </div>
          {error ? <p className="app-inline-error">{error}</p> : null}
          <Cta onClick={onContinue}>Continue</Cta>
        </>
      }
    >
      <div className="app-xfer-form">
        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Choose Your Trip Type</h2>
          <div className="app-xfer-row-2">
            <button
              type="button"
              className="app-xfer-check"
              aria-pressed={tripType === 'arrival'}
              onClick={() => setTripType('arrival')}
            >
              <CheckBox on={tripType === 'arrival'} />
              Arrival Pickup
            </button>
            <button
              type="button"
              className="app-xfer-check"
              aria-pressed={tripType === 'departure'}
              onClick={() => setTripType('departure')}
            >
              <CheckBox on={tripType === 'departure'} />
              Departure Dropoff
            </button>
          </div>
        </section>

        {order}

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Date &amp; Time</h2>
          <div className="app-xfer-row-2 is-gap-10">
            <Picker
              icon={Calendar}
              type="date"
              value={date}
              min={tomorrow()}
              display={fmtDate(date)}
              onChange={setDate}
            />
            <Picker
              icon={Clock}
              type="time"
              value={time}
              display={fmtTime(time)}
              onChange={setTime}
            />
          </div>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Travel Details</h2>
          <div className="app-xfer-details">
            <div className="app-xfer-row-2">
              <div className="app-xfer-field">
                <span className="app-xfer-label">Passengers</span>
                <Counter
                  icon={User}
                  value={passengers}
                  min={1}
                  onChange={setPassengers}
                  label="passengers"
                />
              </div>
              <div className="app-xfer-field">
                <span className="app-xfer-label">Bags</span>
                <Counter icon={Luggage} value={bags} min={0} onChange={setBags} label="bags" />
              </div>
            </div>
            <div className="app-xfer-field">
              <span className="app-xfer-label">Flight Number</span>
              <div className="app-xfer-field is-tight">
                <label className="app-xfer-box">
                  <Plane size={16} strokeWidth={1.5} aria-hidden="true" />
                  <input
                    type="text"
                    className="app-xfer-flight"
                    value={flight}
                    placeholder="Flight number"
                    onChange={(e) => setFlight(e.target.value)}
                  />
                </label>
                <span className="app-xfer-hint">
                  Required so your driver can track your flight in real time.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Vehicle Selection</h2>
          <Dropdown
            icon={Users}
            placeholder="Select Passengers"
            value={vehicle}
            options={VEHICLES}
            onChange={setVehicle}
          />
        </section>
      </div>
    </TransferShell>
  )
}
