import React, { useMemo } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import './GridLayout.css'

interface GridLayoutProps {
  images: any[]
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const GRID_CELL_SIZES: Record<number, string> = {
  1: '150px',
  2: '200px',
  3: '280px',
}

export const GridLayout: React.FC<GridLayoutProps> = ({ images, onContextMenu }) => {
  const gridSize = useViewStore((s) => s.gridSize)
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  const cellSize = GRID_CELL_SIZES[gridSize] || GRID_CELL_SIZES[2]

  const style = useMemo(
    () => ({ '--grid-cell-size': cellSize } as React.CSSProperties),
    [cellSize]
  )

  return (
    <div className="grid-layout" style={style}>
      {images.map((image) => (
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
  )
}
