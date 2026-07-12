import React, { useEffect } from 'react'
import { useViewStore } from './stores/useViewStore'
import { useLibraryStore } from './stores/useLibraryStore'
import { usePlayerStore } from './stores/usePlayerStore'
import Sidebar from './components/layout/Sidebar'
import Toolbar from './components/layout/Toolbar'
import StatusBar from './components/layout/StatusBar'
import GalleryView from './components/gallery/GalleryView'
import ImageViewer from './components/viewer/ImageViewer'
import PlayerOverlay from './components/player/PlayerOverlay'
import CommandPalette from './components/common/CommandPalette'
import './App.css'

export default function App() {
  const theme = useViewStore((s) => s.theme)
  const viewerOpen = useViewStore((s) => s.viewerOpen)
  const playerActive = usePlayerStore((s) => s.isActive)
  const loadAll = useLibraryStore((s) => s.loadAll)
  const setImportProgress = useLibraryStore((s) => s.setImportProgress)

  // Apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Load data on mount
  useEffect(() => {
    loadAll()
  }, [])

  // Listen for import progress
  useEffect(() => {
    const cleanup = window.api.onImportProgress((progress) => {
      setImportProgress(progress)
      if (progress.current >= progress.total) {
        setTimeout(() => {
          setImportProgress(null)
          loadAll()
        }, 500)
      }
    })
    return cleanup
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const playerStore = usePlayerStore.getState()
      const viewStore = useViewStore.getState()

      // Player shortcuts
      if (playerStore.isActive) {
        if (e.key === 'Escape') { playerStore.stopPlayback(); e.preventDefault() }
        else if (e.key === ' ') { playerStore.togglePlayPause(); e.preventDefault() }
        else if (e.key === 'ArrowRight') { playerStore.next(); e.preventDefault() }
        else if (e.key === 'ArrowLeft') { playerStore.previous(); e.preventDefault() }
        return
      }

      // Viewer shortcuts
      if (viewStore.viewerOpen) {
        if (e.key === 'Escape') { viewStore.closeViewer(); e.preventDefault() }
        else if (e.key === 'i' || e.key === 'I') { viewStore.toggleInfoPanel(); e.preventDefault() }
        return
      }

      // Gallery shortcuts
      if (e.key === 'g' || e.key === 'G') { viewStore.setLayoutStyle('grid') }
      else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen()
        else document.exitFullscreen()
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        // Command palette handled by its own component
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Toolbar />
        <div className="gallery-container">
          <GalleryView />
        </div>
        <StatusBar />
      </div>

      {viewerOpen && <ImageViewer />}
      {playerActive && <PlayerOverlay />}
      <CommandPalette />
    </div>
  )
}
