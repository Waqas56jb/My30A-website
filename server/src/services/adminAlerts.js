// Email side of admin alerts (the in-panel side is the notifications row every admin gets, which
// the admin panel polls, shows as a banner and chimes). Recipients are the comma-separated
// settings.alert_emails (Admin → Settings), so the owner decides where alerts go.
import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/email.js'
import { pickPublicUrl } from '../lib/urls.js'

export async function alertRecipients() {
  const { data } = await supabase.from('settings').select('alert_emails').eq('id', 1).maybeSingle()
  return String(data?.alert_emails || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}

export function adminLink({ transfer_id, grocery_order_id, path }) {
  const base = (pickPublicUrl(process.env.ADMIN_APP_URL) || 'https://my30-a-website-admin.vercel.app').replace(/\/$/, '')
  if (transfer_id) return `${base}/transfers?open=${transfer_id}`
  if (grocery_order_id) return `${base}/grocery?open=${grocery_order_id}`
  if (path) return `${base}${path}`
  return base
}

// Never throws — an email problem must not break a booking.
export async function emailAdminAlert({ subject, message, lines = [], transfer_id = null, grocery_order_id = null, path = null }) {
  try {
    const to = await alertRecipients()
    if (!to.length) return { skipped: true, reason: 'NO_ALERT_EMAILS' }
    const text = [
      message,
      '',
      ...lines.filter(Boolean),
      ...(lines.length ? [''] : []),
      `Open it in Admin: ${adminLink({ transfer_id, grocery_order_id, path })}`,
      '',
      '— My30A Host',
    ].join('\n')
    return await sendEmail({ to: to.join(', '), subject, text })
  } catch (error) {
    console.log('Admin alert email skipped:', error.message)
    return { skipped: true, reason: error.message }
  }
}
