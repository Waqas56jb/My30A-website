// Browser check for the Vitoria concierge: a real, visible send button that works (the old dock
// only had a mic-styled submit and a dead paperclip), a working voice button when the browser
// supports dictation, and real, grounded answers — including a restaurant question, which the
// vetted guide doesn't cover, and a live price quote from the transfer table.
//   cd server && node scripts/ui-vitoria.mjs   (API :4000, client :5173)
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

  await g.goto(`${CLIENT}/app/vitoria`)
  const input = g.locator('.app-vitoria-input input')
  await input.waitFor({ timeout: 15000 })
  const send = g.locator('.app-vitoria-send')
  ok((await send.count()) === 1, 'a dedicated send button exists in the dock')
  ok(await send.isDisabled(), 'send is disabled while the box is empty')
  ok((await g.locator('.app-vitoria-attach').count()) === 0, 'the dead paperclip button is gone')
  ok((await g.locator('.app-vitoria-mic').count()) === 1, 'voice (mic) button is present in Chromium')

  await input.fill('Old florida fish house ?')
  ok(!(await send.isDisabled()), 'send becomes enabled once there is text')
  await shot(g, 'vitoria-dock-send-enabled')
  await send.click()
  await g.locator('.app-vitoria-bubble.is-thinking').waitFor({ timeout: 10000 })
  await g.locator('.app-vitoria-bubble.is-thinking').waitFor({ state: 'detached', timeout: 60000 })
  const bubbles1 = await g.locator('.app-vitoria-group:not(.is-user) .app-vitoria-bubble').allInnerTexts()
  const reply1 = bubbles1.join('\n')
  ok(reply1.length > 40, 'Vitoria answered the restaurant question', reply1.slice(0, 120).replace(/\n/g, ' / '))
  ok(!/isn’t included in our vetted|can’t confidently confirm/i.test(reply1), 'no longer refuses a real 30A restaurant just because it is not a partner')
  ok(!/\*\*|^- |^\d+\. /m.test(reply1), 'reply is clean plain text (no markdown/list markers)')

  await input.fill('How much is a transfer from ECP to my place for 4 people?')
  await g.keyboard.press('Enter')
  await g.locator('.app-vitoria-bubble.is-thinking').waitFor({ timeout: 10000 })
  await g.locator('.app-vitoria-bubble.is-thinking').waitFor({ state: 'detached', timeout: 60000 })
  const all = (await g.locator('.app-vitoria-group:not(.is-user) .app-vitoria-bubble').allInnerTexts()).join('\n')
  ok(/\$85/.test(all), 'quotes the real $85 table price for Rosemary Beach ⇄ ECP, 4 passengers')
  await shot(g, 'vitoria-grounded-answers')
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
