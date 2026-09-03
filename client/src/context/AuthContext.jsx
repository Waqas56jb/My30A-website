import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { setAccessToken } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)
const PANEL_ROLES = ['driver', 'partner', 'shopper']

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, roles, is_active')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

function firstPanelRole(roles) {
  return PANEL_ROLES.find((role) => (roles || []).includes(role)) || null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activeRole, setActiveRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    if (!supabase) {
      setLoading(false)
      return undefined
    }

    async function applySession(nextSession) {
      if (!nextSession?.user) {
        setAccessToken(null)
        setSession(null)
        setProfile(null)
        setActiveRole(null)
        return
      }

      setAccessToken(nextSession.access_token)
      const nextProfile = await loadProfile(nextSession.user.id)
      if (ignore) return
      setSession(nextSession)
      setProfile(nextProfile)
      setActiveRole((current) => {
        const roles = nextProfile.roles || []
        if (current && roles.includes(current)) return current
        return firstPanelRole(roles)
      })
    }

    supabase.auth.getSession().then(async ({ data }) => {
      try {
        await applySession(data.session)
      } catch (error) {
        console.error(error)
        if (!ignore) {
          setSession(null)
          setProfile(null)
          setActiveRole(null)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(async () => {
        try {
          await applySession(nextSession)
        } catch (error) {
          console.error(error)
          if (!ignore) {
            setSession(null)
            setProfile(null)
            setActiveRole(null)
          }
        } finally {
          if (!ignore) setLoading(false)
        }
      }, 0)
    })

    return () => {
      ignore = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      activeRole,
      setActiveRole,
      loading,
      signIn: (email, password) =>
        supabase
          ? supabase.auth.signInWithPassword({ email, password })
          : Promise.resolve({ data: { session: null, user: null }, error: { message: 'App is not configured' } }),
      signOut: async () => {
        setAccessToken(null)
        if (!supabase) return { error: null }
        return supabase.auth.signOut()
      },
    }),
    [session, profile, activeRole, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
