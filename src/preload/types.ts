/**
 * @fileoverview Type definitions for the VisFlow preload ↔ renderer IPC API.
 * Every interface here maps to parameters accepted by `window.api` methods
 * exposed through contextBridge.
 */

/* ------------------------------------------------------------------ */
/*  Image                                                              */
/* ------------------------------------------------------------------ */

/** Filtering criteria when querying images. All fields are optional. */
export interface ImageFilters {
  /** Only return images belonging to this collection */
  collectionId?: string
  /** Only return images with ALL of these tag IDs */
  tagIds?: string[]
  /** Minimum star rating (1-5) */
  minRating?: number
  /** Maximum star rating (1-5) */
  maxRating?: number
  /** Only return favourited images */
  favorite?: boolean
  /** Free-text search across file name / caption */
  search?: string
  /** Sort field */
  sortBy?: 'importedAt' | 'createdAt' | 'fileName' | 'rating' | 'fileSize'
  /** Sort direction */
  sortDir?: 'asc' | 'desc'
  /** Pagination – max items to return */
  limit?: number
  /** Pagination – offset */
  offset?: number
}

/** Fields that can be updated on an existing image record. */
export interface ImageUpdate {
  rating: number
  favorite: boolean
  caption: string
  /** Rotation override in degrees (0 | 90 | 180 | 270) */
  rotation: number
}

/* ------------------------------------------------------------------ */
/*  Collection                                                         */
/* ------------------------------------------------------------------ */

export interface CreateCollection {
  name: string
  /** Optional parent collection ID for nesting */
  parentId?: string | null
  description?: string
  color?: string
}

export interface UpdateCollection {
  name: string
  parentId: string | null
  description: string
  color: string
}

/* ------------------------------------------------------------------ */
/*  Tag                                                                */
/* ------------------------------------------------------------------ */

export interface CreateTag {
  name: string
  color?: string
}

export interface UpdateTag {
  name: string
  color: string
}

/* ------------------------------------------------------------------ */
/*  Playlist                                                           */
/* ------------------------------------------------------------------ */

export interface CreatePlaylist {
  name: string
  description?: string
  transition?: string
  durationMs?: number
  transitionMs?: number
}

export interface UpdatePlaylist {
  name: string
  description: string
  transition: string
  durationMs: number
  transitionMs: number
}

/* ------------------------------------------------------------------ */
/*  Smart Group                                                        */
/* ------------------------------------------------------------------ */

/** A single rule inside a smart-group condition set. */
export interface SmartGroupRule {
  field: 'rating' | 'favorite' | 'fileName' | 'caption' | 'fileSize' | 'width' | 'height' | 'createdAt' | 'importedAt' | 'tagId' | 'collectionId'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'startsWith' | 'endsWith'
  value: string | number | boolean
}

export interface CreateSmartGroup {
  name: string
  /** How rules are combined: 'all' = AND, 'any' = OR */
  match: 'all' | 'any'
  rules: SmartGroupRule[]
}

export interface UpdateSmartGroup {
  name: string
  match: 'all' | 'any'
  rules: SmartGroupRule[]
}

/* ------------------------------------------------------------------ */
/*  Import                                                             */
/* ------------------------------------------------------------------ */

/** Progress update emitted during a folder / file import. */
export interface ImportProgress {
  /** Number of files processed so far */
  current: number
  /** Total files to process */
  total: number
  /** Name of the file currently being processed */
  fileName: string
}

/* ------------------------------------------------------------------ */
/*  Playback Options                                                   */
/* ------------------------------------------------------------------ */

export interface PlaybackOptions {
  transition: 'fade' | 'slide' | 'kenburns' | 'zoom'
  durationMs: number
  transitionMs: number
  loop: boolean
  shuffle: boolean
}
