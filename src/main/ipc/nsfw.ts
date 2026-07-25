/**
 * @fileoverview IPC handlers for NSFW review functionality.
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  scanPendingImages,
  cancelNsfwScan,
  setImageNsfwStatus,
  batchSetNsfwStatus,
  clearNsfwResults,
  getModelStatus,
  downloadYoloModel,
  openModelDir
} from '../services/nsfw'
import { getDb } from '../db/connection'
import { images } from '../db/schema'
import { eq, sql } from 'drizzle-orm'

export function registerNsfwHandlers(): void {
  /**
   * Start scanning all unscanned images for NSFW content.
   * Emits progress events to the renderer via 'nsfw:progress'.
   */
  ipcMain.handle('nsfw:scan', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await scanPendingImages((progress) => {
      win?.webContents.send('nsfw:progress', progress)
    })
    return result
  })

  /** Cancel an in-progress NSFW scan. */
  ipcMain.handle('nsfw:cancelScan', async () => {
    cancelNsfwScan()
    return { success: true }
  })

  /** Manually set NSFW status for a single image. */
  ipcMain.handle('nsfw:setStatus', async (_event, imageId: string, status: 'safe' | 'nsfw') => {
    setImageNsfwStatus(imageId, status)
    return { success: true }
  })

  /** Batch set NSFW status for multiple images. */
  ipcMain.handle('nsfw:batchSetStatus', async (_event, imageIds: string[], status: 'safe' | 'nsfw') => {
    batchSetNsfwStatus(imageIds, status)
    return { success: true }
  })

  /** Get count of pending (unscanned) images. */
  ipcMain.handle('nsfw:getPendingCount', async () => {
    const db = getDb()
    const all = db.select({ id: images.id, nsfwScore: images.nsfwScore }).from(images).all()
    const pendingCount = all.filter((r) => r.nsfwScore === null).length
    return { pending: pendingCount }
  })

  /** Get counts for each NSFW status category. */
  ipcMain.handle('nsfw:getCounts', async () => {
    const db = getDb()
    const rows = db
      .select({
        status: images.nsfwStatus,
        count: sql<number>`count(*)`.as('count')
      })
      .from(images)
      .groupBy(images.nsfwStatus)
      .all()

    let safe = 0, nsfw = 0, pending = 0
    for (const row of rows) {
      if (row.status === 'safe') safe = row.count
      else if (row.status === 'nsfw') nsfw = row.count
      else pending = row.count // 'pending' or null
    }
    return { safe, nsfw, pending, total: safe + nsfw + pending }
  })

  /** Clear all NSFW scan results, resetting to unscanned state. */
  ipcMain.handle('nsfw:clearResults', async () => {
    clearNsfwResults()
    return { success: true }
  })

  /** Get NSFW model installation status (YOLO present? model dir, etc.). */
  ipcMain.handle('nsfw:getModelStatus', async () => {
    return getModelStatus()
  })

  /**
   * Download the YOLO model on demand. Emits 'nsfw:downloadProgress' events
   * to the renderer with phase/percent/byte counts.
   */
  ipcMain.handle('nsfw:downloadModels', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return downloadYoloModel((progress) => {
      win?.webContents.send('nsfw:downloadProgress', progress)
    })
  })

  /** Open the model directory in the system file manager (manual install). */
  ipcMain.handle('nsfw:openModelDir', async () => {
    const dir = await openModelDir()
    return { success: true, dir }
  })
}
