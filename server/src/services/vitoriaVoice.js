// Vitoria by voice: OpenAI Realtime speech-to-speech. The browser talks to OpenAI directly over
// WebRTC with a short-lived key minted here; everything factual comes from our own data through
// tools (restaurants, events, beaches, the guest's bookings, transfer prices) — executed by
// POST /api/guest/vitoria/voice/tool, which also returns the same photo cards the chat shows.
import { supabase } from '../lib/supabase.js'
import { diningCard, findDining, recommendDining, understandDining } from './dining.js'
import { beachCard, distinctPhotos, recommendBeaches } from './beaches.js'
import { eventCard, recommendEvents } from './events.js'
import { openStatus } from '../lib/hours.js'

export const REALTIME_MODEL = () => process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
export const REALTIME_VOICE = () => process.env.OPENAI_REALTIME_VOICE || 'marin'

const COMMUNITIES =
  'Alys Beach, Blue Mountain Beach, Dune Allen Beach, Grayton Beach, Gulf Place, Inlet Beach, Miramar Beach, Prominence / Hub, Rosemary Beach, Santa Rosa Beach, Seacrest Beach, Seagrove Beach, Seaside, Topsail Hill, WaterColor, Watersound'

export const VOICE_TOOLS = [
  {
    type: 'function',
    name: 'find_restaurants',
    description:
      'Recommend real restaurants, bars or coffee & breakfast spots from the My30A Host dining guide (every local favorite on our list). Use for any food or drink question. Returns picks with cuisine, community, today’s hours and how to book.',
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'What the guest asked for, in their words, e.g. "rooftop cocktails", "kid friendly pizza", "best seafood for dinner tonight".' },
        community: { type: 'string', description: `Community to search around, if known. One of: ${COMMUNITIES}, Destin.` },
        type: { type: 'string', enum: ['restaurant', 'bar', 'coffee'], description: 'Restaurant, bar or coffee & breakfast.' },
        open_now: { type: 'boolean' },
      },
      required: ['request'],
    },
  },
  {
    type: 'function',
    name: 'place_details',
    description: 'Details for one named restaurant, bar or café: open now or not, today’s hours, phone, and how to reserve (Resy, OpenTable, phone).',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    type: 'function',
    name: 'find_events',
    description: 'Live music, markets, festivals, trivia, kids’ activities and other events along 30A (listed by organizers on 30a.com).',
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'e.g. "live music tonight", "farmers market this weekend", "kids events tomorrow".' },
        community: { type: 'string' },
      },
      required: ['request'],
    },
  },
  {
    type: 'function',
    name: 'find_beaches',
    description: 'Closest public beach accesses (Walton County) with parking, restrooms and accessibility.',
    parameters: {
      type: 'object',
      properties: {
        community: { type: 'string' },
        needs: { type: 'string', enum: ['parking', 'restrooms', 'accessible', 'dogs', 'any'] },
      },
    },
  },
  {
    type: 'function',
    name: 'my_bookings',
    description: 'The guest’s own stay, airport transfers and grocery orders with their current status.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'transfer_price',
    description: 'Fixed price of a private airport transfer between a 30A community and an airport (ECP, VPS or PNS).',
    parameters: {
      type: 'object',
      properties: {
        community: { type: 'string' },
        airport: { type: 'string', enum: ['ECP', 'VPS', 'PNS'] },
        passengers: { type: 'number' },
      },
      required: ['community', 'airport'],
    },
  },
]

export function voiceInstructions(ctx) {
  const stay = ctx.booking
    ? `The guest is staying in ${ctx.booking.community_name || 'a 30A community'}${ctx.booking.check_in ? `, ${ctx.booking.check_in} to ${ctx.booking.check_out || '?'}` : ''}.`
    : 'The guest has no rental on file — ask which community they are staying in when location matters.'
  const now = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())
  return [
    'You are Vitoria, the voice concierge of the My30A Host app for vacation rentals along Scenic Highway 30A, Florida.',
    'Speak like a warm, polished five-star hotel concierge on the phone: natural, upbeat, concise. Usually one to three short sentences, then let the guest talk. Never read out lists longer than three items, URLs or long numbers — the app shows cards with the details on screen.',
    'Always answer in the language the guest speaks.',
    `Right now it is ${now} on 30A (Central time). Guest: ${ctx.profile?.name || 'Guest'} — call them ${ctx.firstName}. ${stay}`,
    '',
    'Use your tools for every factual answer — never invent restaurants, hours, prices or events:',
    '- Food or drinks → find_restaurants (then place_details if they ask about one place). These are local favorites, not paid partners. Reservations are free: say how to book (Resy, OpenTable, phone).',
    '- What’s happening, live music, markets, festivals, things to do → find_events. Mention that events are listed by organizers, so it’s worth checking the details.',
    '- Beaches → find_beaches, and remind them to check the beach flags.',
    '- Their transfers, groceries or stay → my_bookings. Airport transfer cost → transfer_price. Transfers and grocery delivery are booked in the Services tab of the app; everything else is booked directly with the business.',
    'After a tool returns, give your top pick with one reason and say the rest are on screen.',
    'If something is outside 30A or the stay, help briefly and steer back. Keep it safe: beach flags change daily; double red means the water is closed.',
    'Start the call with one short, friendly greeting using their first name and ask how you can help.',
  ].join('\n')
}

export function realtimeSessionConfig(ctx) {
  return {
    type: 'realtime',
    model: REALTIME_MODEL(),
    instructions: voiceInstructions(ctx),
    output_modalities: ['audio'],
    audio: {
      input: {
        transcription: { model: 'gpt-4o-mini-transcribe' },
        noise_reduction: { type: 'near_field' },
        turn_detection: { type: 'semantic_vad', eagerness: 'auto', create_response: true, interrupt_response: true },
      },
      output: { voice: REALTIME_VOICE() },
    },
    tools: VOICE_TOOLS,
    tool_choice: 'auto',
  }
}

// ---------- tool execution ----------
const short = (card) => ({
  name: card.name,
  area: card.area,
  what: card.category,
  when_or_hours: card.facts?.join(' ') || card.hours || '',
  booking: card.booking_platform || (card.booking ? 'online' : card.phone ? 'phone' : ''),
  phone: card.phone || undefined,
  note: (card.why || '').slice(0, 140),
})

export async function runVoiceTool(name, args = {}, ctx) {
  const community = args.community || ctx.booking?.community_name || null
  if (name === 'find_restaurants') {
    const want = understandDining(`${args.request || ''} ${args.type || ''}`)
    const { picks } = await recommendDining({ ...want, type: args.type || want.type, community: want.community || community, openNow: Boolean(args.open_now) || want.openNow, count: 4 })
    const cards = picks.map((r) => diningCard(r))
    return { result: { community: want.community || community, picks: cards.map(short) }, cards }
  }
  if (name === 'place_details') {
    const r = await findDining(args.name)
    if (!r) return { result: { found: false, note: 'Not in the dining guide — suggest calling ahead or checking their website.' }, cards: [] }
    const card = diningCard(r)
    const status = openStatus(r.opening_hours)
    return {
      result: { ...short(card), open_now: status.open_now, today: status.today, weekly_hours: r.hours, price: r.price_range, booking_platform: r.booking_platform, phone: r.phone },
      cards: [card],
    }
  }
  if (name === 'find_events') {
    const { picks, total, want } = await recommendEvents({ text: args.request || 'today', community: args.community || community })
    const cards = picks.map((v) => eventCard(v))
    return { result: { when: want.when, category: want.category, total_listed: total, picks: cards.map(short) }, cards }
  }
  if (name === 'find_beaches') {
    const needs = args.needs || 'any'
    const { picks } = await recommendBeaches({ community, parking: needs === 'parking', accessible: needs === 'accessible', dogs: needs === 'dogs' })
    const cards = distinctPhotos(picks.map((b) => beachCard(b)))
    return { result: { community, picks: cards.map((c) => ({ name: c.name, area: c.area, facts: c.facts.join(', ') })) }, cards }
  }
  if (name === 'my_bookings') {
    const h = ctx.history || {}
    return {
      result: {
        stay: ctx.booking ? { community: ctx.booking.community_name, check_in: ctx.booking.check_in, check_out: ctx.booking.check_out } : null,
        transfers: (h.trips || []).slice(0, 4).map((t) => ({ trip: t.trip_number, airport: t.airport, direction: t.direction === 'from_airport' ? 'arrival' : 'departure', when: ctx.formatWhen(t.scheduled_at), status: t.status })),
        groceries: (h.orders || []).slice(0, 4).map((o) => ({ order: o.order_number, package: o.package, delivery: ctx.formatWhen(o.delivery_time), status: o.status })),
      },
      cards: [],
    }
  }
  if (name === 'transfer_price') {
    const { data: communities } = await supabase.from('communities').select('id, name').eq('is_active', true)
    const c = (communities || []).find((x) => x.name.toLowerCase().includes(String(args.community || '').toLowerCase().split(' ')[0]))
    if (!c) return { result: { found: false, communities: (communities || []).map((x) => x.name) }, cards: [] }
    const vehicle = Number(args.passengers) > 6 ? '14pax' : Number(args.passengers) > 4 ? '6pax' : '4pax'
    const { data: price } = await supabase
      .from('transfer_pricing')
      .select('base_price')
      .eq('community_id', c.id)
      .eq('airport', String(args.airport).toUpperCase())
      .eq('vehicle_type', vehicle)
      .maybeSingle()
    return {
      result: { community: c.name, airport: args.airport, vehicle, one_way_price_usd: price ? Number(price.base_price) : null, note: 'Private door-to-door, per vehicle. Round trip booked together saves 5%. Book in the Services tab.' },
      cards: [],
    }
  }
  return { result: { error: `Unknown tool ${name}` }, cards: [] }
}
