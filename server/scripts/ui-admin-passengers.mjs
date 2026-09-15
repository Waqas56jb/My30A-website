// Quick visual check: the admin Transfers list and assign form show passenger count.
//   cd server && node scripts/ui-admin-passengers.mjs   (API on :4000, admin on :5174)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'

const results = []
let failures = 0
const ok = (cond, name, detail = '') => {
  results.push({ ok: Boolean(cond), name })
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const a = await ctx.newPage()

  await a.goto(`${ADMIN}/login`)
  await a.fill('input[type="email"]', process.env.ADMIN_EMAIL || 'waqas56jb@gmail.com')
  await a.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'My30A-Admin-2026')
  await a.click('button[type="submit"]')
  await a.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
  ok(true, 'admin login')

  await a.goto(`${ADMIN}/transfers`)
  await a.locator('table').first().waitFor({ timeout: 15000 })
  await a.locator('tbody tr').first().waitFor({ timeout: 15000 })
  await a.locator('td small', { hasText: /pax/ }).first().waitFor({ timeout: 10000 }).catch(() => {})
  const paxInList = await a.locator('td', { hasText: /pax/ }).count()
  ok(paxInList > 0, 'passenger count ("N pax") visible in the transfers list', `${paxInList} row(s)`)
  await a.screenshot({ path: `${OUT}/admin-transfers-list-pax.png` })

  // Open the first "requested" row (unassigned) if one exists, to check the assign form
  const requestedRow = a.locator('tr.clickable', { hasText: 'Requested' }).first()
  if (await requestedRow.count()) {
    await requestedRow.click()
    await a.locator('.assign-box').waitFor({ timeout: 10000 })
    const passengerLine = await a.locator('.assign-box .sub', { hasText: /passenger/ }).count()
    ok(passengerLine > 0, 'passenger count shown in the assign driver/vehicle form')
    await a.screenshot({ path: `${OUT}/admin-assign-form-pax.png` })
  } else {
    console.log('  (no "Requested" trip currently in the list — skipping assign-form check)')
  }
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
