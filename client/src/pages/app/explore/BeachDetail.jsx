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
import {
  Actions,
  DetailHero,
  ExploreShell,
  MapCard,
  Pill,
  RatingPill,
  TitleRow,
} from './ExploreShared.jsx'

const AMENITIES = [
  { Icon: Umbrella, label: 'Beach\nAccess' },
  { Icon: CircleParking, label: 'Nearby\nParking' },
  { Icon: Toilet, label: 'Restrooms\nNearby' },
  { Icon: ShowerHead, label: 'Outdoor\nShowers' },
  { Icon: Bike, label: 'Bike\nRacks' },
  { Icon: Users, label: 'Family\nFriendly' },
]

const RULES = [
  { Icon: CircleX, text: 'No glass containers on the beach.' },
  { Icon: Recycle, text: 'Leave no trace. Please dispose of trash in designated bins.' },
  { Icon: Flag, text: 'Swim near a lifeguard and follow flag warnings.' },
  { Icon: Home, text: 'Respect private property and stay off dunes.' },
  { Icon: Waves, text: 'Check local beach conditions and advisories before your visit.' },
]

export default function BeachDetail() {
  return (
    <ExploreShell className="app-exp-detail">
      <DetailHero image="/image1.png" back="/app/explore/guide?c=beaches">
        <TitleRow title="Rosemary Beach Access" />
        <div className="app-exp-pills">
          <Pill icon={MapPin} white>
            Rosemary Beach, FL
          </Pill>
          <RatingPill rating="5.0" reviews="258" white />
        </div>
        <hr className="app-exp-hr" />

        <p className="app-exp-desc">
          Welcome to Rosemary Beach Access, a beautiful public access point to the sugar-white
          sands and emerald waters of 30A. Stroll down the boardwalk, relax by the gulf, and enjoy
          the best of Florida’s Gulf Coast.
        </p>

        <section className="app-exp-block">
          <h3 className="app-exp-h3">Hours/Access</h3>
          <div className="app-exp-amen">
            {AMENITIES.map(({ Icon, label }) => (
              <span key={label} className="app-exp-amen-item">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                <small>{label}</small>
              </span>
            ))}
          </div>
        </section>

        <section className="app-xfer-card app-exp-rules">
          <h3 className="app-exp-h3">Beach Rules</h3>
          {RULES.map(({ Icon, text }) => (
            <div key={text} className="app-exp-rule">
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>{text}</span>
            </div>
          ))}
        </section>

        <MapCard />

        <Actions
          primary={{ label: 'Get Directions', Icon: Map, href: '#directions' }}
          secondary={{ label: 'Share', Icon: Share2, href: '#share' }}
        />
      </DetailHero>
    </ExploreShell>
  )
}
