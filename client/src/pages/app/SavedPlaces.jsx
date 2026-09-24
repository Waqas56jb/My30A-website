import { Link, useSearchParams } from 'react-router-dom'
import { Compass, Heart, UtensilsCrossed } from 'lucide-react'
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
  const [params] = useSearchParams()
  // ?type=dining → Favorite Restaurants: only saved restaurants, bars and cafés.
  const dining = params.get('type') === 'dining'
  const pending = loading && !data
  const places = (data || []).filter((p) => !dining || p.kind === 'restaurant')

  return (
    <ExploreShell active="profile">
      <div className="app-enter">
        <ExploreHead
          title={dining ? 'Favorite Restaurants' : 'Saved Places'}
          sub={dining ? 'Restaurants, bars & cafés you’ve hearted' : 'Everything you’ve hearted in Explore 30A'}
          back="/app/profile"
        />
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
            <strong>{dining ? 'No favorite restaurants yet' : 'No saved places yet'}</strong>
            <p>
              {dining
                ? 'Tap the heart on any restaurant, bar or café in Dining to keep it here.'
                : 'Tap the heart on any place in Explore 30A to keep it here for later.'}
            </p>
            <Link to={dining ? '/app/explore/dining?type=restaurant' : '/app/explore'} className="app-saved-empty-cta app-press">
              {dining ? <UtensilsCrossed size={18} strokeWidth={1.8} aria-hidden="true" /> : <Compass size={18} strokeWidth={1.8} aria-hidden="true" />}
              {dining ? 'Browse dining' : 'Explore 30A'}
            </Link>
          </div>
        ) : null}
      </div>
    </ExploreShell>
  )
}
