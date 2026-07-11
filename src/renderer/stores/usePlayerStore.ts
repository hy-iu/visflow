import { create } from 'zustand'

type TransitionType = 'fade' | 'slide' | 'kenburns' | 'zoom' | 'slide-h' | 'slide-v' | 'jump' | 'masonry-v' | 'masonry-h' | 'organic'

interface PlayerState {
  isPlaying: boolean
  isActive: boolean
  currentIndex: number
  imageIds: string[]
  transition: TransitionType
  durationMs: number
  transitionMs: number
  loop: boolean
  shuffle: boolean
  showControls: boolean
  displayMode: 'fit' | 'original'
  zoomScale: number

  startPlayback: (imageIds: string[], options?: Partial<{
    transition: TransitionType
    durationMs: number
    transitionMs: number
    loop: boolean
    shuffle: boolean
    startIndex: number
  }>) => void
  stopPlayback: () => void
  togglePlayPause: () => void
  next: () => void
  previous: () => void
  goToIndex: (index: number) => void
  setTransition: (t: TransitionType) => void
  setDuration: (ms: number) => void
  setLoop: (loop: boolean) => void
  setShuffle: (shuffle: boolean) => void
  setShowControls: (show: boolean) => void
  setDisplayMode: (mode: 'fit' | 'original') => void
  setZoomScale: (scale: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  isActive: false,
  currentIndex: 0,
  imageIds: [],
  transition: 'fade',
  durationMs: 5000,
  transitionMs: 400,
  loop: true,
  shuffle: false,
  showControls: true,
  displayMode: 'fit',
  zoomScale: 1.0,

  startPlayback: (imageIds, options = {}) => {
    let ids = [...imageIds]
    if (options.shuffle) {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]]
      }
    }
    set({
      isActive: true,
      isPlaying: true,
      imageIds: ids,
      currentIndex: options.startIndex || 0,
      ...(options.transition && { transition: options.transition }),
      ...(options.durationMs && { durationMs: options.durationMs }),
      ...(options.transitionMs && { transitionMs: options.transitionMs }),
      ...(options.loop !== undefined && { loop: options.loop }),
      ...(options.shuffle !== undefined && { shuffle: options.shuffle })
    })
  },
  stopPlayback: () => set({ isActive: false, isPlaying: false, currentIndex: 0, imageIds: [] }),
  togglePlayPause: () => set((s) => ({ isPlaying: !s.isPlaying })),
  next: () => {
    const s = get()
    const next = s.currentIndex + 1
    if (next >= s.imageIds.length) {
      if (s.loop) set({ currentIndex: 0 })
      else set({ isPlaying: false })
    } else {
      set({ currentIndex: next })
    }
  },
  previous: () => set((s) => ({
    currentIndex: s.currentIndex > 0 ? s.currentIndex - 1 : s.imageIds.length - 1
  })),
  goToIndex: (index) => set({ currentIndex: index }),
  setTransition: (transition) => set({ transition }),
  setDuration: (durationMs) => set({ durationMs }),
  setLoop: (loop) => set({ loop }),
  setShuffle: (shuffle) => set({ shuffle }),
  setShowControls: (showControls) => set({ showControls }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setZoomScale: (zoomScale) => set({ zoomScale })
}))
