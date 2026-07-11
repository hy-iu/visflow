import React, { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { getImageUrl } from '../../lib/utils'
import './PlaylistEditor.css'

interface PlaylistEditorProps {
  playlistId: string
  isOpen: boolean
  onClose: () => void
}

export default function PlaylistEditor({ playlistId, isOpen, onClose }: PlaylistEditorProps) {
  const [playlist, setPlaylist] = useState<any>(null)
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists)
  const startPlayback = usePlayerStore((s) => s.startPlayback)

  const fetchPlaylistDetails = async () => {
    try {
      const data = await window.api.getPlaylistById(playlistId)
      setPlaylist(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (isOpen && playlistId) {
      fetchPlaylistDetails()
    }
  }, [playlistId, isOpen])

  const handleUpdateSetting = async (key: string, value: any) => {
    if (!playlist) return
    try {
      await window.api.updatePlaylist(playlistId, { [key]: value })
      setPlaylist((prev: any) => ({ ...prev, [key]: value }))
      loadPlaylists()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!playlist) return
    try {
      await window.api.removePlaylistItems(playlistId, [itemId])
      fetchPlaylistDetails()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePlay = () => {
    if (!playlist || !playlist.items?.length) return
    const imageIds = playlist.items.map((item: any) => item.imageId)
    startPlayback(imageIds, {
      transition: playlist.transition,
      durationMs: playlist.durationMs,
      transitionMs: playlist.transitionMs,
      loop: playlist.loop === 1,
      shuffle: playlist.shuffle === 1,
    })
    onClose()
  }

  if (!playlist) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑播放列表: ${playlist.name}`}
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handlePlay} disabled={!playlist.items?.length}>
            ▶ 播放放映
          </button>
        </div>
      }
    >
      <div className="playlist-editor">
        <div className="playlist-editor__settings">
          <div className="playlist-editor__setting-row">
            <span className="playlist-editor__setting-label">过渡效果</span>
            <select
              className="select"
              value={playlist.transition}
              onChange={(e) => handleUpdateSetting('transition', e.target.value)}
            >
              <option value="fade">交叉渐变 (Fade)</option>
              <option value="slide">浮入/浮出 (Slide)</option>
              <option value="slide-h">水平滑动 (Slide Horizontal)</option>
              <option value="slide-v">竖直滑动 (Slide Vertical)</option>
              <option value="jump">跳变 (Jump)</option>
              <option value="masonry-v">竖直瀑布流滚动 (Masonry Vertical)</option>
              <option value="masonry-h">水平瀑布流滚动 (Masonry Horizontal)</option>
              <option value="organic">有机嵌合滚动 (Organic Nesting)</option>
              <option value="kenburns">电影 drift (Ken Burns)</option>
              <option value="zoom">聚焦缩放 (Zoom)</option>
            </select>
          </div>

          <div className="playlist-editor__setting-row">
            <span className="playlist-editor__setting-label">显示时长</span>
            <div className="playlist-editor__setting-control">
              <input
                type="range"
                min="1000"
                max="15000"
                step="500"
                className="playlist-editor__duration-slider"
                value={playlist.durationMs}
                onChange={(e) => handleUpdateSetting('durationMs', parseInt(e.target.value))}
              />
              <span className="playlist-editor__duration-value">{(playlist.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>

          <div className="playlist-editor__setting-row">
            <span className="playlist-editor__setting-label">循环播放</span>
            <div
              className={`playlist-editor__toggle ${playlist.loop === 1 ? 'playlist-editor__toggle--active' : ''}`}
              onClick={() => handleUpdateSetting('loop', playlist.loop === 1 ? 0 : 1)}
            >
              <div className="playlist-editor__toggle-thumb" />
            </div>
          </div>

          <div className="playlist-editor__setting-row">
            <span className="playlist-editor__setting-label">随机播放</span>
            <div
              className={`playlist-editor__toggle ${playlist.shuffle === 1 ? 'playlist-editor__toggle--active' : ''}`}
              onClick={() => handleUpdateSetting('shuffle', playlist.shuffle === 1 ? 0 : 1)}
            >
              <div className="playlist-editor__toggle-thumb" />
            </div>
          </div>
        </div>

        <div className="playlist-editor__items">
          {!playlist.items || playlist.items.length === 0 ? (
            <div className="playlist-editor__empty">播放列表为空。可在照片卡片右键菜单中添加。</div>
          ) : (
            playlist.items.map((item: any) => (
              <div key={item.id} className="playlist-editor__item">
                <img
                  className="playlist-editor__item-thumb"
                  src={`thumb://${item.imageId}`}
                  onError={(e) => {
                    if (item.image?.filePath) {
                      e.currentTarget.src = getImageUrl(item.image.filePath)
                    }
                  }}
                />
                <span className="playlist-editor__item-name">
                  {item.image?.fileName || '未知文件'}
                </span>
                <button className="playlist-editor__item-remove" onClick={() => handleRemoveItem(item.id)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
