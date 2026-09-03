import { useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table from '../components/Table.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { errorMessage, usd, vehicleLabel, vehicleTypeLabel } from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const VEHICLE_TYPES = [
  { value: '4pax', label: 'Car · 4 pax', capacity: 4 },
  { value: '6pax', label: 'SUV · 6 pax', capacity: 6 },
  { value: '14pax', label: 'Van · 14 pax', capacity: 14 },
]

function emptyVehicle(defaultFee, ownerId) {
  return {
    make: '',
    model: '',
    year: String(new Date().getFullYear()),
    plate: '',
    vehicle_type: '4pax',
    owner_id: ownerId || '',
    owner_fee_percent: String(defaultFee ?? 20),
  }
}

export default function Vehicles() {
  useTitle('Vehicles · My30A Admin')
  const { profile } = useAuth()
  const vehiclesQuery = useQuery('/api/vehicles')
  const usersQuery = useQuery('/api/users')
  const summaryQuery = useQuery('/api/earnings/admin/summary')
  const settingsQuery = useQuery('/api/settings')

  const vehicles = vehiclesQuery.data || []
  const owners = (usersQuery.data || [])
    .filter((user) => (user.roles || []).some((role) => role === 'admin' || role === 'partner'))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const monthStats = {}
  for (const row of summaryQuery.data?.per_vehicle || []) {
    monthStats[row.vehicle] = row
  }
  const settings = settingsQuery.data
  const loading =
    vehiclesQuery.loading || usersQuery.loading || summaryQuery.loading || settingsQuery.loading
  const error = vehiclesQuery.error || usersQuery.error || summaryQuery.error || settingsQuery.error

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyVehicle(20, ''))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    invalidateQuery('/api/vehicles')
    invalidateQuery('/api/earnings/admin/summary')
    await Promise.all([vehiclesQuery.refetch(), summaryQuery.refetch()])
  }

  function openAdd() {
    setForm(emptyVehicle(settings?.default_owner_fee_percent, profile?.id))
    setFormError('')
    setModal('add')
  }

  function openEdit(vehicle) {
    setForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: String(vehicle.year || ''),
      plate: vehicle.plate || '',
      vehicle_type: vehicle.vehicle_type || '4pax',
      owner_id: vehicle.owner_id || '',
      owner_fee_percent: String(vehicle.owner_fee_percent ?? ''),
      status: vehicle.status || 'active',
    })
    setFormError('')
    setModal(vehicle)
  }

  function capacityFor(type) {
    return VEHICLE_TYPES.find((row) => row.value === type)?.capacity || 4
  }

  async function saveVehicle(event) {
    event.preventDefault()
    setFormError('')
    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      plate: form.plate.trim(),
      vehicle_type: form.vehicle_type,
      capacity: capacityFor(form.vehicle_type),
      owner_id: form.owner_id,
      owner_fee_percent: Number(form.owner_fee_percent),
    }
    if (!payload.make || !payload.model || !payload.plate || !payload.owner_id) {
      setFormError('Make, model, plate, and owner are required.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        await api('/api/vehicles', { method: 'POST', body: payload })
      } else {
        await api(`/api/vehicles/${modal.id}`, {
          method: 'PATCH',
          body: { ...payload, status: form.status },
        })
      }
      setModal(null)
      await refresh()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="head">
        <div>
          <h1>Vehicles</h1>
          <div className="sub">Owner fee is set per vehicle. Changing it only affects future trips.</div>
        </div>
        <Button className="btn" onClick={openAdd}>
          <Plus size={18} /> Add vehicle
        </Button>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      <div className="card">
        {loading ? (
          <SkeletonTable rows={3} cols={8} />
        ) : vehicles.length === 0 ? (
          <EmptyState icon={Truck} title="No vehicles yet." actionLabel="Add vehicle" onAction={openAdd} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Owner</th>
                <th className="num">Owner fee</th>
                <th className="num">Trips this month</th>
                <th className="num">Owner fees this month</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const stats = monthStats[vehicleLabel(vehicle)] || { trips: 0, owner_fees: 0 }
                const isYou = vehicle.owner_id === profile?.id
                return (
                  <tr key={vehicle.id}>
                    <td data-label="Vehicle">
                      {vehicle.make} {vehicle.model} {vehicle.year} · {vehicle.plate}
                    </td>
                    <td data-label="Type">{vehicleTypeLabel(vehicle.vehicle_type, vehicle.capacity)}</td>
                    <td data-label="Owner">
                      {vehicle.owner_name || '—'}
                      {isYou ? ' (you)' : ''}
                    </td>
                    <td className="num" data-label="Owner fee">
                      {isYou ? '—' : `${vehicle.owner_fee_percent}%`}
                    </td>
                    <td className="num" data-label="Trips this month">
                      {stats.trips || 0}
                    </td>
                    <td className="num" data-label="Owner fees this month">
                      {isYou ? '—' : usd(stats.owner_fees)}
                    </td>
                    <td data-label="Status">
                      <Pill neutral={vehicle.status !== 'active'}>
                        {vehicle.status === 'active' ? 'Active' : 'Inactive'}
                      </Pill>
                    </td>
                    <td data-label="">
                      <button type="button" className="btn quiet sm" onClick={() => openEdit(vehicle)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </div>

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add vehicle' : 'Edit vehicle'}
        width="480px"
      >
        <form onSubmit={saveVehicle}>
          <div className="row2">
            <div className="field">
              <label>Make</label>
              <input
                value={form.make}
                onChange={(event) => setForm({ ...form, make: event.target.value })}
                placeholder="Ford"
              />
            </div>
            <div className="field">
              <label>Model</label>
              <input
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="Transit"
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Year</label>
              <input
                type="number"
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Plate</label>
              <input
                value={form.plate}
                onChange={(event) => setForm({ ...form, plate: event.target.value })}
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Type</label>
              <select
                value={form.vehicle_type}
                onChange={(event) => setForm({ ...form, vehicle_type: event.target.value })}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Owner</label>
              <select
                value={form.owner_id}
                onChange={(event) => setForm({ ...form, owner_id: event.target.value })}
              >
                <option value="">Select owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                    {owner.id === profile?.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Owner fee %</label>
            <input
              value={form.owner_fee_percent}
              onChange={(event) => setForm({ ...form, owner_fee_percent: event.target.value })}
              style={{ maxWidth: 120 }}
            />
          </div>
          {modal !== 'add' ? (
            <div className="field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="actions">
            <button type="button" className="btn quiet" onClick={() => setModal(null)}>
              Cancel
            </button>
            <Button type="submit" className="btn" pending={saving}>
              {modal === 'add' ? 'Save vehicle' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
