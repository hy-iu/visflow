import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { groupByDate, imageKey } from '../../lib/utils'
import { ImageCard } from './ImageCard'
import './TimelineLayout.css'

interface TimelineLayoutProps {
  images: any[]
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const GRID_CELL_SIZES: Record<number, number> = {
  1: 150,
  2: 200,
  3: 280,
}

const GAP = 8
const HEADER_HEIGHT = 40

/* ======================== Grid Mode (row-based virtualization) ======================== */

interface TimelineGridItem {
  type: 'header' | 'row'
  date?: string
  count?: number
  images?: any[]
}

const TimelineGrid: React.FC<{ images: any[]; onContextMenu?: (e: React.MouseEvent, id: string) => void }> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]
  const parentRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const cols = Math.max(1, Math.floor((width + GAP) / (cellSize + GAP)))
        setColumnCount(cols)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [cellSize])

  const flatItems = useMemo(() => {
    const map = groupByDate(images)
    const items: TimelineGridItem[] = []
    for (const [date, groupImages] of map.entries()) {
      items.push({ type: 'header', date, count: groupImages.length })
      const rowCount = Math.ceil(groupImages.length / columnCount)
      for (let r = 0; r < rowCount; r++) {
        items.push({ type: 'row', images: groupImages.slice(r * columnCount, (r + 1) * columnCount) })
      }
    }
    return items
  }, [images, columnCount])

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => flatItems[index].type === 'header' ? HEADER_HEIGHT : cellSize + GAP,
    overscan: 5,
  })

  return (
    <div className="timeline-layout" ref={parentRef}>
      <div className="timeline-layout__virtual" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = flatItems[virtualItem.index]
          if (item.type === 'header') {
            return (
              <div key={`header-${item.date}`} className="timeline-group__header" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${HEADER_HEIGHT}px`, transform: `translateY(${virtualItem.start}px)` }}>
                {item.date}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{item.count} 张</span>
              </div>
            )
          }
          return (
            <div key={`row-${virtualItem.index}`} className="timeline-group__row" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${cellSize}px`, transform: `translateY(${virtualItem.start}px)`, display: 'flex', gap: `${GAP}px` }}>
              {item.images!.map((image: any) => (
                <div key={imageKey(image)} style={{ flex: 1, minWidth: 0 }}>
                  <ImageCard image={image} isSelected={selectedImageIds.has(image.id)} onSelect={selectImage} onOpen={openViewer} onContextMenu={onContextMenu} />
                </div>
              ))}
              {Array.from({ length: columnCount - item.images!.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ======================== Masonry Mode (viewport culling) ======================== */

interface MasonryEntry {
  type: 'header' | 'image'
  date?: string
  count?: number
  image?: any
  x: number
  y: number
  width: number
  height: number
}

const TimelineMasonry: React.FC<{ images: any[]; onContextMenu?: (e: React.MouseEvent, id: string) => void }> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]
  const parentRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    setContainerWidth(el.clientWidth - 32)
    setViewportHeight(el.clientHeight)

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
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

  // Build masonry layout with headers per date group
  const { entries, totalHeight } = useMemo(() => {
    if (columnCount === 0 || containerWidth <= 0 || images.length === 0) {
      return { entries: [] as MasonryEntry[], totalHeight: 0 }
    }

    const colWidth = (containerWidth - (columnCount - 1) * GAP) / columnCount
    const map = groupByDate(images)
    const result: MasonryEntry[] = []
    let currentY = 0

    for (const [date, groupImages] of map.entries()) {
      // Header
      result.push({ type: 'header', date, count: groupImages.length, x: 0, y: currentY, width: containerWidth, height: HEADER_HEIGHT })
      currentY += HEADER_HEIGHT + GAP

      // Masonry items within this group
      const colHeights = new Array(columnCount).fill(0)
      for (const image of groupImages) {
        let minCol = 0
        for (let c = 1; c < columnCount; c++) {
          if (colHeights[c] < colHeights[minCol]) minCol = c
        }
        const aspectRatio = image.width && image.height ? image.width / image.height : 1
        const itemHeight = Math.round(colWidth / aspectRatio)
        const x = minCol * (colWidth + GAP)
        const y = currentY + colHeights[minCol]
        result.push({ type: 'image', image, x, y, width: colWidth, height: itemHeight })
        colHeights[minCol] += itemHeight + GAP
      }
      currentY += Math.max(...colHeights) + GAP * 2
    }

    return { entries: result, totalHeight: currentY }
  }, [images, columnCount, containerWidth])

  const visibleEntries = useMemo(() => {
    const buffer = cellSize * 3
    const top = scrollTop - buffer
    const bottom = scrollTop + viewportHeight + buffer
    return entries.filter((e) => e.y + e.height > top && e.y < bottom)
  }, [entries, scrollTop, viewportHeight, cellSize])

  return (
    <div className="timeline-layout" ref={parentRef}>
      <div className="timeline-layout__virtual" style={{ height: `${totalHeight}px` }}>
        {visibleEntries.map((entry, idx) => {
          if (entry.type === 'header') {
            return (
              <div key={`header-${entry.date}`} className="timeline-group__header" style={{ position: 'absolute', left: 0, right: 0, top: `${entry.y}px`, height: `${HEADER_HEIGHT}px` }}>
                {entry.date}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{entry.count} 张</span>
              </div>
            )
          }
          return (
            <div key={imageKey(entry.image)} className="timeline-masonry__item" style={{ position: 'absolute', left: `${entry.x}px`, top: `${entry.y}px`, width: `${entry.width}px`, height: `${entry.height}px` }}>
              <ImageCard image={entry.image} isSelected={selectedImageIds.has(entry.image.id)} onSelect={selectImage} onOpen={openViewer} onContextMenu={onContextMenu} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ======================== Main Export ======================== */

export const TimelineLayout: React.FC<TimelineLayoutProps> = ({ images, onContextMenu }) => {
  const layoutStyle = useViewStore((s) => s.layoutStyle)

  if (layoutStyle === 'masonry') {
    return <TimelineMasonry images={images} onContextMenu={onContextMenu} />
  }
  return <TimelineGrid images={images} onContextMenu={onContextMenu} />
}
