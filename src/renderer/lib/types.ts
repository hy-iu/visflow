/**
 * @fileoverview Shared TypeScript types for the VisFlow renderer.
 * These interfaces mirror the Drizzle ORM schema so the renderer has
 * a strongly-typed view of domain entities without importing `drizzle-orm`.
 */

/* ------------------------------------------------------------------ */
/*  EXIF / Metadata                                                    */
/* ------------------------------------------------------------------ */

/** Parsed EXIF data stored alongside an image record. */
export interface ExifData {
  cameraMake?: string
  cameraModel?: string
  focalLength?: number
  fNumber?: number
  iso?: number
  exposureTime?: string
  flash?: boolean
  gpsLatitude?: number
  gpsLongitude?: number
  dateTimeOriginal?: string
  orientation?: number
  software?: string
  lensModel?: string
}

/* ------------------------------------------------------------------ */
/*  Image                                                              */
/* ------------------------------------------------------------------ */

export interface ImageRecord {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
  width: number
  height: number
  thumbPath: string
  rating: number
  favorite: boolean
  caption: string
  rotation: number
  exif: ExifData | null
  importedAt: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------------------------------------------ */
/*  Collection                                                         */
/* ------------------------------------------------------------------ */

export interface CollectionRecord {
  id: string
  name: string
  parentId: string | null
  description: string
  color: string
  imageCount: number
  createdAt: number
  updatedAt: number
}

/** Recursive tree node used by the sidebar to display nested collections. */
export interface CollectionTreeNode extends CollectionRecord {
  children: CollectionTreeNode[]
}

/* ------------------------------------------------------------------ */
/*  Tag                                                                */
/* ------------------------------------------------------------------ */

export interface TagRecord {
  id: string
  name: string
  color: string
  imageCount: number
  createdAt: number
}

/* ------------------------------------------------------------------ */
/*  Playlist                                                           */
/* ------------------------------------------------------------------ */

export interface PlaylistRecord {
  id: string
  name: string
  description: string
  transition: string
  durationMs: number
  transitionMs: number
  imageCount: number
  createdAt: number
  updatedAt: number
}

export interface PlaylistItemRecord {
  id: string
  playlistId: string
  imageId: string
  sortOrder: number
  createdAt: number
}

/* ------------------------------------------------------------------ */
/*  Smart Group                                                        */
/* ------------------------------------------------------------------ */

export interface SmartGroupRule {
  field: string
  operator: string
  value: string | number | boolean
}

export interface SmartGroupRecord {
  id: string
  name: string
  match: 'all' | 'any'
  rules: SmartGroupRule[]
  imageCount: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------------------------------------------ */
/*  Filters & Import                                                   */
/* ------------------------------------------------------------------ */

/** Filtering criteria passed to `window.api.getImages()`. */
export interface ImageFilters {
  collectionId?: string
  tagIds?: string[]
  minRating?: number
  maxRating?: number
  favorite?: boolean
  search?: string
  sortBy?: 'importedAt' | 'createdAt' | 'fileName' | 'rating' | 'fileSize'
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** Progress payload emitted during import operations. */
export interface ImportProgress {
  current: number
  total: number
  fileName: string
}
