import { useEffect } from 'react'

export function useKeyboard(keyMap: Record<string, (e: KeyboardEvent) => void>, deps: any[] = []) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const handler = keyMap[e.key] || keyMap[e.key.toLowerCase()]
      if (handler) {
        handler(e)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, deps)
}
