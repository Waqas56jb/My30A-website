// One base URL for links we send out (SMS trip links, Stripe success pages). Env values may be
// comma lists — prefer the real domain over *.vercel.app / localhost.
export function pickPublicUrl(...values) {
  const list = values
    .flatMap((v) => String(v || '').split(','))
    .map((v) => v.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return list.find((u) => !/localhost|\.vercel\.app/.test(u)) || list[0] || 'http://localhost:5173'
}
