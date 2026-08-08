import React, { useState, useRef, useEffect } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import Modal from '../common/Modal'
import './Toolbar.css'

export default function Toolbar() {
  const sidebarOpen = useViewStore((s) => s.sidebarOpen)
  const toggleSidebar = useViewStore((s) => s.toggleSidebar)
  const currentViewName = useViewStore((s) => s.currentViewName)
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const setLayoutStyle = useViewStore((s) => s.setLayoutStyle)
  const orgMode = useViewStore((s) => s.orgMode)
  const foldersWrap = useViewStore((s) => s.foldersWrap)
  const toggleFoldersWrap = useViewStore((s) => s.toggleFoldersWrap)
  const foldersSortBy = useViewStore((s) => s.foldersSortBy)
  const setFoldersSortBy = useViewStore((s) => s.setFoldersSortBy)
  const foldersGroupBy = useViewStore((s) => s.foldersGroupBy)
  const setFoldersGroupBy = useViewStore((s) => s.setFoldersGroupBy)
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
  const nsfwFilter = useViewStore((s) => s.nsfwFilter)
  const setNsfwFilter = useViewStore((s) => s.setNsfwFilter)
  const nsfwScanning = useViewStore((s) => s.nsfwScanning)
  const setNsfwScanning = useViewStore((s) => s.setNsfwScanning)
  const nsfwScanProgress = useViewStore((s) => s.nsfwScanProgress)
  const setNsfwScanProgress = useViewStore((s) => s.setNsfwScanProgress)

  const loadImages = useLibraryStore((s) => s.loadImages)
  const setImportProgress = useLibraryStore((s) => s.setImportProgress)
  const currentView = useViewStore((s) => s.currentView)
  const currentViewId = useViewStore((s) => s.currentViewId)

  const [nsfwConfirm, setNsfwConfirm] = useState<'nsfw' | 'all' | null>(null)
  const [showNsfwMenu, setShowNsfwMenu] = useState(false)
  const [nsfwCounts, setNsfwCounts] = useState<{ safe: number; nsfw: number; pending: number; total: number } | null>(null)
  const [modelStatus, setModelStatus] = useState<{
    yoloInstalled: boolean
    yoloPath: string | null
    modelDir: string
    downloadUrl: string
  } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{
    phase: 'downloading' | 'done' | 'error'
    receivedBytes: number
    totalBytes: number
    percent: number
    error?: string
  } | null>(null)
  const nsfwMenuRef = useRef<HTMLDivElement>(null)

  // Close NSFW menu on outside click
  useEffect(() => {
    if (!showNsfwMenu) return
    const handleClick = (e: MouseEvent) => {
      if (nsfwMenuRef.current && !nsfwMenuRef.current.contains(e.target as Node)) {
        setShowNsfwMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNsfwMenu])

  // Fetch counts and model status when menu opens
  useEffect(() => {
    if (showNsfwMenu) {
      window.api.nsfwGetCounts().then(setNsfwCounts).catch(() => {})
      window.api.nsfwGetModelStatus().then(setModelStatus).catch(() => {})
    }
  }, [showNsfwMenu])

  // Download the YOLO model on demand, with live progress.
  const handleDownloadModels = async () => {
    setDownloading(true)
    setDownloadProgress({ phase: 'downloading', receivedBytes: 0, totalBytes: 0, percent: 0 })
    const cleanup = window.api.onNsfwDownloadProgress((p) => setDownloadProgress(p))
    try {
      const result = await window.api.nsfwDownloadModels()
      if (result.success) {
        const status = await window.api.nsfwGetModelStatus()
        setModelStatus(status)
      }
    } catch (err) {
      console.error('Model download error:', err)
    } finally {
      cleanup()
      setDownloading(false)
    }
  }

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

  const handleNsfwFilterChange = (target: 'safe' | 'nsfw' | 'all') => {
    setShowNsfwMenu(false)
    if (target === nsfwFilter) return
    if (target === 'nsfw' || target === 'all') {
      setNsfwConfirm(target)
    } else {
      setNsfwFilter(target)
      loadImages({ nsfwFilter: target })
    }
  }

  const confirmNsfwChange = () => {
    if (!nsfwConfirm) return
    setNsfwFilter(nsfwConfirm)
    loadImages({ nsfwFilter: nsfwConfirm })
    setNsfwConfirm(null)
  }

  const handleStartScan = async () => {
    setShowNsfwMenu(false)
    setNsfwScanning(true)
    setNsfwScanProgress({ current: 0, total: 0, fileName: '正在加载模型...', flagged: 0 })
    try {
      const cleanup = window.api.onNsfwProgress((p: any) => {
        setNsfwScanProgress(p)
      })
      await window.api.nsfwScan()
      cleanup()
    } catch (err) {
      console.error('NSFW scan error:', err)
    } finally {
      setNsfwScanning(false)
      setNsfwScanProgress(null)
      loadImages()
    }
  }

  const nsfwFilterLabel = nsfwFilter === 'safe' ? '✅ 已审查' : nsfwFilter === 'nsfw' ? '🚫 NSFW' : '👁 全部'

  return (
    <div className="toolbar-wrapper">
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
          className={`toolbar__layout-btn ${layoutStyle === 'grid' ? 'toolbar__layout-btn--active' : ''}`}
          title="网格排版"
          onClick={() => setLayoutStyle('grid')}
        >
          ⊞
        </button>
        <button
          className={`toolbar__layout-btn ${layoutStyle === 'masonry' ? 'toolbar__layout-btn--active' : ''}`}
          title="瀑布流排版"
          onClick={() => setLayoutStyle('masonry')}
        >
          ▤
        </button>

        {currentView === 'all' && orgMode === 'folders' && (
          <>
            <div className="toolbar__divider" />
            <button
              className="btn btn-secondary toolbar__wrap-btn"
              style={{ fontSize: 12, padding: '4px 8px', minWidth: 64, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={toggleFoldersWrap}
              title={foldersWrap ? '当前为折行平铺' : '当前为横滚单行'}
            >
              {foldersWrap ? '↵ 换行' : '➔ 横滚'}
            </button>
            <button
              className={`btn btn-secondary toolbar__wrap-btn ${foldersGroupBy === 'parent' ? 'toolbar__wrap-btn--active' : ''}`}
              style={{ fontSize: 12, padding: '4px 8px', minWidth: 64, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setFoldersGroupBy(foldersGroupBy === 'parent' ? 'flat' : 'parent')}
              title={foldersGroupBy === 'parent' ? '当前为目录树状展示，点击切回平铺' : '点击按目录树状展示'}
            >
              {foldersGroupBy === 'parent' ? '📂 树状' : '📁 平铺'}
            </button>
          </>
        )}

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

        {currentView === 'all' && orgMode === 'folders' && (
          <>
            <select
              className="toolbar__sort-select"
              value={foldersSortBy}
              onChange={(e: any) => setFoldersSortBy(e.target.value as any)}
              title="文件夹行排序"
              style={{ marginRight: 4 }}
            >
              <option value="name">📁 按文件夹名称</option>
              <option value="path">📁 按绝对路径</option>
              <option value="count">📁 按图片数量</option>
              <option value="importedAt">📁 按导入时间</option>
              <option value="createdAt">📁 按拍摄时间</option>
            </select>
          </>
        )}

        <select
          className="toolbar__sort-select"
          value={sortBy}
          onChange={(e: any) => setSortBy(e.target.value)}
          title="照片排序"
        >
          <option value="importedAt">导入时间</option>
          <option value="createdAt">拍摄时间</option>
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

        <div className="toolbar__nsfw-wrapper" ref={nsfwMenuRef}>
          <button
            className={`toolbar__nsfw-btn ${nsfwFilter !== 'safe' ? 'toolbar__nsfw-btn--active' : ''}`}
            onClick={() => setShowNsfwMenu(!showNsfwMenu)}
            title="内容审查筛选"
          >
            {nsfwFilterLabel}
          </button>
          {showNsfwMenu && (
            <div className="toolbar__nsfw-menu">
              <button
                className={`toolbar__nsfw-menu-item ${nsfwFilter === 'safe' ? 'toolbar__nsfw-menu-item--active' : ''}`}
                onClick={() => handleNsfwFilterChange('safe')}
              >
                ✅ 已审查
                <span className="toolbar__nsfw-menu-desc">{nsfwCounts ? `${nsfwCounts.safe} 张` : '隐藏 NSFW 图片'}</span>
              </button>
              <button
                className={`toolbar__nsfw-menu-item ${nsfwFilter === 'nsfw' ? 'toolbar__nsfw-menu-item--active' : ''}`}
                onClick={() => handleNsfwFilterChange('nsfw')}
              >
                🚫 仅 NSFW
                <span className="toolbar__nsfw-menu-desc">{nsfwCounts ? `${nsfwCounts.nsfw} 张` : '只看被隐藏的图片'}</span>
              </button>
              <button
                className={`toolbar__nsfw-menu-item ${nsfwFilter === 'all' ? 'toolbar__nsfw-menu-item--active' : ''}`}
                onClick={() => handleNsfwFilterChange('all')}
              >
                👁 全部
                <span className="toolbar__nsfw-menu-desc">{nsfwCounts ? `${nsfwCounts.total} 张（含 ${nsfwCounts.pending} 张未审查）` : '显示所有图片'}</span>
              </button>
              <div className="toolbar__nsfw-menu-divider" />
              <button
                className="toolbar__nsfw-menu-item"
                onClick={handleStartScan}
                disabled={nsfwScanning}
              >
                🔍 开始审查扫描
                <span className="toolbar__nsfw-menu-desc">
                  {nsfwScanning && nsfwScanProgress
                    ? `扫描中 ${nsfwScanProgress.current}/${nsfwScanProgress.total}`
                    : '检测未审查的图片'}
                </span>
              </button>
              <button
                className="toolbar__nsfw-menu-item"
                onClick={async () => {
                  setShowNsfwMenu(false)
                  if (confirm('确定要清除所有审查结果吗？所有图片将恢复为“未审查”状态。')) {
                    await window.api.nsfwClearResults()
                    loadImages()
                  }
                }}
                disabled={nsfwScanning}
              >
                🗑️ 清除审查结果
                <span className="toolbar__nsfw-menu-desc">重置所有图片为未审查</span>
              </button>
              <div className="toolbar__nsfw-menu-divider" />
              <div className="toolbar__nsfw-model">
                {modelStatus?.yoloInstalled ? (
                  <div className="toolbar__nsfw-model-status toolbar__nsfw-model-status--ok">
                    🟢 审查模型已就绪
                    <span className="toolbar__nsfw-menu-desc">NudeNet YOLO 检测模型已安装</span>
                  </div>
                ) : (
                  <>
                    <div className="toolbar__nsfw-model-status toolbar__nsfw-model-status--missing">
                      🟡 YOLO 模型未安装
                      <span className="toolbar__nsfw-menu-desc">
                        缺少 NudeNet 检测模型，审查精度会下降。可自动下载或手动放置。
                      </span>
                    </div>
                    {downloading && downloadProgress ? (
                      <div className="toolbar__nsfw-model-download">
                        {downloadProgress.phase === 'error' ? (
                          <>
                            <span className="toolbar__nsfw-model-error">下载失败：{downloadProgress.error}</span>
                            <div className="toolbar__nsfw-model-actions">
                              <button className="toolbar__nsfw-model-btn toolbar__nsfw-model-btn--primary" onClick={handleDownloadModels}>
                                🔄 重试下载
                              </button>
                              <button className="toolbar__nsfw-model-btn" onClick={() => window.api.nsfwOpenModelDir()}>
                                📂 打开模型目录
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="toolbar__nsfw-model-bar">
                              <div className="toolbar__nsfw-model-bar-fill" style={{ width: `${downloadProgress.percent}%` }} />
                            </div>
                            <span className="toolbar__nsfw-menu-desc">
                              正在下载模型 {downloadProgress.percent}%
                              {downloadProgress.totalBytes > 0
                                ? `（${Math.round(downloadProgress.receivedBytes / 1048576)}/${Math.round(downloadProgress.totalBytes / 1048576)} MB）`
                                : ''}
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="toolbar__nsfw-model-actions">
                        <button className="toolbar__nsfw-model-btn toolbar__nsfw-model-btn--primary" onClick={handleDownloadModels}>
                          ⬇️ 自动下载模型
                        </button>
                        <button className="toolbar__nsfw-model-btn" onClick={() => window.api.nsfwOpenModelDir()}>
                          📂 打开模型目录
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <button className="toolbar__import-btn" onClick={handleImportFolder}>
          📥 导入
        </button>
      </div>

      {/* NSFW filter confirmation modal */}
      {nsfwConfirm && (
        <Modal
          isOpen={!!nsfwConfirm}
          onClose={() => setNsfwConfirm(null)}
          title="内容审查提示"
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn" onClick={() => setNsfwConfirm(null)}>取消</button>
              <button className="btn btn-primary" onClick={confirmNsfwChange}>确认切换</button>
            </div>
          }
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {nsfwConfirm === 'nsfw'
              ? '您即将切换到「仅 NSFW」视图，将只显示被标记为 NSFW 的已隐藏图片。确定继续？'
              : '您即将切换到「全部」视图，将显示所有图片（包括 NSFW 内容）。确定继续？'}
          </p>
        </Modal>
      )}
    </div>

    {/* NSFW scan progress bar */}
    {nsfwScanning && nsfwScanProgress && (
      <div className="toolbar__scan-progress">
        <div className="toolbar__scan-progress-bar">
          <div
            className="toolbar__scan-progress-fill"
            style={{ width: nsfwScanProgress.total > 0 ? `${Math.round((nsfwScanProgress.current / nsfwScanProgress.total) * 100)}%` : '0%' }}
          />
        </div>
        <span className="toolbar__scan-progress-text">
          🔍 审查扫描中 {nsfwScanProgress.total > 0 ? `${nsfwScanProgress.current}/${nsfwScanProgress.total}` : ''}
          {nsfwScanProgress.fileName && nsfwScanProgress.fileName !== '完成' ? ` — ${nsfwScanProgress.fileName}` : ''}
          {nsfwScanProgress.flagged > 0 ? ` | 🚫 ${nsfwScanProgress.flagged}` : ''}
        </span>
        <button
          className="toolbar__scan-cancel-btn"
          onClick={() => window.api.nsfwCancelScan()}
          title="停止审查扫描"
        >
          ✕
        </button>
      </div>
    )}
    </div>
  )
}
