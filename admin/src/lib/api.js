import { API_URL } from './config.js'
import { supabase } from './supabase.js'

let accessToken = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function withQuery(path, params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }

  let token = accessToken
  if (!token && supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    token = session?.access_token || null
    if (token) accessToken = token
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const { body, ...rest } = options
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    body:
      body !== undefined && typeof body !== 'string' && !(body instanceof FormData)
        ? JSON.stringify(body)
        : body,
  })

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    if (response.status === 401) accessToken = null
    const error = new Error(data?.error || response.statusText)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
