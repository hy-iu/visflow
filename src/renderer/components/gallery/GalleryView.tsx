import React, { useRef, useEffect, useState } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { useDragDrop } from '../../hooks/useDragDrop'
import { GridLayout } from './GridLayout'
import { MasonryLayout } from './MasonryLayout'
import { TimelineLayout } from './TimelineLayout'
import { FolderLayout } from './FolderLayout'
import { CollectionsOverview } from './CollectionsOverview'
import ContextMenu from '../common/ContextMenu'
import './GalleryView.css'

export default function GalleryView() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const orgMode = useViewStore((s) => s.orgMode)
  const currentView = useViewStore((s) => s.currentView)
  const currentViewId = useViewStore((s) => s.currentViewId)
  const sortBy = useViewStore((s) => s.sortBy)
  const sortDir = useViewStore((s) => s.sortDir)
  const searchQuery = useViewStore((s) => s.searchQuery)

  const images = useLibraryStore((s) => s.images)
  const collections = useLibraryStore((s) => s.collections)
  const playlists = useLibraryStore((s) => s.playlists)
  const tags = useLibraryStore((s) => s.tags)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const setImportProgress = useLibraryStore((s) => s.setImportProgress)
  const loadAll = useLibraryStore((s) => s.loadAll)
  const loadImages = useLibraryStore((s) => s.loadImages)

  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number }
    items: any[]
  } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, clickedId: string) => {
    e.preventDefault()
    
    const targets = selectedImageIds.has(clickedId)
      ? Array.from(selectedImageIds)
      : [clickedId]

    const menuItems: any[] = []

    // 1. Add to Collections
    if (collections.length > 0) {
      collections.forEach((col) => {
        menuItems.push({
          label: `📁 添加到图集: ${col.name}`,
          onClick: async () => {
            try {
              await window.api.addImagesToCollection(col.id, targets)
              loadAll()
            } catch (err) {
              console.error(err)
            }
          }
        })
      })
      menuItems.push({ divider: true })
    }

    // 2. Add to Playlists
    if (playlists.length > 0) {
      playlists.forEach((pl) => {
        menuItems.push({
          label: `🎬 添加到播放列表: ${pl.name}`,
          onClick: async () => {
            try {
              await window.api.addImagesToPlaylist(pl.id, targets)
              loadAll()
            } catch (err) {
              console.error(err)
            }
          }
        })
      })
      menuItems.push({ divider: true })
    }

    // 3. Add Tag
    if (tags.length > 0) {
      tags.forEach((tag) => {
        menuItems.push({
          label: `🏷️ 标记标签: ${tag.name}`,
          onClick: async () => {
            try {
              await window.api.addTagToImages(tag.id, targets)
              loadAll()
            } catch (err) {
              console.error(err)
            }
          }
        })
      })
      menuItems.push({ divider: true })
    }

    // 4. Delete
    menuItems.push({
      label: `🗑️ 从库中删除 (${targets.length} 张照片)`,
      onClick: async () => {
        if (confirm(`确定要从库中删除这 ${targets.length} 张照片吗？此操作不会删除您磁盘上的原图文件。`)) {
          try {
            for (const targetId of targets) {
              await window.api.deleteImage(targetId)
            }
            clearSelection()
            loadAll()
          } catch (err) {
            console.error(err)
          }
        }
      }
    })

    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      items: menuItems
    })
  }

  // Reload images when view, sort, or search changes (debounced to avoid duplicate/rapid loads)
  useEffect(() => {
    const handler = setTimeout(() => {
      loadImages()
    }, 150)
    return () => clearTimeout(handler)
  }, [currentView, currentViewId, sortBy, sortDir, searchQuery])

  const handleDroppedFiles = async (filePaths: string[]) => {
    // Filter out non-images
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic', '.heif']
    const validFiles = filePaths.filter((path) =>
      imageExtensions.some((ext) => path.toLowerCase().endsWith(ext))
    )

    if (validFiles.length === 0) return

    try {
      setImportProgress({ current: 0, total: validFiles.length, fileName: '准备导入拖拽的文件...' })
      await window.api.importFiles(validFiles)
    } catch (err) {
      console.error(err)
    }
  }

  const { isDragOver } = useDragDrop(containerRef, handleDroppedFiles)

  const handleImportClick = async () => {
    try {
      const folderPath = await window.api.openFolderDialog()
      if (folderPath) {
        setImportProgress({ current: 0, total: 100, fileName: '分析导入目录中...' })
        await window.api.importFolder(folderPath)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const renderLayout = () => {
    if (currentView === 'all') {
      if (orgMode === 'timeline') {
        return <TimelineLayout images={images} onContextMenu={handleContextMenu} />
      } else if (orgMode === 'folders') {
        return <FolderLayout onContextMenu={handleContextMenu} />
      } else if (orgMode === 'collections') {
        return <CollectionsOverview onContextMenu={handleContextMenu} />
      }
    }

    if (layoutStyle === 'masonry') {
      return <MasonryLayout images={images} onContextMenu={handleContextMenu} />
    }
    return <GridLayout images={images} onContextMenu={handleContextMenu} />
  }

  return (
    <div ref={containerRef} className="gallery-view">
      {images.length === 0 ? (
        <div className="gallery-view__empty">
          <span className="gallery-view__empty-icon">📷</span>
          <span className="gallery-view__empty-title">你的图库空空如也</span>
          <span className="gallery-view__empty-desc">
            拖拽文件夹/图片文件到这里，或点击下方按钮开始导入您的照片。
          </span>
          <button className="btn btn-primary" onClick={handleImportClick}>
            📥 导入文件夹
          </button>
        </div>
      ) : (
        renderLayout()
      )}

      {isDragOver && (
        <div className="gallery-view__drag-overlay">
          <span className="gallery-view__drag-icon">📥</span>
          <span className="gallery-view__drag-text">松开鼠标即可导入文件</span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
