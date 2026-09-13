import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExploreHead, ExploreShell, FILTERS, GUIDE, GuideCard } from './ExploreShared.jsx'

export default function LocalGuide() {
  const [params] = useSearchParams()
  const initial = FILTERS.some((f) => f.key === params.get('c')) ? params.get('c') : 'all'
  const [filter, setFilter] = useState(initial)
  const items = GUIDE.filter((g) => g.cats.includes(filter))

  return (
    <ExploreShell>
      <ExploreHead title="Local Guide" sub="30A’s best - curated by Vitoria" back="/app/explore" />

      <div className="app-exp-body">
        <div className="app-exp-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`app-exp-filter${filter === f.key ? ' is-on' : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="app-exp-cards">
          {items.map((item) => (
            <GuideCard key={item.key} item={item} />
          ))}
        </div>
      </div>
    </ExploreShell>
  )
}
