import { errorText, guest, useGuestQuery } from '../../lib/guestApi.js'
import { ExploreHead, ExploreShell, VendorCard } from './explore/ExploreShared.jsx'

export default function SavedPlaces() {
  const { data, loading, error } = useGuestQuery(guest.saved, [])
  const places = data || []

  return (
    <ExploreShell active="profile">
      <ExploreHead title="Saved Places" sub="Everything you’ve hearted in Explore 30A" back="/app/profile" />
      <div className="app-exp-body">
        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
        {!loading && !error ? <h2 className="app-exp-count">{places.length} Saved</h2> : null}
        <div className="app-exp-vendors">
          {places.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </div>
        {!loading && !error && places.length === 0 ? (
          <p className="app-empty">Tap the heart on any place in Explore 30A to save it here.</p>
        ) : null}
      </div>
    </ExploreShell>
  )
}
