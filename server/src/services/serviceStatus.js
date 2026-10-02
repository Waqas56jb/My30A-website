// Service availability (Admin → Settings → Service availability): Transfer and Grocery can each be
// paused with a message and an optional "back online" time. While paused, guests see the message
// instead of the form, new requests are refused, and Vitoria says so. When the back-online time
// passes, the service reopens on its own.
import { supabase } from '../lib/supabase.js'

const TIME_ZONE = 'America/Chicago'
const LABEL = { transfer: 'Airport transfers', grocery: 'Grocery delivery' }

function resumeLabel(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

function one(row, kind) {
  const resumeAt = row?.[`${kind}_resume_at`] || null
  const paused = Boolean(row?.[`${kind}_paused`]) && !(resumeAt && new Date(resumeAt).getTime() <= Date.now())
  return {
    paused,
    message: paused ? row[`${kind}_pause_message`] || `${LABEL[kind]} are paused for the moment.` : null,
    resume_at: paused ? resumeAt : null,
    resume_label: paused ? resumeLabel(resumeAt) : null,
  }
}

export async function serviceStatus() {
  const { data } = await supabase
    .from('settings')
    .select('transfer_paused, transfer_pause_message, transfer_resume_at, grocery_paused, grocery_pause_message, grocery_resume_at')
    .eq('id', 1)
    .maybeSingle()
  return { transfer: one(data, 'transfer'), grocery: one(data, 'grocery') }
}

// The guest-facing text when that service is paused (route answers 503 with it), else null.
export async function pausedMessage(kind) {
  const status = (await serviceStatus())[kind]
  if (!status.paused) return null
  return `${status.message}${status.resume_label ? ` Back online ${status.resume_label}.` : ''}`
}

// One line per paused service, for Vitoria's instructions.
export function serviceStatusLines(status) {
  return ['transfer', 'grocery']
    .filter((kind) => status?.[kind]?.paused)
    .map(
      (kind) =>
        `${LABEL[kind]} are PAUSED right now — do not offer to book or arrange them. Tell the guest: "${status[kind].message}"${
          status[kind].resume_label ? ` and that it is back online ${status[kind].resume_label} (Central time)` : ' (no return time set yet)'
        }.`
    )
}
