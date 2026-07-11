import { useEffect } from 'react'
import { useViewStore } from '../stores/useViewStore'

export function useTheme() {
  const theme = useViewStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
}
