import React, { useState } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { buildCollectionTree } from '../../lib/utils'
import CollectionTree from '../organize/CollectionTree'
import PlaylistEditor from '../organize/PlaylistEditor'
import SmartGroupEditor from '../organize/SmartGroupEditor'
import Modal from '../common/Modal'
import './Sidebar.css'

export default function Sidebar() {
  const sidebarOpen = useViewStore((s) => s.sidebarOpen)
  const currentView = useViewStore((s) => s.currentView)
  const currentViewId = useViewStore((s) => s.currentViewId)
  const navigateTo = useViewStore((s) => s.navigateTo)
  const orgMode = useViewStore((s) => s.orgMode)
  const setOrgMode = useViewStore((s) => s.setOrgMode)


  const collections = useLibraryStore((s) => s.collections)
  const tags = useLibraryStore((s) => s.tags)
  const playlists = useLibraryStore((s) => s.playlists)
  const smartGroups = useLibraryStore((s) => s.smartGroups)
  const loadCollections = useLibraryStore((s) => s.loadCollections)
  const loadTags = useLibraryStore((s) => s.loadTags)
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists)
  const loadSmartGroups = useLibraryStore((s) => s.loadSmartGroups)

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collections: true,
    tags: true,
    playlists: true,
    smartGroups: true,
  })

  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean
    type: 'collection' | 'tag' | 'playlist' | 'smartGroup'
    title: string
    placeholder: string
  } | null>(null)
  const [modalInput, setModalInput] = useState('')

  const handleDeleteTag = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除此标签吗？这不会影响图片本身。')) return
    try {
      await window.api.deleteTag(id)
      loadTags()
      const viewStore = useViewStore.getState()
      if (viewStore.currentView === 'tag' && viewStore.currentViewId === id) {
        navigateTo('all')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除此播放列表吗？这不会影响图片本身。')) return
    try {
      await window.api.deletePlaylist(id)
      loadPlaylists()
      const viewStore = useViewStore.getState()
      if (viewStore.currentView === 'playlist' && viewStore.currentViewId === id) {
        navigateTo('all')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteSmartGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除此智能分组吗？这不会影响图片本身。')) return
    try {
      await window.api.deleteSmartGroup(id)
      loadSmartGroups()
      const viewStore = useViewStore.getState()
      if (viewStore.currentView === 'smartGroup' && viewStore.currentViewId === id) {
        navigateTo('all')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleCreateConfirm = async () => {
    if (!createModal || !modalInput.trim()) return
    const name = modalInput.trim()
    try {
      if (createModal.type === 'collection') {
        await window.api.createCollection({ name })
        loadCollections()
      } else if (createModal.type === 'tag') {
        await window.api.createTag({ name })
        loadTags()
      } else if (createModal.type === 'playlist') {
        await window.api.createPlaylist({ name })
        loadPlaylists()
      } else if (createModal.type === 'smartGroup') {
        await window.api.createSmartGroup({
          name,
          rules: { match: 'all', rules: [{ field: 'rating', operator: 'gte', value: 4 }] }
        })
        loadSmartGroups()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreateModal(null)
      setModalInput('')
    }
  }

  const handleCreateCollection = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCreateModal({
      isOpen: true,
      type: 'collection',
      title: '新建图集',
      placeholder: '请输入新图集的名称...'
    })
  }

  const handleCreateTag = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCreateModal({
      isOpen: true,
      type: 'tag',
      title: '新建标签',
      placeholder: '请输入新标签的名称...'
    })
  }

  const handleCreatePlaylist = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCreateModal({
      isOpen: true,
      type: 'playlist',
      title: '新建播放列表',
      placeholder: '请输入新播放列表的名称...'
    })
  }

  const handleCreateSmartGroup = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCreateModal({
      isOpen: true,
      type: 'smartGroup',
      title: '新建智能分组',
      placeholder: '请输入新智能分组的名称...'
    })
  }

  const collectionTree = buildCollectionTree(collections)

  return (
    <div className={`sidebar ${!sidebarOpen ? 'sidebar--hidden' : ''}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo gradient-text">VisFlow</div>
      </div>
      <div className="sidebar__content">
        {/* All Photos */}
        <div
          className={`sidebar__nav-item ${currentView === 'all' && orgMode === 'all' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => {
            navigateTo('all', null, '所有图片')
            setOrgMode('all')
          }}
        >
          <span className="sidebar__nav-icon">📷</span>
          <span className="sidebar__nav-label">所有图片</span>
        </div>

        {/* Timeline */}
        <div
          className={`sidebar__nav-item ${currentView === 'all' && orgMode === 'timeline' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => {
            navigateTo('all', null, '时间轴')
            setOrgMode('timeline')
          }}
        >
          <span className="sidebar__nav-icon">⫶</span>
          <span className="sidebar__nav-label">时间轴</span>
        </div>

        {/* Folders View */}
        <div
          className={`sidebar__nav-item ${currentView === 'all' && orgMode === 'folders' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => {
            navigateTo('all', null, '文件夹')
            setOrgMode('folders')
          }}
        >
          <span className="sidebar__nav-icon">📁</span>
          <span className="sidebar__nav-label">文件夹</span>
        </div>

        <div className="sidebar__divider" />

        {/* Collections */}
        <div className="sidebar__section">
          <div className="sidebar__section-header" onClick={() => toggleSection('collections')}>
            <span className="sidebar__section-title">
              <span className={`sidebar__section-arrow ${expandedSections.collections ? 'sidebar__section-arrow--expanded' : ''}`}>▸</span>
              文件夹/图集
            </span>
            <button className="sidebar__add-btn" onClick={handleCreateCollection}>+</button>
          </div>
          <div
            className={`sidebar__section-items ${!expandedSections.collections ? 'sidebar__section-items--collapsed' : ''}`}
            style={{ maxHeight: expandedSections.collections ? '300px' : '0px', overflowY: 'auto' }}
          >
            <CollectionTree nodes={collectionTree} />
          </div>
        </div>

        {/* Tags */}
        <div className="sidebar__section">
          <div className="sidebar__section-header" onClick={() => toggleSection('tags')}>
            <span className="sidebar__section-title">
              <span className={`sidebar__section-arrow ${expandedSections.tags ? 'sidebar__section-arrow--expanded' : ''}`}>▸</span>
              标签
            </span>
            <button className="sidebar__add-btn" onClick={handleCreateTag}>+</button>
          </div>
          <div
            className={`sidebar__section-items ${!expandedSections.tags ? 'sidebar__section-items--collapsed' : ''}`}
            style={{ maxHeight: expandedSections.tags ? '200px' : '0px', overflowY: 'auto' }}
          >
            {tags.map((tag) => {
              const isActive = currentView === 'tag' && currentViewId === tag.id
              return (
                <div
                  key={tag.id}
                  className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => navigateTo('tag', tag.id, tag.name)}
                >
                  <span className="sidebar__tag-dot" style={{ backgroundColor: tag.color || '#6366f1' }} />
                  <span className="sidebar__nav-label">{tag.name}</span>
                  {tag.imageCount > 0 && <span className="sidebar__nav-badge">{tag.imageCount}</span>}
                  <div className="sidebar__item-actions">
                    <button
                      className="sidebar__item-action-btn sidebar__item-action-btn--delete"
                      onClick={(e) => handleDeleteTag(tag.id, e)}
                      title="删除标签"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Playlists */}
        <div className="sidebar__section">
          <div className="sidebar__section-header" onClick={() => toggleSection('playlists')}>
            <span className="sidebar__section-title">
              <span className={`sidebar__section-arrow ${expandedSections.playlists ? 'sidebar__section-arrow--expanded' : ''}`}>▸</span>
              播放列表
            </span>
            <button className="sidebar__add-btn" onClick={handleCreatePlaylist}>+</button>
          </div>
          <div
            className={`sidebar__section-items ${!expandedSections.playlists ? 'sidebar__section-items--collapsed' : ''}`}
            style={{ maxHeight: expandedSections.playlists ? '200px' : '0px', overflowY: 'auto' }}
          >
            {playlists.map((pl) => {
              const isActive = currentView === 'playlist' && currentViewId === pl.id
              return (
                <div
                  key={pl.id}
                  className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => navigateTo('playlist', pl.id, pl.name)}
                >
                  <span className="sidebar__nav-icon">🎬</span>
                  <span className="sidebar__nav-label">{pl.name}</span>
                  <div className="sidebar__item-actions">
                    <button
                      className="sidebar__item-action-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingPlaylistId(pl.id)
                      }}
                      title="播放列表设置"
                    >
                      ⚙️
                    </button>
                    <button
                      className="sidebar__item-action-btn sidebar__item-action-btn--delete"
                      onClick={(e) => handleDeletePlaylist(pl.id, e)}
                      title="删除播放列表"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Smart Groups */}
        <div className="sidebar__section">
          <div className="sidebar__section-header" onClick={() => toggleSection('smartGroups')}>
            <span className="sidebar__section-title">
              <span className={`sidebar__section-arrow ${expandedSections.smartGroups ? 'sidebar__section-arrow--expanded' : ''}`}>▸</span>
              智能分组
            </span>
            <button className="sidebar__add-btn" onClick={handleCreateSmartGroup}>+</button>
          </div>
          <div
            className={`sidebar__section-items ${!expandedSections.smartGroups ? 'sidebar__section-items--collapsed' : ''}`}
            style={{ maxHeight: expandedSections.smartGroups ? '200px' : '0px', overflowY: 'auto' }}
          >
            {smartGroups.map((sg) => {
              const isActive = currentView === 'smartGroup' && currentViewId === sg.id
              return (
                <div
                  key={sg.id}
                  className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => navigateTo('smartGroup', sg.id, sg.name)}
                >
                  <span className="sidebar__nav-icon">🔍</span>
                  <span className="sidebar__nav-label">{sg.name}</span>
                  <div className="sidebar__item-actions">
                    <button
                      className="sidebar__item-action-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingGroupId(sg.id)
                      }}
                      title="配置智能规则"
                    >
                      ⚙️
                    </button>
                    <button
                      className="sidebar__item-action-btn sidebar__item-action-btn--delete"
                      onClick={(e) => handleDeleteSmartGroup(sg.id, e)}
                      title="删除智能分组"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Playlist Editor Dialog */}
      {editingPlaylistId && (
        <PlaylistEditor
          playlistId={editingPlaylistId}
          isOpen={!!editingPlaylistId}
          onClose={() => setEditingPlaylistId(null)}
        />
      )}

      {/* Smart Group Editor Dialog */}
      {editingGroupId !== null && (
        <SmartGroupEditor
          groupId={editingGroupId}
          isOpen={editingGroupId !== null}
          onClose={() => setEditingGroupId(null)}
        />
      )}

      {/* Create Modal Dialog */}
      {createModal && (
        <Modal
          isOpen={createModal.isOpen}
          onClose={() => {
            setCreateModal(null)
            setModalInput('')
          }}
          title={createModal.title}
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button
                className="btn"
                onClick={() => {
                  setCreateModal(null)
                  setModalInput('')
                }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateConfirm}
                disabled={!modalInput.trim()}
              >
                确定
              </button>
            </div>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <input
              type="text"
              className="collection-tree__rename-input"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px' }}
              placeholder={createModal.placeholder}
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && modalInput.trim()) {
                  handleCreateConfirm()
                } else if (e.key === 'Escape') {
                  setCreateModal(null)
                  setModalInput('')
                }
              }}
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
