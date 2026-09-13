import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { ExploreHead, ExploreShell } from './ExploreShared.jsx'

const SECTIONS = [
  {
    key: 'rules',
    title: 'Beach Rules',
    items: [
      'No glass containers on the beach.',
      'Stay off the dunes and use designated beach access paths.',
      'Follow beach flag warnings before entering the water.',
      'Dispose of trash properly and leave no trace.',
      'Respect private property and posted access restrictions.',
      'Check local rules before bringing pets, fires, tents, or large setups.',
    ],
  },
  {
    key: 'parking',
    title: 'Parking',
    items: [
      'Public parking is available at regional beach accesses; arrive early in season.',
      'Do not park on private streets, lawns, or in front of beach access paths.',
      'Golf carts and bikes have designated racks at most accesses.',
    ],
  },
  {
    key: 'access',
    title: 'Beach Access',
    items: [
      'Regional and neighborhood accesses are marked with blue signs along 30A.',
      'Many accesses include boardwalks, showers, and restrooms.',
      'Some communities restrict access to residents and guests.',
    ],
  },
  {
    key: 'safety',
    title: 'Safety',
    items: [
      'Double red flags mean the water is closed to the public.',
      'Rip currents are common; swim near lifeguards when possible.',
      'Use sunscreen and stay hydrated, especially midday.',
    ],
  },
  {
    key: 'weather',
    title: 'Weather',
    items: [
      'Summer afternoons often bring short thunderstorms; check the radar before heading out.',
      'Hurricane season runs June through November.',
      'Water temperatures are warmest from June to September.',
    ],
  },
  {
    key: 'transport',
    title: 'Transportation',
    items: [
      'Nearest airports: ECP (Panama City), VPS (Destin), PNS (Pensacola).',
      'The 30A bike path runs the full length of the highway.',
      'Book airport transfers in the Services tab.',
    ],
  },
  {
    key: 'services',
    title: 'Local Services',
    items: [
      'Grocery: Publix at Water Sound Town Center.',
      'Urgent care and pharmacies are available in Santa Rosa Beach and Inlet Beach.',
      'Ask Vitoria for vetted local vendors.',
    ],
  },
  {
    key: 'emergency',
    title: 'Emergency Helplines',
    items: [
      'Emergency: 911',
      'Walton County Sheriff (non-emergency): (850) 892-8111',
      'South Walton Fire District: (850) 267-1298',
      'Beach conditions hotline: (850) 892-8111',
    ],
  },
]

export default function PublicInfo() {
  const [open, setOpen] = useState('rules')

  return (
    <ExploreShell nav={false}>
      <ExploreHead
        title="Public Information"
        sub="Official resources, helpful local information for your stay"
        back="/app/explore"
      />

      <div className="app-exp-body">
        <div className="app-exp-accs">
          {SECTIONS.map((s) => {
            const isOpen = open === s.key
            return (
              <section key={s.key} className="app-exp-acc">
                <button
                  type="button"
                  className="app-exp-acc-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : s.key)}
                >
                  <span>{s.title}</span>
                  {isOpen ? (
                    <ChevronUp size={22} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={22} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
                {isOpen ? (
                  <ul className="app-exp-acc-list">
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })}
        </div>

        <div className="app-xfer-note is-info is-lg">
          <Info size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            Information provided is based on official local resources, including{' '}
            <a href="https://www.visitsouthwalton.com" target="_blank" rel="noreferrer">
              Visit South Walton
            </a>{' '}
            and regional partners.
          </span>
        </div>
      </div>
    </ExploreShell>
  )
}
