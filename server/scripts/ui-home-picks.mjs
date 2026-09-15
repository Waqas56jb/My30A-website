// Verifies the home screen's "Vitoria's Pick Tonight" section shows real, top-rated vendors
// instead of the old fake placeholder guide (which no longer exists).
//   cd server && node scripts/ui-home-picks.mjs   (API :4000, client :5173)
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

  const pick = g.locator('.app-home-pick', { hasText: '30A Blaze Beach Bonfires' })
  await pick.waitFor({ timeout: 15000 })
  ok(true, 'home screen shows the real top-rated vendor as a pick')
  await pick.scrollIntoViewIfNeeded()
  await g.screenshot({ path: `${OUT}/home-picks-real.png` })
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
