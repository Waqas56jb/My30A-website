import { Link } from 'react-router-dom'
import { Compass, Heart } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../lib/guestApi.js'
import { ExploreHead, ExploreShell, VendorCard } from './explore/ExploreShared.jsx'

function VendorSkeleton() {
  return (
    <div className="app-saved-skel" aria-hidden="true">
      <span className="app-skel app-saved-skel-img" />
      <span className="app-saved-skel-body">
        <span className="app-skel app-skel-title" style={{ width: '85%' }} />
        <span style={{ display: 'flex', gap: 8 }}>
          <span className="app-skel" style={{ width: 70, height: 26, borderRadius: 999 }} />
          <span className="app-skel" style={{ width: 56, height: 26, borderRadius: 999 }} />
        </span>
        <span className="app-skel app-skel-line" />
        <span className="app-skel app-skel-line" style={{ width: '70%' }} />
        <span className="app-skel app-skel-title" style={{ width: '50%', marginTop: 'auto' }} />
      </span>
    </div>
  )
}

export default function SavedPlaces() {
  const { data, loading, error } = useGuestQuery(guest.saved, [])
  const pending = loading && !data
  const places = data || []

  return (
    <ExploreShell active="profile">
      <div className="app-enter">
        <ExploreHead title="Saved Places" sub="Everything you’ve hearted in Explore 30A" back="/app/profile" />
      </div>
      <div className="app-exp-body">
        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
        {pending ? (
          <>
            <span className="app-skel app-skel-title" style={{ width: 96 }} aria-hidden="true" />
            <div className="app-exp-vendors" aria-busy="true">
              <VendorSkeleton />
              <VendorSkeleton />
            </div>
          </>
        ) : null}
        {!pending && !error && places.length > 0 ? (
          <>
            <h2 className="app-exp-count app-enter">{places.length} Saved</h2>
            <div className="app-exp-vendors app-stagger app-saved-list">
              {places.map((v) => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </>
        ) : null}
        {!pending && !error && places.length === 0 ? (
          <div className="app-saved-empty app-rise">
            <span className="app-saved-empty-ico" aria-hidden="true">
              <Heart size={26} strokeWidth={1.8} />
            </span>
            <strong>No saved places yet</strong>
            <p>Tap the heart on any place in Explore 30A to keep it here for later.</p>
            <Link to="/app/explore" className="app-saved-empty-cta app-press">
              <Compass size={18} strokeWidth={1.8} aria-hidden="true" />
              Explore 30A
            </Link>
          </div>
        ) : null}
      </div>
    </ExploreShell>
  )
}
