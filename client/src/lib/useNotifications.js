import { useEffect } from 'react'
import { useQuery } from './useQuery.js'

export function useNotifications({ poll = false } = {}) {
  const query = useQuery('/api/notifications/mine')
  const refetch = query.refetch

  useEffect(() => {
    if (!poll) return undefined
    function refresh() {
      if (document.visibilityState !== 'visible') return
      refetch().catch(() => {})
    }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [poll, refetch])

  const unread = Number(query.data?.unread_count || 0)
  return { ...query, unread, notifications: query.data?.notifications || [] }
}
