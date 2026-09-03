import { useState } from 'react'
import BottomSheet from './BottomSheet.jsx'
import Spinner from './Spinner.jsx'
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
    <BottomSheet open={open} onClose={close} title="Change password">
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="client-current-password">Current password</label>
          <input
            id="client-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="client-new-password">New password</label>
          <input
            id="client-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="sheet-error">{error}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            Save password
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
