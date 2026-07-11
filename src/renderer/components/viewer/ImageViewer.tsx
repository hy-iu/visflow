import React, { useState, useEffect, useRef } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { formatFileSize, formatDateTime, getImageUrl } from '../../lib/utils'
import './ImageViewer.css'

export default function ImageViewer() {
  const viewerImageId = useViewStore((s) => s.viewerImageId)
  const closeViewer = useViewStore((s) => s.closeViewer)
  const infoPanelOpen = useViewStore((s) => s.infoPanelOpen)
  const toggleInfoPanel = useViewStore((s) => s.toggleInfoPanel)

  const images = useLibraryStore((s) => s.images)
  const loadImages = useLibraryStore((s) => s.loadImages)
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const idx = images.findIndex((img) => img.id === viewerImageId)
    if (idx !== -1) {
      setCurrentImageIndex(idx)
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
    }
  }, [viewerImageId, images])

  const image = images[currentImageIndex]
  if (!image) return null

  const handleNext = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex((prev) => prev + 1)
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
    }
  }

  const handlePrev = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1)
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentImageIndex, images])

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const nextScale = Math.min(Math.max(zoomScale * factor, 0.5), 10)
    setZoomScale(nextScale)
    if (nextScale === 1) {
      setPanOffset({ x: 0, y: 0 })
    }
  }

  // Dragging / Panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClicked = () => {
    if (zoomScale > 1) {
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
    } else {
      setZoomScale(2)
    }
  }

  const handleRatingChange = async (rating: number) => {
    try {
      await window.api.updateImage(image.id, { rating })
      loadImages() // Reload parent gallery
    } catch (err) {
      console.error(err)
    }
  }

  const handleColorChange = async (colorLabel: string | null) => {
    try {
      await window.api.updateImage(image.id, { colorLabel })
      loadImages()
    } catch (err) {
      console.error(err)
    }
  }

  const exif = image.exifJson ? JSON.parse(image.exifJson) : {}

  return (
    <div className="image-viewer">
      <div className="image-viewer__main">
        {/* Header */}
        <div className="image-viewer__header">
          <span className="image-viewer__filename truncate">{image.fileName}</span>
          <div className="image-viewer__header-actions">
            <button className="btn btn-ghost" onClick={toggleInfoPanel}>
              ℹ️ 元数据
            </button>
            <button className="btn btn-ghost" onClick={closeViewer}>✕ 关闭</button>
          </div>
        </div>

        {/* Canvas / Main image display */}
        <div
          className="image-viewer__canvas"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClicked}
          style={{ cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            ref={imgRef}
            className="image-viewer__img"
            src={getImageUrl(image.filePath)}
            alt={image.fileName}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`
            }}
          />

          {/* Navigation Buttons */}
          {currentImageIndex > 0 && (
            <button className="image-viewer__nav-btn image-viewer__nav-btn--prev" onClick={handlePrev}>
              ‹
            </button>
          )}
          {currentImageIndex < images.length - 1 && (
            <button className="image-viewer__nav-btn image-viewer__nav-btn--next" onClick={handleNext}>
              ›
            </button>
          )}
        </div>

        {/* Bottom controls */}
        <div className="image-viewer__bottom">
          {/* Rating */}
          <div className="image-viewer__rating">
            {[1, 2, 3, 4, 5].map((val) => (
              <span
                key={val}
                onClick={() => handleRatingChange(val)}
                style={{ opacity: (image.rating || 0) >= val ? 1 : 0.3 }}
              >
                ★
              </span>
            ))}
            <span
              onClick={() => handleRatingChange(0)}
              style={{ fontSize: '12px', marginLeft: '10px', verticalAlign: 'middle', opacity: 0.5 }}
            >
              清除
            </span>
          </div>

          {/* Colors */}
          <div className="image-viewer__colors">
            {['red', 'yellow', 'green', 'blue', 'purple'].map((c) => (
              <span
                key={c}
                className={`image-viewer__color-dot image-viewer__color-dot--active`}
                style={{
                  backgroundColor: c === 'red' ? '#ef4444' : c === 'yellow' ? '#f59e0b' : c === 'green' ? '#10b981' : c === 'blue' ? '#3b82f6' : '#8b5cf6',
                  opacity: image.colorLabel === c ? 1 : 0.3
                }}
                onClick={() => handleColorChange(image.colorLabel === c ? null : c)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Exif / Information Panel */}
      {infoPanelOpen && (
        <div className="image-viewer__sidebar">
          <div className="image-viewer__sidebar-section">
            <div className="image-viewer__sidebar-title">基本信息</div>
            <div className="image-viewer__exif-grid">
              <div className="image-viewer__exif-item">
                <span className="image-viewer__exif-label">大小</span>
                <span className="image-viewer__exif-value">{formatFileSize(image.fileSize || 0)}</span>
              </div>
              <div className="image-viewer__exif-item">
                <span className="image-viewer__exif-label">尺寸</span>
                <span className="image-viewer__exif-value">{image.width} × {image.height}</span>
              </div>
              <div className="image-viewer__exif-item">
                <span className="image-viewer__exif-label">格式</span>
                <span className="image-viewer__exif-value">{image.mimeType || '未知'}</span>
              </div>
              <div className="image-viewer__exif-item">
                <span className="image-viewer__exif-label">导入时间</span>
                <span className="image-viewer__exif-value">{formatDateTime(image.importedAt)}</span>
              </div>
            </div>
            <div className="image-viewer__exif-item" style={{ marginTop: '12px' }}>
              <span className="image-viewer__exif-label">路径</span>
              <span className="image-viewer__exif-value" style={{ wordBreak: 'break-all', fontSize: '11px' }}>
                {image.filePath}
              </span>
            </div>
          </div>

          <div className="image-viewer__sidebar-section">
            <div className="image-viewer__sidebar-title">相机与 EXIF 元数据</div>
            {Object.keys(exif).length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>无相机拍摄参数数据</div>
            ) : (
              <div className="image-viewer__exif-grid">
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">相机厂商</span>
                  <span className="image-viewer__exif-value">{exif.Make || exif.cameraMake || '-'}</span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">相机型号</span>
                  <span className="image-viewer__exif-value">{exif.Model || exif.cameraModel || '-'}</span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">光圈</span>
                  <span className="image-viewer__exif-value">
                    {exif.FNumber || exif.fNumber ? `f/${exif.FNumber || exif.fNumber}` : '-'}
                  </span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">快门速度</span>
                  <span className="image-viewer__exif-value">{exif.ExposureTime || exif.exposureTime ? `${exif.ExposureTime || exif.exposureTime}s` : '-'}</span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">ISO</span>
                  <span className="image-viewer__exif-value">{exif.ISO || exif.iso || '-'}</span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">焦距</span>
                  <span className="image-viewer__exif-value">
                    {exif.FocalLength || exif.focalLength ? `${exif.FocalLength || exif.focalLength}mm` : '-'}
                  </span>
                </div>
                <div className="image-viewer__exif-item">
                  <span className="image-viewer__exif-label">拍摄时间</span>
                  <span className="image-viewer__exif-value">
                    {exif.DateTimeOriginal || exif.dateTimeOriginal ? exif.DateTimeOriginal || exif.dateTimeOriginal : '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
