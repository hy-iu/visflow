import React, { useMemo, useState, useCallback } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import { MasonryLayout } from './MasonryLayout'
import './FolderLayout.css'

/** Max images to render per folder in unwrap (horizontal scroll) mode */
const UNWRAP_RENDER_LIMIT = 60
/** Max images to render per folder in wrap grid mode */
const WRAP_GRID_RENDER_LIMIT = 200

interface FolderRowProps {
  dirPath: string
  dirName: string
  images: any[]
  layoutStyle: 'grid' | 'masonry'
  foldersWrap: boolean
  gridSize: number
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const FolderRow: React.FC<FolderRowProps> = React.memo(({
  dirPath,
  dirName,
  images,
  layoutStyle,
  foldersWrap,
  gridSize,
  onContextMenu,
}) => {
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)
  const [showAll, setShowAll] = useState(false)

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
      // Unwrap: Horizontal scroll row (limit rendered count)
      const renderLimit = showAll ? images.length : UNWRAP_RENDER_LIMIT
      const visibleImages = images.slice(0, renderLimit)
      return (
        <div
          className={`folder-row__track folder-row__track--${layoutStyle}`}
          style={trackStyle}
        >
          {visibleImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isSelected={selectedImageIds.has(image.id)}
              onSelect={selectImage}
              onOpen={openViewer}
              onContextMenu={onContextMenu}
            />
          ))}
          {!showAll && images.length > UNWRAP_RENDER_LIMIT && (
            <button className="folder-row__show-more" onClick={() => setShowAll(true)}>
              +{images.length - UNWRAP_RENDER_LIMIT}
            </button>
          )}
        </div>
      )
    } else {
      // Wrap: Folder grid or masonry columns
      if (layoutStyle === 'masonry') {
        return <MasonryLayout images={images} onContextMenu={onContextMenu} />
      } else {
        const renderLimit = showAll ? images.length : WRAP_GRID_RENDER_LIMIT
        const visibleImages = images.slice(0, renderLimit)
        return (
          <div className="folder-row__grid" style={gridStyle}>
            {visibleImages.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                isSelected={selectedImageIds.has(image.id)}
                onSelect={selectImage}
                onOpen={openViewer}
                onContextMenu={onContextMenu}
              />
            ))}
            {!showAll && images.length > WRAP_GRID_RENDER_LIMIT && (
              <button className="folder-row__show-more folder-row__show-more--grid" onClick={() => setShowAll(true)}>
                显示全部 {images.length} 张
              </button>
            )}
          </div>
        )
      }
    }
  }

  return (
    <div className="folder-row">
      <div className="folder-row__header">
        <div className="folder-row__header-info">
          <span className="folder-row__title">📁 {dirName}</span>
          <span className="folder-row__path" title={dirPath}>{dirPath}</span>
        </div>
        <span className="folder-row__count">{images.length} 张图片</span>
      </div>
      <div className="folder-row__content">{renderContent()}</div>
    </div>
  )
})

interface FolderLayoutProps {
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

function parseDirectory(filePath: string) {
  const isWindows = filePath.includes('\\')
  const separator = isWindows ? '\\' : '/'
  const parts = filePath.split(/[/\\]/)
  const fileName = parts.pop() || ''
  const dirPath = parts.join(separator)
  const dirName = parts[parts.length - 1] || dirPath
  return { dirPath, dirName }
}

export const FolderLayout: React.FC<FolderLayoutProps> = ({ onContextMenu }) => {
  const images = useLibraryStore((s) => s.images)
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const foldersWrap = useViewStore((s) => s.foldersWrap)
  const gridSize = useViewStore((s) => s.gridSize)
  const foldersSortBy = useViewStore((s) => s.foldersSortBy)
  const sortDir = useViewStore((s) => s.sortDir)

  // Group images by their physical parent folder
  const folderGroups = useMemo(() => {
    const groupsMap = new Map<string, { dirPath: string; dirName: string; list: any[] }>()
    
    for (const img of images) {
      if (!img.filePath) continue
      const { dirPath, dirName } = parseDirectory(img.filePath)
      
      if (!groupsMap.has(dirPath)) {
        groupsMap.set(dirPath, { dirPath, dirName, list: [] })
      }
      groupsMap.get(dirPath)!.list.push(img)
    }
    
    const list = Array.from(groupsMap.values())
    
    list.sort((a, b) => {
      let valA: any = a.dirName
      let valB: any = b.dirName
      
      if (foldersSortBy === 'count') {
        valA = a.list.length
        valB = b.list.length
      } else if (foldersSortBy === 'path') {
        valA = a.dirPath
        valB = b.dirPath
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA
      }
      
      return sortDir === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA)
    })
    
    return list
  }, [images, foldersSortBy, sortDir])

  if (images.length === 0) {
    return (
      <div className="folder-layout__empty">
        <span className="folder-layout__empty-icon">📷</span>
        <span className="folder-layout__empty-title">你的图库空空如也</span>
        <span className="folder-layout__empty-desc">
          请点击右上角的“导入”按钮，或将文件夹拖拽到此处开始导入。
        </span>
      </div>
    )
  }

  if (folderGroups.length === 0) {
    return (
      <div className="folder-layout__empty">
        <span className="folder-layout__empty-icon">📁</span>
        <span className="folder-layout__empty-title">未识别到文件夹</span>
        <span className="folder-layout__empty-desc">
          未能在图库图片的路径中解析出有效的文件夹。
        </span>
      </div>
    )
  }

  return (
    <div className="folder-layout">
      {folderGroups.map((group) => (
        <FolderRow
          key={group.dirPath}
          dirPath={group.dirPath}
          dirName={group.dirName}
          images={group.list}
          layoutStyle={layoutStyle}
          foldersWrap={foldersWrap}
          gridSize={gridSize}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}
