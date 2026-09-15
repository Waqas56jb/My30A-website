// Verifies the admin panel shows the guest's uploaded Publix list screenshot — as a "List" link in
// the table, and as an inline image thumbnail in the order drawer — before the admin assigns a shopper.
//   cd server && node scripts/ui-admin-grocery-list-photo.mjs   (API on :4000, admin on :5174)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'
const ORDER_ID = process.argv[2]
const ORDER_NUMBER = process.argv[3]
if (!ORDER_ID || !ORDER_NUMBER) {
  console.error('Usage: node ui-admin-grocery-list-photo.mjs <order-id> <order-number>')
  process.exit(1)
}

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

  await a.goto(`${ADMIN}/grocery`)
  // The admin grocery list endpoint generates signed URLs for every photo on every row in a loop
  // server-side, so with lots of historical test orders this can legitimately take 15-20s. Wait
  // for a REAL row, not the SkeletonTable's placeholder rows (class "skeleton-row").
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  ok(true, 'grocery orders table loaded')

  const listLinkCount = await a.locator('td.photo-links a', { hasText: 'List' }).count()
  ok(listLinkCount > 0, '"List" link visible in the main table Photos column', `${listLinkCount} row(s)`)
  await a.screenshot({ path: `${OUT}/admin-grocery-list-link-table.png` })

  await a.locator('tr.clickable', { hasText: `#${ORDER_NUMBER}` }).first().click()
  await a.locator('.assign-box').waitFor({ timeout: 15000 })
  ok(true, 'order drawer opened, still requested (not yet assigned)')

  const heading = await a.locator('b', { hasText: 'Publix list screenshot' }).count()
  ok(heading > 0, 'drawer shows a "Publix list screenshot" heading')

  const img = a.locator('img[alt="Publix cart / grocery list"]')
  await img.waitFor({ timeout: 10000 })
  const box = await img.boundingBox()
  ok(box && box.width > 20 && box.height > 20, 'list screenshot renders as a real visible inline image', JSON.stringify(box))

  await a.screenshot({ path: `${OUT}/admin-grocery-list-photo-drawer.png` })
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
