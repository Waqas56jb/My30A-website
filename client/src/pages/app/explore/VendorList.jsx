import { Link, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { ExploreHead, ExploreShell, Pill, RatingPill, VENDORS, VENDOR_LISTS } from './ExploreShared.jsx'

export default function VendorList() {
  const { slug } = useParams()
  const title = VENDOR_LISTS[slug] || 'Local Vendors'

  return (
    <ExploreShell>
      <ExploreHead title={title} sub="Curated vendors to elevate your stay" back="/app/explore/guide" />

      <div className="app-exp-body">
        <h2 className="app-exp-count">{VENDORS.length} Vendors</h2>
        <div className="app-exp-vendors">
          {VENDORS.map((v) => (
            <article key={v.id} className="app-exp-vendor">
              <img src={v.image} alt="" />
              <div className="app-exp-vendor-body">
                <h3>{v.name}</h3>
                <div className="app-exp-pills">
                  <Pill icon={MapPin}>{v.place}</Pill>
                  <RatingPill rating={v.rating} reviews={v.reviews} />
                </div>
                <p>{v.desc}</p>
                <div className="app-exp-vendor-foot">
                  <strong>From ${v.from}</strong>
                  <Link to={`/app/explore/vendor/${v.id}`}>View Vendor</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </ExploreShell>
  )
}
