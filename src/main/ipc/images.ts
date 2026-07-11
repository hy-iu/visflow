import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { images, imageTags, imageCollections } from '../db/schema'
import { eq, desc, asc, like, and, inArray, sql, SQL } from 'drizzle-orm'
import fs from 'fs'

export function registerImageHandlers(): void {
  ipcMain.handle('images:getAll', async (_event, filters?: any) => {
    const db = getDb()
    const conditions: SQL[] = []
    if (filters?.search) conditions.push(like(images.fileName, `%${filters.search}%`))
    if (filters?.minRating !== undefined) conditions.push(sql`${images.rating} >= ${filters.minRating}`)
    if (filters?.colorLabel) conditions.push(eq(images.colorLabel, filters.colorLabel))
    if (filters?.collectionId) {
      const colImages = db.select({ imageId: imageCollections.imageId }).from(imageCollections).where(eq(imageCollections.collectionId, filters.collectionId)).all()
      const ids = colImages.map(r => r.imageId)
      if (ids.length === 0) return []
      conditions.push(inArray(images.id, ids))
    }
    if (filters?.tagIds?.length) {
      const tagImages = db.select({ imageId: imageTags.imageId }).from(imageTags).where(inArray(imageTags.tagId, filters.tagIds)).all()
      const ids = [...new Set(tagImages.map(r => r.imageId))]
      if (ids.length === 0) return []
      conditions.push(inArray(images.id, ids))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const sortCol = filters?.sortBy === 'fileName' ? images.fileName : filters?.sortBy === 'rating' ? images.rating : filters?.sortBy === 'fileSize' ? images.fileSize : filters?.sortBy === 'createdAt' ? images.createdAt : images.importedAt
    const sortDir = filters?.sortDir === 'asc' ? asc : desc
    return db.select().from(images).where(where).orderBy(sortDir(sortCol)).all()
  })
  ipcMain.handle('images:getById', async (_event, id: string) => {
    const db = getDb()
    return db.select().from(images).where(eq(images.id, id)).get() || null
  })
  ipcMain.handle('images:update', async (_event, id: string, data: any) => {
    const db = getDb()
    const updateData: any = { updatedAt: Date.now() }
    if (data.rating !== undefined) updateData.rating = data.rating
    if (data.colorLabel !== undefined) updateData.colorLabel = data.colorLabel
    db.update(images).set(updateData).where(eq(images.id, id)).run()
    return db.select().from(images).where(eq(images.id, id)).get()
  })
  ipcMain.handle('images:delete', async (_event, id: string) => {
    const db = getDb()
    const img = db.select().from(images).where(eq(images.id, id)).get()
    if (img && typeof img.thumbPath === 'string') { try { fs.unlinkSync(img.thumbPath) } catch {} }
    db.delete(imageCollections).where(eq(imageCollections.imageId, id)).run()
    db.delete(imageTags).where(eq(imageTags.imageId, id)).run()
    db.delete(images).where(eq(images.id, id)).run()
  })
}
