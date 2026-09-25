import { useParams } from 'react-router-dom'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, VendorCard, VendorSkeleton } from './ExploreShared.jsx'

export default function VendorList() {
  const { slug } = useParams()
  const { data, loading, error } = useGuestQuery(() => guest.vendors(slug), [slug])
  const vendors = data?.vendors || []
  const ready = data && !error

  return (
    <ExploreShell>
      <ExploreHead
        title={data?.title || 'Local Vendors'}
        sub="Curated vendors to elevate your stay"
        back="/app/explore"
      />

      <div className="app-exp-body">
        {error ? (
          <p className="app-inline-error">{error.status === 404 ? 'This guide is not available.' : errorText(error)}</p>
        ) : null}
        {ready ? (
          <h2 className="app-exp-count">
            {vendors.length} {vendors.length === 1 ? 'Vendor' : 'Vendors'}
          </h2>
        ) : null}
        <div className="app-exp-vendors">
          {ready ? vendors.map((v, i) => <VendorCard key={v.id} vendor={v} index={i} />) : !error ? <VendorSkeleton /> : null}
        </div>
        {!loading && ready && vendors.length === 0 ? <p className="app-empty">No vendors listed yet.</p> : null}
      </div>
    </ExploreShell>
  )
}
