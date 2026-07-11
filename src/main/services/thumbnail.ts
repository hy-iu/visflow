/**
 * @fileoverview Thumbnail generation service.
 *
 * Generates 300 px-wide JPEG thumbnails using `sharp` and persists them to
 * `<userData>/thumbs/<imageId>.jpg`.  A simple semaphore limits the number
 * of concurrent sharp pipelines to {@link MAX_CONCURRENT} (4) so we don't
 * overwhelm the CPU during large imports.
 */

import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'
import sharp from 'sharp'

/** Maximum number of thumbnails generated in parallel. */
const MAX_CONCURRENT = 4

/** Width of generated thumbnails in pixels. */
const THUMB_WIDTH = 300

/** JPEG quality for generated thumbnails. */
const JPEG_QUALITY = 80

/* ---- Simple counting semaphore ----------------------------------- */
let running = 0
const waiting: Array<() => void> = []

function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    waiting.push(resolve)
  })
}

function release(): void {
  if (waiting.length > 0) {
    const next = waiting.shift()!
    next()
  } else {
    running--
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ensure the thumbnail output directory exists.
 */
export async function ensureThumbDir(): Promise<void> {
  const dir = path.join(app.getPath('userData'), 'thumbs')
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Generate a thumbnail for the given image file.
 *
 * @param imagePath - Absolute path to the source image.
 * @param imageId  - UUID used as the thumbnail filename.
 * @returns Absolute path to the generated thumbnail JPEG.
 */
export async function generateThumbnail(imagePath: string, imageId: string): Promise<string> {
  const thumbDir = path.join(app.getPath('userData'), 'thumbs')
  const thumbPath = path.join(thumbDir, `${imageId}.jpg`)

  await acquire()
  try {
    await sharp(imagePath)
      .rotate() // honour EXIF orientation
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(thumbPath)
  } finally {
    release()
  }

  return thumbPath
}
