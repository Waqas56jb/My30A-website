export default function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="empty">
      {Icon ? <Icon size={28} strokeWidth={1.75} /> : null}
      <p className="empty-title">{title}</p>
      {detail ? <p>{detail}</p> : null}
    </div>
  )
}
