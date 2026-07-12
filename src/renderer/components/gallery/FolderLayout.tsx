import React, { useState, useEffect } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import { MasonryLayout } from './MasonryLayout'
import './FolderLayout.css'

interface FolderRowProps {
  collection: any
  layoutStyle: 'grid' | 'masonry'
  foldersWrap: boolean
  gridSize: number
  sortBy: string
  sortDir: string
  searchQuery: string
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const FolderRow: React.FC<FolderRowProps> = ({
  collection,
  layoutStyle,
  foldersWrap,
  gridSize,
  sortBy,
  sortDir,
  searchQuery,
  onContextMenu,
}) => {
  const [images, setImages] = useState<any[]>([])
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)

  useEffect(() => {
    window.api
      .getImages({
        collectionId: collection.id,
        sortBy,
        sortDir,
        search: searchQuery || undefined,
      })
      .then((res: any[]) => {
        setImages(res || [])
      })
      .catch((err: any) => console.error(err))
  }, [collection.id, sortBy, sortDir, searchQuery])

  if (images.length === 0) {
    return (
      <div className="folder-row folder-row--empty">
        <div className="folder-row__header">
          <span className="folder-row__title">📁 {collection.name}</span>
          <span className="folder-row__count">0 张图片</span>
        </div>
        <div className="folder-row__content">
          <div className="folder-row__empty-placeholder">
            此图集内暂无图片。您可以在 “所有图片” 或 “时间轴” 视图下选择图片，然后右键选择 “添加到图集: {collection.name}”。
          </div>
        </div>
      </div>
    )
  }

  // gridSize mapping to row heights for horizontal scroll mode
  const rowHeightMap: Record<number, number> = {
    1: 130,
    2: 190,
    3: 270,
  }
  const rowHeight = rowHeightMap[gridSize] || 190

  const gridCellSizeMap: Record<number, string> = {
    1: '150px',
    2: '200px',
    3: '280px',
  }
  const cellSize = gridCellSizeMap[gridSize] || '200px'

  const gridStyle = {
    '--grid-cell-size': cellSize,
  } as React.CSSProperties

  const trackStyle = {
    '--row-height': `${rowHeight}px`,
  } as React.CSSProperties

  const renderContent = () => {
    if (!foldersWrap) {
      // Unwrap: Horizontal scroll row
      return (
        <div
          className={`folder-row__track folder-row__track--${layoutStyle}`}
          style={trackStyle}
        >
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
    } else {
      // Wrap: Folder grid or masonry columns
      if (layoutStyle === 'masonry') {
        return <MasonryLayout images={images} onContextMenu={onContextMenu} />
      } else {
        return (
          <div className="folder-row__grid" style={gridStyle}>
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
    }
  }

  return (
    <div className="folder-row">
      <div className="folder-row__header">
        <span className="folder-row__title">📁 {collection.name}</span>
        <span className="folder-row__count">{images.length} 张图片</span>
      </div>
      <div className="folder-row__content">{renderContent()}</div>
    </div>
  )
}

interface FolderLayoutProps {
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

export const FolderLayout: React.FC<FolderLayoutProps> = ({ onContextMenu }) => {
  const collections = useLibraryStore((s) => s.collections)
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const foldersWrap = useViewStore((s) => s.foldersWrap)
  const gridSize = useViewStore((s) => s.gridSize)
  const sortBy = useViewStore((s) => s.sortBy)
  const sortDir = useViewStore((s) => s.sortDir)
  const searchQuery = useViewStore((s) => s.searchQuery)

  if (collections.length === 0) {
    return (
      <div className="folder-layout__empty">
        <span className="folder-layout__empty-icon">📁</span>
        <span className="folder-layout__empty-title">暂无图集/文件夹</span>
        <span className="folder-layout__empty-desc">
          请点击左侧侧边栏中“文件夹/图集”右侧的 “+” 按钮新建一个图集，然后在“所有图片”或“时间轴”中右键图片添加到该图集。
        </span>
      </div>
    )
  }

  return (
    <div className="folder-layout">
      {collections.map((col) => (
        <FolderRow
          key={col.id}
          collection={col}
          layoutStyle={layoutStyle}
          foldersWrap={foldersWrap}
          gridSize={gridSize}
          sortBy={sortBy}
          sortDir={sortDir}
          searchQuery={searchQuery}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}
