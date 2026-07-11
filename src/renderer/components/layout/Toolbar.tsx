import React from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import './Toolbar.css'

export default function Toolbar() {
  const sidebarOpen = useViewStore((s) => s.sidebarOpen)
  const toggleSidebar = useViewStore((s) => s.toggleSidebar)
  const currentViewName = useViewStore((s) => s.currentViewName)
  const layout = useViewStore((s) => s.layout)
  const setLayout = useViewStore((s) => s.setLayout)
  const gridSize = useViewStore((s) => s.gridSize)
  const setGridSize = useViewStore((s) => s.setGridSize)
  const sortBy = useViewStore((s) => s.sortBy)
  const setSortBy = useViewStore((s) => s.setSortBy)
  const sortDir = useViewStore((s) => s.sortDir)
  const toggleSortDir = useViewStore((s) => s.toggleSortDir)
  const theme = useViewStore((s) => s.theme)
  const toggleTheme = useViewStore((s) => s.toggleTheme)
  const searchQuery = useViewStore((s) => s.searchQuery)
  const setSearchQuery = useViewStore((s) => s.setSearchQuery)

  const loadImages = useLibraryStore((s) => s.loadImages)
  const setImportProgress = useLibraryStore((s) => s.setImportProgress)
  const currentView = useViewStore((s) => s.currentView)
  const currentViewId = useViewStore((s) => s.currentViewId)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setSearchQuery(e.target.value)
   }

  const handleImportFolder = async () => {
    try {
      const folderPath = await window.api.openFolderDialog()
      if (folderPath) {
        setImportProgress({ current: 0, total: 100, fileName: '正在分析文件夹...' })
        await window.api.importFolder(folderPath)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar__left">
        <button className="toolbar__menu-btn" onClick={toggleSidebar}>
          {sidebarOpen ? '⇥' : '☰'}
        </button>
        <span className="toolbar__title">{currentViewName}</span>
      </div>

      <div className="toolbar__search">
        <span className="toolbar__search-icon">🔍</span>
        <input
          type="text"
          className="toolbar__search-input"
          placeholder="搜索图片文件名..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      <div className="toolbar__actions">
        <button
          className={`toolbar__layout-btn ${layout === 'grid' ? 'toolbar__layout-btn--active' : ''}`}
          title="网格布局"
          onClick={() => setLayout('grid')}
        >
          ⊞
        </button>
        <button
          className={`toolbar__layout-btn ${layout === 'masonry' ? 'toolbar__layout-btn--active' : ''}`}
          title="瀑布流布局"
          onClick={() => setLayout('masonry')}
        >
          ▤
        </button>
        <button
          className={`toolbar__layout-btn ${layout === 'timeline' ? 'toolbar__layout-btn--active' : ''}`}
          title="时间轴布局"
          onClick={() => setLayout('timeline')}
        >
          ⫶
        </button>

        <div className="toolbar__divider" />

        <input
          type="range"
          min="1"
          max="3"
          className="toolbar__grid-slider"
          value={gridSize}
          onChange={(e) => setGridSize(parseInt(e.target.value))}
          title="网格尺寸"
        />

        <div className="toolbar__divider" />

        <select
          className="toolbar__sort-select"
          value={sortBy}
          onChange={(e: any) => setSortBy(e.target.value)}
        >
          <option value="importedAt">导入时间</option>
          <option value="createdAt">创建时间</option>
          <option value="fileName">文件名</option>
          <option value="rating">评分</option>
          <option value="fileSize">文件大小</option>
        </select>

        <button className="toolbar__sort-dir-btn" onClick={toggleSortDir}>
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        <div className="toolbar__divider" />

        <button className="toolbar__theme-btn" onClick={toggleTheme}>
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        <button className="toolbar__import-btn" onClick={handleImportFolder}>
          📥 导入
        </button>
      </div>
    </div>
  )
}
