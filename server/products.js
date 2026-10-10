import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { supabaseServer, isServerSupabaseConfigured } from './supabase.js'

const root = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.REVIEWS_DB_PATH || `${root}/data/reviews.sqlite`)
const database = new DatabaseSync(databasePath)

database.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    collection TEXT NOT NULL,
    colour TEXT NOT NULL,
    fabric TEXT NOT NULL DEFAULT '',
    zari TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL,
    original_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 1,
    stock_count INTEGER NOT NULL DEFAULT 10,
    length TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    blouse TEXT NOT NULL DEFAULT '',
    care TEXT NOT NULL DEFAULT '',
    best INTEGER NOT NULL DEFAULT 0,
    is_new INTEGER NOT NULL DEFAULT 0,
    hex TEXT NOT NULL DEFAULT '#888888',
    images_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection);
`)

const HEX = {
  Maroon: '#6b1523',
  Red: '#a3182b',
  'Emerald Green': '#1f6b52',
  Mustard: '#c9962b',
  Ivory: '#e9dcc0',
  Pink: '#c8567a',
  'Peacock Blue': '#14697a',
  Purple: '#5b2a76',
  Teal: '#1b7a78',
  Orange: '#d2661e',
  Navy: '#1e2a5a',
  Magenta: '#a21b66',
  Gold: '#b8964f',
  White: '#f8f4eb',
  Charcoal: '#3b3b3b',
  Khaki: '#8f8a5b',
}

function loadSeedData() {
  const seedPath = resolve(root, '../src/data/raw-products.json')
  if (!existsSync(seedPath)) return []
  try {
    const raw = JSON.parse(readFileSync(seedPath, 'utf8'))
    return Array.isArray(raw) ? raw : []
  } catch (err) {
    console.error('Failed to parse raw-products.json for database seed:', err.message)
    return []
  }
}

function formatRow(row) {
  if (!row) return null
  let images = []
  try {
    images = JSON.parse(row.images_json)
    if (!Array.isArray(images)) images = []
  } catch {
    images = []
  }

  // Fallback: If product has no images recorded, supply its default catalog images
  if (images.length === 0 && row.id) {
    images = [
      `/images/products/${row.id}-1.jpg`,
      `/images/products/${row.id}-2.jpg`,
      `/images/products/${row.id}-3.jpg`,
      `/images/products/${row.id}-4.jpg`,
    ]
  }

  return {
    id: row.id,
    sku: row.sku || `KFS-${row.id.replace('kfs-', '').toUpperCase()}`,
    name: row.name,
    collection: row.collection,
    colour: row.colour,
    fabric: row.fabric || '',
    zari: row.zari || '',
    price: Number(row.price),
    originalPrice: Number(row.original_price || row.price),
    discount: Number(row.discount || 0),
    stock: Boolean(row.stock),
    stockCount: Number(row.stock_count ?? 10),
    length: row.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
    description: row.description || '',
    blouse: row.blouse || 'Unstitched blouse piece included.',
    care: row.care || 'Dry clean only.',
    best: Boolean(row.best),
    isNew: Boolean(row.is_new),
    hex: row.hex || HEX[row.colour] || '#888888',
    images,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const countRow = database.prepare('SELECT COUNT(*) as count FROM products').get()
if (Number(countRow?.count || 0) === 0) {
  console.log('Seeding SQLite products table from raw-products.json...')
  const seedProducts = loadSeedData()
  const insertStmt = database.prepare(`
    INSERT INTO products (
      id, sku, name, collection, colour, fabric, zari,
      price, original_price, discount, stock, stock_count,
      length, description, blouse, care, best, is_new,
      hex, images_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `)

  const now = new Date().toISOString()
  for (const p of seedProducts) {
    const validImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : [
          `/images/products/${p.id}-1.jpg`,
          `/images/products/${p.id}-2.jpg`,
          `/images/products/${p.id}-3.jpg`,
          `/images/products/${p.id}-4.jpg`,
        ]

    insertStmt.run(
      p.id,
      p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`,
      p.name,
      p.collection,
      p.colour,
      p.fabric || '',
      p.zari || '',
      Number(p.price) || 0,
      Number(p.originalPrice || p.price),
      Number(p.discount || 0),
      p.stock !== false ? 1 : 0,
      Number(p.stockCount ?? 10),
      p.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
      p.description || '',
      p.blouse || 'Unstitched blouse piece included.',
      p.care || 'Dry clean only.',
      p.best ? 1 : 0,
      p.isNew ? 1 : 0,
      p.hex || HEX[p.colour] || '#888888',
      JSON.stringify(validImages),
      now,
      now
    )
  }
  console.log(`Successfully seeded ${seedProducts.length} products to database.`)
}

export function getAllProducts() {
  const rows = database.prepare('SELECT * FROM products ORDER BY id ASC').all()
  return rows.map(formatRow)
}

export function getProductById(id) {
  const row = database.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(id)
  return formatRow(row)
}

export function saveProductToDatabase(p) {
  if (!p || !p.id || !p.name) {
    throw new Error('Product must have an id and name.')
  }

  const existing = getProductById(p.id)
  const now = new Date().toISOString()
  const createdAt = existing?.createdAt || now

  // Process and sanitize images
  let validImages = []
  if (Array.isArray(p.images)) {
    validImages = p.images.filter((img) => typeof img === 'string' && img.trim())
  }
  if (validImages.length === 0) {
    // Preserve existing images if none provided in the update
    validImages = existing?.images && existing.images.length > 0
      ? existing.images
      : [
          `/images/products/${p.id}-1.jpg`,
          `/images/products/${p.id}-2.jpg`,
          `/images/products/${p.id}-3.jpg`,
          `/images/products/${p.id}-4.jpg`,
        ]
  }

  const sku = p.sku || existing?.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`
  const price = Number(p.price) || 0
  const originalPrice = Number(p.originalPrice || price)
  const discount = Number(p.discount || (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0))
  const stock = p.stock !== false ? 1 : 0
  const stockCount = Number(p.stockCount ?? (stock ? 10 : 0))
  const best = p.best ? 1 : 0
  const isNew = p.isNew ? 1 : 0
  const hex = p.hex || HEX[p.colour] || '#888888'

  const upsertStmt = database.prepare(`
    INSERT INTO products (
      id, sku, name, collection, colour, fabric, zari,
      price, original_price, discount, stock, stock_count,
      length, description, blouse, care, best, is_new,
      hex, images_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      sku = excluded.sku,
      name = excluded.name,
      collection = excluded.collection,
      colour = excluded.colour,
      fabric = excluded.fabric,
      zari = excluded.zari,
      price = excluded.price,
      original_price = excluded.original_price,
      discount = excluded.discount,
      stock = excluded.stock,
      stock_count = excluded.stock_count,
      length = excluded.length,
      description = excluded.description,
      blouse = excluded.blouse,
      care = excluded.care,
      best = excluded.best,
      is_new = excluded.is_new,
      hex = excluded.hex,
      images_json = excluded.images_json,
      updated_at = excluded.updated_at
  `)

  upsertStmt.run(
    p.id,
    sku,
    p.name.trim(),
    p.collection || 'Kanchipuram Silk Sarees',
    p.colour || 'Maroon',
    p.fabric || '',
    p.zari || '',
    price,
    originalPrice,
    discount,
    stock,
    stockCount,
    p.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
    p.description || '',
    p.blouse || 'Unstitched blouse piece included.',
    p.care || 'Dry clean only.',
    best,
    isNew,
    hex,
    JSON.stringify(validImages),
    createdAt,
    now
  )

  const saved = getProductById(p.id)

  // Asynchronously sync to Supabase products table if available
  if (isServerSupabaseConfigured && supabaseServer) {
    supabaseServer
      .from('products')
      .upsert([
        {
          id: p.id,
          name: p.name.trim(),
          collection: p.collection || 'Kanchipuram Silk Sarees',
          colour: p.colour || 'Maroon',
          fabric: p.fabric || '',
          zari: p.zari || '',
          price,
          stock: Boolean(stock),
          hex,
          images: validImages,
          blouse: p.blouse || '',
          care: p.care || '',
          best: Boolean(best),
          is_new: Boolean(isNew),
        },
      ])
      .then(({ error }) => {
        if (error) console.warn('[Supabase Products Sync Warning]:', error.message)
      })
      .catch((e) => console.warn('[Supabase Products Sync Exception]:', e.message))
  }

  return saved
}

export function deleteProductFromDatabase(id) {
  if (!id) return false
  database.prepare('DELETE FROM products WHERE id = ?').run(id)

  if (isServerSupabaseConfigured && supabaseServer) {
    supabaseServer
      .from('products')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn('[Supabase Products Delete Warning]:', error.message)
      })
      .catch((e) => console.warn('[Supabase Products Delete Exception]:', e.message))
  }

  return true
}

export function resetProductsToSeed() {
  database.exec('DELETE FROM products')
  const seedProducts = loadSeedData()
  const insertStmt = database.prepare(`
    INSERT INTO products (
      id, sku, name, collection, colour, fabric, zari,
      price, original_price, discount, stock, stock_count,
      length, description, blouse, care, best, is_new,
      hex, images_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `)

  const now = new Date().toISOString()
  for (const p of seedProducts) {
    const validImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : [
          `/images/products/${p.id}-1.jpg`,
          `/images/products/${p.id}-2.jpg`,
          `/images/products/${p.id}-3.jpg`,
          `/images/products/${p.id}-4.jpg`,
        ]

    insertStmt.run(
      p.id,
      p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`,
      p.name,
      p.collection,
      p.colour,
      p.fabric || '',
      p.zari || '',
      Number(p.price) || 0,
      Number(p.originalPrice || p.price),
      Number(p.discount || 0),
      p.stock !== false ? 1 : 0,
      Number(p.stockCount ?? 10),
      p.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
      p.description || '',
      p.blouse || 'Unstitched blouse piece included.',
      p.care || 'Dry clean only.',
      p.best ? 1 : 0,
      p.isNew ? 1 : 0,
      p.hex || HEX[p.colour] || '#888888',
      JSON.stringify(validImages),
      now,
      now
    )
  }
  return getAllProducts()
}
