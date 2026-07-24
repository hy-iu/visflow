import { create } from 'zustand'

interface ImportProgress {
  current: number
  total: number
  fileName: string
}

interface LibraryState {
  images: any[]
  collections: any[]
  tags: any[]
  playlists: any[]
  smartGroups: any[]
  selectedImageIds: Set<string>
  isLoading: boolean
  importProgress: ImportProgress | null

  loadImages: (filters?: any) => Promise<void>
  loadCollections: () => Promise<void>
  loadTags: () => Promise<void>
  loadPlaylists: () => Promise<void>
  loadSmartGroups: () => Promise<void>
  loadAll: () => Promise<void>
  selectImage: (id: string, multi?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  toggleSelection: (id: string) => void
  setImportProgress: (p: ImportProgress | null) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  images: [],
  collections: [],
  tags: [],
  playlists: [],
  smartGroups: [],
  selectedImageIds: new Set(),
  isLoading: false,
  importProgress: null,

  loadImages: async (filters) => {
    set({ isLoading: true })
    try {
      const viewStore = (await import('./useViewStore')).useViewStore.getState()
      const currentView = filters?.view || viewStore.currentView
      const currentViewId = filters?.viewId !== undefined ? filters.viewId : viewStore.currentViewId
      const sortBy = filters?.sortBy || viewStore.sortBy
      const sortDir = filters?.sortDir || viewStore.sortDir
      const search = filters?.search !== undefined ? filters.search : viewStore.searchQuery
      const nsfwFilter = filters?.nsfwFilter !== undefined ? filters.nsfwFilter : viewStore.nsfwFilter

      let imgs: any[] = []
      if (currentView === 'all') {
        imgs = await window.api.getImages({ sortBy, sortDir, search, nsfwFilter })
      } else if (currentView === 'collection') {
        imgs = await window.api.getImages({ collectionId: currentViewId || undefined, sortBy, sortDir, search, nsfwFilter })
      } else if (currentView === 'tag') {
        imgs = await window.api.getImages({ tagIds: currentViewId ? [currentViewId] : undefined, sortBy, sortDir, search, nsfwFilter })
      } else if (currentView === 'playlist') {
        if (currentViewId) {
          const playlist = await window.api.getPlaylistById(currentViewId)
          if (playlist && playlist.items) {
            let items = playlist.items.map((item: any) => item.image).filter(Boolean)
            if (search) {
              items = items.filter((img: any) => img.fileName?.toLowerCase().includes(search.toLowerCase()))
            }
            if (sortBy && sortBy !== 'importedAt') {
              items.sort((a: any, b: any) => {
                const valA = a[sortBy]
                const valB = b[sortBy]
                if (typeof valA === 'string') {
                  return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
                }
                return sortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0)
              })
            }
            imgs = items
          }
        }
      } else if (currentView === 'smartGroup') {
        if (currentViewId) {
          imgs = await window.api.evaluateSmartGroup(currentViewId)
          if (search) {
            imgs = imgs.filter((img: any) => img.fileName?.toLowerCase().includes(search.toLowerCase()))
          }
        }
      }
      set({ images: imgs })
    } catch (err) {
      console.error('Failed to load images:', err)
    } finally {
      set({ isLoading: false })
    }
  },
  loadCollections: async () => {
    try {
      const cols = await window.api.getCollections()
      set({ collections: cols })
    } catch (err) {
      console.error('Failed to load collections:', err)
    }
  },
  loadTags: async () => {
    try {
      const t = await window.api.getTags()
      set({ tags: t })
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  },
  loadPlaylists: async () => {
    try {
      const p = await window.api.getPlaylists()
      set({ playlists: p })
    } catch (err) {
      console.error('Failed to load playlists:', err)
    }
  },
  loadSmartGroups: async () => {
    try {
      const sg = await window.api.getSmartGroups()
      set({ smartGroups: sg })
    } catch (err) {
      console.error('Failed to load smart groups:', err)
    }
  },
  loadAll: async () => {
    set({ isLoading: true })
    try {
      await Promise.all([
        get().loadImages(),
        get().loadCollections(),
        get().loadTags(),
        get().loadPlaylists(),
        get().loadSmartGroups()
      ])
    } finally {
      set({ isLoading: false })
    }
  },
  selectImage: (id, multi = false) => {
    set((state) => {
      const next = multi ? new Set(state.selectedImageIds) : new Set<string>()
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedImageIds: next }
    })
  },
  selectAll: () => {
    set((state) => ({
      selectedImageIds: new Set(state.images.map((i: any) => i.id))
    }))
  },
  clearSelection: () => set({ selectedImageIds: new Set() }),
  toggleSelection: (id) => {
    set((state) => {
      const next = new Set(state.selectedImageIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedImageIds: next }
    })
  },
  setImportProgress: (p) => set({ importProgress: p })
}))
