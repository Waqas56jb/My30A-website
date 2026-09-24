import { useParams } from 'react-router-dom'
import {
  CalendarDays,
  CalendarCheck,
  Clock,
  DollarSign,
  ExternalLink,
  Info,
  MapPin,
  Navigation,
  Package,
  Phone,
  Store,
} from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import {
  Actions,
  DetailHero,
  DetailSkeleton,
  ExploreShell,
  Pill,
  RatingPill,
  TitleRow,
} from './ExploreShared.jsx'
import { useSavedToggle } from './VendorDetail.jsx'

const TYPE_LABEL = { restaurant: 'Restaurant', bar: 'Bar', coffee: 'Coffee & Breakfast' }

export default function RestaurantDetail() {
  const { id } = useParams()
  const { data: place, loading, error } = useGuestQuery(() => guest.vendor(id), [id])
  const { saved, busy, toggle } = useSavedToggle(place)

  if (loading || error || !place) {
    return (
      <ExploreShell className="app-exp-detail">
        <DetailHero loading={!error} back="/app/explore/dining">
          {error ? <p className="app-empty">{error.status === 404 ? 'Restaurant not found.' : errorText(error)}</p> : <DetailSkeleton />}
        </DetailHero>
      </ExploreShell>
    )
  }

  const tel = place.phone ? `tel:${place.phone.replace(/[^\d+]/g, '')}` : null
  const rows = [
    { Icon: Package, label: 'Cuisine', value: place.cuisine || TYPE_LABEL[place.venue_type] || '—' },
    { Icon: Store, label: 'Community', value: place.community || place.place },
    place.address ? { Icon: MapPin, label: 'Address', value: place.address, wide: true } : null,
    { Icon: CalendarCheck, label: 'Hours', value: place.hours || 'Call ahead for hours', wide: Boolean(place.hours && place.hours.length > 22) },
    place.price_range ? { Icon: DollarSign, label: 'Price', value: place.price_range } : null,
    place.phone ? { Icon: Phone, label: 'Phone', value: place.phone } : null,
  ].filter(Boolean)

  // Reservations are free: we only deep-link to the restaurant's own booking page, chosen by the
  // platform it really uses (verified from its website). Phone-only restaurants show the number.
  const PLATFORM = { resy: 'Resy', opentable: 'OpenTable', sevenrooms: 'SevenRooms', tock: 'Tock' }
  const online = place.booking_url && place.booking_platform && place.booking_platform !== 'phone_only'
  const primary = online
    ? {
        label: PLATFORM[place.booking_platform] ? `Reserve on ${PLATFORM[place.booking_platform]}` : 'Reserve online',
        Icon: CalendarDays,
        href: place.booking_url,
      }
    : tel
      ? { label: place.venue_type === 'restaurant' ? 'Call to reserve' : 'Call', Icon: Phone, href: tel }
      : { label: 'Directions', Icon: Navigation, href: place.directions_url }
  const secondary = place.website_url
    ? { label: 'Menu & website', Icon: ExternalLink, href: place.website_url }
    : { label: 'Directions', Icon: Navigation, href: place.directions_url }
  const reservationLine = online
    ? `Book free on ${PLATFORM[place.booking_platform] || 'the restaurant’s own website'} — no fee from My30A Host.`
    : place.phone
      ? `${place.venue_type === 'restaurant' ? 'Reservations by phone' : 'Call ahead'}: ${place.phone}`
      : null
  const verified = place.last_verified_date
    ? new Date(`${place.last_verified_date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero
        image={place.image}
        name={place.name}
        guideSlug={`dining-${place.venue_type || 'restaurant'}`}
        back={place.back || '/app/explore/dining'}
      >
        <div className="app-exp-block is-tight">
          <TitleRow title={place.name} saved={saved} onToggle={toggle} busy={busy} />
          {place.subtitle ? <p className="app-exp-sub">{place.subtitle}</p> : null}
        </div>
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            {place.community || place.place}
          </Pill>
          {place.rating !== null && place.rating !== undefined ? (
            <RatingPill rating={place.rating} reviews={place.reviews} white />
          ) : (
            <Pill white>{TYPE_LABEL[place.venue_type] || 'Local favorite'}</Pill>
          )}
          {place.hours_today ? (
            <Pill icon={Clock} white>
              {place.open_now ? <b className="is-open">Open now</b> : place.open_now === false ? <b>Closed now</b> : null}{' '}
              {place.hours_today}
            </Pill>
          ) : null}
        </div>
        <hr className="app-exp-hr" />

        {place.desc ? <p className="app-exp-desc">{place.desc}</p> : null}
        {place.tags?.length ? (
          <div className="app-exp-chips">
            {place.tags.map((t) => (
              <span key={t} className="app-exp-chip">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <section className="app-xfer-card app-exp-rows">
          {rows.map(({ Icon, label, value, wide }) => (
            <div key={label} className={`app-xfer-row${wide ? ' is-wide' : ''}`}>
              <span className="app-xfer-row-l">
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </span>
              <span className="app-xfer-row-v">{value}</span>
            </div>
          ))}
        </section>

        <div className="app-xfer-note is-info is-lg">
          <Info size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            A local favorite, not a paid partner. Hours can change — call ahead, or ask Vitoria for
            today&apos;s hours.
          </span>
        </div>

        {reservationLine ? (
          <p className="app-exp-reserve-line">
            {online ? <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" /> : <Phone size={14} strokeWidth={1.8} aria-hidden="true" />}
            <span>
              {reservationLine}
              {verified ? <small> · Checked {verified}</small> : null}
            </span>
          </p>
        ) : null}

        <Actions primary={primary} secondary={secondary} />
      </DetailHero>
    </ExploreShell>
  )
}
