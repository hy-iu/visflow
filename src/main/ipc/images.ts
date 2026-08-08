import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { images, imageTags, imageCollections, playlistItems } from '../db/schema'
import { eq, desc, asc, like, and, inArray, sql, SQL } from 'drizzle-orm'
import fs from 'fs'

export function registerImageHandlers(): void {
  ipcMain.handle('images:getAll', async (_event, filters?: any) => {
    const db = getDb()
    const conditions: SQL[] = []
    if (filters?.search) conditions.push(like(images.fileName, `%${filters.search}%`))
    if (filters?.minRating !== undefined) conditions.push(sql`${images.rating} >= ${filters.minRating}`)
    if (filters?.colorLabel) conditions.push(eq(images.colorLabel, filters.colorLabel))

    // NSFW filter logic:
    // 'safe' = only images explicitly reviewed and marked safe
    // 'nsfw' = only images flagged as NSFW
    // 'all' = no nsfw filtering (includes pending/unscanned)
    const nsfwFilter = filters?.nsfwFilter || 'safe'
    if (nsfwFilter === 'safe') {
      conditions.push(eq(images.nsfwStatus, 'safe'))
    } else if (nsfwFilter === 'nsfw') {
      conditions.push(eq(images.nsfwStatus, 'nsfw'))
    }
    // 'all' adds no condition

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
    if (filters?.dirPath) {
      // Prefix match on the physical folder (LIKE with explicit ESCAPE so that
      // '%', '_' and '\' inside folder names stay literal).
      const sep = filters.dirPath.includes('\\') ? '\\' : '/'
      const escaped = String(filters.dirPath + sep).replace(/[\\%_]/g, (ch) => '\\' + ch)
      conditions.push(sql`${images.filePath} LIKE ${escaped + '%'} ESCAPE '\\'`)
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const sortCol = filters?.sortBy === 'fileName' ? images.fileName : filters?.sortBy === 'rating' ? images.rating : filters?.sortBy === 'fileSize' ? images.fileSize : filters?.sortBy === 'createdAt' ? images.createdAt : images.importedAt
    const sortDir = filters?.sortDir === 'asc' ? asc : desc
    // Lean column set for list views: the serialised EXIF blob is only needed
    // by the detail viewer and would bloat the IPC payload for large libraries.
    return db.select({
      id: images.id,
      filePath: images.filePath,
      fileName: images.fileName,
      mimeType: images.mimeType,
      fileSize: images.fileSize,
      width: images.width,
      height: images.height,
      rating: images.rating,
      colorLabel: images.colorLabel,
      nsfwScore: images.nsfwScore,
      nsfwStatus: images.nsfwStatus,
      createdAt: images.createdAt,
      importedAt: images.importedAt
    }).from(images).where(where).orderBy(sortDir(sortCol)).all()
  })
  // Lightweight folder index (Everything-style): the SQLite images table is the
  // persistent file-index cache; this aggregates it into per-folder summaries so
  // the renderer can paint folder headers instantly and lazy-load images later.
  ipcMain.handle('folders:getIndex', async (_event, filters?: any) => {
    const db = getDb()
    const conditions: SQL[] = []
    if (filters?.search) conditions.push(like(images.fileName, `%${filters.search}%`))
    const nsfwFilter = filters?.nsfwFilter || 'safe'
    if (nsfwFilter === 'safe') conditions.push(eq(images.nsfwStatus, 'safe'))
    else if (nsfwFilter === 'nsfw') conditions.push(eq(images.nsfwStatus, 'nsfw'))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const rows = db.select({
      filePath: images.filePath,
      importedAt: images.importedAt,
      createdAt: images.createdAt
    }).from(images).where(where).all()
    const map = new Map<string, { dirPath: string; dirName: string; count: number; latestImportedAt: number; latestCreatedAt: number }>()
    for (const r of rows) {
      if (!r.filePath) continue
      const parts = r.filePath.split(/[/\\]/)
      parts.pop()
      const isWindows = r.filePath.includes('\\')
      const dirPath = parts.join(isWindows ? '\\' : '/')
      const dirName = parts[parts.length - 1] || dirPath
      let g = map.get(dirPath)
      if (!g) {
        g = { dirPath, dirName, count: 0, latestImportedAt: 0, latestCreatedAt: 0 }
        map.set(dirPath, g)
      }
      g.count++
      if ((r.importedAt || 0) > g.latestImportedAt) g.latestImportedAt = r.importedAt || 0
      if ((r.createdAt || 0) > g.latestCreatedAt) g.latestCreatedAt = r.createdAt || 0
    }
    return Array.from(map.values())
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
    db.transaction((tx) => {
      tx.delete(imageCollections).where(eq(imageCollections.imageId, id)).run()
      tx.delete(imageTags).where(eq(imageTags.imageId, id)).run()
      tx.delete(playlistItems).where(eq(playlistItems.imageId, id)).run()
      tx.delete(images).where(eq(images.id, id)).run()
    })
  })
  ipcMain.handle('images:deleteBatch', async (_event, ids: string[]) => {
    const db = getDb()
    if (!Array.isArray(ids) || ids.length === 0) return
    const rows = db.select({ id: images.id, thumbPath: images.thumbPath }).from(images).where(inArray(images.id, ids)).all()
    db.transaction((tx) => {
      tx.delete(imageCollections).where(inArray(imageCollections.imageId, ids)).run()
      tx.delete(imageTags).where(inArray(imageTags.imageId, ids)).run()
      tx.delete(playlistItems).where(inArray(playlistItems.imageId, ids)).run()
      tx.delete(images).where(inArray(images.id, ids)).run()
    })
    // Remove thumbnails after the transaction commits
    for (const r of rows) { if (typeof r.thumbPath === 'string') { try { fs.unlinkSync(r.thumbPath) } catch {} } }
  })
}
