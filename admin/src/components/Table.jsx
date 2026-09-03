import { ChevronRight } from 'lucide-react'

export default function Table({ children }) {
  return (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  )
}

export function Clip({ children, title }) {
  const text = children == null ? '' : String(children)
  return (
    <span className="clip" title={title || text}>
      {text}
    </span>
  )
}

export function RowChevron() {
  return (
    <td data-label="" className="row-chevron-cell">
      <ChevronRight size={16} className="row-chevron" aria-hidden="true" />
    </td>
  )
}
