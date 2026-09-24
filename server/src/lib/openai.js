// Minimal OpenAI chat wrapper (no SDK; Node 18+ fetch). Mirrors lib/stripe.js: when the key
// is missing or every model fails, callers get { skipped: true, reason } and fall back.

const NOT_CONFIGURED = { skipped: true, reason: 'OPENAI_NOT_CONFIGURED' }
const DEFAULT_FALLBACK_MODEL = 'gpt-4o-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

// Out of credits / billing problems fail identically for every model and every call, so after the
// first such answer skip OpenAI for a few minutes — callers fall back instantly instead of waiting
// on 6 doomed requests per chat message.
const QUOTA_CODES = ['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'account_deactivated']
const QUOTA_PAUSE_MS = 3 * 60 * 1000
let quotaBlockedUntil = 0
let quotaReason = ''
const quotaBlocked = () => (Date.now() < quotaBlockedUntil ? { skipped: true, reason: quotaReason } : null)
function noteQuota(json) {
  const code = json?.error?.code || json?.error?.type
  if (!QUOTA_CODES.includes(code)) return false
  quotaBlockedUntil = Date.now() + QUOTA_PAUSE_MS
  quotaReason = json?.error?.message || code
  return true
}

function candidateModels(model) {
  const list = [
    model,
    process.env.OPENAI_MODEL,
    process.env.OPENAI_MODEL_FALLBACK,
    DEFAULT_FALLBACK_MODEL,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return [...new Set(list)]
}

// Responses API with OpenAI's hosted web_search tool + a strict JSON schema for the final
// answer. Used by Vitoria so she can look up live facts (today's restaurant hours) and return
// structured place cards. Same { skipped, reason } contract as chatCompletion.
export async function webResponse({ instructions, input, schema, model, location, timeoutMs = 60000 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NOT_CONFIGURED
  const blocked = quotaBlocked()
  if (blocked) return blocked

  let lastReason = 'OPENAI_FAILED'
  for (const candidate of candidateModels(model)) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: candidate,
          instructions,
          input,
          tools: [{ type: 'web_search', ...(location ? { user_location: { type: 'approximate', ...location } } : {}) }],
          text: { format: { type: 'json_schema', name: schema.name, strict: true, schema: schema.schema } },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        lastReason = json?.error?.message || `${response.status} ${response.statusText}`
        if (noteQuota(json) || response.status === 401 || response.status === 403) break
        continue
      }
      const text = (json?.output || [])
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content || [])
        .filter((part) => part.type === 'output_text')
        .map((part) => part.text)
        .join('')
      try {
        return { data: JSON.parse(text), model: candidate }
      } catch {
        lastReason = 'OPENAI_BAD_JSON'
      }
    } catch (error) {
      lastReason = error?.name === 'TimeoutError' ? 'OPENAI_TIMEOUT' : error.message
    }
  }
  return { skipped: true, reason: lastReason }
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function chatCompletion({ messages, model, maxTokens = 400, timeoutMs = 25000 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NOT_CONFIGURED
  const blocked = quotaBlocked()
  if (blocked) return blocked

  let lastReason = 'OPENAI_FAILED'
  for (const candidate of candidateModels(model)) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: candidate,
          messages,
          max_completion_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        lastReason = json?.error?.message || `${response.status} ${response.statusText}`
        // A bad key or an empty balance fails for every model; do not keep retrying.
        if (noteQuota(json) || response.status === 401 || response.status === 403) break
        continue
      }

      const content = json?.choices?.[0]?.message?.content?.trim()
      if (content) return { content, model: candidate }
      lastReason = 'OPENAI_EMPTY_RESPONSE'
    } catch (error) {
      lastReason = error?.name === 'TimeoutError' ? 'OPENAI_TIMEOUT' : error.message
    }
  }

  return { skipped: true, reason: lastReason }
}
