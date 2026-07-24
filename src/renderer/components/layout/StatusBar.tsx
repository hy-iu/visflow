import React from 'react'
import { useLibraryStore } from '../../stores/useLibraryStore'
import './StatusBar.css'

export default function StatusBar() {
  const images = useLibraryStore((s) => s.images)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const importProgress = useLibraryStore((s) => s.importProgress)

  const hasSelected = selectedImageIds.size > 0
  const isImporting = importProgress !== null

  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <span>共 {images.length} 张图片</span>
      </div>

      {isImporting && (
        <div className="statusbar__progress">
          <div className="statusbar__progress-bar">
            <div
              className="statusbar__progress-fill"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
          <span className="statusbar__progress-text truncate" title={importProgress.fileName}>
            正在导入 ({importProgress.current}/{importProgress.total}): {importProgress.fileName}
          </span>
        </div>
      )}

      <div className="statusbar__right">
        {hasSelected && (
          <>
            <span className="statusbar__selected">已选择 {selectedImageIds.size} 张图片</span>
            <button className="statusbar__deselect-btn" onClick={clearSelection} title="取消所有选择">
              ✕ 退出选择
            </button>
          </>
        )}
      </div>
    </div>
  )
}
