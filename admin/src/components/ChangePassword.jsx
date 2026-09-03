import { useState } from 'react'
import Button from './Button.jsx'
import Modal from './Modal.jsx'
import { api } from '../lib/api.js'
import { errorMessage } from '../lib/format.js'

export default function ChangePassword({ open, onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    if (saving) return
    setCurrentPassword('')
    setNewPassword('')
    setError('')
    onClose()
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Change password" width="400px">
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="admin-current-password">Current password</label>
          <input
            id="admin-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="admin-new-password">New password</label>
          <input
            id="admin-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="actions">
          <button type="button" className="btn quiet" onClick={close} disabled={saving}>
            Cancel
          </button>
          <Button type="submit" className="btn" pending={saving}>
            Save password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
