export default function EmptyState({ icon: Icon, title, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={28} strokeWidth={1.75} /> : null}
      <p>{title}</p>
      {actionLabel ? (
        <button type="button" className="btn" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
