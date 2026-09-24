import { chromium } from 'file:///C:/Users/HP/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
const C='http://localhost:5173', OUT='C:/Users/HP/AppData/Local/Temp/claude/d--fiverr-My30A-website/d1b2cff9-dc8f-4b85-a8bd-3707ff7d5026/scratchpad/shots/new'
import fs from 'fs'; fs.mkdirSync(OUT,{recursive:true})
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}); const g=await ctx.newPage()
await g.goto(C+'/app/login'); await g.fill('input[name="email"]','guest.demo@example.com'); await g.fill('input[name="password"]','Test-Pass-2026!'); await g.click('button[type="submit"]'); await g.waitForURL(/\/app\/home/)
const settle=async()=>{await g.waitForTimeout(1500)}
await g.goto(C+'/app/explore'); await g.locator('.app-exp-tile:not(.app-skel)').first().waitFor(); await settle(); await g.screenshot({path:OUT+'/explore.png'})
await g.locator('.app-home-scroll').evaluate(e=>e.scrollTo(0,600)); await settle(); await g.screenshot({path:OUT+'/explore2.png'})
await g.goto(C+'/app/explore/guide?c=local-essentials'); await g.locator('.app-exp-card:not(.app-skel)').first().waitFor(); await settle(); await g.screenshot({path:OUT+'/guide.png'})
await g.goto(C+'/app/explore/vendors/shopping'); await g.locator('.app-exp-vendor:not(.is-skel)').first().waitFor(); await settle(); await g.screenshot({path:OUT+'/vendors.png'})
await g.goto(C+'/app/explore/vendors/pickleball'); await g.locator('.app-exp-vendor:not(.is-skel)').first().waitFor(); await settle(); await g.screenshot({path:OUT+'/vendors-noimg.png'})
const href=await g.locator('.app-exp-vendor').first().getAttribute('href')
await g.goto(C+href); await g.locator('.app-exp-title-row').waitFor(); await settle(); await g.screenshot({path:OUT+'/detail-noimg.png'})
await g.goto(C+'/app/explore/vendor/30a-yacht-charters'); await g.locator('.app-exp-title-row').waitFor(); await settle(); await g.screenshot({path:OUT+'/detail.png'})
// skeleton capture: throttle
const cdp=await ctx.newCDPSession(g); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:1500,downloadThroughput:200000,uploadThroughput:200000})
await g.goto(C+'/app/explore/vendors/photography'); await g.waitForTimeout(2500); await g.screenshot({path:OUT+'/skeleton.png'})
await b.close()
