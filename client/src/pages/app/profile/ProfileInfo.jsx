import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Lock } from 'lucide-react'
import { errorText, guest, initials, useGuestQuery } from '../../../lib/guestApi.js'
import { squareJpeg } from '../../../lib/avatar.js'
import { ExploreHead, ExploreShell } from '../explore/ExploreShared.jsx'

export default function ProfileInfo() {
  const { data, reload } = useGuestQuery(guest.me, [])
  const profile = data?.profile
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // Fill from the profile once it loads — but never overwrite what the guest already typed.
  const touched = useRef(false)
  useEffect(() => {
    if (profile && !touched.current) {
      setName(profile.name || '')
      setPhone(profile.phone || '')
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (!name.trim()) return setError('Please enter your name.')
    if (phone.trim() && phone.replace(/\D/g, '').length < 10) return setError('Please enter a valid phone number (drivers use it to reach you).')
    setBusy(true)
    try {
      await guest.updateMe({ name: name.trim(), phone: phone.trim() })
      try {
        localStorage.setItem('my30a-guest-name', name.trim().split(/\s+/)[0])
      } catch {
        /* ignore */
      }
      setSaved(true)
      reload()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setPhotoBusy(true)
    try {
      await guest.uploadAvatar(await squareJpeg(file))
      reload()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <ExploreShell active="profile">
      <ExploreHead title="Personal Information" sub="How drivers, shoppers and Vitoria know you" back="/app/profile" />
      <form className="app-exp-body app-pf-form" onSubmit={save}>
        <div className="app-pf-photo">
          <button type="button" className="app-pf-photo-btn" onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Change profile photo">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span>{initials(profile?.name, profile?.email)}</span>
            )}
            <i aria-hidden="true">
              <Camera size={15} strokeWidth={2} />
            </i>
          </button>
          <small>{photoBusy ? 'Uploading…' : 'Tap to change photo'}</small>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>

        <label className="app-co-field">
          <span>Full name</span>
          <input value={name} onChange={(e) => ((touched.current = true), setName(e.target.value))} autoComplete="name" placeholder="Your full name" />
        </label>
        <label className="app-co-field">
          <span>Mobile number</span>
          <input value={phone} onChange={(e) => ((touched.current = true), setPhone(e.target.value))} autoComplete="tel" inputMode="tel" placeholder="(850) 555-0123" />
        </label>
        <label className="app-co-field is-locked">
          <span>
            Email <Lock size={12} strokeWidth={2} aria-hidden="true" />
          </span>
          <input value={profile?.email || ''} readOnly />
          <small>Your email is your login. To change it, contact My30A Host.</small>
        </label>

        {error ? <p className="app-inline-error">{error}</p> : null}
        {saved ? (
          <p className="app-pf-saved">
            <CheckCircle2 size={16} strokeWidth={2} /> Saved
          </p>
        ) : null}
        <button type="submit" className="app-co-pay" disabled={busy || !profile}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </ExploreShell>
  )
}
