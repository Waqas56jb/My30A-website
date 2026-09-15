import { useLocation, useSearchParams } from 'react-router-dom'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, GuideCard, VendorCard } from './ExploreShared.jsx'

export default function LocalGuide() {
  const [params] = useSearchParams()
  const { state } = useLocation()
  const q = (params.get('q') || '').trim()
  const categoryKey = (params.get('c') || '').trim()
  // The tile grid passes its label via router state (same-app navigation); a direct link or
  // refresh falls back to a generic title rather than guessing.
  const title = q ? `Results for “${q}”` : state?.label || 'Local Guide'

  const guideQuery = useGuestQuery(() => guest.guide(categoryKey), [categoryKey], { enabled: !q })
  const searchQuery = useGuestQuery(() => guest.search(q), [q], { enabled: Boolean(q) })

  const items = q ? searchQuery.data?.guides || [] : guideQuery.data?.items || []
  const vendors = q ? searchQuery.data?.vendors || [] : []
  const loading = q ? searchQuery.loading : guideQuery.loading
  const error = q ? searchQuery.error : guideQuery.error

  return (
    <ExploreShell>
      <ExploreHead title={title} sub="30A’s best - curated by Vitoria" back="/app/explore" />

      <div className="app-exp-body">
        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        <div className="app-exp-cards">
          {items.map((item) => (
            <GuideCard key={item.key} item={item} />
          ))}
        </div>

        {vendors.length ? (
          <>
            <h2 className="app-exp-count">{vendors.length} Places</h2>
            <div className="app-exp-vendors">
              {vendors.map((v) => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </>
        ) : null}

        {!loading && !error && items.length === 0 && vendors.length === 0 ? (
          <p className="app-empty">Nothing here yet. Try another category.</p>
        ) : null}
      </div>
    </ExploreShell>
  )
}
