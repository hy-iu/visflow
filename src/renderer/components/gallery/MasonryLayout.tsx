import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import { imageKey } from '../../lib/utils'
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

const GAP = 8

interface MasonryItem {
  image: any
  x: number
  y: number
  width: number
  height: number
}

export const MasonryLayout: React.FC<MasonryLayoutProps> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const parentRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const rafRef = useRef<number>(0)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]

  // Measure container (contentRect already excludes padding)
  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    // Set initial values immediately
    setContainerWidth(el.clientWidth - 32) // clientWidth includes padding, subtract it
    setViewportHeight(el.clientHeight)

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // contentRect already excludes padding for border-box elements
        const width = entry.contentRect.width
        setContainerWidth(width)
        setViewportHeight(entry.contentRect.height)
        const cols = Math.max(1, Math.floor((width + GAP) / (cellSize + GAP)))
        setColumnCount(cols)
      }
    })
    observer.observe(el)

    const onScroll = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop)
        rafRef.current = 0
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cellSize])

  // Calculate masonry positions using shortest-column-first algorithm
  const { items, totalHeight } = useMemo(() => {
    if (columnCount === 0 || containerWidth <= 0 || images.length === 0) {
      return { items: [] as MasonryItem[], totalHeight: 0 }
    }

    const colWidth = (containerWidth - (columnCount - 1) * GAP) / columnCount
    const colHeights = new Array(columnCount).fill(0)
    const result: MasonryItem[] = []

    for (const image of images) {
      // Find shortest column
      let minCol = 0
      for (let c = 1; c < columnCount; c++) {
        if (colHeights[c] < colHeights[minCol]) minCol = c
      }

      // Calculate item height from aspect ratio
      const aspectRatio = image.width && image.height ? image.width / image.height : 1
      const itemHeight = Math.round(colWidth / aspectRatio)

      const x = minCol * (colWidth + GAP)
      const y = colHeights[minCol]

      result.push({ image, x, y, width: colWidth, height: itemHeight })

      colHeights[minCol] += itemHeight + GAP
    }

    const maxH = Math.max(...colHeights)
    return { items: result, totalHeight: maxH > 0 ? maxH - GAP : 0 }
  }, [images, columnCount, containerWidth])

  // Only render items visible in the viewport (with buffer)
  const visibleItems = useMemo(() => {
    const buffer = cellSize * 3
    const top = scrollTop - buffer
    const bottom = scrollTop + viewportHeight + buffer
    return items.filter((item) => item.y + item.height > top && item.y < bottom)
  }, [items, scrollTop, viewportHeight, cellSize])

  return (
    <div className="masonry-layout" ref={parentRef}>
      <div
        className="masonry-layout__virtual"
        style={{ height: `${totalHeight}px` }}
      >
        {visibleItems.map((item) => (
          <div
            key={imageKey(item.image)}
            className="masonry-layout__item"
            style={{
              position: 'absolute',
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${item.width}px`,
              height: `${item.height}px`,
            }}
          >
            <ImageCard
              image={item.image}
              isSelected={selectedImageIds.has(item.image.id)}
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
