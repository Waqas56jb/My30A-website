import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import Button from '../components/Button.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table from '../components/Table.jsx'
import { useToast } from '../components/Toast.jsx'
import { api, withQuery } from '../lib/api.js'
import {
  chicagoDateTimeToIso,
  chicagoDatetimeLocal,
  errorMessage,
  formatDateTime,
  formatShortDate,
  primaryWorkerRole,
  roleLabel,
  usd,
} from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const PAY_METHODS = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'stripe', label: 'Stripe' },
]

function methodLabel(method) {
  return PAY_METHODS.find((row) => row.value === method)?.label || method || '—'
}

function itemRef(item) {
  if (item.trip_number) return `#${item.trip_number}`
  if (item.order_number) return `#${item.order_number}`
  if (item.item_type === 'owner') return 'Owner fee'
  if (item.item_type === 'shopper') return 'Grocery'
  return item.item_type || 'Item'
}

function hasBalance(summary) {
  return (
    Number(summary?.trip_earnings || 0) !== 0 ||
    Number(summary?.tip_earnings || 0) !== 0 ||
    Number(summary?.cash_collected || 0) !== 0 ||
    Number(summary?.cash_owed_to_admin || 0) !== 0 ||
    Number(summary?.total_amount || 0) !== 0
  )
}

function hasPending(row) {
  return Number(row?.pending_total || 0) !== 0
}

function netDisplay(amount) {
  const net = Number(amount || 0)
  if (net < 0) {
    return (
      <span className="flag">
        <b>
          {usd(Math.abs(net))} owes you
        </b>
      </span>
    )
  }
  return <b>{usd(net)}</b>
}

function pendingNote(amount) {
  const pending = Number(amount || 0)
  if (pending === 0) return null
  return <div className="pending-note">In pending payouts: {usd(pending)}</div>
}

function OwedRowCells({ row }) {
  const summary = row.summary || {}
  const owes = Number(summary.cash_owed_to_admin || 0)
  return (
    <>
      <td data-label="Person">
        {row.user.name} <Pill neutral>{roleLabel(primaryWorkerRole(row.user.roles))}</Pill>
      </td>
      <td className="num" data-label="Trip earnings">
        {usd(summary.trip_earnings)}
      </td>
      <td className="num" data-label="Tips">
        {usd(summary.tip_earnings)}
      </td>
      <td className="num" data-label="Cash collected">
        {usd(summary.cash_collected)}
      </td>
      <td className={`num${owes > 0 ? ' flag' : ''}`} data-label="Owes you">
        {usd(owes)}
      </td>
      <td className="num" data-label="Net to pay">
        {netDisplay(summary.total_amount)}
        {pendingNote(row.pending_total)}
      </td>
    </>
  )
}

export default function Payouts() {
  useTitle('Payouts · My30A Admin')
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const userParam = params.get('user')

  const [personId, setPersonId] = useState('')
  const [status, setStatus] = useState('')
  const historyPath = useMemo(
    () => withQuery('/api/payouts', { user_id: personId, status }),
    [personId, status]
  )

  const owedQuery = useQuery('/api/payouts/owed')
  const historyQuery = useQuery(historyPath)
  const usersQuery = useQuery('/api/users')

  const owed = [...(owedQuery.data || [])].sort((a, b) => {
    const byOwed = Number(b.summary?.total_amount || 0) - Number(a.summary?.total_amount || 0)
    if (byOwed) return byOwed
    return Math.abs(Number(b.pending_total || 0)) - Math.abs(Number(a.pending_total || 0))
  })
  const history = historyQuery.data || []
  const people = (usersQuery.data || [])
    .filter((user) => (user.roles || []).some((role) => ['driver', 'partner', 'shopper'].includes(role)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const error = owedQuery.error || historyQuery.error

  const [working, setWorking] = useState('')
  const [generateUser, setGenerateUser] = useState(null)
  const [notes, setNotes] = useState('')
  const [payPayout, setPayPayout] = useState(null)
  const [payMethod, setPayMethod] = useState('zelle')
  const [payDate, setPayDate] = useState(chicagoDatetimeLocal())
  const [payNotes, setPayNotes] = useState('')
  const [payError, setPayError] = useState('')
  const [itemsId, setItemsId] = useState(null)

  const previewQuery = useQuery(generateUser ? `/api/payouts/owed/${generateUser.user.id}` : null, {
    enabled: Boolean(generateUser),
  })
  const itemsQuery = useQuery(itemsId ? `/api/payouts/${itemsId}` : null, { enabled: Boolean(itemsId) })

  const openedUser = useRef('')

  useEffect(() => {
    if (!userParam || !owed.length) return undefined
    if (openedUser.current === userParam) return undefined
    const row = owed.find((item) => item.user.id === userParam)
    if (row && hasBalance(row.summary)) {
      openedUser.current = userParam
      setGenerateUser(row)
      setNotes('')
    }
    return undefined
  }, [userParam, owed])

  function clearUserParam() {
    if (!params.get('user')) return
    const next = new URLSearchParams(params)
    next.delete('user')
    setParams(next, { replace: true })
  }

  async function refresh() {
    invalidateQuery('/api/payouts')
    invalidateQuery('/api/payouts/owed')
    invalidateQuery('/api/dashboard')
    await Promise.all([owedQuery.refetch(), historyQuery.refetch()])
  }

  function openGenerate(row) {
    setGenerateUser(row)
    setNotes('')
  }

  async function createPayout(event) {
    event.preventDefault()
    if (!generateUser) return
    setWorking('create')
    try {
      await api('/api/payouts', {
        method: 'POST',
        body: { user_id: generateUser.user.id, notes: notes.trim() || undefined },
      })
      toast.success(`Payout created for ${generateUser.user.name}`)
      setGenerateUser(null)
      setNotes('')
      clearUserParam()
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setWorking('')
    }
  }

  async function markPaid(event) {
    event.preventDefault()
    if (!payPayout) return
    setPayError('')
    setWorking(`pay-${payPayout.id}`)
    try {
      await api(`/api/payouts/${payPayout.id}/mark-paid`, {
        method: 'POST',
        body: {
          payment_method: payMethod,
          paid_at: chicagoDateTimeToIso(payDate),
          notes: payNotes.trim() || undefined,
        },
      })
      toast.success('Marked paid')
      setPayPayout(null)
      await refresh()
    } catch (err) {
      setPayError(errorMessage(err))
      toast.error(errorMessage(err))
    } finally {
      setWorking('')
    }
  }

  async function removePayout(payout) {
    if (!window.confirm(`Delete this pending payout for ${payout.user?.name || 'this person'}?`)) return
    setWorking(`del-${payout.id}`)
    try {
      await api(`/api/payouts/${payout.id}`, { method: 'DELETE' })
      toast.success('Payout deleted')
      if (itemsId === payout.id) setItemsId(null)
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setWorking('')
    }
  }

  const previewItems = previewQuery.data?.items || []
  const previewSummary = previewQuery.data?.summary || generateUser?.summary || {}
  const items = itemsQuery.data?.items || []
  const itemsPayout = itemsQuery.data

  function owedCard(row) {
    const summary = row.summary || {}
    const balanced = hasBalance(summary)
    const muted = !balanced && !hasPending(row)
    const owes = Number(summary.cash_owed_to_admin || 0)
    return (
      <div key={row.user.id} className={`owed-card${muted ? ' muted-row' : ''}`}>
        <div>
          {row.user.name} <Pill neutral>{roleLabel(primaryWorkerRole(row.user.roles))}</Pill>
        </div>
        <div className="net">{netDisplay(summary.total_amount)}</div>
        {pendingNote(row.pending_total)}
        <div className="meta">
          <span>Trip earnings {usd(summary.trip_earnings)}</span>
          <span>Tips {usd(summary.tip_earnings)}</span>
          <span>Cash collected {usd(summary.cash_collected)}</span>
          <span className={owes > 0 ? 'flag' : undefined}>Owes you {usd(owes)}</span>
        </div>
        {balanced ? (
          <Button className="btn" onClick={() => openGenerate(row)}>
            Generate payout
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <section>
      <div className="head">
        <div>
          <h1>Payouts</h1>
          <div className="sub">Pay whenever you like. The system keeps the running balance.</div>
        </div>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      <div className="card rise" style={{ '--i': 0 }}>
        <h3 style={{ marginBottom: 10 }}>Owed right now</h3>
        {owedQuery.loading ? (
          <SkeletonTable rows={4} cols={7} />
        ) : owed.length === 0 ? (
          <EmptyState icon={Wallet} title="Nobody is owed anything right now" />
        ) : (
          <div className="content-in">
            <div className="owed-desktop">
              <Table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="num">Trip earnings</th>
                    <th className="num">Tips</th>
                    <th className="num">Cash collected</th>
                    <th className="num">Owes you</th>
                    <th className="num">Net to pay</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {owed.map((row) => {
                    const balanced = hasBalance(row.summary)
                    const muted = !balanced && !hasPending(row)
                    return (
                      <tr key={row.user.id} className={muted ? 'muted-row' : undefined}>
                        <OwedRowCells row={row} />
                        <td data-label="">
                          {balanced ? (
                            <Button className="btn sm" onClick={() => openGenerate(row)}>
                              Generate payout
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <div className="owed-mobile">{owed.map(owedCard)}</div>
          </div>
        )}
      </div>

      <div className="card rise" style={{ marginTop: 16, '--i': 1 }}>
        <h3 style={{ marginBottom: 10 }}>Payout history</h3>
        <div className="filters">
          <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
            <option value="">All people</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        {historyQuery.loading && !history.length ? (
          <SkeletonTable rows={4} cols={9} />
        ) : history.length === 0 ? (
          <EmptyState icon={Wallet} title="No payouts yet" />
        ) : (
          <div className="content-in">
            <Table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Person</th>
                  <th className="num">Trip earnings</th>
                  <th className="num">Tips</th>
                  <th className="num">Cash owed</th>
                  <th className="num">Total</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((payout) => {
                  const pending = payout.status === 'pending'
                  const cashOwed = Number(payout.cash_owed_to_admin || 0)
                  return (
                    <tr key={payout.id}>
                      <td data-label="Created">{formatShortDate(payout.created_at)}</td>
                      <td data-label="Person">{payout.user?.name || '—'}</td>
                      <td className="num" data-label="Trip earnings">
                        {usd(payout.trip_earnings)}
                      </td>
                      <td className="num" data-label="Tips">
                        {usd(payout.tip_earnings)}
                      </td>
                      <td className={`num${cashOwed > 0 ? ' flag' : ''}`} data-label="Cash owed">
                        {usd(payout.cash_owed_to_admin)}
                      </td>
                      <td className="num" data-label="Total">
                        {Number(payout.total_amount) < 0 ? (
                          <span className="flag">{usd(Math.abs(payout.total_amount))} owes you</span>
                        ) : (
                          usd(payout.total_amount)
                        )}
                      </td>
                      <td data-label="Method">{methodLabel(payout.payment_method)}</td>
                      <td data-label="Status">
                        {pending ? (
                          <Pill sand>Pending</Pill>
                        ) : (
                          <Pill>
                            Paid
                            {payout.paid_at ? ` · ${formatShortDate(payout.paid_at)}` : ''}
                          </Pill>
                        )}
                      </td>
                      <td data-label="">
                        <div className="history-actions">
                          {pending ? (
                            <Button
                              className="btn sm"
                              onClick={() => {
                                setPayError('')
                                setPayMethod('zelle')
                                setPayDate(chicagoDatetimeLocal())
                                setPayNotes(payout.notes || '')
                                setPayPayout(payout)
                              }}
                            >
                              Mark paid
                            </Button>
                          ) : null}
                          <Button className="btn quiet sm" onClick={() => setItemsId(payout.id)}>
                            Items
                          </Button>
                          {pending ? (
                            <Button
                              className="btn quiet sm danger"
                              pending={working === `del-${payout.id}`}
                              onClick={() => removePayout(payout)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(generateUser)}
        onClose={() => {
          setGenerateUser(null)
          clearUserParam()
        }}
        title={generateUser ? `Generate payout · ${generateUser.user.name}` : 'Generate payout'}
        width="640px"
      >
        {generateUser ? (
          <form onSubmit={createPayout}>
            {previewQuery.loading ? (
              <SkeletonTable rows={3} cols={5} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Date</th>
                    <th className="num">Trip earnings</th>
                    <th className="num">Tips</th>
                    <th className="num">Cash collected</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, index) => (
                    <tr key={`${item.item_type}-${item.transfer_id || item.grocery_order_id}-${index}`}>
                      <td data-label="Item">{itemRef(item)}</td>
                      <td data-label="Date">{formatDateTime(item.date)}</td>
                      <td className="num" data-label="Trip earnings">
                        {usd(item.trip_earnings)}
                      </td>
                      <td className="num" data-label="Tips">
                        {usd(item.tip_earnings)}
                      </td>
                      <td className="num" data-label="Cash collected">
                        {usd(item.cash_collected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="kv" style={{ marginTop: 12 }}>
              <span>Trip earnings</span>
              <span className="num">{usd(previewSummary.trip_earnings)}</span>
              <span>Tips</span>
              <span className="num">{usd(previewSummary.tip_earnings)}</span>
              <span>Cash collected</span>
              <span className="num">{usd(previewSummary.cash_collected)}</span>
              <span>Owes you</span>
              <span className={`num${Number(previewSummary.cash_owed_to_admin) > 0 ? ' flag' : ''}`}>
                {usd(previewSummary.cash_owed_to_admin)}
              </span>
              <span>Net to pay</span>
              <span className="num total">{netDisplay(previewSummary.total_amount)}</span>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Notes</label>
              <textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="actions">
              <Button
                className="btn quiet"
                onClick={() => {
                  setGenerateUser(null)
                  clearUserParam()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn" pending={working === 'create'}>
                Create payout
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(payPayout)}
        onClose={() => setPayPayout(null)}
        title={payPayout ? `Mark paid · ${payPayout.user?.name || 'Payout'}` : 'Mark paid'}
        width="440px"
      >
        {payPayout ? (
          <form onSubmit={markPaid}>
            <p className="muted" style={{ marginBottom: 12 }}>
              {usd(payPayout.total_amount)} · {formatShortDate(payPayout.created_at)}
            </p>
            <div className="field">
              <label>Payment method</label>
              <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
                {PAY_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Paid date</label>
              <input
                type="datetime-local"
                value={payDate}
                onChange={(event) => setPayDate(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea rows="2" value={payNotes} onChange={(event) => setPayNotes(event.target.value)} />
            </div>
            {payError ? <p className="form-error">{payError}</p> : null}
            <div className="actions">
              <Button className="btn quiet" onClick={() => setPayPayout(null)}>
                Cancel
              </Button>
              <Button type="submit" className="btn" pending={working === `pay-${payPayout.id}`}>
                Mark paid
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Drawer open={Boolean(itemsId)} onClose={() => setItemsId(null)}>
        {itemsPayout ? (
          <>
            <Button className="btn quiet sm" onClick={() => setItemsId(null)} style={{ float: 'right' }}>
              Close
            </Button>
            <h2>{itemsPayout.user?.name || 'Payout'}</h2>
            <div className="sub">
              {formatDateTime(itemsPayout.created_at)} ·{' '}
              {itemsPayout.status === 'pending' ? (
                <Pill sand>Pending</Pill>
              ) : (
                <Pill>
                  Paid
                  {itemsPayout.paid_at ? ` · ${formatShortDate(itemsPayout.paid_at)}` : ''}
                </Pill>
              )}
            </div>
            {itemsQuery.loading ? (
              <SkeletonTable rows={3} cols={4} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Date</th>
                    <th>Detail</th>
                    <th className="num">Trip earnings</th>
                    <th className="num">Tips</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item">{itemRef(item)}</td>
                      <td data-label="Date">{formatDateTime(item.date)}</td>
                      <td data-label="Detail">{item.detail || '—'}</td>
                      <td className="num" data-label="Trip earnings">
                        {usd(item.trip_earnings)}
                      </td>
                      <td className="num" data-label="Tips">
                        {usd(item.tip_earnings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="kv">
              <span>Trip earnings</span>
              <span className="num">{usd(itemsPayout.trip_earnings)}</span>
              <span>Tips</span>
              <span className="num">{usd(itemsPayout.tip_earnings)}</span>
              <span>Cash owed</span>
              <span className="num">{usd(itemsPayout.cash_owed_to_admin)}</span>
              <span>Total</span>
              <span className="num total">{netDisplay(itemsPayout.total_amount)}</span>
            </div>
            {itemsPayout.status === 'paid' ? (
              <div className="kv">
                <span>Method</span>
                <span>{methodLabel(itemsPayout.payment_method)}</span>
                <span>Paid</span>
                <span>{formatDateTime(itemsPayout.paid_at)}</span>
              </div>
            ) : null}
            {itemsPayout.notes ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {itemsPayout.notes}
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted">Loading payout…</p>
        )}
      </Drawer>
    </section>
  )
}
