import { useParams } from 'react-router-dom'
import {
  Bike,
  CircleParking,
  CircleX,
  Flag,
  Home,
  Map,
  MapPin,
  Recycle,
  Share2,
  ShowerHead,
  Toilet,
  Umbrella,
  Users,
  Waves,
} from 'lucide-react'
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
import { useSavedToggle } from './VendorDetail.jsx'

// Amenity labels come from the database; pick an icon by keyword.
function amenityIcon(label) {
  const l = label.toLowerCase()
  if (l.includes('park')) return CircleParking
  if (l.includes('restroom')) return Toilet
  if (l.includes('shower')) return ShowerHead
  if (l.includes('bike')) return Bike
  if (l.includes('family')) return Users
  return Umbrella
}

const RULE_ICONS = [CircleX, Recycle, Flag, Home, Waves]

function twoLines(label) {
  const words = label.split(' ')
  if (words.length < 2) return label
  const mid = Math.ceil(words.length / 2)
  return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`
}

export default function BeachDetail() {
  const { id } = useParams()
  const { data: beach, loading, error } = useGuestQuery(() => guest.vendor(id), [id])
  const { saved, busy, toggle } = useSavedToggle(beach)

  if (loading || error || !beach) {
    return (
      <ExploreShell className="app-exp-detail">
        <DetailHero loading={!error} back="/app/explore/guide?c=beaches">
          {error ? <p className="app-empty">{error.status === 404 ? 'Beach not found.' : errorText(error)}</p> : <DetailSkeleton />}
        </DetailHero>
      </ExploreShell>
    )
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: beach.name, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* ignore */
    }
  }

  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image={beach.image} back={beach.back || '/app/explore/guide?c=beaches'}>
        <TitleRow title={beach.name} saved={saved} onToggle={toggle} busy={busy} />
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            {beach.place}
          </Pill>
          <RatingPill rating={beach.rating} reviews={beach.reviews} white />
        </div>
        <hr className="app-exp-hr" />

        <p className="app-exp-desc">{beach.desc}</p>

        {beach.amenities?.length ? (
          <section className="app-exp-block">
            <h3 className="app-exp-h3">Hours/Access</h3>
            <div className="app-exp-amen">
              {beach.amenities.map((label) => {
                const Icon = amenityIcon(label)
                return (
                  <span key={label} className="app-exp-amen-item">
                    <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                    <small>{twoLines(label)}</small>
                  </span>
                )
              })}
            </div>
          </section>
        ) : null}

        {beach.rules?.length ? (
          <section className="app-xfer-card app-exp-rules">
            <h3 className="app-exp-h3">Beach Rules</h3>
            {beach.rules.map((text, i) => {
              const Icon = RULE_ICONS[i % RULE_ICONS.length]
              return (
                <div key={text} className="app-exp-rule">
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span>{text}</span>
                </div>
              )
            })}
          </section>
        ) : null}

        <MapCard
          name={beach.map?.name || beach.community || beach.place}
          line1={beach.map?.line1 || '30A, FL'}
          line2={beach.map?.line2 || beach.place}
        />

        <div className="app-exp-actions">
          <a
            href={beach.directions_url || `https://maps.google.com/?q=${encodeURIComponent(beach.name)}`}
            className="app-exp-btn is-primary"
            target="_blank"
            rel="noreferrer"
          >
            <Map size={20} strokeWidth={1.5} aria-hidden="true" />
            Get Directions
          </a>
          <button type="button" className="app-exp-btn is-ghost" onClick={share}>
            <Share2 size={20} strokeWidth={1.5} aria-hidden="true" />
            Share
          </button>
        </div>
      </DetailHero>
    </ExploreShell>
  )
}
