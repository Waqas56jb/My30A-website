import Spinner from './Spinner.jsx'

export default function Button({
  pending = false,
  children,
  className = 'btn',
  type = 'button',
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      className={`${className}${pending ? ' pending' : ''}`}
      disabled={disabled || pending}
      {...props}
    >
      <span className="btn-label">{children}</span>
      {pending ? (
        <span className="btn-spinner">
          <Spinner />
        </span>
      ) : null}
    </button>
  )
}
