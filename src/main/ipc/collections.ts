import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { collections, imageCollections } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export function registerCollectionHandlers(): void {
  ipcMain.handle('collections:getAll', async () => { return getDb().select().from(collections).all() })
  ipcMain.handle('collections:create', async (_e, data: any) => {
    const db = getDb(); const id = uuidv4()
    db.insert(collections).values({ id, name: data.name, parentId: data.parentId || null, description: data.description || null, sortOrder: data.sortOrder || 0, createdAt: Date.now() }).run()
    return db.select().from(collections).where(eq(collections.id, id)).get()
  })
  ipcMain.handle('collections:update', async (_e, id: string, data: any) => {
    const db = getDb(); const u: any = {}
    if (data.name !== undefined) u.name = data.name
    if (data.parentId !== undefined) u.parentId = data.parentId
    if (data.description !== undefined) u.description = data.description
    if (data.coverImageId !== undefined) u.coverImageId = data.coverImageId
    db.update(collections).set(u).where(eq(collections.id, id)).run()
    return db.select().from(collections).where(eq(collections.id, id)).get()
  })
  ipcMain.handle('collections:delete', async (_e, id: string) => {
    const db = getDb()
    db.delete(imageCollections).where(eq(imageCollections.collectionId, id)).run()
    db.delete(collections).where(eq(collections.id, id)).run()
  })
  ipcMain.handle('collections:addImages', async (_e, collectionId: string, imageIds: string[]) => {
    const db = getDb(); const existing = db.select().from(imageCollections).where(eq(imageCollections.collectionId, collectionId)).all()
    const existingSet = new Set(existing.map(e => e.imageId)); let sortOrder = existing.length
    db.transaction((tx) => { for (const imageId of imageIds) { if (!existingSet.has(imageId)) { tx.insert(imageCollections).values({ imageId, collectionId, sortOrder: sortOrder++ }).run() } } })
  })
  ipcMain.handle('collections:removeImages', async (_e, collectionId: string, imageIds: string[]) => {
    const db = getDb()
    db.transaction((tx) => { for (const imageId of imageIds) { tx.delete(imageCollections).where(and(eq(imageCollections.collectionId, collectionId), eq(imageCollections.imageId, imageId))).run() } })
  })
}
