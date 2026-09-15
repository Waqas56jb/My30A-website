// Browser test for live address autocomplete on the grocery delivery-address screen (same real
// Nominatim-backed API as the transfer booking screen).
//   cd server && node scripts/ui-grocery-address.mjs   (API on :4000, client on :5173)
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
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const g = await ctx.newPage()

  await g.goto(`${CLIENT}/app/login`)
  await g.fill('input[name="email"]', GUEST)
  await g.fill('input[name="password"]', PASSWORD)
  await g.click('button[type="submit"]')
  await g.waitForURL(/\/app\/home/, { timeout: 20000 })
  ok(true, 'guest login')

  await g.goto(`${CLIENT}/app/grocery/list`)
  await g.locator('.app-xfer-h', { hasText: 'Delivery Address' }).waitFor({ timeout: 15000 })
  ok(true, 'grocery delivery-address screen loaded')

  const addrInput = g.locator('.app-xfer-addr input[type="text"]')
  await addrInput.click()
  // Clear the prefilled saved address first (touched guard should keep it cleared).
  await addrInput.fill('')
  await addrInput.fill('Watersound, FL')

  const suggestionItems = g.locator('.app-xfer-sugg .app-xfer-sugg-item')
  await suggestionItems.first().waitFor({ timeout: 8000 })
  const count = await suggestionItems.count()
  ok(count > 0, 'live address suggestions appear while typing', `${count} suggestion(s)`)
  await shot(g, 'grocery-addr-suggestions')

  const firstText = await suggestionItems.first().innerText()
  await suggestionItems.first().click()
  await g.waitForTimeout(200)
  const inputValue = await addrInput.inputValue()
  ok(inputValue.length > 0 && inputValue !== 'Watersound, FL', 'selecting a suggestion fills the real geocoded address', inputValue)
  ok(!(await suggestionItems.first().isVisible().catch(() => false)), 'suggestions dropdown closes after picking one')

  // Prefill race-condition guard: typing early should not get clobbered by the slow stay-prefill fetch.
  const addrInput2 = addrInput
  await addrInput2.fill('')
  await addrInput2.fill('123 Test Street')
  await g.waitForTimeout(1500) // long enough for the booking() prefill fetch to resolve if it were going to
  const stillTyped = await addrInput2.inputValue()
  ok(stillTyped === '123 Test Street', 'typed address is not overwritten by the stay prefill', stillTyped)
  await shot(g, 'grocery-addr-not-clobbered')
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
