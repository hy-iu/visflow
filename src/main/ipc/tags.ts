import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { tags, imageTags } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export function registerTagHandlers(): void {
  ipcMain.handle('tags:getAll', async () => {
    const db = getDb(); const allTags = db.select().from(tags).all()
    return allTags.map(tag => {
      const count = db.select({ count: sql<number>`count(*)` }).from(imageTags).where(eq(imageTags.tagId, tag.id)).get()
      return { ...tag, imageCount: count?.count || 0 }
    })
  })
  ipcMain.handle('tags:create', async (_e, data: any) => {
    const db = getDb(); const id = uuidv4()
    db.insert(tags).values({ id, name: data.name, color: data.color || '#6366f1', createdAt: Date.now() }).run()
    return db.select().from(tags).where(eq(tags.id, id)).get()
  })
  ipcMain.handle('tags:update', async (_e, id: string, data: any) => {
    const db = getDb(); const u: any = {}
    if (data.name !== undefined) u.name = data.name; if (data.color !== undefined) u.color = data.color
    db.update(tags).set(u).where(eq(tags.id, id)).run()
    return db.select().from(tags).where(eq(tags.id, id)).get()
  })
  ipcMain.handle('tags:delete', async (_e, id: string) => {
    const db = getDb(); db.delete(imageTags).where(eq(imageTags.tagId, id)).run(); db.delete(tags).where(eq(tags.id, id)).run()
  })
  ipcMain.handle('tags:addToImages', async (_e, tagId: string, imageIds: string[]) => {
    const db = getDb(); for (const imageId of imageIds) { try { db.insert(imageTags).values({ imageId, tagId }).run() } catch {} }
  })
  ipcMain.handle('tags:removeFromImages', async (_e, tagId: string, imageIds: string[]) => {
    const db = getDb(); for (const imageId of imageIds) { db.delete(imageTags).where(and(eq(imageTags.tagId, tagId), eq(imageTags.imageId, imageId))).run() }
  })
}
