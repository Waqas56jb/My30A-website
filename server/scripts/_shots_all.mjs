import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import fs from 'fs'
const C='http://localhost:5173', OUT='C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots/final'
fs.mkdirSync(OUT,{recursive:true})
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const g=await ctx.newPage()
const errs=[]; g.on('pageerror',e=>errs.push(e.message)); g.on('console',m=>m.type()==='error'&&errs.push(m.text()))
await g.goto(C+'/',{waitUntil:'load'}); await g.waitForTimeout(3500); await g.screenshot({path:OUT+'/landing.png'})
await g.goto(C+'/app/login'); await g.fill('input[name="email"]','guest.demo@example.com'); await g.fill('input[name="password"]','Test-Pass-2026!'); await g.click('button[type="submit"]'); await g.waitForURL(/\/app\/home/)
for (const [n,p] of [['home','/app/home'],['services','/app/services'],['profile','/app/profile'],['saved','/app/profile/saved'],['explore','/app/explore']]) { await g.goto(C+p); await g.waitForTimeout(3000); await g.screenshot({path:`${OUT}/${n}.png`}) }
// SPA tab hop to check SWR instant render
await g.goto(C+'/app/home'); await g.waitForTimeout(2500)
await g.click('nav >> text=Explore'); await g.waitForTimeout(150); const skel=await g.locator('.app-exp-tile.app-skel').count(); console.log('skeleton tiles after revisit:',skel)
console.log('errors:',errs.slice(0,8))
await b.close()
