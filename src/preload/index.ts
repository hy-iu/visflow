import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getImages: (filters?: any) => ipcRenderer.invoke('images:getAll', filters),
  getImageById: (id: string) => ipcRenderer.invoke('images:getById', id),
  updateImage: (id: string, data: any) => ipcRenderer.invoke('images:update', id, data),
  deleteImage: (id: string) => ipcRenderer.invoke('images:delete', id),
  getCollections: () => ipcRenderer.invoke('collections:getAll'),
  createCollection: (data: any) => ipcRenderer.invoke('collections:create', data),
  updateCollection: (id: string, data: any) => ipcRenderer.invoke('collections:update', id, data),
  deleteCollection: (id: string) => ipcRenderer.invoke('collections:delete', id),
  addImagesToCollection: (cid: string, ids: string[]) => ipcRenderer.invoke('collections:addImages', cid, ids),
  removeImagesFromCollection: (cid: string, ids: string[]) => ipcRenderer.invoke('collections:removeImages', cid, ids),
  getTags: () => ipcRenderer.invoke('tags:getAll'),
  createTag: (data: any) => ipcRenderer.invoke('tags:create', data),
  updateTag: (id: string, data: any) => ipcRenderer.invoke('tags:update', id, data),
  deleteTag: (id: string) => ipcRenderer.invoke('tags:delete', id),
  addTagToImages: (tid: string, ids: string[]) => ipcRenderer.invoke('tags:addToImages', tid, ids),
  removeTagFromImages: (tid: string, ids: string[]) => ipcRenderer.invoke('tags:removeFromImages', tid, ids),
  getPlaylists: () => ipcRenderer.invoke('playlists:getAll'),
  getPlaylistById: (id: string) => ipcRenderer.invoke('playlists:getById', id),
  createPlaylist: (data: any) => ipcRenderer.invoke('playlists:create', data),
  updatePlaylist: (id: string, data: any) => ipcRenderer.invoke('playlists:update', id, data),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlists:delete', id),
  addImagesToPlaylist: (pid: string, ids: string[]) => ipcRenderer.invoke('playlists:addImages', pid, ids),
  removePlaylistItems: (pid: string, ids: string[]) => ipcRenderer.invoke('playlists:removeItems', pid, ids),
  reorderPlaylistItems: (pid: string, ids: string[]) => ipcRenderer.invoke('playlists:reorder', pid, ids),
  getSmartGroups: () => ipcRenderer.invoke('smartGroups:getAll'),
  createSmartGroup: (data: any) => ipcRenderer.invoke('smartGroups:create', data),
  updateSmartGroup: (id: string, data: any) => ipcRenderer.invoke('smartGroups:update', id, data),
  deleteSmartGroup: (id: string) => ipcRenderer.invoke('smartGroups:delete', id),
  evaluateSmartGroup: (id: string) => ipcRenderer.invoke('smartGroups:evaluate', id),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  importFolder: (p: string) => ipcRenderer.invoke('import:folder', p),
  importFiles: (ps: string[]) => ipcRenderer.invoke('import:files', ps),
  onImportProgress: (cb: (p: any) => void) => {
    const handler = (_e: any, p: any) => cb(p)
    ipcRenderer.on('import:progress', handler)
    return () => ipcRenderer.removeListener('import:progress', handler)
  }
})
