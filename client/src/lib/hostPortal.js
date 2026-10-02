// Host dashboard (/host) API — see server/src/routes/host.js.
import QRCode from 'qrcode'
import { api } from './api.js'

export const hostPortal = {
  me: () => api('/api/host/me'),
  activity: (id, days = 30) => api(`/api/host/homes/${id}/activity?days=${days}`),
  createHome: (body) => api('/api/host/homes', { method: 'POST', body }),
  updateHome: (id, body) => api(`/api/host/homes/${id}`, { method: 'PATCH', body }),
  deleteHome: (id) => api(`/api/host/homes/${id}`, { method: 'DELETE' }),
  newLink: (id) => api(`/api/host/homes/${id}/new-link`, { method: 'POST' }),
  uploadImage: (id, kind, file) => {
    const form = new FormData()
    form.append('image', file, file.name)
    return api(`/api/host/homes/${id}/image?kind=${kind}`, { method: 'POST', body: form })
  },
  checkout: (body = {}) => api('/api/host/billing/checkout', { method: 'POST', body }),
  confirm: (session_id) => api('/api/host/billing/confirm', { method: 'POST', body: { session_id } }),
  quantity: (quantity) => api('/api/host/billing/quantity', { method: 'POST', body: { quantity } }),
  portal: () => api('/api/host/billing/portal', { method: 'POST' }),
  plans: () => api('/api/public/host-plans'),
  signup: (body) => api('/api/public/host-signup', { method: 'POST', body }),
}

export function homeLink(home) {
  return `${window.location.origin.includes('localhost') ? window.location.origin : 'https://www.my30ahost.com'}/h/${home.slug}`
}

export function qrDataUrl(home, width = 520) {
  return QRCode.toDataURL(homeLink(home), { width, margin: 1, errorCorrectionLevel: 'M' })
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Printable letter-size poster for the house (Figma "Screen 1"). `win` is opened synchronously by
// the click handler so pop-up blockers allow it.
export async function printPoster(home, win) {
  const qr = await qrDataUrl(home, 900)
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(home.home_name)} · QR</title>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:Satoshi,Inter,system-ui,sans-serif;color:#0a1628;background:#fff}
.p{width:8.5in;height:11in;margin:0 auto;padding:.7in .8in;display:flex;flex-direction:column;align-items:center;text-align:center;
background:linear-gradient(180deg,#def3f5 0%,#eef9f9 55%,#fff 100%);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.logo{width:1.7in;height:1.7in;object-fit:contain}.name{font-size:30px;font-weight:700;margin:.15in 0 0}
.tag{margin:.18in 0 0;font-size:15px;font-weight:500;letter-spacing:.05em;text-transform:uppercase}
h1{margin:.45in 0 0;font-size:34px;line-height:1.2}.copy{max-width:5.6in;margin:.14in 0 0;font-size:16px;line-height:1.5;color:#6b7785}
.qr{position:relative;margin:.45in 0 0;padding:.22in}.qr img{display:block;width:3.6in;height:3.6in}
.qr i{position:absolute;width:.62in;height:.62in;border:7px solid #f39200}
.qr i:nth-child(2){top:0;left:0;border-right:0;border-bottom:0}.qr i:nth-child(3){top:0;right:0;border-left:0;border-bottom:0}
.qr i:nth-child(4){bottom:0;left:0;border-right:0;border-top:0}.qr i:nth-child(5){bottom:0;right:0;border-left:0;border-top:0}
.scan{margin:.35in 0 0;padding:.16in .5in;border-radius:999px;background:linear-gradient(180deg,#ffa21f,#ffc560);font-size:17px;font-weight:500;letter-spacing:.05em;text-transform:uppercase}
.home{margin:.22in 0 0;font-size:14px;color:#4a5563}.by{margin-top:auto;font-size:12px;letter-spacing:.06em;color:#8a94a0}
</style></head><body><div class="p">
${home.logo_url ? `<img class="logo" src="${escapeHtml(home.logo_url)}" alt="">` : `<p class="name">${escapeHtml(home.host_name)}</p>`}
${home.host_tagline ? `<p class="tag">${escapeHtml(home.host_tagline)}</p>` : ''}
<h1>Your Home On 30A, Taken Care Of.</h1>
<p class="copy">Grocery delivery, airport transfers, local partners, and Vitoria — your AI concierge, available 24/7.</p>
<div class="qr"><img src="${qr}" alt="QR code"><i></i><i></i><i></i><i></i></div>
<div class="scan">Scan to start exploring</div>
<p class="home">${escapeHtml(home.home_name)}${home.area ? ` · ${escapeHtml(home.area)}` : ''} · WiFi, door code &amp; house info inside</p>
<p class="by">CONCIERGE POWERED BY MY30A HOST</p>
</div><script>Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>(document.fonts?document.fonts.ready:0)).then(()=>setTimeout(()=>print(),250))</script></body></html>`)
  win.document.close()
}

export const PLAN_LABEL = { monthly: 'Monthly', semiannual: 'Every 6 months', annual: 'Annual' }

export function money(value) {
  return `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`
}
