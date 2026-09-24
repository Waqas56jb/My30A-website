import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, ExternalLink, MapPin } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import {
  Actions,
  DetailHero,
  DetailSkeleton,
  ExploreShell,
  MapCard,
  Pill,
  RatingPill,
  TitleRow,
} from './ExploreShared.jsx'

export function useSavedToggle(vendor) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setSaved(Boolean(vendor?.saved))
  }, [vendor?.id, vendor?.saved])

  const toggle = async () => {
    if (!vendor || busy) return
    setBusy(true)
    try {
      if (saved) await guest.unsave(vendor.id)
      else await guest.save(vendor.id)
      setSaved(!saved)
    } catch {
      /* keep previous state */
    } finally {
      setBusy(false)
    }
  }
  return { saved, busy, toggle }
}

export default function VendorDetail() {
  const { id } = useParams()
  const { data: vendor, loading, error } = useGuestQuery(() => guest.vendor(id), [id])
  const { saved, busy, toggle } = useSavedToggle(vendor)

  if (loading || error || !vendor) {
    return (
      <ExploreShell className="app-exp-detail">
        <DetailHero loading={!error} back="/app/explore/guide">
          {error ? <p className="app-empty">{error.status === 404 ? 'Place not found.' : errorText(error)}</p> : <DetailSkeleton />}
        </DetailHero>
      </ExploreShell>
    )
  }

  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image={vendor.image} name={vendor.name} guideSlug={vendor.guide_slug} back={vendor.back || '/app/explore/guide'}>
        <TitleRow title={vendor.name} saved={saved} onToggle={toggle} busy={busy} />
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

        {vendor.about ? (
          <section className="app-exp-block">
            <h3 className="app-exp-h3">About</h3>
            <p className="app-exp-desc">{vendor.about}</p>
          </section>
        ) : null}

        {vendor.services?.length ? (
          <section className="app-exp-block">
            <h3 className="app-exp-h3">Services</h3>
            <div className="app-exp-chips">
              {vendor.services.map((s) => (
                <span key={s} className="app-exp-chip">
                  {s}
                </span>
              ))}
            </div>
          </section>
        ) : null}
        <hr className="app-exp-hr" />

        <MapCard
          name={vendor.map?.name || vendor.community || vendor.place}
          line1={vendor.map?.line1 || '30A, FL'}
          line2={vendor.map?.line2 || vendor.place}
        />

        <Actions
          primary={{ label: 'Book With Partner', Icon: CalendarDays, href: vendor.booking_url || vendor.website_url || '#book' }}
          secondary={{ label: 'Visit Website', Icon: ExternalLink, href: vendor.website_url || '#website' }}
        />
      </DetailHero>
    </ExploreShell>
  )
}
