// Verifies the admin drawer shows "Card on file: Saved" once the guest has saved a card for a
// grocery order still awaiting shopping/delivery.
//   cd server && node scripts/ui-admin-grocery-card-saved.mjs <order-id> <order-number>
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const ADMIN = 'http://localhost:5174'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots'
const [, , ORDER_NUMBER] = process.argv
if (!ORDER_NUMBER) {
  console.error('Usage: node ui-admin-grocery-card-saved.mjs <order-number>')
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

  await a.goto(`${ADMIN}/grocery`)
  await a.locator('tbody tr:not(.skeleton-row)').first().waitFor({ timeout: 30000 })
  await a.locator('tr.clickable', { hasText: `#${ORDER_NUMBER}` }).first().click()
  await a.locator('.assign-box').waitFor({ timeout: 15000 })

  const cardOnFileRow = a.getByText('Card on file', { exact: true })
  await cardOnFileRow.waitFor({ timeout: 10000 })
  const savedPill = await a.locator('.pill', { hasText: 'Saved' }).count()
  ok(savedPill > 0, 'drawer shows "Card on file: Saved" for this order')
  await a.screenshot({ path: `${OUT}/admin-grocery-card-saved.png` })
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
