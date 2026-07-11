/**
 * @fileoverview Drizzle ORM schema for the VisFlow SQLite database.
 *
 * Defines all tables, columns, defaults and inter-table relations used by the
 * application.  Every primary key is a UUID-v4 stored as TEXT; every timestamp
 * is stored as an integer (Unix-ms via `Date.now()`).
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

/* ------------------------------------------------------------------ */
/*  Core tables                                                       */
/* ------------------------------------------------------------------ */

/** Imported image records. */
export const images = sqliteTable('images', {
  id: text('id').primaryKey(),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  width: integer('width'),
  height: integer('height'),
  thumbPath: text('thumb_path'),
  /** Serialised EXIF JSON blob. */
  exifJson: text('exif_json'),
  rating: integer('rating').default(0),
  colorLabel: text('color_label'),
  createdAt: integer('created_at'),
  importedAt: integer('imported_at'),
  updatedAt: integer('updated_at')
})

/** Hierarchical collection / folder structure. */
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Self-referencing FK for nested collections. */
  parentId: text('parent_id'),
  coverImageId: text('cover_image_id'),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at')
})

/** User-defined colour-coded tags. */
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6366f1'),
  createdAt: integer('created_at')
})

/* ------------------------------------------------------------------ */
/*  Junction tables                                                   */
/* ------------------------------------------------------------------ */

/** Many-to-many: images ↔ collections. */
export const imageCollections = sqliteTable(
  'image_collections',
  {
    imageId: text('image_id').notNull(),
    collectionId: text('collection_id').notNull(),
    sortOrder: integer('sort_order').default(0)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.imageId, table.collectionId] })
  })
)

/** Many-to-many: images ↔ tags. */
export const imageTags = sqliteTable(
  'image_tags',
  {
    imageId: text('image_id').notNull(),
    tagId: text('tag_id').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.imageId, table.tagId] })
  })
)

/* ------------------------------------------------------------------ */
/*  Slideshow / playlist tables                                       */
/* ------------------------------------------------------------------ */

/** Slideshow playlist with transition settings. */
export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name'),
  transition: text('transition').default('fade'),
  durationMs: integer('duration_ms').default(5000),
  transitionMs: integer('transition_ms').default(300),
  /** 1 = loop enabled, 0 = disabled (SQLite has no native boolean). */
  loop: integer('loop').default(1),
  /** 1 = shuffle, 0 = sequential. */
  shuffle: integer('shuffle').default(0),
  createdAt: integer('created_at')
})

/** Ordered items inside a playlist. */
export const playlistItems = sqliteTable('playlist_items', {
  id: text('id').primaryKey(),
  playlistId: text('playlist_id'),
  imageId: text('image_id'),
  sortOrder: integer('sort_order'),
  customDurationMs: integer('custom_duration_ms'),
  customTransition: text('custom_transition')
})

/* ------------------------------------------------------------------ */
/*  Smart groups (dynamic, rule-based collections)                    */
/* ------------------------------------------------------------------ */

/** Persisted smart-group definitions. */
export const smartGroups = sqliteTable('smart_groups', {
  id: text('id').primaryKey(),
  name: text('name'),
  /** JSON-encoded SmartGroupRules object. */
  rulesJson: text('rules_json'),
  sortBy: text('sort_by').default('createdAt'),
  sortDir: text('sort_dir').default('desc'),
  createdAt: integer('created_at')
})

/* ------------------------------------------------------------------ */
/*  Relations                                                         */
/* ------------------------------------------------------------------ */

export const imagesRelations = relations(images, ({ many }) => ({
  imageCollections: many(imageCollections),
  imageTags: many(imageTags),
  playlistItems: many(playlistItems)
}))

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  parent: one(collections, {
    fields: [collections.parentId],
    references: [collections.id]
  }),
  coverImage: one(images, {
    fields: [collections.coverImageId],
    references: [images.id]
  }),
  imageCollections: many(imageCollections)
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  imageTags: many(imageTags)
}))

export const imageCollectionsRelations = relations(imageCollections, ({ one }) => ({
  image: one(images, {
    fields: [imageCollections.imageId],
    references: [images.id]
  }),
  collection: one(collections, {
    fields: [imageCollections.collectionId],
    references: [collections.id]
  })
}))

export const imageTagsRelations = relations(imageTags, ({ one }) => ({
  image: one(images, {
    fields: [imageTags.imageId],
    references: [images.id]
  }),
  tag: one(tags, {
    fields: [imageTags.tagId],
    references: [tags.id]
  })
}))

export const playlistsRelations = relations(playlists, ({ many }) => ({
  items: many(playlistItems)
}))

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id]
  }),
  image: one(images, {
    fields: [playlistItems.imageId],
    references: [images.id]
  })
}))

export const smartGroupsRelations = relations(smartGroups, () => ({}))
