// Verifies: (1) the guest-facing transfer review screen no longer shows a self-service
// "Add Holiday add-on" checkbox, and (2) the admin transfer drawer can add/remove the holiday
// fee, shown as a plain "Holiday fee $40" line — matching the client's explicit request.
//   cd server && node scripts/ui-holiday-fee.mjs   (API :4000, client :5173, admin :5174)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const CLIENT = 'http://localhost:5173'
const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'
const PASSWORD = 'Test-Pass-2026!'
const GUEST = 'guest.demo@example.com'

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
  // ---------- Guest: book a transfer, confirm no self-service holiday checkbox ----------
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const g = await gctx.newPage()
  await g.goto(`${CLIENT}/app/login`)
  await g.fill('input[name="email"]', GUEST)
  await g.fill('input[name="password"]', PASSWORD)
  await g.click('button[type="submit"]')
  await g.waitForURL(/\/app\/home/, { timeout: 20000 })

  await g.goto(`${CLIENT}/app/transfer`)
  await g.locator('.app-xfer-h', { hasText: 'Select your Community' }).waitFor({ timeout: 15000 })
  const communityDd = g.locator('.app-xfer-section', { hasText: 'Select your Community' }).locator('.app-xfer-dd')
  await communityDd.locator('button.app-xfer-select').click()
  await communityDd.getByText('Rosemary Beach', { exact: true }).click()
  await g.locator('.app-xfer-addr input[type="text"]').fill('12 N Barrett Square, Rosemary Beach, FL')
  await g.waitForTimeout(300)
  await g.locator('input[placeholder="Flight number"]').fill('DL 100')
  await g.locator('button', { hasText: 'Continue' }).click()
  await g.waitForURL(/\/app\/transfer\/review/, { timeout: 15000 })

  await g.locator('.app-xfer-price, .app-xfer-card').first().waitFor({ timeout: 15000 })
  await g.waitForTimeout(1000) // let the quote settle
  const holidayCheckboxCount = await g.locator('button', { hasText: /Holiday|holiday/ }).count()
  ok(holidayCheckboxCount === 0, 'no self-service "Add Holiday add-on" checkbox on the review screen')
  const bodyText = await g.textContent('body')
  ok(!/holiday/i.test(bodyText), 'no "holiday" wording anywhere on the guest review screen')
  await shot(g, 'transfer-review-no-holiday-checkbox')

  // ---------- Admin: find a requested transfer, add the holiday fee ----------
  const actx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const a = await actx.newPage()
  await a.goto(`${ADMIN}/login`)
  await a.fill('input[type="email"]', process.env.ADMIN_EMAIL || 'waqas56jb@gmail.com')
  await a.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'My30A-Admin-2026')
  await a.click('button[type="submit"]')
  await a.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })

  await a.goto(`${ADMIN}/transfers`)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  await a.locator('tr.clickable', { hasText: 'Requested' }).first().click()
  await a.locator('button', { hasText: 'Add Holiday Fee' }).waitFor({ timeout: 15000 })
  ok(true, 'admin drawer shows an "Add Holiday Fee" button for a requested trip')

  const chargeBefore = await a.locator('.kv', { hasText: 'Customer charge' }).locator('.num').first().innerText()
  await a.locator('button', { hasText: 'Add Holiday Fee' }).click()
  await a.locator('button', { hasText: 'Remove Holiday Fee' }).waitFor({ timeout: 10000 })
  ok(true, 'button flips to "Remove Holiday Fee" after adding it')
  await a.locator('span', { hasText: /Holiday fee \$40/ }).waitFor({ timeout: 10000 })
  ok(true, 'Fees row now shows a plain "Holiday fee $40" line')
  const chargeAfter = await a.locator('.kv', { hasText: 'Customer charge' }).locator('.num').first().innerText()
  ok(
    parseFloat(chargeAfter.replace(/[^0-9.]/g, '')) === parseFloat(chargeBefore.replace(/[^0-9.]/g, '')) + 40,
    'customer charge increased by exactly $40',
    `${chargeBefore} -> ${chargeAfter}`
  )
  await shot(a, 'admin-holiday-fee-added')

  await a.locator('button', { hasText: 'Remove Holiday Fee' }).click()
  await a.locator('button', { hasText: 'Add Holiday Fee' }).waitFor({ timeout: 10000 })
  const feeGoneCount = await a.locator('span', { hasText: /Holiday fee \$40/ }).count()
  ok(feeGoneCount === 0, 'Holiday fee line disappears after removing it')
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
