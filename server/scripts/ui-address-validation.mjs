// Browser test for the guest-app "address must be inside the selected community" feature:
// live autocomplete suggestions while typing, a blocking inline error on a mismatched
// community/address pair, and a successful match that lets the guest continue.
//   cd server && node scripts/ui-address-validation.mjs   (API on :4000, client on :5173)
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

  await g.goto(`${CLIENT}/app/transfer`)
  await g.locator('.app-xfer-h', { hasText: 'Select your Community' }).waitFor({ timeout: 15000 })
  ok(true, 'transfer booking screen loaded')

  // ---------- Select community = Seaside ----------
  const communityDd = g.locator('.app-xfer-section', { hasText: 'Select your Community' }).locator('.app-xfer-dd')
  await communityDd.locator('button.app-xfer-select').click()
  await communityDd.getByText('Seaside', { exact: true }).click()
  ok(true, 'selected community: Seaside')

  // ---------- Type an address that belongs to a DIFFERENT community (Rosemary Beach) ----------
  const addrInput = g.locator('.app-xfer-addr input[type="text"]')
  await addrInput.click()
  await addrInput.fill('12 N Barrett Square, Rosemary Beach, FL')

  // The pinned "saved address" suggestion always renders first — target only the live
  // (geocoder-backed) results, which carry no "saved address" sub-label.
  const suggestionItems = g.locator('.app-xfer-sugg .app-xfer-sugg-item')
  const liveItems = suggestionItems.filter({ hasNotText: 'saved address' })
  await liveItems.first().waitFor({ timeout: 8000 })
  const suggestionsVisible = await liveItems.count()
  ok(suggestionsVisible > 0, 'live address suggestions appear while typing', `${suggestionsVisible} suggestion(s)`)
  await shot(g, 'addr-suggestions-visible')

  // Pick the first live suggestion (closes the dropdown, sets lat/lon)
  await liveItems.first().click()

  const mismatchError = g.locator('.app-inline-error', { hasText: /Seaside/ })
  await mismatchError.waitFor({ timeout: 8000 })
  ok((await mismatchError.count()) > 0, 'inline error shown: address is in Rosemary Beach, not Seaside')
  await shot(g, 'addr-mismatch-error')

  // Continue must be blocked
  await g.locator('button', { hasText: 'Continue' }).click()
  await g.waitForTimeout(500)
  ok(g.url().includes('/app/transfer') && !g.url().includes('/review'), 'Continue blocked — still on booking screen')
  const blockError = await g.locator('.app-inline-error').count()
  ok(blockError > 0, 'blocking error still visible after Continue click')
  await shot(g, 'addr-continue-blocked')

  // ---------- Now type a real Seaside address and confirm it's accepted ----------
  await addrInput.fill('')
  await addrInput.fill('Seaside, FL')
  await liveItems.first().waitFor({ timeout: 8000 })
  const seasideSuggestions = await liveItems.count()
  ok(seasideSuggestions > 0, 'live suggestions appear for Seaside query', `${seasideSuggestions} suggestion(s)`)
  await liveItems.first().click()

  const okMsg = g.locator('.app-inline-ok', { hasText: /Seaside/ })
  await okMsg.waitFor({ timeout: 8000 })
  ok((await okMsg.count()) > 0, 'inline success shown: address is inside Seaside')
  await shot(g, 'addr-match-ok')

  // Fill required fields and continue — should now navigate to review
  await g.fill('input[placeholder="Flight number"]', 'DL 100')
  await g.locator('button', { hasText: 'Continue' }).click()
  await g.waitForURL(/\/app\/transfer\/review/, { timeout: 10000 })
  ok(true, 'Continue succeeds and navigates to review once address matches community')
  await shot(g, 'addr-continue-succeeds')
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
