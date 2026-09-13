import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table from '../components/Table.jsx'
import { withQuery } from '../lib/api.js'
import { chicagoToday, errorMessage, formatDateTime } from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { useQuery } from '../lib/useQuery.js'

const KINDS = [
  { id: 'all', label: 'Everything' },
  { id: 'chat', label: 'Chat' },
  { id: 'sms', label: 'SMS' },
  { id: 'calls', label: 'Calls' },
]

function monthStart() {
  return `${chicagoToday().slice(0, 8)}01`
}

function smsPill(status) {
  if (status === 'sent') return {}
  if (status === 'failed') return { warn: true }
  return { neutral: true } // queued / skipped (Twilio not configured yet)
}

// Full, permanent history of every trip conversation, SMS and masked call — for disputes and audits.
export default function Messages() {
  useTitle('Messages · My30A Admin')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [driverId, setDriverId] = useState('')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState('')

  const path = useMemo(
    () =>
      withQuery('/api/messages', {
        q,
        kind,
        driver_id: driverId,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : '',
        date_to: dateTo ? `${dateTo}T23:59:59` : '',
      }),
    [q, kind, driverId, dateFrom, dateTo]
  )
  const query = useQuery(path)
  const usersQuery = useQuery('/api/users')
  const drivers = (usersQuery.data || [])
    .filter((user) => (user.roles || []).some((role) => ['driver', 'partner'].includes(role)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const rows = useMemo(() => {
    const data = query.data || { messages: [], sms: [], calls: [] }
    const all = [
      ...data.messages.map((m) => ({ ...m, _kind: 'chat' })),
      ...data.sms.map((m) => ({ ...m, _kind: 'sms' })),
      ...data.calls.map((m) => ({ ...m, _kind: 'call' })),
    ]
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [query.data])

  return (
    <section>
      <div className="head">
        <div>
          <h1>Messages & calls</h1>
          <div className="sub">
            Every guest ↔ driver chat, SMS and masked call, kept forever. Drivers only ever see
            their active trips.
          </div>
        </div>
      </div>

      <div className="filters">
        <input
          placeholder="Search trip #, guest, driver, text…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
          <option value="">All drivers</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>

      {query.error ? <p className="page-error">{errorMessage(query.error)}</p> : null}

      <div className="card rise" style={{ '--i': 0 }}>
        {query.loading && !query.data ? (
          <SkeletonTable rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Nothing in this range." />
        ) : (
          <div className="content-in">
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Trip</th>
                  <th>Type</th>
                  <th>From → To</th>
                  <th>Content</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row._kind}-${row.id}`}>
                    <td data-label="When">{formatDateTime(row.created_at)}</td>
                    <td data-label="Trip">
                      {row.transfer ? (
                        <Link to={`/transfers?open=${row.transfer.id}`}>#{row.transfer.trip_number}</Link>
                      ) : (
                        '—'
                      )}
                      <br />
                      <small className="muted">
                        {row.transfer?.guest_name || ''}
                        {row.transfer?.driver?.name ? ` · ${row.transfer.driver.name}` : ''}
                      </small>
                    </td>
                    <td data-label="Type">
                      {row._kind === 'chat' ? (
                        <Pill sand>Chat · {row.sender_role}</Pill>
                      ) : row._kind === 'sms' ? (
                        <Pill {...smsPill(row.status)}>SMS · {row.status}</Pill>
                      ) : (
                        <Pill neutral>Call · {row.status || '—'}</Pill>
                      )}
                    </td>
                    <td data-label="From → To">
                      {row._kind === 'chat'
                        ? row.sender_name || row.sender_role
                        : row._kind === 'sms'
                          ? `My30A → ${row.to_phone || '—'}`
                          : `${row.from_phone || '—'} → ${row.to_phone || '—'}${row.duration_seconds ? ` · ${row.duration_seconds}s` : ''}`}
                    </td>
                    <td data-label="Content">
                      {row._kind === 'call' ? (row.direction || '').replace(/_/g, ' ') : row.body}
                      {row._kind === 'sms' && row.error ? <small className="muted"> · {row.error}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </section>
  )
}
