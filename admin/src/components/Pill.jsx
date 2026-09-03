export default function Pill({ children, warn, neutral, sand }) {
  const className = [
    'pill',
    warn ? 'warn' : '',
    neutral ? 'neutral' : '',
    sand ? 'sand' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={className}>{children}</span>
}
