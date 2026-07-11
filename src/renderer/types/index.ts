/**
 * @file Core type definitions for the VisFlow renderer.
 * All shared interfaces and enums live here to ensure consistency.
 */

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Available gallery layout modes. */
export type LayoutMode = 'grid' | 'masonry' | 'timeline'

/** Grid cell size presets. */
export type GridSize = 'small' | 'medium' | 'large'

/** Sort keys for the gallery. */
export type SortKey = 'dateAdded' | 'dateTaken' | 'name' | 'rating' | 'size'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/** Theme variants. */
export type ThemeMode = 'dark' | 'light'

/** Player transition types. */
export type TransitionType = 'fade' | 'slide' | 'kenburns' | 'zoom'

/** Smart group rule operators. */
export type RuleOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'before'
  | 'after'

/** Smart group rule fields. */
export type RuleField =
  | 'name'
  | 'rating'
  | 'dateTaken'
  | 'dateAdded'
  | 'width'
  | 'height'
  | 'size'
  | 'tag'
  | 'collection'
  | 'extension'
  | 'camera'
  | 'lens'

/** Match mode for smart group rules. */
export type MatchMode = 'all' | 'any'

/* ------------------------------------------------------------------ */
/*  Database-aligned records                                           */
/* ------------------------------------------------------------------ */

/** Represents a single image in the library. */
export interface ImageRecord {
  id: string
  filePath: string
  fileName: string
  extension: string
  width: number
  height: number
  sizeBytes: number
  rating: number
  colorLabel: string | null
  dateTaken: string | null
  dateAdded: string
  thumbnailPath: string | null

  /* EXIF subset (nullable) */
  cameraMake: string | null
  cameraModel: string | null
  lens: string | null
  focalLength: number | null
  aperture: number | null
  shutterSpeed: string | null
  iso: number | null
  gpsLatitude: number | null
  gpsLongitude: number | null
}

/** A hierarchical collection (folder-like). */
export interface CollectionRecord {
  id: string
  name: string
  parentId: string | null
  coverImageId: string | null
  imageCount: number
  sortOrder: number
}

/** A tag with an associated color. */
export interface TagRecord {
  id: string
  name: string
  color: string
  imageCount: number
}

/** A playlist with ordered images and playback settings. */
export interface PlaylistRecord {
  id: string
  name: string
  transitionType: TransitionType
  durationMs: number
  loop: boolean
  shuffle: boolean
  itemCount: number
}

/** A single item inside a playlist. */
export interface PlaylistItemRecord {
  id: string
  playlistId: string
  imageId: string
  sortOrder: number
  image?: ImageRecord
}

/** A smart group definition. */
export interface SmartGroupRecord {
  id: string
  name: string
  matchMode: MatchMode
  rules: SmartGroupRule[]
  imageCount: number
}

/** A single rule inside a smart group. */
export interface SmartGroupRule {
  id: string
  field: RuleField
  operator: RuleOperator
  value: string
  value2?: string // for 'between' operator
}

/* ------------------------------------------------------------------ */
/*  UI-specific types                                                  */
/* ------------------------------------------------------------------ */

/** Navigation target for the sidebar. */
export interface NavTarget {
  type: 'all' | 'collection' | 'tag' | 'playlist' | 'smartGroup'
  id?: string
  label: string
}

/** Context menu item definition. */
export interface ContextMenuItem {
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  children?: ContextMenuItem[]
  onClick?: () => void
}

/** Command palette action. */
export interface CommandAction {
  id: string
  label: string
  icon?: string
  shortcut?: string
  section?: string
  onExecute: () => void
}

/** Import progress info from main process. */
export interface ImportProgress {
  current: number
  total: number
  fileName: string
  phase: 'scanning' | 'importing' | 'thumbnailing' | 'done' | 'error'
  error?: string
}
