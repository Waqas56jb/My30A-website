export default function SkeletonTable({ rows = 4, cols = 5 }) {
  return (
    <table>
      <tbody>
        {Array.from({ length: rows }).map((_, row) => (
          <tr key={row} className="skeleton-row">
            {Array.from({ length: cols }).map((__, col) => (
              <td key={col}>
                <span className="shimmer" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid stats">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card stat rise" style={{ '--i': index }}>
          <span className="shimmer shimmer-sm" />
          <span className="shimmer shimmer-lg" />
          <span className="shimmer shimmer-sm" />
        </div>
      ))}
    </div>
  )
}
