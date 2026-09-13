import { CalendarDays, Clock, ExternalLink, Info, MapPin, Package, Store, CalendarCheck } from 'lucide-react'
import {
  Actions,
  DetailHero,
  ExploreShell,
  Pill,
  RatingPill,
  TitleRow,
} from './ExploreShared.jsx'

const TAGS = ['Sunset views', 'Cocktails', 'Reservations recommended', 'Rooftop', 'Date night']

const ROWS = [
  { Icon: Package, label: 'Cuisine/Type', value: 'Seafood' },
  { Icon: Store, label: 'Location/Community', value: 'Rosemary Beach' },
  { Icon: CalendarCheck, label: 'Hours', value: 'Mon - Sat, 4:00 - 10:00 PM' },
  {
    Icon: Clock,
    label: 'About',
    value: 'Elevated rooftop dining with fresh seafood, cocktails, and panoramic Gulf views.',
    wide: true,
  },
]

export default function RestaurantDetail() {
  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image="/image10.png" back="/app/explore/guide?c=restaurants">
        <div className="app-exp-block is-tight">
          <TitleRow title="Pescado Rooftop Bar" />
          <p className="app-exp-sub">Seafood • Coastal • Rooftop</p>
        </div>
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            Rosemary Beach, FL
          </Pill>
          <RatingPill rating="5.0" reviews="258" white />
        </div>
        <div className="app-exp-pills">
          <Pill icon={Clock} white>
            <b className="is-open">Open today</b> 4:00 PM — 10:00 PM
          </Pill>
        </div>
        <hr className="app-exp-hr" />

        <p className="app-exp-desc">
          An elevated rooftop dining experience with fresh seafood, handcrafted cocktails, and
          panoramic Gulf views.
        </p>
        <div className="app-exp-chips">
          {TAGS.map((t) => (
            <span key={t} className="app-exp-chip">
              {t}
            </span>
          ))}
        </div>

        <section className="app-xfer-card app-exp-rows">
          {ROWS.map(({ Icon, label, value, wide }) => (
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
          primary={{ label: 'Book On Resy', Icon: CalendarDays, href: '#resy' }}
          secondary={{ label: 'Visit Website', Icon: ExternalLink, href: '#website' }}
        />
      </DetailHero>
    </ExploreShell>
  )
}
