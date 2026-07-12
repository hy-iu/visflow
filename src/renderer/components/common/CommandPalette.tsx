import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import './CommandPalette.css'

interface CommandAction {
  id: string
  label: string
  icon: string
  shortcut?: string
  perform: () => void
  category?: string
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleTheme = useViewStore((s) => s.toggleTheme)
  const setLayoutStyle = useViewStore((s) => s.setLayoutStyle)
  const setOrgMode = useViewStore((s) => s.setOrgMode)
  const navigateTo = useViewStore((s) => s.navigateTo)
  const loadAll = useLibraryStore((s) => s.loadAll)
  const setImportProgress = useLibraryStore((s) => s.setImportProgress)

  const handleImportFolder = async () => {
    try {
      const folderPath = await window.api.openFolderDialog()
      if (folderPath) {
        setImportProgress({ current: 0, total: 100, fileName: '正在准备导入...' })
        await window.api.importFolder(folderPath)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const commands: CommandAction[] = [
    { id: 'import', label: '导入图片文件夹', icon: '📥', shortcut: 'Ctrl+I', category: '文件', perform: handleImportFolder },
    { id: 'refresh', label: '刷新图库数据', icon: '🔄', category: '文件', perform: () => loadAll() },
    { id: 'theme', label: '切换暗色/亮色主题', icon: '🌓', category: '系统', perform: () => toggleTheme() },
    { id: 'layout-grid', label: '切换为网格排版', icon: '⊞', shortcut: 'G', category: '布局', perform: () => setLayoutStyle('grid') },
    { id: 'layout-masonry', label: '切换为瀑布流排版', icon: '▤', category: '布局', perform: () => setLayoutStyle('masonry') },
    { id: 'view-all', label: '查看所有图片', icon: '📷', category: '视图', perform: () => { navigateTo('all', null, '所有图片'); setOrgMode('all') } },
    { id: 'view-timeline', label: '查看时间轴', icon: '⫶', category: '视图', perform: () => { navigateTo('all', null, '时间轴'); setOrgMode('timeline') } },
    { id: 'view-folders', label: '查看文件夹视图', icon: '📁', category: '视图', perform: () => { navigateTo('all', null, '文件夹'); setOrgMode('folders') } },
  ]

  // Global listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
    };
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filter commands
  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category?.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Key navigation in palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].perform()
        setIsOpen(false)
      }
    }
  }

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="cmd-palette-backdrop" onClick={() => setIsOpen(false)}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmd-palette__input-wrap">
          <span className="cmd-palette__input-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette__input"
            placeholder="搜索命令或操作..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="cmd-palette__list">
          {filtered.length === 0 ? (
            <div className="cmd-palette__empty">未找到匹配的命令</div>
          ) : (
            filtered.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`cmd-palette__item ${index === selectedIndex ? 'cmd-palette__item--active' : ''}`}
                onClick={() => {
                  cmd.perform()
                  setIsOpen(false)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="cmd-palette__item-icon">{cmd.icon}</span>
                <span className="cmd-palette__item-label">{cmd.label}</span>
                {cmd.shortcut && <span className="cmd-palette__item-shortcut">{cmd.shortcut}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
