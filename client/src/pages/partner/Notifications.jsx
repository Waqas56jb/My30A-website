import { Bell } from 'lucide-react'
import EmptyState from '../../components/EmptyState.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import { api } from '../../lib/api.js'
import { errorMessage, formatWhenLine } from '../../lib/format.js'
import { useNotifications } from '../../lib/useNotifications.js'
import { invalidateQuery } from '../../lib/useQuery.js'
import { useTitle } from '../../lib/useTitle.js'

const HIGHLIGHT = /(#\d+|\$[\d.,]+)/g

function RichMessage({ text }) {
  const parts = String(text || '').split(HIGHLIGHT)
  return (
    <div className="m">
      {parts.map((part, index) =>
        /^(#\d+|\$[\d.,]+)$/.test(part) ? <b key={index}>{part}</b> : <span key={index}>{part}</span>
      )}
    </div>
  )
}

export default function Notifications() {
  useTitle('Notifications · My30A Host')
  usePageHeader('Notifications')
  const { notifications, loading, error, unread, refetch } = useNotifications()

  async function markAll() {
    if (!unread) return
    try {
      await api('/api/notifications/read-all', { method: 'POST' })
      invalidateQuery('/api/notifications/mine')
      await refetch()
    } catch {
      /* keep current list; next poll retries */
    }
  }

  async function markOne(item) {
    if (item.is_read) return
    try {
      await api(`/api/notifications/${item.id}/read`, { method: 'PATCH' })
      invalidateQuery('/api/notifications/mine')
      await refetch()
    } catch {
      /* ignore */
    }
  }

  return (
    <section>
      <div className="toolbar">
        <button type="button" className="link" onClick={markAll} disabled={!unread}>
          Mark all read
        </button>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      {loading ? (
        <>
          <div className="notif">
            <span className="dot" />
            <span className="shimmer shimmer-lg" />
          </div>
          <div className="notif">
            <span className="dot" />
            <span className="shimmer shimmer-lg" />
          </div>
        </>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing yet. You'll be notified every time your vehicle completes a trip."
        />
      ) : (
        notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`notif${item.is_read ? ' read' : ''}`}
            onClick={() => markOne(item)}
          >
            <span className="dot" />
            <div>
              <RichMessage text={item.message} />
              <div className="when">{formatWhenLine(item.created_at)}</div>
            </div>
          </button>
        ))
      )}
    </section>
  )
}
