import { createClient } from '@supabase/supabase-js'

const PERSIST_KEY = 'my30a-persist-session'

export function setPersistSession(remember) {
  try {
    sessionStorage.setItem(PERSIST_KEY, remember ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function shouldPersist() {
  try {
    return sessionStorage.getItem(PERSIST_KEY) !== '0'
  } catch {
    return true
  }
}

const authStorage = {
  getItem(key) {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      if (shouldPersist()) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {
      /* ignore */
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storage: authStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
