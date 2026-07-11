import React from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import './PlayerControls.css'

interface PlayerControlsProps {
  visible: boolean
}

export default function PlayerControls({ visible }: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const imageIds = usePlayerStore((s) => s.imageIds)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const stopPlayback = usePlayerStore((s) => s.stopPlayback)
  
  const transition = usePlayerStore((s) => s.transition)
  const setTransition = usePlayerStore((s) => s.setTransition)
  const durationMs = usePlayerStore((s) => s.durationMs)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const loop = usePlayerStore((s) => s.loop)
  const setLoop = usePlayerStore((s) => s.setLoop)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const setShuffle = usePlayerStore((s) => s.setShuffle)
  const displayMode = usePlayerStore((s) => s.displayMode)
  const setDisplayMode = usePlayerStore((s) => s.setDisplayMode)
  const zoomScale = usePlayerStore((s) => s.zoomScale)
  const setZoomScale = usePlayerStore((s) => s.setZoomScale)

  return (
    <div className={`player-controls ${!visible ? 'player-controls--hidden' : ''}`}>
      <div className="player-controls__group">
        <button className="player-controls__btn" onClick={previous} title="上一张 (←)">
          ⏮
        </button>
        <button
          className="player-controls__btn player-controls__play-btn"
          onClick={togglePlayPause}
          title={isPlaying ? '暂停 (空格)' : '播放 (空格)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="player-controls__btn" onClick={next} title="下一张 (→)">
          ⏭
        </button>
      </div>

      <div className="player-controls__divider" />

      <span className="player-controls__info">
        {currentIndex + 1} / {imageIds.length}
      </span>

      <div className="player-controls__divider" />

      <div className="player-controls__group">
        <select
          className="player-controls__select"
          value={transition}
          onChange={(e: any) => setTransition(e.target.value)}
          title="过渡效果"
        >
          <option value="fade">渐变</option>
          <option value="slide">浮入/浮出</option>
          <option value="slide-h">水平滑动</option>
          <option value="slide-v">竖直滑动</option>
          <option value="jump">跳变</option>
          <option value="masonry-v">竖直瀑布流滚动</option>
          <option value="masonry-h">水平瀑布流滚动</option>
          <option value="organic">有机嵌合滚动</option>
          <option value="kenburns">电影</option>
          <option value="zoom">缩放</option>
        </select>

        {!(transition === 'masonry-v' || transition === 'masonry-h' || transition === 'organic') ? (
          <select
            className="player-controls__select"
            value={displayMode}
            onChange={(e: any) => setDisplayMode(e.target.value)}
            title="图片大小"
          >
            <option value="fit">适应屏幕</option>
            <option value="original">原始大小</option>
          </select>
        ) : (
          <select
            className="player-controls__select"
            value={zoomScale.toString()}
            onChange={(e: any) => setZoomScale(parseFloat(e.target.value))}
            title="瀑布流缩放"
          >
            <option value="0.5">0.5x 缩放</option>
            <option value="0.75">0.75x 缩放</option>
            <option value="1">1.0x 原始大小</option>
            <option value="1.25">1.25x 放大</option>
            <option value="1.5">1.5x 放大</option>
            <option value="2">2.0x 放大</option>
          </select>
        )}

        <select
          className="player-controls__select"
          value={durationMs}
          onChange={(e: any) => setDuration(parseInt(e.target.value))}
          title="停留时间"
        >
          <option value="2000">2 秒</option>
          <option value="3000">3 秒</option>
          <option value="5000">5 秒</option>
          <option value="8000">8 秒</option>
          <option value="10000">10 秒</option>
        </select>
      </div>

      <div className="player-controls__divider" />

      <div className="player-controls__group">
        <button
          className={`player-controls__btn ${loop ? 'player-controls__btn--active' : ''}`}
          onClick={() => setLoop(!loop)}
          title="循环播放"
        >
          🔁
        </button>
        <button
          className={`player-controls__btn ${shuffle ? 'player-controls__btn--active' : ''}`}
          onClick={() => setShuffle(!shuffle)}
          title="随机播放"
        >
          🔀
        </button>
      </div>

      <div className="player-controls__divider" />

      <button className="player-controls__btn" onClick={stopPlayback} title="退出 (Esc)">
        ✕
      </button>
    </div>
  )
}
