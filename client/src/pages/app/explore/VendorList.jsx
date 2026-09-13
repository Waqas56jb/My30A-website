import { useParams } from 'react-router-dom'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, VendorCard } from './ExploreShared.jsx'

export default function VendorList() {
  const { slug } = useParams()
  const { data, loading, error } = useGuestQuery(() => guest.vendors(slug), [slug])
  const vendors = data?.vendors || []

  return (
    <ExploreShell>
      <ExploreHead
        title={data?.title || 'Local Vendors'}
        sub="Curated vendors to elevate your stay"
        back="/app/explore/guide"
      />

      <div className="app-exp-body">
        {error ? (
          <p className="app-inline-error">{error.status === 404 ? 'This guide is not available.' : errorText(error)}</p>
        ) : null}
        {!loading && !error ? <h2 className="app-exp-count">{vendors.length} Vendors</h2> : null}
        <div className="app-exp-vendors">
          {vendors.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </div>
        {!loading && !error && vendors.length === 0 ? (
          <p className="app-empty">No vendors listed yet.</p>
        ) : null}
      </div>
    </ExploreShell>
  )
}
