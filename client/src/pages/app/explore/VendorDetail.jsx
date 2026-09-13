import { useParams } from 'react-router-dom'
import { CalendarDays, ExternalLink, MapPin } from 'lucide-react'
import {
  Actions,
  DetailHero,
  ExploreShell,
  MapCard,
  Pill,
  RatingPill,
  TitleRow,
  VENDORS,
} from './ExploreShared.jsx'

const SERVICES = ['Sunrise bonfire', 'chair setup', 'S’mores add-on', 'Family friendly']

export default function VendorDetail() {
  const { id } = useParams()
  const vendor = VENDORS.find((v) => v.id === id) || VENDORS[0]

  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image={vendor.image} back="/app/explore/vendors/beach-bonfires">
        <TitleRow title={vendor.name} />
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            {vendor.place}
          </Pill>
          <RatingPill rating={vendor.rating} reviews={vendor.reviews} white />
        </div>
        <p className="app-exp-desc">{vendor.desc}</p>
        <hr className="app-exp-hr" />

        <div className="app-exp-referral">
          <strong>Partner Referral</strong>
          <em>
            My 30A Host connects you with this partner. Booking and payment happen directly with
            the business.
          </em>
        </div>

        <section className="app-exp-block">
          <h3 className="app-exp-h3">About</h3>
          <p className="app-exp-desc">
            We handle everything - from setup to cleanup - so you can relax and enjoy quality time
            with the people who matter most. Perfect for families, couples, and groups celebrating
            life on 30A.
          </p>
        </section>

        <section className="app-exp-block">
          <h3 className="app-exp-h3">Services</h3>
          <div className="app-exp-chips">
            {SERVICES.map((s) => (
              <span key={s} className="app-exp-chip">
                {s}
              </span>
            ))}
          </div>
        </section>
        <hr className="app-exp-hr" />

        <MapCard />

        <Actions
          primary={{ label: 'Book With Partner', Icon: CalendarDays, href: '#book' }}
          secondary={{ label: 'Visit Website', Icon: ExternalLink, href: '#website' }}
        />
      </DetailHero>
    </ExploreShell>
  )
}
