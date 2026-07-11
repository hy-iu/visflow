/**
 * @fileoverview Database connection factory for VisFlow.
 *
 * Uses better-sqlite3 under the hood with WAL journalling for concurrent
 * read performance.  The connection is lazily created on the first call to
 * `getDb()` and reused for the lifetime of the process.
 *
 * On first connection the required tables are created via raw SQL so that no
 * separate migration step is needed during development.
 */

import path from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/** Singleton Drizzle instance. */
let db: BetterSQLite3Database<typeof schema> | null = null

/** Underlying better-sqlite3 handle (kept for raw `.exec()`). */
let rawDb: Database.Database | null = null

/**
 * Return (and lazily create) the Drizzle database instance.
 *
 * The database file lives at `<userData>/visflow.db`.  WAL mode is enabled
 * automatically and all tables are created if they do not already exist.
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'visflow.db')
  rawDb = new Database(dbPath)

  /* Enable WAL for better concurrent-read performance. */
  rawDb.pragma('journal_mode = WAL')

  /* Create tables if they don't exist yet. */
  createTablesIfNeeded(rawDb)

  db = drizzle(rawDb, { schema })
  return db
}

/**
 * Close the database connection cleanly.  Called during app shutdown.
 */
export function closeDb(): void {
  if (rawDb) {
    rawDb.close()
    rawDb = null
    db = null
  }
}

/* ------------------------------------------------------------------ */
/*  DDL – keeps the schema in sync without Drizzle-Kit migrations     */
/* ------------------------------------------------------------------ */

function createTablesIfNeeded(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id          TEXT PRIMARY KEY,
      file_path   TEXT NOT NULL UNIQUE,
      file_name   TEXT,
      mime_type   TEXT,
      file_size   INTEGER,
      width       INTEGER,
      height      INTEGER,
      thumb_path  TEXT,
      exif_json   TEXT,
      rating      INTEGER DEFAULT 0,
      color_label TEXT,
      created_at  INTEGER,
      imported_at INTEGER,
      updated_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS collections (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      parent_id      TEXT,
      cover_image_id TEXT,
      description    TEXT,
      sort_order     INTEGER DEFAULT 0,
      created_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT DEFAULT '#6366f1',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS image_collections (
      image_id      TEXT NOT NULL,
      collection_id TEXT NOT NULL,
      sort_order    INTEGER DEFAULT 0,
      PRIMARY KEY (image_id, collection_id)
    );

    CREATE TABLE IF NOT EXISTS image_tags (
      image_id TEXT NOT NULL,
      tag_id   TEXT NOT NULL,
      PRIMARY KEY (image_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id            TEXT PRIMARY KEY,
      name          TEXT,
      transition    TEXT DEFAULT 'fade',
      duration_ms   INTEGER DEFAULT 5000,
      transition_ms INTEGER DEFAULT 300,
      loop          INTEGER DEFAULT 1,
      shuffle       INTEGER DEFAULT 0,
      created_at    INTEGER
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      id                TEXT PRIMARY KEY,
      playlist_id       TEXT,
      image_id          TEXT,
      sort_order        INTEGER,
      custom_duration_ms INTEGER,
      custom_transition  TEXT
    );

    CREATE TABLE IF NOT EXISTS smart_groups (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      rules_json TEXT,
      sort_by    TEXT DEFAULT 'createdAt',
      sort_dir   TEXT DEFAULT 'desc',
      created_at INTEGER
    );
  `)
}
