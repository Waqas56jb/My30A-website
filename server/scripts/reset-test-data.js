import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'grocery-uploads'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const confirmed = process.argv.includes('--confirm')
const TEST_SUFFIX = '@my30a.test'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function countEq(table, column, ids) {
  if (!ids.length) return 0
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in(column, ids)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function selectIds(table, column, userIds, idColumn = 'id') {
  if (!userIds.length) return []
  const { data, error } = await supabase.from(table).select(idColumn).in(column, userIds)
  if (error) throw new Error(`${table}: ${error.message}`)
  return [...new Set((data || []).map((row) => row[idColumn]).filter(Boolean))]
}

async function removeGroceryUploads(orderIds) {
  let removed = 0
  for (const orderId of orderIds) {
    const { data, error } = await supabase.storage.from(BUCKET).list(orderId)
    if (error || !data?.length) continue
    const paths = data.map((file) => `${orderId}/${file.name}`)
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
    if (removeError) {
      console.log(`storage skip ${orderId}: ${removeError.message}`)
      continue
    }
    removed += paths.length
  }
  return removed
}

async function del(table, column, ids) {
  if (!ids.length) return
  const { error } = await supabase.from(table).delete().in(column, ids)
  if (error) throw new Error(`delete ${table}.${column}: ${error.message}`)
}

try {
const { data: testers, error: testersError } = await supabase
  .from('profiles')
  .select('id, email, name')
  .ilike('email', `%${TEST_SUFFIX}`)

if (testersError) {
  throw testersError
}

const users = (testers || []).filter((row) =>
  String(row.email || '')
    .toLowerCase()
    .endsWith(TEST_SUFFIX)
)
const userIds = users.map((row) => row.id)

const vehicleIds = await selectIds('vehicles', 'owner_id', userIds)
const transferFromUsers = [
  ...(await selectIds('transfers', 'driver_id', userIds)),
  ...(await selectIds('transfers', 'vehicle_owner_id', userIds)),
  ...(await selectIds('transfers', 'created_by', userIds)),
]
let transferFromVehicles = []
if (vehicleIds.length) {
  const { data, error } = await supabase.from('transfers').select('id').in('vehicle_id', vehicleIds)
  if (error) throw new Error(error.message)
  transferFromVehicles = (data || []).map((row) => row.id)
}
const transferIds = [...new Set([...transferFromUsers, ...transferFromVehicles])]

const groceryIds = [
  ...(await selectIds('grocery_orders', 'shopper_id', userIds)),
  ...(await selectIds('grocery_orders', 'created_by', userIds)),
]
const uniqueGroceryIds = [...new Set(groceryIds)]
const payoutIds = await selectIds('payouts', 'user_id', userIds)

const gpsByTransfer = await countEq('gps_points', 'transfer_id', transferIds)
const gpsByDriver = await countEq('gps_points', 'driver_id', userIds)
const tripLogs =
  (await countEq('trip_status_log', 'transfer_id', transferIds)) +
  (await countEq('trip_status_log', 'updated_by', userIds))
const groceryLogs =
  (await countEq('grocery_status_log', 'order_id', uniqueGroceryIds)) +
  (await countEq('grocery_status_log', 'updated_by', userIds))
const notifications = await countEq('notifications', 'user_id', userIds)
const payoutItems = await countEq('payout_items', 'payout_id', payoutIds)
const agreements =
  (await countEq('compensation_agreements', 'user_id', userIds)) +
  (await countEq('compensation_agreements', 'created_by', userIds))

console.log('Test data cleanup (@my30a.test)')
console.log(`  users: ${users.length}`)
for (const user of users) {
  console.log(`    - ${user.email}`)
}
console.log(`  transfers: ${transferIds.length}`)
console.log(`  grocery_orders: ${uniqueGroceryIds.length}`)
console.log(`  payouts: ${payoutIds.length}`)
console.log(`  payout_items: ${payoutItems}`)
console.log(`  notifications: ${notifications}`)
console.log(`  gps_points: ${gpsByTransfer + gpsByDriver}`)
console.log(`  trip_status_log: ${tripLogs}`)
console.log(`  grocery_status_log: ${groceryLogs}`)
console.log(`  compensation_agreements: ${agreements}`)
console.log(`  vehicles: ${vehicleIds.length}`)
console.log('  keeps: communities, transfer_pricing, settings, non-@my30a.test admins')

if (!confirmed) {
  console.log('\nPass --confirm to delete (npm run reset:test).')
  process.exit(1)
}

if (!userIds.length) {
  console.log('\nNothing to delete.')
  process.exit(0)
}

const filesRemoved = await removeGroceryUploads(uniqueGroceryIds)

await del('gps_points', 'transfer_id', transferIds)
await del('trip_status_log', 'transfer_id', transferIds)
await del('notifications', 'transfer_id', transferIds)
await del('payout_items', 'transfer_id', transferIds)
await del('gps_points', 'driver_id', userIds)
await del('trip_status_log', 'updated_by', userIds)
await del('grocery_status_log', 'order_id', uniqueGroceryIds)
await del('grocery_status_log', 'updated_by', userIds)
await del('notifications', 'grocery_order_id', uniqueGroceryIds)
await del('payout_items', 'grocery_order_id', uniqueGroceryIds)
await del('payout_items', 'payout_id', payoutIds)
await del('payouts', 'id', payoutIds)
await del('notifications', 'user_id', userIds)
await del('transfers', 'id', transferIds)
await del('grocery_orders', 'id', uniqueGroceryIds)
await del('compensation_agreements', 'user_id', userIds)
await del('compensation_agreements', 'created_by', userIds)
await del('vehicles', 'id', vehicleIds)

for (const user of users) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) throw new Error(`auth delete ${user.email}: ${error.message}`)
}

console.log(`\nDeleted ${users.length} test user(s) and related rows. Grocery files removed: ${filesRemoved}.`)
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
