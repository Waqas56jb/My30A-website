// Verifies the redesigned Explore 30A category grid: real photo tiles, real vendor counts,
// correct per-tile filtering (the old bug showed all 20 guides for 3 of 8 tiles), and the
// Beaches tile routing to real public beach-access data instead of fake placeholder guides.
//   cd server && node scripts/ui-explore-redesign.mjs   (API :4000, client :5173)
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

  await g.goto(`${CLIENT}/app/explore`)
  await g.locator('.app-exp-tile:not(.app-skel)').first().waitFor({ timeout: 15000 })
  const onWater = g.locator('.app-exp-tile', { hasText: 'On The Water' })
  await onWater.locator('small', { hasText: '34 local partners' }).waitFor({ timeout: 8000 })
  ok(true, 'On The Water tile shows the real vendor count (34 local partners)')

  const tileCount = await g.locator('.app-exp-tile:not(.app-skel)').count()
  ok(tileCount === 14, 'grid shows all 14 real categories (3 dining tiles + events)', `${tileCount} tiles`)
  await shot(g, 'explore-grid-redesigned')

  const shopping = g.locator('.app-exp-tile', { hasText: 'Shopping' })
  await shopping.locator('small', { hasText: '39 local partners' }).waitFor({ timeout: 8000 })
  ok(true, 'Shopping tile shows the real vendor count (39 local partners)')

  const soonBadge = await g.locator('.app-exp-tile', { hasText: 'Restaurants' }).locator('.app-exp-tile-soon').count()
  const restaurantsCount = await g.locator('.app-exp-tile', { hasText: 'Restaurants' }).locator('small').textContent()
  ok(soonBadge === 0 && /\d+ places/.test(restaurantsCount), 'Restaurants tile is live with the real restaurant count', restaurantsCount)

  // ---------- The core bug fix: tapping "Golf & Outdoor Rentals" shows ONLY its 4 real guides ----------
  await g.locator('.app-exp-tile', { hasText: 'Golf & Outdoor Rentals' }).click()
  await g.waitForURL(/\/app\/explore\/guide/, { timeout: 10000 })
  await g.locator('h1', { hasText: 'Golf & Outdoor Rentals' }).waitFor({ timeout: 10000 })
  ok(true, 'guide screen header shows the tapped category name, not generic "Local Guide"')
  await g.locator('.app-exp-card:not(.app-skel)').first().waitFor({ timeout: 10000 })
  const cardCount = await g.locator('.app-exp-card:not(.app-skel)').count()
  ok(cardCount === 4, 'shows exactly the 4 real golf/outdoor guides, not all 20', `${cardCount} cards`)
  const cardTitles = await g.locator('.app-exp-card strong').allTextContents()
  const expected = ['Golf Cart Rentals', 'Bike Rentals', 'Golf Courses', 'Pickleball']
  ok(
    expected.every((t) => cardTitles.includes(t)) && cardTitles.length === 4,
    'the 4 cards are exactly the real golf/outdoor categories',
    cardTitles.join(', ')
  )
  await shot(g, 'explore-golf-outdoor-guides')

  // ---------- Drill into one guide's vendor list (real data) ----------
  await g.locator('.app-exp-card', { hasText: 'Golf Courses' }).click()
  await g.waitForURL(/\/app\/explore\/vendors\/golf-courses/, { timeout: 10000 })
  await g.locator('.app-exp-vendor:not(.is-skel)').first().waitFor({ timeout: 10000 })
  const vendorNames = await g.locator('.app-exp-vendor-name strong').allTextContents()
  ok(
    vendorNames.includes('Santa Rosa Golf & Beach Club') && vendorNames.includes('Burnt Pine Golf Club'),
    'vendor list shows real client-provided golf courses',
    vendorNames.join(', ')
  )
  await shot(g, 'explore-golf-courses-vendors')

  // ---------- Beaches tile routes to real public beach-access data ----------
  await g.goto(`${CLIENT}/app/explore`)
  await g.locator('.app-exp-tile', { hasText: 'Beaches' }).click()
  await g.waitForURL(/\/app\/explore\/info\?focus=beach-access/, { timeout: 10000 })
  await g.locator('h1', { hasText: 'Beaches' }).waitFor({ timeout: 10000 })
  await g.locator('.app-beach-row:not(.app-skel)').first().waitFor({ timeout: 10000 })
  const beachCount = await g.locator('.app-beach-row').count()
  const countLabel = await g.locator('.app-dine-count strong').textContent()
  ok(beachCount === 59 && countLabel.includes('59'), 'Beaches tile shows the real 59 public beach-access cards, not fake vendor guides', `${beachCount} cards`)
  await g.locator('.app-dine-chip', { hasText: 'Restrooms' }).click()
  const withRestrooms = await g.locator('.app-beach-row').count()
  ok(withRestrooms > 0 && withRestrooms < 59, 'Restrooms filter narrows the list to accesses that have them', `${withRestrooms} accesses`)
  await shot(g, 'explore-beaches-real-data')
} catch (error) {
  ok(false, 'unexpected error', error.message)
  console.error(error)
} finally {
  await browser.close()
}

console.log(`\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ''}.`)
process.exit(failures ? 1 : 0)
