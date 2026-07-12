import React, { useState, useEffect, useRef, useMemo } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import PlayerControls from './PlayerControls'
import { getImageUrl } from '../../lib/utils'
import './PlayerOverlay.css'

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export default function PlayerOverlay() {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const imageIds = usePlayerStore((s) => s.imageIds)
  const transition = usePlayerStore((s) => s.transition)
  const durationMs = usePlayerStore((s) => s.durationMs)
  const displayMode = usePlayerStore((s) => s.displayMode)
  const zoomScale = usePlayerStore((s) => s.zoomScale)
  const next = usePlayerStore((s) => s.next)
  const stopPlayback = usePlayerStore((s) => s.stopPlayback)

  const images = useLibraryStore((s) => s.images)

  // Calculate organic collage coordinates in main component body
  const organicLayoutItems = useMemo(() => {
    const canvasWidth = window.innerWidth
    const gap = 24 * zoomScale
    const placed: { x: number; y: number; w: number; h: number }[] = []
    
    // We allow overlap to pack them organically
    const overlapAllowance = 32 * zoomScale

    return imageIds.map((id) => {
      const img = images.find((i) => i.id === id)
      if (!img) return null
      
      const naturalW = img.width || 800
      const naturalH = img.height || 600
      
      const w = naturalW * zoomScale
      const h = naturalH * zoomScale

      const displayW = Math.min(w, canvasWidth - 32)
      const displayH = h * (displayW / w)

      const hash = hashString(id)
      const rotation = (hash % 8) - 4 // -4deg to +4deg
      const shiftX = (hashString(id + 'x') % (30 * zoomScale + 1)) - (15 * zoomScale)
      const shiftY = (hashString(id + 'y') % (30 * zoomScale + 1)) - (15 * zoomScale)

      const candidateY = [0, ...placed.map((r) => r.y + r.h + gap - overlapAllowance)].sort((a, b) => a - b)
      const candidateX = [0, ...placed.map((r) => r.x + r.w + gap - overlapAllowance)]
        .filter((x) => x + displayW <= canvasWidth)
        .sort((a, b) => a - b)

      let chosenX = 0
      let chosenY = 0
      let found = false
      let minScore = Infinity

      for (const y of candidateY) {
        if (y < 0) continue
        for (const x of candidateX) {
          if (x + displayW > canvasWidth) continue

          let overlap = false
          for (const r of placed) {
            const intersects = !(
              x + displayW - overlapAllowance <= r.x ||
              x + overlapAllowance >= r.x + r.w ||
              y + displayH - overlapAllowance <= r.y ||
              y + overlapAllowance >= r.y + r.h
            )
            if (intersects) {
              overlap = true
              break
            }
          }

          if (!overlap) {
            const score = y + x * 0.05
            if (score < minScore) {
              minScore = score
              chosenX = x
              chosenY = y
              found = true
            }
          }
        }
        if (found) break
      }

      if (!found) {
        chosenX = 0
        chosenY = placed.length > 0 ? Math.max(...placed.map((r) => r.y + r.h + gap)) : 0
      }

      const rect = { x: chosenX, y: chosenY, w: displayW, h: displayH }
      placed.push(rect)

      return {
        id,
        img,
        x: chosenX + shiftX,
        y: chosenY + shiftY,
        w: displayW,
        h: displayH,
        rotation
      }
    }).filter(Boolean) as any[]
  }, [imageIds, zoomScale, window.innerWidth, images])

  const organicTotalHeight = useMemo(() => {
    if (organicLayoutItems.length === 0) return 0
    return Math.max(...organicLayoutItems.map(item => item.y + item.h)) + 32 * zoomScale
  }, [organicLayoutItems, zoomScale])

  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({})
  const [recalc, setRecalc] = useState(0)

  const [scrollOffset, setScrollOffset] = useState(0)
  const scrollOffsetRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const subContainerRef = useRef<HTMLDivElement>(null)

  const triggerRecalc = () => setRecalc((r) => r + 1)

  // Find actual image records
  const currentImageId = imageIds[currentIndex]
  const currentImage = images.find((img) => img.id === currentImageId)

  // Clean up slide refs array size
  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, imageIds.length)
  }, [imageIds])

  // Slide auto advance (only in non-masonry/organic modes)
  useEffect(() => {
    const isMasonry = transition === 'masonry-v' || transition === 'masonry-h' || transition === 'organic'
    if (isMasonry || !isPlaying) return

    const timer = setInterval(() => {
      next()
    }, durationMs)
    return () => clearInterval(timer)
  }, [isPlaying, currentIndex, durationMs, next, transition])

  // Mouse move control visibility
  const handleMouseMove = () => {
    setControlsVisible(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, 3000)
  }

  useEffect(() => {
    handleMouseMove()
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [currentIndex])

  // Calculate sliding offsets to center the active image (only in track modes)
  useEffect(() => {
    const isTrackMode = transition === 'slide-h' || transition === 'slide-v' || transition === 'jump'
    if (!isTrackMode) return

    const updatePosition = () => {
      const activeSlide = slideRefs.current[currentIndex]
      const track = trackRef.current
      if (!activeSlide || !track) return

      const activeRect = activeSlide.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let transform = ''
      if (transition === 'slide-v') {
        const activeCenterY = activeSlide.offsetTop + activeRect.height / 2
        const offsetY = viewportHeight / 2 - activeCenterY
        transform = `translate3d(0, ${offsetY}px, 0)`
      } else {
        const activeCenterX = activeSlide.offsetLeft + activeRect.width / 2
        const offsetX = viewportWidth / 2 - activeCenterX
        transform = `translate3d(${offsetX}px, 0, 0)`
      }

      const isJump = transition === 'jump'
      setTransformStyle({
        transform,
        transition: isJump ? 'none' : 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      })
    }

    // Run positioning logic
    updatePosition()
    const timer = setTimeout(updatePosition, 50)

    window.addEventListener('resize', updatePosition)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
    }
  }, [currentIndex, transition, displayMode, recalc, imageIds, zoomScale])

  // Auto-scrolling Masonry requestAnimationFrame loop
  useEffect(() => {
    const isMasonry = transition === 'masonry-v' || transition === 'masonry-h' || transition === 'organic'
    if (!isMasonry || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const baseSpeed = 4000 / durationMs
    const speed = baseSpeed * 0.4 // Adjust scroll pace

    const scroll = () => {
      scrollOffsetRef.current += speed

      const subContainer = subContainerRef.current
      if (subContainer) {
        const subRect = subContainer.getBoundingClientRect()
        const loopThreshold = (transition === 'masonry-v' || transition === 'organic') ? subRect.height : subRect.width
        if (scrollOffsetRef.current >= loopThreshold && loopThreshold > 0) {
          scrollOffsetRef.current = scrollOffsetRef.current % loopThreshold
        }
      }

      setScrollOffset(scrollOffsetRef.current)
      animationFrameRef.current = requestAnimationFrame(scroll)
    }

    animationFrameRef.current = requestAnimationFrame(scroll)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying, transition, durationMs, recalc, imageIds, zoomScale])

  if (!currentImage && imageIds.length === 0) return null

  // Determine transition classes for standard overlay mode
  const getTransitionClass = () => {
    if (transition === 'slide') {
      return 'player-overlay__slide--slide-enter'
    } else if (transition === 'zoom') {
      return 'player-overlay__slide--zoom-enter'
    } else if (transition === 'kenburns') {
      return currentIndex % 2 === 0
        ? 'player-overlay__slide--kenburns-active'
        : 'player-overlay__slide--kenburns-active-alt'
    }
    return ''
  }

  // Render vertical masonry layout
  const renderVerticalMasonry = () => {
    const baseColWidth = 320
    const colsCount = Math.max(1, Math.floor(window.innerWidth / (baseColWidth * zoomScale)))
    const columns: string[][] = Array.from({ length: colsCount }, () => [])
    imageIds.forEach((id, idx) => {
      columns[idx % colsCount].push(id)
    })

    const renderGridContent = () => (
      <div
        className="player-overlay__masonry-grid player-overlay__masonry-grid--vertical"
        style={{
          display: 'flex',
          gap: `${16 * zoomScale}px`,
          padding: `${16 * zoomScale}px`,
          width: '100%'
        }}
      >
        {columns.map((colImageIds, colIdx) => (
          <div
            key={colIdx}
            className="player-overlay__masonry-col"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: `${16 * zoomScale}px`
            }}
          >
            {colImageIds.map((id) => {
              const img = images.find((i) => i.id === id)
              if (!img) return null
              return (
                <div key={id} className="player-overlay__masonry-item">
                  <img
                    className="player-overlay__masonry-img"
                    src={getImageUrl(img.filePath)}
                    alt=""
                    onLoad={triggerRecalc}
                    style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )

    return (
      <div className="player-overlay__masonry-wrapper player-overlay__masonry-wrapper--vertical">
        <div
          className="player-overlay__masonry-track"
          style={{ transform: `translate3d(0, -${scrollOffset}px, 0)` }}
        >
          <div ref={subContainerRef} className="player-overlay__masonry-sub">
            {renderGridContent()}
          </div>
          <div className="player-overlay__masonry-sub">
            {renderGridContent()}
          </div>
        </div>
      </div>
    )
  }

  // Render horizontal masonry layout
  const renderHorizontalMasonry = () => {
    const baseRowHeight = 320
    const rowsCount = Math.max(1, Math.floor(window.innerHeight / (baseRowHeight * zoomScale)))
    const rows: string[][] = Array.from({ length: rowsCount }, () => [])
    imageIds.forEach((id, idx) => {
      rows[idx % rowsCount].push(id)
    })

    const renderGridContent = () => (
      <div
        className="player-overlay__masonry-grid player-overlay__masonry-grid--horizontal"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${16 * zoomScale}px`,
          padding: `${16 * zoomScale}px`,
          height: '100%',
          justifyContent: 'center'
        }}
      >
        {rows.map((rowImageIds, rowIdx) => (
          <div
            key={rowIdx}
            className="player-overlay__masonry-row"
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: `${16 * zoomScale}px`,
              height: `${baseRowHeight * zoomScale}px`,
              flex: '0 0 auto'
            }}
          >
            {rowImageIds.map((id) => {
              const img = images.find((i) => i.id === id)
              if (!img) return null
              return (
                <div key={id} className="player-overlay__masonry-item" style={{ height: '100%', flexShrink: 0 }}>
                  <img
                    className="player-overlay__masonry-img"
                    src={getImageUrl(img.filePath)}
                    alt=""
                    onLoad={triggerRecalc}
                    style={{ height: '100%', width: 'auto', display: 'block', borderRadius: '8px', objectFit: 'contain' }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )

    return (
      <div className="player-overlay__masonry-wrapper player-overlay__masonry-wrapper--horizontal">
        <div
          className="player-overlay__masonry-track"
          style={{ transform: `translate3d(-${scrollOffset}px, 0, 0)` }}
        >
          <div ref={subContainerRef} className="player-overlay__masonry-sub">
            {renderGridContent()}
          </div>
          <div className="player-overlay__masonry-sub">
            {renderGridContent()}
          </div>
        </div>
      </div>
    )
  }

  // Render organic collage layout (2D packing)
  const renderOrganicLayout = () => {
    const renderGridContent = () => (
      <div
        className="player-overlay__organic-grid"
        style={{
          position: 'relative',
          width: '100%',
          height: `${organicTotalHeight}px`
        }}
      >
        {organicLayoutItems.map((item) => (
          <div
            key={item.id}
            className="player-overlay__masonry-item"
            style={{
              position: 'absolute',
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${item.w}px`,
              height: `${item.h}px`,
              transform: `rotate(${item.rotation}deg)`,
              border: '4px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
              background: '#0e0e11',
              borderRadius: '4px',
              transition: 'transform 0.2s ease'
            }}
          >
            <img
              className="player-overlay__masonry-img"
              src={getImageUrl(item.img.filePath)}
              alt=""
              onLoad={triggerRecalc}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'contain',
                borderRadius: '2px'
              }}
            />
          </div>
        ))}
      </div>
    )

    return (
      <div className="player-overlay__masonry-wrapper player-overlay__masonry-wrapper--vertical">
        <div
          className="player-overlay__masonry-track"
          style={{ transform: `translate3d(0, -${scrollOffset}px, 0)` }}
        >
          <div ref={subContainerRef} className="player-overlay__masonry-sub" style={{ height: `${organicTotalHeight}px` }}>
            {renderGridContent()}
          </div>
          <div className="player-overlay__masonry-sub" style={{ height: `${organicTotalHeight}px` }}>
            {renderGridContent()}
          </div>
        </div>
      </div>
    )
  }

  // Branch Rendering
  if (transition === 'masonry-v') {
    return (
      <div
        className="player-overlay"
        onMouseMove={handleMouseMove}
        onClick={handleMouseMove}
      >
        {renderVerticalMasonry()}
        <PlayerControls visible={controlsVisible} />
      </div>
    )
  }

  if (transition === 'masonry-h') {
    return (
      <div
        className="player-overlay"
        onMouseMove={handleMouseMove}
        onClick={handleMouseMove}
      >
        {renderHorizontalMasonry()}
        <PlayerControls visible={controlsVisible} />
      </div>
    )
  }

  if (transition === 'organic') {
    return (
      <div
        className="player-overlay"
        onMouseMove={handleMouseMove}
        onClick={handleMouseMove}
      >
        {renderOrganicLayout()}
        <PlayerControls visible={controlsVisible} />
      </div>
    )
  }

  const isTrackMode = transition === 'slide-h' || transition === 'slide-v' || transition === 'jump'

  if (isTrackMode) {
    return (
      <div
        className="player-overlay"
        onMouseMove={handleMouseMove}
        onClick={handleMouseMove}
      >
        <div className="player-overlay__viewport player-overlay__viewport--track">
          <div
            ref={trackRef}
            className={`player-overlay__track player-overlay__track--${transition === 'slide-v' ? 'vertical' : 'horizontal'}`}
            style={transformStyle}
          >
            {imageIds.map((id, index) => {
              const img = images.find((i) => i.id === id)
              if (!img) return null
              const isActive = index === currentIndex

              return (
                <div
                  key={id}
                  ref={(el) => { slideRefs.current[index] = el }}
                  className={`player-overlay__slide player-overlay__slide--track-item ${
                    isActive ? 'player-overlay__slide--active' : ''
                  }`}
                >
                  <img
                    className={`player-overlay__img player-overlay__img--${displayMode}`}
                    src={getImageUrl(img.filePath)}
                    alt=""
                    onLoad={triggerRecalc}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <PlayerControls visible={controlsVisible} />
      </div>
    )
  }

  // Fallback to absolute overlay transitions
  return (
    <div
      className="player-overlay"
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
    >
      <div className="player-overlay__viewport">
        {imageIds.map((id, index) => {
          const img = images.find((i) => i.id === id)
          if (!img) return null
          const isActive = index === currentIndex
          const isPrev = index === (currentIndex - 1 + imageIds.length) % imageIds.length

          return (
            <div
              key={id}
              className={`player-overlay__slide ${isActive ? 'player-overlay__slide--active' : ''} ${
                isActive ? getTransitionClass() : ''
              }`}
              style={{
                display: isActive || isPrev ? 'flex' : 'none',
                transition: transition === 'fade' ? 'opacity 0.4s ease-in-out' : 'none',
              }}
            >
              <img
                className={`player-overlay__img player-overlay__img--${displayMode}`}
                src={getImageUrl(img.filePath)}
                alt=""
              />
            </div>
          )
        })}
      </div>

      <PlayerControls visible={controlsVisible} />
    </div>
  )
}
