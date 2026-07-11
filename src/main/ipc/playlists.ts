import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { playlists, playlistItems, images } from '../db/schema'
import { eq, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export function registerPlaylistHandlers(): void {
  ipcMain.handle('playlists:getAll', async () => { return getDb().select().from(playlists).all() })
  ipcMain.handle('playlists:getById', async (_e, id: string) => {
    const db = getDb(); const playlist = db.select().from(playlists).where(eq(playlists.id, id)).get()
    if (!playlist) return null
    const items = db.select().from(playlistItems).where(eq(playlistItems.playlistId, id)).orderBy(asc(playlistItems.sortOrder)).all()
    const itemsWithImages = items.map(item => ({ ...item, image: item.imageId ? db.select().from(images).where(eq(images.id, item.imageId)).get() : null }))
    return { ...playlist, items: itemsWithImages }
  })
  ipcMain.handle('playlists:create', async (_e, data: any) => {
    const db = getDb(); const id = uuidv4()
    db.insert(playlists).values({ id, name: data.name || 'Untitled', transition: data.transition || 'fade', durationMs: data.durationMs || 5000, transitionMs: data.transitionMs || 300, loop: data.loop ?? 1, shuffle: data.shuffle ?? 0, createdAt: Date.now() }).run()
    return db.select().from(playlists).where(eq(playlists.id, id)).get()
  })
  ipcMain.handle('playlists:update', async (_e, id: string, data: any) => {
    const db = getDb(); const u: any = {}
    for (const k of ['name','transition','durationMs','transitionMs','loop','shuffle']) { if ((data as any)[k] !== undefined) (u as any)[k] = (data as any)[k] }
    db.update(playlists).set(u).where(eq(playlists.id, id)).run()
    return db.select().from(playlists).where(eq(playlists.id, id)).get()
  })
  ipcMain.handle('playlists:delete', async (_e, id: string) => { const db = getDb(); db.delete(playlistItems).where(eq(playlistItems.playlistId, id)).run(); db.delete(playlists).where(eq(playlists.id, id)).run() })
  ipcMain.handle('playlists:addImages', async (_e, playlistId: string, imageIds: string[]) => {
    const db = getDb(); const existing = db.select().from(playlistItems).where(eq(playlistItems.playlistId, playlistId)).all(); let sortOrder = existing.length
    for (const imageId of imageIds) { db.insert(playlistItems).values({ id: uuidv4(), playlistId, imageId, sortOrder: sortOrder++ }).run() }
  })
  ipcMain.handle('playlists:removeItems', async (_e, _pid: string, itemIds: string[]) => { const db = getDb(); for (const id of itemIds) { db.delete(playlistItems).where(eq(playlistItems.id, id)).run() } })
  ipcMain.handle('playlists:reorder', async (_e, _pid: string, orderedIds: string[]) => { const db = getDb(); orderedIds.forEach((id, i) => { db.update(playlistItems).set({ sortOrder: i }).where(eq(playlistItems.id, id)).run() }) })
}
