/**
 * @fileoverview Image import service.
 *
 * Recursively walks a folder (or accepts explicit file paths) looking for
 * supported image formats, and for each file:
 *
 * 1. Generates a UUID-v4 identifier.
 * 2. Reads file stats (size).
 * 3. Parses EXIF metadata.
 * 4. Generates a 300 px JPEG thumbnail.
 * 5. Inserts the record into the `images` table.
 *
 * A progress callback lets the renderer show live feedback.
 */

import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/connection'
import { images } from '../db/schema'
import { parseExif } from './exif'
import { generateThumbnail, ensureThumbDir } from './thumbnail'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Progress callback fired for every file processed. */
export type ProgressCallback = (current: number, total: number, fileName: string) => void

/** Result returned after an import operation completes. */
export interface ImportResult {
  /** Number of images successfully imported. */
  imported: number
  /** Number of files that were skipped (already imported or unsupported). */
  skipped: number
  /** Errors encountered during import (file path → message). */
  errors: Array<{ filePath: string; message: string }>
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** File extensions considered importable image types (lower-cased). */
const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
  '.avif'
])

/** Map common extensions to MIME types. */
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.avif': 'image/avif'
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Recursively collect all image file paths under `dir`.
 */
async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = []

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await walkDir(fullPath)
      results.push(...nested)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        results.push(fullPath)
      }
    }
  }

  return results
}

/* ------------------------------------------------------------------ */
/*  Core import logic                                                 */
/* ------------------------------------------------------------------ */

/**
 * Import a single image file into the database.
 *
 * @returns `true` if the image was imported, `false` if skipped.
 */
async function importSingleFile(filePath: string): Promise<boolean> {
  const db = getDb()

  /* Skip files that have already been imported. */
  const normalised = path.resolve(filePath)
  const existing = db.select().from(images).where(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (() => {
      const { eq } = require('drizzle-orm') as typeof import('drizzle-orm')
      return eq(images.filePath, normalised)
    })()
  ).get()

  if (existing) return false

  const id = uuidv4()
  const stat = await fs.stat(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const fileName = path.basename(filePath)
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'

  /* Parse EXIF (may return null for PNGs etc.). */
  const exif = await parseExif(filePath)

  /* Generate thumbnail. */
  const thumbPath = await generateThumbnail(filePath, id)

  const now = Date.now()

  db.insert(images)
    .values({
      id,
      filePath: normalised,
      fileName,
      mimeType,
      fileSize: stat.size,
      width: exif?.imageWidth ?? null,
      height: exif?.imageHeight ?? null,
      thumbPath,
      exifJson: exif ? JSON.stringify(exif) : null,
      rating: 0,
      colorLabel: null,
      createdAt: exif?.dateTimeOriginal ? exif.dateTimeOriginal.getTime() : stat.birthtimeMs,
      importedAt: now,
      updatedAt: now
    })
    .run()

  return true
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Recursively scan a folder and import all supported image files.
 *
 * @param folderPath  - Root folder to scan.
 * @param onProgress  - Optional progress callback.
 * @returns Summary of the import operation.
 */
export async function importFolder(
  folderPath: string,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const filePaths = await walkDir(folderPath)
  return importFiles(filePaths, onProgress)
}

/**
 * Import an explicit list of image files.
 *
 * @param filePaths  - Absolute paths to image files.
 * @param onProgress - Optional progress callback.
 * @returns Summary of the import operation.
 */
export async function importFiles(
  filePaths: string[],
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  await ensureThumbDir()

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const total = filePaths.length

  for (let i = 0; i < total; i++) {
    const fp = filePaths[i]
    const fileName = path.basename(fp)

    try {
      const imported = await importSingleFile(fp)
      if (imported) {
        result.imported++
      } else {
        result.skipped++
      }
    } catch (err) {
      result.errors.push({
        filePath: fp,
        message: err instanceof Error ? err.message : String(err)
      })
    }

    onProgress?.(i + 1, total, fileName)
  }

  return result
}
