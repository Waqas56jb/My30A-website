import { useEffect } from 'react'

export function useTitle(title) {
  useEffect(() => {
    document.title = title
    return () => {
      document.title = 'My30A Host'
    }
  }, [title])
}
