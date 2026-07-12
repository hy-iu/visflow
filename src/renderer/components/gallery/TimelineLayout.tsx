import React, { useMemo } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { groupByDate } from '../../lib/utils'
import { ImageCard } from './ImageCard'
import { MasonryLayout } from './MasonryLayout'
import './TimelineLayout.css'

interface TimelineLayoutProps {
  images: any[]
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const GRID_CELL_SIZES: Record<number, string> = {
  1: '150px',
  2: '200px',
  3: '280px',
}

export const TimelineLayout: React.FC<TimelineLayoutProps> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]

  const groups = useMemo(() => {
    const map = groupByDate(images)
    return Array.from(map.entries())
  }, [images])

  const gridStyle = useMemo(
    () => ({ '--grid-cell-size': cellSize } as React.CSSProperties),
    [cellSize]
  )

  return (
    <div className="timeline-layout">
      {groups.map(([date, groupImages]) => (
        <div key={date} className="timeline-group">
          <div className="timeline-group__header">
            {date}
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
              {groupImages.length} 张
            </span>
          </div>
          {layoutStyle === 'masonry' ? (
            <MasonryLayout images={groupImages} onContextMenu={onContextMenu} />
          ) : (
            <div className="timeline-group__grid" style={gridStyle}>
              {groupImages.map((image: any) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  isSelected={selectedImageIds.has(image.id)}
                  onSelect={selectImage}
                  onOpen={openViewer}
                  onContextMenu={onContextMenu}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
