import { Pencil } from 'lucide-react'

export const TIPS = [
  { key: '10', pct: 10 },
  { key: '18', pct: 18, popular: true },
  { key: '20', pct: 20 },
  { key: 'custom', custom: true },
]

export const money = (n) => `$${n.toFixed(2)}`

export function tipAmount(base, key) {
  const t = TIPS.find((x) => x.key === key)
  return t?.pct ? (base * t.pct) / 100 : 0
}

export function TipGrid({ base, pick, onPick }) {
  return (
    <div className="app-xfer-tips">
      {TIPS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`app-xfer-tip${pick === t.key ? ' is-on' : ''}`}
          aria-pressed={pick === t.key}
          onClick={() => onPick(t.key)}
        >
          {t.popular ? <span className="app-xfer-tip-pop">Popular</span> : null}
          {t.custom ? (
            <>
              <Pencil size={20} strokeWidth={1.5} aria-hidden="true" />
              <small>Custom</small>
            </>
          ) : (
            <>
              <strong>{t.pct}%</strong>
              <small>{money((base * t.pct) / 100)}</small>
            </>
          )}
        </button>
      ))}
    </div>
  )
}
