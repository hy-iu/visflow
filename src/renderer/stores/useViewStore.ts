import { create } from 'zustand'

type LayoutStyle = 'grid' | 'masonry'
type OrgMode = 'all' | 'timeline' | 'folders'
type SortBy = 'importedAt' | 'createdAt' | 'fileName' | 'rating' | 'fileSize'
type SortDir = 'asc' | 'desc'
type NavigationView = 'all' | 'collection' | 'tag' | 'playlist' | 'smartGroup'

interface ViewState {
  layoutStyle: LayoutStyle
  orgMode: OrgMode
  foldersWrap: boolean
  sortBy: SortBy
  sortDir: SortDir
  gridSize: number
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  infoPanelOpen: boolean
  currentView: NavigationView
  currentViewId: string | null
  currentViewName: string
  viewerOpen: boolean
  viewerImageId: string | null
  searchQuery: string

  setLayoutStyle: (style: LayoutStyle) => void
  setOrgMode: (mode: OrgMode) => void
  toggleFoldersWrap: () => void
  setSortBy: (sortBy: SortBy) => void
  toggleSortDir: () => void
  setGridSize: (size: number) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleInfoPanel: () => void
  navigateTo: (view: NavigationView, id?: string | null, name?: string) => void
  openViewer: (imageId: string) => void
  closeViewer: () => void
  setSearchQuery: (q: string) => void
}

const savedTheme = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('visflow-theme') as 'dark' | 'light'
  : null) || 'dark'

export const useViewStore = create<ViewState>((set) => ({
  layoutStyle: 'grid',
  orgMode: 'all',
  foldersWrap: false,
  sortBy: 'importedAt',
  sortDir: 'desc',
  gridSize: 2,
  theme: savedTheme,
  sidebarOpen: true,
  infoPanelOpen: false,
  currentView: 'all',
  currentViewId: null,
  currentViewName: '所有图片',
  viewerOpen: false,
  viewerImageId: null,
  searchQuery: '',

  setLayoutStyle: (layoutStyle) => set({ layoutStyle }),
  setOrgMode: (orgMode) => set({ orgMode }),
  toggleFoldersWrap: () => set((s) => ({ foldersWrap: !s.foldersWrap })),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
  setGridSize: (gridSize) => set({ gridSize: Math.min(3, Math.max(1, gridSize)) }),
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('visflow-theme', next)
    return { theme: next }
  }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleInfoPanel: () => set((s) => ({ infoPanelOpen: !s.infoPanelOpen })),
  navigateTo: (view, id = null, name = '') => set({
    currentView: view, currentViewId: id,
    currentViewName: name || (view === 'all' ? '所有图片' : '')
  }),
  openViewer: (imageId) => set({ viewerOpen: true, viewerImageId: imageId }),
  closeViewer: () => set({ viewerOpen: false, viewerImageId: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery })
}))
