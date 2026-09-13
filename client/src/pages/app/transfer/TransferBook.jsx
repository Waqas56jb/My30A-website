import { useRef, useState } from 'react'
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
import { Cta, TransferShell, pad } from './TransferShell.jsx'

const AIRPORTS = ['ECP', 'VPS', 'PNS']
const COMMUNITIES = [
  'Rosemary Beach',
  'Alys Beach',
  'Seaside',
  'WaterColor',
  'Seagrove Beach',
  'Grayton Beach',
  'Inlet Beach',
  'Miramar Beach',
]
const VEHICLES = ['4 Passenger Vehicle', '6 Passenger Vehicle', '14 Passenger Vehicle']
const SUGGESTIONS = [
  {
    main: '21 N Barrett Square,',
    sub: 'Rosemary Beach, FL',
    full: '21 N Barrett Square, Rosemary Beach, FL 32461',
  },
  {
    main: 'Lorem ipsum dolor sit amet consectetur adipiscing elit.',
    sub: 'Rosemary Beach, FL',
    full: 'Lorem ipsum dolor sit amet, Rosemary Beach, FL',
  },
  {
    main: '21 N Barrett Square, Rosemary Beach, FL 32461',
    sub: 'Rosemary Beach, FL',
    full: '21 N Barrett Square, Rosemary Beach, FL 32461',
  },
]

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

export function Picker({ icon: Icon, type, value, display, onChange }) {
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
  const [community, setCommunity] = useState('')
  const [address, setAddress] = useState(SUGGESTIONS[0].full)
  const [showSugg, setShowSugg] = useState(true)
  const [date, setDate] = useState('2026-09-18')
  const [time, setTime] = useState('17:50')
  const [passengers, setPassengers] = useState(2)
  const [bags, setBags] = useState(2)
  const [flight, setFlight] = useState('WN 0987')
  const [vehicle, setVehicle] = useState('')

  const onContinue = () => {
    navigate('/app/transfer/review', {
      state: {
        booking: {
          tripType,
          airport,
          community: community || 'Rosemary Beach',
          address,
          date: fmtDate(date),
          time: fmtTime(time),
          passengers,
          bags,
          flight,
          vehicle: vehicle || '4 Passenger Vehicle',
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
        options={COMMUNITIES}
        onChange={setCommunity}
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
                setAddress(e.target.value)
                setShowSugg(true)
              }}
              onFocus={() => setShowSugg(true)}
            />
          </span>
          <button
            type="button"
            className="app-xfer-clear"
            aria-label="Clear address"
            onClick={() => {
              setAddress('')
              setShowSugg(true)
            }}
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </label>
        {showSugg ? (
          <div className="app-xfer-sugg">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`app-xfer-sugg-item${i === 0 ? ' is-on' : ''}`}
                onClick={() => {
                  setAddress(s.full)
                  setShowSugg(false)
                }}
              >
                <strong>{s.main}</strong>
                <small>{s.sub}</small>
              </button>
            ))}
          </div>
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
            <span>Your property is in {community || 'Rosemary Beach'}</span>
          </div>
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
