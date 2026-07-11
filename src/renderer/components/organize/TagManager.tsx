import React, { useState } from 'react'
import Modal from '../common/Modal'
import { useLibraryStore } from '../../stores/useLibraryStore'
import './TagManager.css'

interface TagManagerProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#6b7280', // Grey
]

export default function TagManager({ isOpen, onClose }: TagManagerProps) {
  const tags = useLibraryStore((s) => s.tags)
  const loadTags = useLibraryStore((s) => s.loadTags)
  
  const [tagName, setTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tagName.trim()) return
    try {
      await window.api.createTag({ name: tagName, color: selectedColor })
      setTagName('')
      loadTags()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTag = async (id: string) => {
    if (!confirm('确定要删除此标签吗？')) return
    try {
      await window.api.deleteTag(id)
      loadTags()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="标签管理">
      <div className="tag-manager">
        <div className="tag-manager__list">
          {tags.length === 0 ? (
            <div className="tag-manager__empty">无可用标签，请在下方创建</div>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className="tag-manager__item">
                <span className="tag-manager__color-dot" style={{ backgroundColor: tag.color }} />
                <span className="tag-manager__name">{tag.name}</span>
                <span className="tag-manager__count">{tag.imageCount || 0} 张</span>
                <button className="tag-manager__delete-btn" onClick={() => handleDeleteTag(tag.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleCreateTag} className="tag-manager__create-form">
          <span className="tag-manager__create-label">创建新标签</span>
          <div className="tag-manager__color-palette">
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                className={`tag-manager__color-swatch ${selectedColor === c ? 'tag-manager__color-swatch--selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setSelectedColor(c)}
              />
            ))}
          </div>
          <div className="tag-manager__create-row">
            <input
              type="text"
              className="input tag-manager__create-input"
              placeholder="标签名称..."
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">添加</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
