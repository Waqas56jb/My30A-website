// Quick visual check: the grocery package screen no longer shows Rush/Holiday add-ons.
//   cd server && node scripts/ui-grocery-no-addons.mjs   (API on :4000, client on :5173)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const CLIENT = 'http://localhost:5173'
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

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const g = await ctx.newPage()

  await g.goto(`${CLIENT}/app/login`)
  await g.fill('input[name="email"]', GUEST)
  await g.fill('input[name="password"]', PASSWORD)
  await g.click('button[type="submit"]')
  await g.waitForURL(/\/app\/home/, { timeout: 20000 })

  await g.goto(`${CLIENT}/app/grocery`)
  await g.locator('.app-xfer-h', { hasText: 'Choose Your Package' }).waitFor({ timeout: 15000 })
  ok(true, 'grocery package screen loaded')

  await g.waitForTimeout(1000) // let the live catalog fetch resolve
  const rushOrHoliday = await g.locator('text=/Rush|Holiday/').count()
  ok(rushOrHoliday === 0, 'no Rush/Holiday text anywhere on the page', `${rushOrHoliday} match(es)`)

  const addonsHeading = await g.locator('.app-xfer-h', { hasText: 'Add-Ons' }).count()
  ok(addonsHeading === 0, 'Add-Ons section is hidden entirely (no add-ons left)')

  await g.screenshot({ path: `${OUT}/grocery-no-rush-holiday.png` })
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
