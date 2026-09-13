// Minimal OpenAI chat wrapper (no SDK; Node 18+ fetch). Mirrors lib/stripe.js: when the key
// is missing or every model fails, callers get { skipped: true, reason } and fall back.

const NOT_CONFIGURED = { skipped: true, reason: 'OPENAI_NOT_CONFIGURED' }
const DEFAULT_FALLBACK_MODEL = 'gpt-4o-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

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

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function chatCompletion({ messages, model, maxTokens = 400, timeoutMs = 25000 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NOT_CONFIGURED

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
        // A bad key will fail for every model; do not keep retrying.
        if (response.status === 401 || response.status === 403) break
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
