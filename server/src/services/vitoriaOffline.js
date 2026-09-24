// Vitoria without OpenAI: a rule-based concierge over the same real data (dining guide, beach
// accesses, the guest's own trips / orders / saved places). Used whenever the AI is unreachable
// (no credits, outage, timeout) so guests still get specific, correct answers with place cards,
// never a generic "ask me about…" line. It reads the recent conversation, so a follow-up like
// "Seaside" after "best restaurant near me" continues the dining request.
import {
  DINING_INTENT,
  communityIn,
  diningCard,
  diningMentionedIn,
  recommendDining,
  understandDining,
} from './dining.js'

const low = (s) => String(s || '').toLowerCase()
const TRIP_STATUS = {
  requested: 'requested — we’re confirming a driver',
  assigned: 'confirmed — your driver is assigned',
  en_route: 'your driver is on the way',
  arrived: 'your driver has arrived',
  in_progress: 'in progress',
  completed: 'completed',
  cancelled: 'cancelled',
}

function lastCommunity(userTexts) {
  for (let i = userTexts.length - 1; i >= 0; i -= 1) {
    const c = communityIn(userTexts[i])
    if (c) return c
  }
  return null
}

// Where to search: a place named in this message wins; "near me" means where they are staying;
// otherwise the last community mentioned in the conversation, then their stay.
function resolveCommunity(text, userTexts, ctx) {
  const named = communityIn(text)
  if (named) return named
  const stay = ctx.booking?.community_name || null
  if (stay && /near me|nearest|closest|close to me|nearby|around me|where i am|walking distance/.test(low(text))) return stay
  return lastCommunity(userTexts) || stay
}

// Community names contain "Beach" — strip them before deciding whether the guest means the beach.
const withoutPlaces = (text) =>
  low(text).replace(/(rosemary|alys|inlet|seacrest|grayton|seagrove|blue mountain|miramar|santa rosa|dune allen|panama city|fort walton|walton)\s+beach/g, ' ')
const BEACH_INTENT = /beach|sunset|swim|sand\b|ocean|shore|flags?\b/
const isBeachAsk = (text) => BEACH_INTENT.test(withoutPlaces(text))

// What were we last talking about? Skips bare community replies like "Seaside".
function lastTopic(texts) {
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const t = low(texts[i])
    if (DINING_INTENT.test(t)) return 'dining'
    if (isBeachAsk(t)) return 'beach'
    if (/airport|transfer|grocer|publix/.test(t)) return 'service'
  }
  return null
}

const isOnlyPlace = (text) => {
  const c = communityIn(text)
  if (!c) return false
  const nameWords = new Set(low(c).split(/[^a-z]+/).filter(Boolean))
  const filler = /^(tell|me|about|what|how|in|at|near|the|and|whats|ok|okay|please|now|there|around|beach|sea|water|color|colour|grove|side|we|are|im|staying|stay|were)$/
  const rest = low(text)
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !nameWords.has(w) && !filler.test(w))
  return rest.length === 0
}

function placeLine(card) {
  const bits = [card.category.split(' · ')[0], card.hours ? card.hours.replace(' · today', ', today') : null].filter(Boolean)
  return `${card.name} in ${card.area}${bits.length ? `, ${bits.join(', ')}` : ''}`
}

async function answerDining(text, userTexts, ctx) {
  // A bare community ("Seaside") answering our "which community?" continues the last dining ask.
  const previousAsk = [...userTexts.slice(0, -1)].reverse().find((t) => DINING_INTENT.test(low(t)))
  const basis = DINING_INTENT.test(low(text)) ? text : `${previousAsk || ''} ${text}`
  const want = understandDining(basis)
  const community = resolveCommunity(text, userTexts, ctx)
  const { picks, matchedTags } = await recommendDining({ ...want, community })
  if (!picks.length) {
    return {
      reply: `I couldn’t find a match for that in our dining guide, ${ctx.firstName}.\n\nTry Explore → Restaurants, Bars or Coffee & Breakfast and filter by community or cuisine.`,
      places: [],
    }
  }
  const cards = picks.map((r) => diningCard(r))
  const kind = want.type === 'bar' ? 'bars' : want.type === 'coffee' ? 'coffee & breakfast spots' : 'places to eat'
  const flavour = want.tags.length && matchedTags ? `${want.tags.slice(0, 2).join(' & ').toLowerCase()} ` : ''
  const where = community ? `in and around ${community}` : 'along 30A'
  const when = want.tonight ? ' for tonight' : want.openNow ? ' that are open now' : ''
  const intro = `Here are my favorite ${flavour}${kind} ${where}${when}, ${ctx.firstName} — all from our local dining guide.`
  // The cards carry photos, hours and links — the text stays a short, human recommendation.
  const top = cards[0]
  const why = String(top.why || '').split(/(?<=[.!?])\s/)[0]
  const topLine = `My top pick is ${placeLine(top)}.${why ? ` ${why}` : ''}`
  const tail = community
    ? 'Want me to narrow it down, like seafood, rooftop or family friendly?'
    : 'Which community are you staying in? I’ll find the closest spots for you.'
  return { reply: `${intro}\n\n${topLine}\n\n${tail}`, places: cards }
}

async function answerNamedPlace(rows, ctx) {
  const cards = rows.map((r) => diningCard(r))
  const c = cards[0]
  const status =
    c.open_now === true
      ? `is open right now (${c.hours.replace('Open now · ', '')})`
      : c.open_now === false
        ? /^Opens /.test(c.hours)
          ? `is closed right now and opens at ${c.hours.match(/^Opens ([^·]+)/)[1].trim()} today (${c.today})`
          : 'is closed for the rest of today'
        : 'doesn’t list its hours, so it’s worth calling ahead'
  const contact = c.booking ? 'You can reserve online from the card.' : c.phone ? `Call ${c.phone} to reserve.` : ''
  return {
    reply: `${c.name} in ${c.area} ${status}.\n\n${[c.why, contact].filter(Boolean).join(' ')}`,
    places: cards,
  }
}

// 30A communities west → east; "nearest" beach access = fewest steps along the highway.
const ALONG_30A = [
  'miramar', 'topsail', 'dune allen', 'santa rosa', 'gulf place', 'blue mountain', 'grayton', 'watercolor',
  'seaside', 'seagrove', 'watersound', 'prominence', 'alys', 'seacrest', 'rosemary', 'inlet',
]
const stepOf = (label) => {
  const l = low(label)
  const inner = l.match(/\(([^)]+)\)/)?.[1] || l
  return ALONG_30A.findIndex((k) => inner.includes(k))
}

function answerBeach(ctx, community) {
  const accesses = ctx.beachAccesses || []
  if (!accesses.length) return 'Every beach along 30A has public accesses — look for the blue access signs.'
  const home = community ? stepOf(community) : -1
  let picks = accesses.slice(0, 3)
  if (home >= 0) {
    picks = accesses
      .map((p, i) => ({ p, d: stepOf(p.community) < 0 ? 99 : Math.abs(stepOf(p.community) - home), i }))
      .sort((x, y) => x.d - y.d || x.i - y.i)
      .slice(0, 3)
      .map((x) => x.p)
  }
  const exact = home >= 0 && picks.some((p) => stepOf(p.community) === home)
  const head = community
    ? exact
      ? `Closest public beach accesses in ${community}:`
      : `${community} doesn’t have a county access of its own — these are the closest public ones:`
    : 'A few popular public beach accesses:'
  const lines = picks.map((p) => `${p.name} (${p.community})${p.details ? ` — ${p.details}` : ''}`).join('\n')
  const ask = community ? '' : '\n\nWhich community are you staying in? I’ll find the closest accesses.'
  return `${head}\n\n${lines}\n\nCheck the flags when you arrive — double red means the water is closed.${ask}`
}

function answerTrips(ctx) {
  const trips = ctx.history?.trips || ctx.trips || []
  if (!trips.length) return `You don’t have any airport transfers yet, ${ctx.firstName}.\n\nBook one in the Services tab — private door-to-door rides to and from ECP, VPS and PNS.`
  const lines = trips.slice(0, 4).map((t) => `Trip #${t.trip_number}, ${t.airport} ${t.direction === 'from_airport' ? 'arrival' : 'departure'} on ${ctx.formatWhen(t.scheduled_at)} — ${TRIP_STATUS[t.status] || t.status}`)
  return `Here are your airport transfers, ${ctx.firstName}:\n\n${lines.join('\n')}\n\nYou can follow a live trip from the Home screen.`
}

function answerGroceries(ctx) {
  const orders = ctx.history?.orders || ctx.orders || []
  const how = 'Pick a package, choose how you’d like the kitchen stocked and upload your Publix cart screenshot. You pay the flat fee plus the exact Publix receipt, charged only after delivery.'
  if (!orders.length) return `Groceries are ordered from the Services tab.\n\n${how}`
  const lines = orders.slice(0, 4).map((o) => `Order #${o.order_number}, ${o.package || 'grocery'} package, delivery ${ctx.formatWhen(o.delivery_time)} — ${String(o.status).replace(/_/g, ' ')}`)
  return `Your grocery orders, ${ctx.firstName}:\n\n${lines.join('\n')}\n\n${how}`
}

function answerSaved(ctx) {
  const saved = ctx.history?.saved || []
  if (!saved.length) return 'You haven’t saved any places yet — tap the heart on any restaurant or partner in Explore and it will appear in Profile → Saved Places.'
  return `Your saved places:\n\n${saved.slice(0, 8).map((s) => `${s.name}${s.community ? ` in ${s.community}` : ''}`).join('\n')}`
}

export async function vitoriaOffline(text, ctx, recent = []) {
  const userTexts = [...recent.filter((m) => m.role === 'user').map((m) => m.content)]
  if (userTexts[userTexts.length - 1] !== text) userTexts.push(text)
  const q = low(text)
  const community = resolveCommunity(text, userTexts, ctx)

  const named = await diningMentionedIn(text)
  if (named.length && !/\b(best|top|recommend|near|closest)\b/.test(q)) return answerNamedPlace(named, ctx)

  const topic = lastTopic(userTexts.slice(0, -1))
  const placeOnly = isOnlyPlace(text)
  if (DINING_INTENT.test(q) || (placeOnly && topic !== 'beach')) return answerDining(text, userTexts, ctx)

  if (isBeachAsk(text) || (placeOnly && topic === 'beach')) {
    return { reply: answerBeach(ctx, community), places: [] }
  }
  if (/saved|favou?rites|hearted/.test(q)) return { reply: answerSaved(ctx), places: [] }
  if (/airport|transfer|ride|pick ?up|drop ?off|flight|shuttle|driver|trip/.test(q)) return { reply: answerTrips(ctx), places: [] }
  if (/grocer|publix|stock|order|delivery|fridge|kitchen/.test(q)) return { reply: answerGroceries(ctx), places: [] }
  if (/my (stay|booking|rental|house|property)|check.?in|check.?out|where am i staying/.test(q)) {
    const b = ctx.booking
    return {
      reply: b
        ? `You’re staying in ${b.community_name || '30A'}${b.property_address ? ` at ${b.property_address}` : ''}${b.check_in ? `, ${b.check_in} to ${b.check_out || '?'}` : ''}.\n\nAnything I can line up for your stay?`
        : 'I don’t have your rental on file yet — add it in Profile → My Stay and I’ll tailor everything to where you are.',
      places: [],
    }
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo|salam|assalam)/.test(q.trim())) {
    return {
      reply: `Hi ${ctx.firstName}! I can find you a great restaurant, bar or coffee spot, the closest beach access, or help with groceries and airport transfers.\n\nWhat sounds good?`,
      places: [],
    }
  }
  return {
    reply: `Happy to help, ${ctx.firstName}.\n\nTry asking me for dinner in ${community || 'your community'}, the best coffee nearby, a rooftop bar, the closest beach access, or the status of your grocery order or airport transfer.`,
    places: [],
  }
}
