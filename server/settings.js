import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.REVIEWS_DB_PATH || `${root}/data/reviews.sqlite`)
const database = new DatabaseSync(databasePath)

database.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

export const DEFAULT_SETTINGS = {
  hero: '/images/hero-silk-showroom.jpg',
  background: '/images/hero-silk-showroom.jpg',
  banner: '/images/bridal-banner.jpg',
  about: '/images/about-draping.jpg',
  'c:Bridal Collection': '/images/collections/bridal.jpg',
  'c:Soft Silk': '/images/collections/soft-silk.jpg',
  'c:Shirts': '/images/collections/shirts.jpg',
  'c:Tops': '/images/collections/tops.jpg',
  'c:Pants': '/images/collections/pants.jpg',
}

// Seed default settings if empty
const countRow = database.prepare('SELECT COUNT(*) as count FROM site_settings').get()
if (Number(countRow?.count || 0) === 0) {
  const insertStmt = database.prepare(
    'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)'
  )
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertStmt.run(key, value, now)
  }
}

export function getAllSettings() {
  const rows = database.prepare('SELECT key, value FROM site_settings').all()
  const settings = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row && row.key) {
      settings[row.key] = row.value
    }
  }
  return settings
}

export function getSetting(key) {
  const row = database.prepare('SELECT value FROM site_settings WHERE key = ?').get(key)
  return row ? row.value : DEFAULT_SETTINGS[key] || null
}

export function saveSetting(key, value) {
  if (!key || typeof key !== 'string') return false
  const now = new Date().toISOString()
  const val = String(value || '')
  database
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, val, now)
  return true
}

export function resetSettings() {
  database.exec('DELETE FROM site_settings')
  const insertStmt = database.prepare(
    'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)'
  )
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertStmt.run(key, value, now)
  }
  return getAllSettings()
}
