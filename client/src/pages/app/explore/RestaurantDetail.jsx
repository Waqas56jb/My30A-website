import { useParams } from 'react-router-dom'
import { CalendarDays, Clock, ExternalLink, Info, MapPin, Package, Store, CalendarCheck } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import {
  Actions,
  DetailHero,
  ExploreShell,
  Pill,
  RatingPill,
  TitleRow,
} from './ExploreShared.jsx'
import { useSavedToggle } from './VendorDetail.jsx'

export default function RestaurantDetail() {
  const { id } = useParams()
  const { data: place, loading, error } = useGuestQuery(() => guest.vendor(id), [id])
  const { saved, busy, toggle } = useSavedToggle(place)

  if (loading || error || !place) {
    return (
      <ExploreShell className="app-exp-detail">
        <DetailHero image="/image10.png" back="/app/explore/guide?c=restaurants">
          <p className="app-empty">{error ? (error.status === 404 ? 'Restaurant not found.' : errorText(error)) : 'Loading…'}</p>
        </DetailHero>
      </ExploreShell>
    )
  }

  const rows = [
    { Icon: Package, label: 'Cuisine/Type', value: place.cuisine || '—' },
    { Icon: Store, label: 'Location/Community', value: place.community || place.place },
    { Icon: CalendarCheck, label: 'Hours', value: place.hours || '—' },
    { Icon: Clock, label: 'About', value: place.about || place.desc, wide: true },
  ]

  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image={place.image} back={place.back || '/app/explore/guide?c=restaurants'}>
        <div className="app-exp-block is-tight">
          <TitleRow title={place.name} saved={saved} onToggle={toggle} busy={busy} />
          {place.subtitle ? <p className="app-exp-sub">{place.subtitle}</p> : null}
        </div>
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            {place.place}
          </Pill>
          <RatingPill rating={place.rating} reviews={place.reviews} white />
        </div>
        {place.hours_today ? (
          <div className="app-exp-pills">
            <Pill icon={Clock} white>
              <b className="is-open">Open today</b> {place.hours_today}
            </Pill>
          </div>
        ) : null}
        <hr className="app-exp-hr" />

        <p className="app-exp-desc">{place.desc}</p>
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
            My30A Host connects you to this restaurant. Reservations are completed directly with
            the provider.
          </span>
        </div>

        <Actions
          primary={{ label: place.booking_url?.includes('resy') ? 'Book On Resy' : 'Reserve a Table', Icon: CalendarDays, href: place.booking_url || place.website_url || '#resy' }}
          secondary={{ label: 'Visit Website', Icon: ExternalLink, href: place.website_url || '#website' }}
        />
      </DetailHero>
    </ExploreShell>
  )
}
