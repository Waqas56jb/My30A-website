import { useState } from 'react'
import { Copy, Plus, Users } from 'lucide-react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table from '../components/Table.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import {
  chicagoToday,
  compensationLabel,
  errorMessage,
  formatShortDate,
  roleLabel,
} from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const STAFF_ROLES = ['driver', 'partner', 'shopper']
const COMP_TYPES = [
  { value: 'fixed', label: 'Fixed per trip' },
  { value: 'percentage', label: 'Percentage of trip' },
  { value: 'hourly', label: 'Per hour' },
]

const emptyPerson = {
  name: '',
  phone: '',
  email: '',
  driver: false,
  shopper: false,
  partner: false,
  type: 'fixed',
  value: '30',
  send_email: true,
}

export default function People() {
  useTitle('People · My30A Admin')
  const toast = useToast()
  const { data, error, loading, refetch } = useQuery('/api/users')
  const people = (data || [])
    .filter((person) => (person.roles || []).some((role) => STAFF_ROLES.includes(role)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyPerson)
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [createdPassword, setCreatedPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [ratePerson, setRatePerson] = useState(null)
  const [rateForm, setRateForm] = useState({ type: 'fixed', value: '', effective_from: chicagoToday() })
  const [rateError, setRateError] = useState('')
  const [rateSaving, setRateSaving] = useState(false)
  const [editPerson, setEditPerson] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    driver: false,
    shopper: false,
    partner: false,
    is_active: true,
  })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [emailResetDetails, setEmailResetDetails] = useState(true)

  async function refresh() {
    invalidateQuery('/api/users')
    await refetch()
  }

  function compensationCell(person) {
    const roles = person.roles || []
    const agreement = person.compensation
    const upcoming = person.compensation_upcoming
    const parts = []
    if (roles.includes('driver') || roles.includes('shopper')) {
      parts.push(compensationLabel(agreement, roles, { includeSince: false }))
    }
    if (roles.includes('partner')) {
      parts.push('Owner fee set per vehicle')
    }
    if (parts.length === 0) return '—'
    return (
      <>
        {parts.join(' · ')}
        {agreement?.effective_from ? (
          <>
            {' '}
            <small className="muted">since {formatShortDate(agreement.effective_from)}</small>
          </>
        ) : null}
        {upcoming ? (
          <>
            <br />
            <small className="muted">
              New: {compensationLabel(upcoming, roles, { includeSince: false })} from{' '}
              {formatShortDate(upcoming.effective_from)}
            </small>
          </>
        ) : null}
      </>
    )
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function createPerson(event) {
    event.preventDefault()
    setAddError('')
    const roles = []
    if (addForm.driver) roles.push('driver')
    if (addForm.shopper) roles.push('shopper')
    if (addForm.partner) roles.push('partner')
    if (!addForm.name.trim() || !addForm.email.trim() || roles.length === 0) {
      setAddError('Name, email, and at least one role are required.')
      return
    }
    if ((addForm.driver || addForm.shopper) && addForm.value === '') {
      setAddError('Set a compensation value for drivers and shoppers.')
      return
    }

    setAddSaving(true)
    try {
      const created = await api('/api/users', {
        method: 'POST',
        body: {
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim() || null,
          roles,
          send_email: Boolean(addForm.send_email),
        },
      })
      if (addForm.driver || addForm.shopper) {
        await api('/api/compensation', {
          method: 'POST',
          body: {
            user_id: created.id,
            type: addForm.type,
            value: Number(addForm.value),
            effective_from: chicagoToday(),
          },
        })
      }
      setCreatedPassword(created.password || '')
      await refresh()
    } catch (err) {
      setAddError(errorMessage(err))
    } finally {
      setAddSaving(false)
    }
  }

  function openRate(person) {
    const current = person.compensation
    setRatePerson(person)
    setRateError('')
    setRateForm({
      type: current?.type || 'fixed',
      value: current?.value != null ? String(current.value) : '',
      effective_from: chicagoToday(),
    })
  }

  async function saveRate(event) {
    event.preventDefault()
    setRateError('')
    setRateSaving(true)
    try {
      const saved = await api('/api/compensation', {
        method: 'POST',
        body: {
          user_id: ratePerson.id,
          type: rateForm.type,
          value: Number(rateForm.value),
          effective_from: rateForm.effective_from,
        },
      })
      setRatePerson(null)
      await refresh()
      toast.success(
        `New rate saved · effective ${formatShortDate(saved.effective_from || rateForm.effective_from)}`
      )
    } catch (err) {
      setRateError(errorMessage(err))
    } finally {
      setRateSaving(false)
    }
  }

  function openEdit(person) {
    const roles = person.roles || []
    setEditPerson(person)
    setEditError('')
    setResetPassword('')
    setCopied(false)
    setEmailResetDetails(true)
    setEditForm({
      name: person.name || '',
      phone: person.phone || '',
      driver: roles.includes('driver'),
      shopper: roles.includes('shopper'),
      partner: roles.includes('partner'),
      is_active: person.is_active !== false,
    })
  }

  async function saveEdit(event) {
    event.preventDefault()
    setEditError('')
    const roles = []
    if (editForm.driver) roles.push('driver')
    if (editForm.shopper) roles.push('shopper')
    if (editForm.partner) roles.push('partner')
    if ((editPerson.roles || []).includes('admin')) roles.push('admin')
    if (roles.filter((role) => role !== 'admin').length === 0) {
      setEditError('Keep at least one role.')
      return
    }
    setEditSaving(true)
    try {
      await api(`/api/users/${editPerson.id}`, {
        method: 'PATCH',
        body: {
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          roles,
          is_active: editForm.is_active,
        },
      })
      setEditPerson(null)
      await refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  async function resetUserPassword() {
    setEditError('')
    try {
      const result = await api(`/api/users/${editPerson.id}/reset-password`, {
        method: 'POST',
        body: { send_email: Boolean(emailResetDetails) },
      })
      setResetPassword(result.password)
      setCopied(false)
    } catch (err) {
      setEditError(errorMessage(err))
    }
  }

  const needsComp = addForm.driver || addForm.shopper

  return (
    <section>
      <div className="head">
        <div>
          <h1>People</h1>
          <div className="sub">Drivers, shoppers and vehicle partners. You create every login here.</div>
        </div>
        <Button
          className="btn"
          onClick={() => {
            setAddForm(emptyPerson)
            setAddError('')
            setCreatedPassword('')
            setCopied(false)
            setAddOpen(true)
          }}
        >
          <Plus size={18} /> Add person
        </Button>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      <div className="card">
        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people yet."
            actionLabel="Add person"
            onAction={() => {
              setAddForm(emptyPerson)
              setAddError('')
              setCreatedPassword('')
              setAddOpen(true)
            }}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roles</th>
                <th>Compensation</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td data-label="Name">{person.name}</td>
                  <td data-label="Roles">
                    {(person.roles || [])
                      .filter((role) => STAFF_ROLES.includes(role))
                      .map((role) => (
                        <span key={role}>
                          <Pill neutral>{roleLabel(role)}</Pill>{' '}
                        </span>
                      ))}
                  </td>
                  <td data-label="Compensation">{compensationCell(person)}</td>
                  <td data-label="Contact">
                    {person.email}
                    {person.phone ? ` · ${person.phone}` : ''}
                  </td>
                  <td data-label="Status">
                    <Pill neutral={!person.is_active}>{person.is_active ? 'Active' : 'Inactive'}</Pill>
                  </td>
                  <td data-label="">
                    {(person.roles || []).some((role) => role === 'driver' || role === 'shopper') ? (
                      <>
                        <button type="button" className="btn quiet sm" onClick={() => openRate(person)}>
                          Change rate
                        </button>{' '}
                      </>
                    ) : null}
                    <button type="button" className="btn quiet sm" onClick={() => openEdit(person)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={createdPassword ? 'Login created' : 'Add person'}
      >
        {createdPassword ? (
          <>
            <p className="sub" style={{ marginBottom: 12 }}>
              Share this temporary password once. They can change it after signing in.
            </p>
            <div className="password-box">
              <code>{createdPassword}</code>
              <button type="button" className="btn quiet sm" onClick={() => copyText(createdPassword)}>
                <Copy size={18} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setAddOpen(false)}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={createPerson}>
            <div className="row2">
              <div className="field">
                <label>Name</label>
                <input
                  value={addForm.name}
                  onChange={(event) => setAddForm({ ...addForm, name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={addForm.phone}
                  onChange={(event) => setAddForm({ ...addForm, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Email (their login)</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(event) => setAddForm({ ...addForm, email: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Roles</label>
              <div className="checks">
                <label>
                  <input
                    type="checkbox"
                    checked={addForm.driver}
                    onChange={(event) => setAddForm({ ...addForm, driver: event.target.checked })}
                  />{' '}
                  Driver
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={addForm.shopper}
                    onChange={(event) => setAddForm({ ...addForm, shopper: event.target.checked })}
                  />{' '}
                  Shopper
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={addForm.partner}
                    onChange={(event) => setAddForm({ ...addForm, partner: event.target.checked })}
                  />{' '}
                  Partner (vehicle owner)
                </label>
              </div>
            </div>
            {needsComp ? (
              <div className="row2">
                <div className="field">
                  <label>Compensation type</label>
                  <select
                    value={addForm.type}
                    onChange={(event) => setAddForm({ ...addForm, type: event.target.value })}
                  >
                    {COMP_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Value</label>
                  <input
                    value={addForm.value}
                    onChange={(event) => setAddForm({ ...addForm, value: event.target.value })}
                    placeholder="30"
                  />
                </div>
              </div>
            ) : null}
            <div className="field">
              <label className="checks">
                <input
                  type="checkbox"
                  checked={addForm.send_email}
                  onChange={(event) => setAddForm({ ...addForm, send_email: event.target.checked })}
                />{' '}
                Email login details to this person
              </label>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>
              A temporary password is created and shown to you once. Share it with them; they can change it after
              signing in.
            </p>
            {addError ? <p className="form-error">{addError}</p> : null}
            <div className="actions">
              <button type="button" className="btn quiet" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <Button type="submit" className="btn" pending={addSaving}>
                Create login
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(ratePerson)}
        onClose={() => setRatePerson(null)}
        title={ratePerson ? `Change rate · ${ratePerson.name}` : 'Change rate'}
        width="440px"
      >
        {ratePerson ? (
          <form onSubmit={saveRate}>
            <p className="muted" style={{ marginBottom: 12 }}>
              Current: {compensationLabel(ratePerson.compensation, ratePerson.roles)}. This adds a new
              agreement row — past trips keep the old rate.
            </p>
            <div className="row2">
              <div className="field">
                <label>Type</label>
                <select
                  value={rateForm.type}
                  onChange={(event) => setRateForm({ ...rateForm, type: event.target.value })}
                >
                  {COMP_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Value</label>
                <input
                  value={rateForm.value}
                  onChange={(event) => setRateForm({ ...rateForm, value: event.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Effective from</label>
              <input
                type="date"
                value={rateForm.effective_from}
                onChange={(event) => setRateForm({ ...rateForm, effective_from: event.target.value })}
              />
            </div>
            {rateError ? <p className="form-error">{rateError}</p> : null}
            <div className="actions">
              <button type="button" className="btn quiet" onClick={() => setRatePerson(null)}>
                Cancel
              </button>
              <Button type="submit" className="btn" pending={rateSaving}>
                Save new rate
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editPerson)}
        onClose={() => setEditPerson(null)}
        title={editPerson ? `Edit · ${editPerson.name}` : 'Edit'}
        width="480px"
      >
        {editPerson ? (
          <form onSubmit={saveEdit}>
            <div className="row2">
              <div className="field">
                <label>Name</label>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Roles</label>
              <div className="checks">
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.driver}
                    onChange={(event) => setEditForm({ ...editForm, driver: event.target.checked })}
                  />{' '}
                  Driver
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.shopper}
                    onChange={(event) => setEditForm({ ...editForm, shopper: event.target.checked })}
                  />{' '}
                  Shopper
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.partner}
                    onChange={(event) => setEditForm({ ...editForm, partner: event.target.checked })}
                  />{' '}
                  Partner
                </label>
              </div>
            </div>
            <div className="field">
              <label className="checks">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })}
                />{' '}
                Active
              </label>
            </div>
            {resetPassword ? (
              <div className="password-box">
                <code>{resetPassword}</code>
                <button type="button" className="btn quiet sm" onClick={() => copyText(resetPassword)}>
                  <Copy size={18} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <div className="field">
                <label className="checks">
                  <input
                    type="checkbox"
                    checked={emailResetDetails}
                    onChange={(event) => setEmailResetDetails(event.target.checked)}
                  />{' '}
                  Email login details to this person
                </label>
                <p className="muted" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn quiet sm" onClick={resetUserPassword}>
                    Reset password
                  </button>
                </p>
              </div>
            )}
            {editError ? <p className="form-error">{editError}</p> : null}
            <div className="actions">
              <button type="button" className="btn quiet" onClick={() => setEditPerson(null)}>
                Cancel
              </button>
              <Button type="submit" className="btn" pending={editSaving}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  )
}
