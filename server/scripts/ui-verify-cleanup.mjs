// Verifies all 5 protected accounts (admin + driver.test/partner.test/shopper.test/guest.demo)
// can still log in after the demo-data cleanup, and that the Transfers/Grocery admin lists are
// now down to a single row each.
//   cd server && node scripts/ui-verify-cleanup.mjs   (API :4000, client :5173, admin :5174)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const CLIENT = 'http://localhost:5173'
const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'
const PASSWORD = 'Test-Pass-2026!'

const results = []
let failures = 0
const ok = (cond, name, detail = '') => {
  results.push({ ok: Boolean(cond), name })
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

const browser = await chromium.launch()
try {
  // ---------- Guest ----------
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const g = await gctx.newPage()
  await g.goto(`${CLIENT}/app/login`)
  await g.fill('input[name="email"]', 'guest.demo@example.com')
  await g.fill('input[name="password"]', PASSWORD)
  await g.click('button[type="submit"]')
  await g.waitForURL(/\/app\/home/, { timeout: 20000 })
  ok(true, 'guest.demo@example.com logs in fine')

  // ---------- Driver ----------
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const d = await dctx.newPage()
  await d.goto(`${CLIENT}/login`)
  await d.fill('input[name="email"]', 'driver.test@example.com')
  await d.fill('input[name="password"]', PASSWORD)
  await d.click('button[type="submit"]')
  await d.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
  ok(true, 'driver.test@example.com logs in fine')

  // ---------- Partner ----------
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p = await pctx.newPage()
  await p.goto(`${CLIENT}/login`)
  await p.fill('input[name="email"]', 'partner.test@example.com')
  await p.fill('input[name="password"]', PASSWORD)
  await p.click('button[type="submit"]')
  await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
  ok(true, 'partner.test@example.com logs in fine')

  // ---------- Shopper ----------
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const s = await sctx.newPage()
  await s.goto(`${CLIENT}/login`)
  await s.fill('input[name="email"]', 'shopper.test@example.com')
  await s.fill('input[name="password"]', PASSWORD)
  await s.click('button[type="submit"]')
  await s.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
  ok(true, 'shopper.test@example.com logs in fine')

  // ---------- Admin ----------
  const actx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const a = await actx.newPage()
  await a.goto(`${ADMIN}/login`)
  await a.fill('input[type="email"]', process.env.ADMIN_EMAIL || 'waqas56jb@gmail.com')
  await a.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'My30A-Admin-2026')
  await a.click('button[type="submit"]')
  await a.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
  ok(true, 'admin logs in fine')

  const farFuture = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10)

  await a.goto(`${ADMIN}/transfers`)
  await a.locator('table').first().waitFor({ timeout: 15000 })
  await a.locator('input[type="date"]').nth(1).fill(farFuture)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  const transferRows = await a.locator('tbody tr:not(.skeleton-row)').count()
  ok(transferRows === 1, 'Transfers list is down to exactly 1 row', `${transferRows} rows`)
  await shot(a, 'admin-transfers-cleaned')

  await a.goto(`${ADMIN}/grocery`)
  await a.locator('table').first().waitFor({ timeout: 15000 })
  await a.locator('input[type="date"]').nth(1).fill(farFuture)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  const groceryRows = await a.locator('tbody tr:not(.skeleton-row)').count()
  ok(groceryRows === 1, 'Grocery orders list is down to exactly 1 row', `${groceryRows} rows`)
  await shot(a, 'admin-grocery-cleaned')

  await a.goto(`${ADMIN}/payouts`)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  const payoutRows = await a.locator('tbody tr:not(.skeleton-row)').count()
  ok(payoutRows === 1, 'Payouts list is down to exactly 1 row', `${payoutRows} rows`)

  // People only lists staff roles (driver/shopper/partner) — guest and admin aren't "created"
  // there, so 3 is the correct fully-cleaned count, not 5.
  await a.goto(`${ADMIN}/people`)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  const peopleRows = await a.locator('tbody tr:not(.skeleton-row)').count()
  ok(peopleRows === 3, 'People list shows exactly one driver, one partner, one shopper', `${peopleRows} rows`)
  await shot(a, 'admin-people-cleaned')

  await a.goto(`${ADMIN}/vehicles`)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  const vehicleRows = await a.locator('tbody tr:not(.skeleton-row)').count()
  ok(vehicleRows === 1, 'Vehicles list is down to exactly 1 row', `${vehicleRows} rows`)
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
