import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import { imageKey } from '../../lib/utils'
import './GridLayout.css'

interface GridLayoutProps {
  images: any[]
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const GRID_CELL_SIZES: Record<number, number> = {
  1: 150,
  2: 200,
  3: 280,
}

const GAP = 8

export const GridLayout: React.FC<GridLayoutProps> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]

  const parentRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)

  // Measure container width to calculate columns
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width - 32 // padding 16px * 2
        const cols = Math.max(1, Math.floor((width + GAP) / (cellSize + GAP)))
        setColumnCount(cols)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [cellSize])

  const rowCount = Math.ceil(images.length / columnCount)
  const rowHeight = cellSize + GAP

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  const style = useMemo(
    () => ({ '--grid-cell-size': `${cellSize}px` } as React.CSSProperties),
    [cellSize]
  )

  return (
    <div className="grid-layout-scroll" ref={parentRef}>
      <div
        className="grid-layout"
        style={{
          ...style,
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columnCount
          const rowImages = images.slice(startIdx, startIdx + columnCount)
          return (
            <div
              key={virtualRow.index}
              className="grid-layout__row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${cellSize}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                gap: `${GAP}px`,
              }}
            >
              {rowImages.map((image) => (
                <div key={imageKey(image)} className="grid-layout__cell" style={{ flex: 1, minWidth: 0 }}>
                  <ImageCard
                    image={image}
                    isSelected={selectedImageIds.has(image.id)}
                    onSelect={selectImage}
                    onOpen={openViewer}
                    onContextMenu={onContextMenu}
                  />
                </div>
              ))}
              {/* Fill empty cells to keep alignment */}
              {Array.from({ length: columnCount - rowImages.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
