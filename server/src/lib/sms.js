// Twilio SMS via the REST API (no SDK). Mirrors lib/stripe.js: when Twilio isn't configured the
// message is still logged to sms_log with status 'skipped' so nothing is lost and the admin can
// see exactly what would have gone out.
import { supabase } from './supabase.js'

const notConfigured = { skipped: true, reason: 'TWILIO_NOT_CONFIGURED' }

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  )
}

export function maskedCallNumber() {
  return process.env.TWILIO_FROM_NUMBER || null
}

// Normalizes US numbers to E.164 (+1XXXXXXXXXX); returns null when it can't.
export function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (String(phone).trim().startsWith('+') && digits.length >= 8) return `+${digits}`
  return null
}

export function last10(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10)
}

export async function sendSms({ to, body, transfer_id = null, grocery_order_id = null, kind = null }) {
  const e164 = toE164(to)
  const log = {
    transfer_id,
    grocery_order_id,
    to_phone: e164 || (to ? String(to) : null),
    body,
    kind,
    status: 'queued',
  }

  if (!e164) {
    log.status = 'skipped'
    log.error = 'NO_VALID_PHONE'
    await supabase.from('sms_log').insert(log)
    return { skipped: true, reason: 'NO_VALID_PHONE' }
  }
  if (!isSmsConfigured()) {
    log.status = 'skipped'
    log.error = notConfigured.reason
    await supabase.from('sms_log').insert(log)
    return notConfigured
  }

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const params = new URLSearchParams({ To: e164, From: process.env.TWILIO_FROM_NUMBER, Body: body })
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(10000),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      log.status = 'failed'
      log.error = json.message || `${response.status}`
      await supabase.from('sms_log').insert(log)
      return { skipped: true, reason: log.error }
    }
    log.status = 'sent'
    log.provider_sid = json.sid
    await supabase.from('sms_log').insert(log)
    return { sent: true, sid: json.sid }
  } catch (error) {
    log.status = 'failed'
    log.error = error.message
    await supabase.from('sms_log').insert(log)
    return { skipped: true, reason: error.message }
  }
}
