import { useState, useEffect, RefObject } from 'react'

export function useDragDrop(ref: RefObject<HTMLElement | null>, onDropFiles: (files: string[]) => void) {
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Only set to false if we're leaving the container itself
      if (e.relatedTarget === null || !el.contains(e.relatedTarget as Node)) {
        setIsDragOver(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files: string[] = []
      if (e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i] as any
          if (file && file.path) {
            files.push(file.path)
          }
        }
      }
      if (files.length > 0) {
        onDropFiles(files)
      }
    }

    el.addEventListener('dragenter', handleDragEnter)
    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)

    return () => {
      el.removeEventListener('dragenter', handleDragEnter)
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('drop', handleDrop)
    }
  }, [ref, onDropFiles])

  return { isDragOver }
}
