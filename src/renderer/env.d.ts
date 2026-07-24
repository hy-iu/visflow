declare global {
  interface Window {
    api: {
      getImages: (filters?: any) => Promise<any[]>
      getImageById: (id: string) => Promise<any>
      updateImage: (id: string, data: any) => Promise<any>
      deleteImage: (id: string) => Promise<void>
      getCollections: () => Promise<any[]>
      createCollection: (data: any) => Promise<any>
      updateCollection: (id: string, data: any) => Promise<any>
      deleteCollection: (id: string) => Promise<void>
      addImagesToCollection: (cid: string, ids: string[]) => Promise<void>
      removeImagesFromCollection: (cid: string, ids: string[]) => Promise<void>
      getTags: () => Promise<any[]>
      createTag: (data: any) => Promise<any>
      updateTag: (id: string, data: any) => Promise<any>
      deleteTag: (id: string) => Promise<void>
      addTagToImages: (tid: string, ids: string[]) => Promise<void>
      removeTagFromImages: (tid: string, ids: string[]) => Promise<void>
      getPlaylists: () => Promise<any[]>
      getPlaylistById: (id: string) => Promise<any>
      createPlaylist: (data: any) => Promise<any>
      updatePlaylist: (id: string, data: any) => Promise<any>
      deletePlaylist: (id: string) => Promise<void>
      addImagesToPlaylist: (pid: string, ids: string[]) => Promise<void>
      removePlaylistItems: (pid: string, ids: string[]) => Promise<void>
      reorderPlaylistItems: (pid: string, ids: string[]) => Promise<void>
      getSmartGroups: () => Promise<any[]>
      createSmartGroup: (data: any) => Promise<any>
      updateSmartGroup: (id: string, data: any) => Promise<any>
      deleteSmartGroup: (id: string) => Promise<void>
      evaluateSmartGroup: (id: string) => Promise<any[]>
      openFolderDialog: () => Promise<string | null>
      importFolder: (path: string) => Promise<any>
      importFiles: (paths: string[]) => Promise<any>
      onImportProgress: (cb: (p: any) => void) => () => void
      // NSFW review
      nsfwScan: () => Promise<{ scanned: number; flagged: number }>
      nsfwCancelScan: () => Promise<{ success: boolean }>
      nsfwSetStatus: (imageId: string, status: 'safe' | 'nsfw') => Promise<{ success: boolean }>
      nsfwBatchSetStatus: (imageIds: string[], status: 'safe' | 'nsfw') => Promise<{ success: boolean }>
      nsfwGetPendingCount: () => Promise<{ pending: number }>
      nsfwGetCounts: () => Promise<{ safe: number; nsfw: number; pending: number; total: number }>
      nsfwClearResults: () => Promise<{ success: boolean }>
      onNsfwProgress: (cb: (p: any) => void) => () => void
    }
  }
}
export {}
