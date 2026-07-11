import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import './MasonryLayout.css'

interface MasonryLayoutProps {
  images: any[]
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const GRID_CELL_SIZES: Record<number, number> = {
  1: 150,
  2: 200,
  3: 280,
}

export const MasonryLayout: React.FC<MasonryLayoutProps> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const cols = Math.max(1, Math.floor(width / cellSize))
        setColumnCount(cols)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [cellSize])

  const columnsStyle = useMemo(
    () => ({ columnCount }),
    [columnCount]
  )

  return (
    <div className="masonry-layout" ref={containerRef}>
      <div className="masonry-layout__columns" style={columnsStyle}>
        {images.map((image) => (
          <div key={image.id} className="masonry-layout__item">
            <ImageCard
              image={image}
              isSelected={selectedImageIds.has(image.id)}
              onSelect={selectImage}
              onOpen={openViewer}
              onContextMenu={onContextMenu}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
