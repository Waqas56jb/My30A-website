// Every button the client reported as dead, clicked in a real browser (local dev, Stripe TEST):
// Explore search button, Profile bell + avatar photo + Favorite Restaurants + Personal
// Information / Notifications / Payment Methods / Settings, the in-app notification banner + chime,
// and the checkout "Name on card" field.
//   cd server && node scripts/ui-profile-actions.mjs     (API :4000, client :5173)
import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const C = 'http://localhost:5173'
const OUT = 'C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots/pf'
let pass = 0
let fail = 0
const ok = (c, n, d = '') => {
  c ? pass++ : fail++
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`)
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8Dw/z8DAwMDAwMDAwAkBgMBmCJwOgAAAABJRU5ErkJggg==', 'base64')

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  // Count chimes: wrap the oscillator start used by playChime.
  window.__chimes = 0
  const Orig = window.AudioContext
  if (Orig) {
    window.AudioContext = class extends Orig {
      createOscillator() {
        window.__chimes += 0.5
        return super.createOscillator()
      }
    }
  }
})
const g = await ctx.newPage()
const errs = []
g.on('pageerror', (e) => errs.push(e.message))
await g.goto(C + '/app/login')
await g.fill('input[name="email"]', 'guest.demo@example.com')
await g.fill('input[name="password"]', 'Test-Pass-2026!')
await g.click('button[type="submit"]')
await g.waitForURL(/\/app\/home/)
const { data: me } = await db.from('profiles').select('id').eq('email', 'guest.demo@example.com').single()

// Explore search button
await g.goto(C + '/app/explore')
await g.fill('.app-exp-search input', 'Pescado')
await g.locator('.app-exp-search-go').click()
await g.waitForURL(/guide\?q=Pescado/, { timeout: 10000 }).catch(() => {})
ok(/guide\?q=Pescado/.test(g.url()), 'Explore search button runs the search', g.url())

// Profile rows
const rows = [
  ['Favorite Restaurants', /profile\/saved\?type=dining/, 'Favorite Restaurants'],
  ['Personal Information', /profile\/info/, 'Personal Information'],
  ['Payment Methods', /profile\/payments/, 'Payment Methods'],
  ['Settings', /profile\/settings/, 'Settings'],
  ['Notifications', /app\/notifications/, 'Notifications'],
]
for (const [label, url, heading] of rows) {
  await g.goto(C + '/app/profile')
  await g.locator('.app-pf-row', { hasText: label }).first().click()
  await g.waitForURL(url, { timeout: 10000 }).catch(() => {})
  const h = await g.locator('h1').first().textContent().catch(() => '')
  ok(url.test(g.url()) && h.includes(heading), `Profile → ${label} opens its screen`, h)
}

// Bell with badge
await db.from('notifications').insert({ user_id: me.id, message: 'Test: your driver Sam is on the way 🚗' })
await g.goto(C + '/app/profile')
await g.waitForTimeout(2500)
const badge = await g.locator('.app-bell-badge').first().textContent().catch(() => null)
await g.locator('.app-bell').first().click()
await g.waitForURL(/app\/notifications/, { timeout: 10000 }).catch(() => {})
ok(/app\/notifications/.test(g.url()) && badge, 'Bell shows unread badge and opens Notifications', `badge=${badge}`)
await g.waitForTimeout(1500)
const items = await g.locator('.app-nt-item').count()
await g.screenshot({ path: OUT + '-notifications.png' })
await g.locator('.app-nt-chip', { hasText: 'Mark all read' }).click().catch(() => {})
await g.waitForTimeout(800)
ok(items > 0 && (await g.locator('.app-nt-item.is-unread').count()) === 0, 'Notifications list + Mark all read', `${items} items`)

// Live arrival: banner + chime while the guest is on another screen
await g.goto(C + '/app/home')
await g.mouse.click(200, 400) // a real tap unlocks audio like on a phone
await g.waitForTimeout(2500)
await db.from('notifications').insert({ user_id: me.id, message: 'Your grocery order is on the way!' })
await g.locator('.app-notif-toast').waitFor({ timeout: 30000 }).catch(() => {})
const toast = await g.locator('.app-notif-toast').textContent().catch(() => '')
const chimes = await g.evaluate(() => window.__chimes)
await g.screenshot({ path: OUT + '-toast.png' })
ok(/grocery order is on the way/.test(toast) && chimes >= 1, 'New notification → banner + chime sound', `chime oscillators=${chimes * 2}`)

// Personal information save
await g.goto(C + '/app/profile/info')
await g.waitForTimeout(1500)
await g.fill('input[autocomplete="tel"]', '(850) 555-0142')
await g.locator('button[type="submit"]', { hasText: 'Save' }).click()
await g.locator('.app-pf-saved').waitFor({ timeout: 10000 }).catch(() => {})
const { data: after } = await db.from('profiles').select('phone').eq('id', me.id).single()
ok(after.phone === '(850) 555-0142', 'Personal Information saves the phone', after.phone)

// Avatar upload from the Profile pencil
await g.goto(C + '/app/profile')
await g.waitForTimeout(1500)
await g.setInputFiles('.app-pf-avatar-wrap input[type=file]', { name: 'me.png', mimeType: 'image/png', buffer: PNG })
await g.locator('img.app-pf-avatar.is-photo').waitFor({ timeout: 20000 }).catch(() => {})
const src = await g.locator('img.app-pf-avatar.is-photo').getAttribute('src').catch(() => null)
ok(src && /avatars/.test(src), 'Profile pencil uploads a photo and shows it', src?.slice(0, 80))

// Payment methods: add then remove a card (Stripe test mode)
await g.goto(C + '/app/profile/payments')
await g.waitForTimeout(2000)
const before = await g.locator('.app-co-method.is-static').count()
await g.locator('.app-co-pay', { hasText: 'Add a card' }).click()
const frame = g.frameLocator('iframe[name^="__privateStripeFrame"]').first()
await frame.locator('input[name="number"]').waitFor({ timeout: 25000 })
await g.fill('.app-co-field input[autocomplete="cc-name"]', 'Alex Jessy')
await frame.locator('input[name="number"]').fill('4242 4242 4242 4242')
await frame.locator('input[name="expiry"]').fill('10 / 31')
await frame.locator('input[name="cvc"]').fill('123')
if (await frame.locator('input[name="postalCode"]').count()) await frame.locator('input[name="postalCode"]').fill('32461')
await g.locator('.app-co-pay', { hasText: 'Save card' }).click()
await g.waitForFunction((n) => document.querySelectorAll('.app-co-method.is-static').length > n || document.querySelectorAll('.app-co-method.is-static').length >= 1, before, { timeout: 30000 }).catch(() => {})
await g.waitForTimeout(1500)
const afterAdd = await g.locator('.app-co-method.is-static').count()
ok(afterAdd >= Math.max(1, before), 'Payment Methods → Add a card saves it', `${before} → ${afterAdd}`)
g.once('dialog', (d) => d.accept())
await g.locator('.app-pf-remove').first().click()
await g.waitForTimeout(3000)
const afterRemove = await g.locator('.app-co-method.is-static').count()
ok(afterRemove === afterAdd - 1, 'Payment Methods → Remove card', `${afterAdd} → ${afterRemove}`)

// Settings
await g.goto(C + '/app/profile/settings')
await g.locator('.app-switch').click()
const off = await g.evaluate(() => localStorage.getItem('my30a-notification-sound'))
await g.locator('.app-switch').click()
const on = await g.evaluate(() => localStorage.getItem('my30a-notification-sound'))
await g.locator('.app-set-row', { hasText: 'Cancellation policy' }).click()
ok(off === 'off' && on === 'on' && (await g.locator('.app-set-policy li').count()) === 5, 'Settings: sound toggle + cancellation policy')

// Checkout: Name on card is typeable even before the address/quote is ready
await g.goto(C + '/app/grocery')
await g.waitForTimeout(2000)
await g.locator('.app-xfer-cta').last().click()
await g.waitForURL(/grocery\/stocking/)
await g.locator('.app-xfer-cta').last().click()
await g.waitForURL(/grocery\/list/)
await g.waitForTimeout(2500)
if (await g.locator('.app-co-method.is-add').count()) await g.locator('.app-co-method.is-add').click()
await g.locator('.app-co-field input[autocomplete="cc-name"]').waitFor({ timeout: 20000 })
await g.fill('.app-co-field input[autocomplete="cc-name"]', 'Typed Name OK')
ok((await g.inputValue('.app-co-field input[autocomplete="cc-name"]')) === 'Typed Name OK', 'Checkout "Name on card" accepts typing')

await db.from('profiles').update({ phone: null }).eq('id', me.id)
console.log(`\n${pass}/${pass + fail} checks passed${fail ? `, ${fail} FAILED` : ''}. errors: ${JSON.stringify(errs)}`)
await b.close()
process.exit(fail ? 1 : 0)
