// One-time cleanup: the admin panel accumulated ~400 transfers / ~150 grocery orders / thousands
// of notifications from a long session of e2e-cli.js + Playwright runs. Trims every list down to
// one row, while protecting the documented demo login accounts (admin + driver.test/partner.test/
// shopper.test/guest.demo) and whatever profiles/vehicle the kept rows themselves reference, so
// nothing dangles or breaks a foreign key.
//   cd server && node scripts/cleanup-demo-data.js [--dry-run]
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dryRun = process.argv.includes('--dry-run')

const DEMO_EMAILS = ['driver.test@example.com', 'partner.test@example.com', 'shopper.test@example.com', 'guest.demo@example.com']

async function count(table, filter = (q) => q) {
  const { count: n, error } = await filter(supabase.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw error
  return n
}

async function del(table, filter) {
  if (dryRun) return
  const { error } = await filter(supabase.from(table).delete())
  if (error) throw new Error(`delete ${table}: ${error.message}`)
}

async function main() {
  console.log(dryRun ? '--- DRY RUN (no changes will be made) ---' : '--- LIVE RUN ---')

  const { data: adminProfile } = await supabase.from('profiles').select('id, email').eq('email', process.env.ADMIN_EMAIL).maybeSingle()
  const { data: demoProfiles } = await supabase.from('profiles').select('id, email').in('email', DEMO_EMAILS)
  const keepProfileIds = new Set([adminProfile?.id, ...(demoProfiles || []).map((p) => p.id)].filter(Boolean))
  console.log('Base protected accounts:', [adminProfile?.email, ...(demoProfiles || []).map((p) => p.email)].filter(Boolean).join(', '))

  const { data: keepTransfer } = await supabase
    .from('transfers')
    .select('id, trip_number, guest_id, driver_id, vehicle_owner_id, vehicle_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: keepOrder } = await supabase
    .from('grocery_orders')
    .select('id, order_number, guest_id, shopper_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: keepPayout } = await supabase
    .from('payouts')
    .select('id, user_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Whatever people/vehicle the kept rows actually reference must also survive, or deleting
  // "everyone else" would leave a dangling foreign key on a row we're keeping.
  for (const id of [keepTransfer?.guest_id, keepTransfer?.driver_id, keepTransfer?.vehicle_owner_id, keepOrder?.guest_id, keepOrder?.shopper_id, keepPayout?.user_id]) {
    if (id) keepProfileIds.add(id)
  }
  let keepVehicleId = keepTransfer?.vehicle_id || null
  if (!keepVehicleId) {
    const { data: e2eVehicle } = await supabase.from('vehicles').select('id').eq('plate', 'E2E-4PAX').maybeSingle()
    keepVehicleId = e2eVehicle?.id || null
  }

  console.log(`Keeping transfer #${keepTransfer?.trip_number ?? '—'}, grocery order #${keepOrder?.order_number ?? '—'}, vehicle ${keepVehicleId ?? '—'}`)
  console.log(`Protected profile count (base + referenced by kept rows): ${keepProfileIds.size}`)

  const before = {
    transfers: await count('transfers'),
    grocery_orders: await count('grocery_orders'),
    payouts: await count('payouts'),
    payout_items: await count('payout_items'),
    notifications: await count('notifications'),
    sms_log: await count('sms_log'),
    gps_points: await count('gps_points'),
    compensation_agreements: await count('compensation_agreements'),
    vehicles: await count('vehicles'),
    profiles: await count('profiles'),
    saved_places: await count('saved_places'),
    guest_bookings: await count('guest_bookings'),
  }

  // Order matters: clear FK-blocking children before the parents they point to. payout_items
  // cascade from payouts, but payouts carry their own pre-computed totals, so clearing all
  // payout_items first (to unblock deleting old transfers/orders) doesn't affect the kept payout.
  await del('payout_items', (q) => q.not('id', 'is', null))
  if (keepPayout) await del('payouts', (q) => q.neq('id', keepPayout.id))
  await del('gps_points', (q) => (keepTransfer ? q.neq('transfer_id', keepTransfer.id) : q.not('id', 'is', null)))
  await del('sms_log', (q) => {
    let query = q
    if (keepTransfer) query = query.or(`transfer_id.neq.${keepTransfer.id},transfer_id.is.null`)
    return query
  })
  await del('notifications', (q) => q.not('id', 'is', null))
  await del('call_log', (q) => q.not('id', 'is', null))

  if (keepTransfer) await del('transfers', (q) => q.neq('id', keepTransfer.id))
  if (keepOrder) await del('grocery_orders', (q) => q.neq('id', keepOrder.id))

  await del('compensation_agreements', (q) => q.not('user_id', 'in', `(${[...keepProfileIds].join(',')})`))
  if (keepVehicleId) await del('vehicles', (q) => q.neq('id', keepVehicleId))

  const { data: guestProfiles } = await supabase.from('profiles').select('id').contains('roles', ['guest'])
  const keepGuestIds = new Set([...keepProfileIds].filter((id) => (guestProfiles || []).some((g) => g.id === id)))
  await del('saved_places', (q) => q.not('guest_id', 'in', `(${[...keepGuestIds].join(',') || '00000000-0000-0000-0000-000000000000'})`))
  await del('guest_bookings', (q) => q.not('guest_id', 'in', `(${[...keepGuestIds].join(',') || '00000000-0000-0000-0000-000000000000'})`))

  await del('profiles', (q) => q.not('id', 'in', `(${[...keepProfileIds].join(',')})`))

  const after = dryRun
    ? before
    : {
        transfers: await count('transfers'),
        grocery_orders: await count('grocery_orders'),
        payouts: await count('payouts'),
        payout_items: await count('payout_items'),
        notifications: await count('notifications'),
        sms_log: await count('sms_log'),
        gps_points: await count('gps_points'),
        compensation_agreements: await count('compensation_agreements'),
        vehicles: await count('vehicles'),
        profiles: await count('profiles'),
        saved_places: await count('saved_places'),
        guest_bookings: await count('guest_bookings'),
      }

  console.log('\nTable            before -> after')
  for (const key of Object.keys(before)) {
    console.log(`${key.padEnd(16)} ${String(before[key]).padStart(5)} -> ${after[key]}`)
  }
}

main().catch((error) => {
  console.error('cleanup failed:', error)
  process.exit(1)
})
