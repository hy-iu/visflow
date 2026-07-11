/**
 * @fileoverview EXIF metadata extraction service.
 *
 * Uses the `exifr` library to pull camera / exposure / GPS metadata from
 * image files.  Returns a normalised {@link ExifData} object or `null` when
 * the file contains no EXIF data (e.g. PNGs, screenshots).
 */

import exifr from 'exifr'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Normalised EXIF fields extracted from an image file. */
export interface ExifData {
  dateTimeOriginal: Date | null
  make: string | null
  model: string | null
  focalLength: number | null
  exposureTime: number | null
  fNumber: number | null
  iso: number | null
  gpsLatitude: number | null
  gpsLongitude: number | null
  imageWidth: number | null
  imageHeight: number | null
  orientation: number | null
}

/* ------------------------------------------------------------------ */
/*  Parsing                                                           */
/* ------------------------------------------------------------------ */

/** EXIF tags we want exifr to extract. */
const PICK_TAGS = [
  'DateTimeOriginal',
  'Make',
  'Model',
  'FocalLength',
  'ExposureTime',
  'FNumber',
  'ISO',
  'GPSLatitude',
  'GPSLongitude',
  'ImageWidth',
  'ImageHeight',
  'ExifImageWidth',
  'ExifImageHeight',
  'Orientation'
] as const

/**
 * Parse EXIF data from an image file.
 *
 * @param filePath - Absolute path to the image.
 * @returns Parsed {@link ExifData} or `null` if no EXIF data is present.
 */
export async function parseExif(filePath: string): Promise<ExifData | null> {
  try {
    const raw = await exifr.parse(filePath, {
      pick: PICK_TAGS as unknown as string[]
    })

    if (!raw) return null

    return {
      dateTimeOriginal: raw.DateTimeOriginal instanceof Date ? raw.DateTimeOriginal : null,
      make: raw.Make ?? null,
      model: raw.Model ?? null,
      focalLength: raw.FocalLength ?? null,
      exposureTime: raw.ExposureTime ?? null,
      fNumber: raw.FNumber ?? null,
      iso: raw.ISO ?? null,
      gpsLatitude: raw.GPSLatitude ?? null,
      gpsLongitude: raw.GPSLongitude ?? null,
      imageWidth: raw.ExifImageWidth ?? raw.ImageWidth ?? null,
      imageHeight: raw.ExifImageHeight ?? raw.ImageHeight ?? null,
      orientation: raw.Orientation ?? null
    }
  } catch {
    /* File is unreadable or has no EXIF – this is expected for PNGs etc. */
    return null
  }
}
