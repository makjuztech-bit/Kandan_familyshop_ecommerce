import { useSyncExternalStore } from 'react'
import { IMG, API_BASE, getAdminAuthHeaders } from '../config/shop'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { uploadImageToFirebase, setActiveWebsiteImage } from '../services/imageService'
import { db, isFirebaseConfigured } from '../services/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import rawProducts from './raw-products.json'

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')

export const HEX = {
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

export const COLLECTIONS = [...new Set(rawProducts.map((p) => p.collection))]

// Build seed catalogue ensuring all products have authentic, valid image URLs
const seed = rawProducts.map((p) => {
  const defaultImages = [
    `/images/products/${p.id}-1.jpg`,
    `/images/products/${p.id}-2.jpg`,
    `/images/products/${p.id}-3.jpg`,
    `/images/products/${p.id}-4.jpg`,
  ]
  const validImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : defaultImages

  return {
    ...p,
    sku: p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`,
    hex: p.hex || HEX[p.colour] || HEX['White'],
    images: validImages,
    price: Number(p.price) || 0,
    originalPrice: Number(p.originalPrice || p.price),
    discount: Number(p.discount || 0),
    stockCount: Number(p.stockCount ?? 10),
    stock: p.stock !== false,
  }
})

const seedById = Object.fromEntries(seed.map((p) => [p.id, p]))

const KEY = 'kfs_catalog_v5'
const DELETED_KEY = 'kfs_deleted_products'
const IK = 'kfs_site_images'
const subs = new Set()
const D = structuredClone(IMG)

function getDeletedIds() {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    const arr = JSON.parse(raw || '[]')
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function markDeletedId(id) {
  if (typeof localStorage === 'undefined' || !id) return
  try {
    const set = getDeletedIds()
    set.add(id)
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

function unmarkDeletedId(id) {
  if (typeof localStorage === 'undefined' || !id) return
  try {
    const set = getDeletedIds()
    if (set.has(id)) {
      set.delete(id)
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)))
    }
  } catch {}
}

const rd = (k, d) => {
  if (typeof localStorage === 'undefined') return d
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}

export const products = []
export const byId = {}
let ver = 0

const emit = () => {
  ver++
  subs.forEach((f) => {
    try {
      f()
    } catch {}
  })
}

export function sanitizeProduct(p) {
  if (!p || typeof p !== 'object') return null
  const id = String(p.id || '').trim()
  if (!id) return null

  const defaultImages = seedById[id]?.images || [
    `/images/products/${id}-1.jpg`,
    `/images/products/${id}-2.jpg`,
    `/images/products/${id}-3.jpg`,
    `/images/products/${id}-4.jpg`,
  ]

  let imgs = []
  if (Array.isArray(p.images)) {
    imgs = p.images.filter((img) => typeof img === 'string' && img.trim().length > 0)
  }
  if (imgs.length === 0) imgs = defaultImages

  const price = Number(p.price) || 0
  const originalPrice = Number(p.originalPrice || p.original_price || price)
  const discount = Number(
    p.discount != null
      ? p.discount
      : originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0
  )
  const stockCount = Number(p.stockCount ?? p.stock_count ?? (p.stock !== false ? 10 : 0))

  return {
    ...p,
    id,
    sku: p.sku || `KFS-${id.replace('kfs-', '').toUpperCase()}`,
    name: String(p.name || '').trim(),
    collection: p.collection || COLLECTIONS[0] || 'Kanchipuram Silk Sarees',
    colour: p.colour || 'Maroon',
    fabric: p.fabric || 'Pure Mulberry Silk',
    zari: p.zari || 'Rich Gold Zari',
    price,
    originalPrice,
    discount,
    stock: p.stock !== false && stockCount > 0,
    stockCount,
    length: p.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
    description: p.description || '',
    blouse: p.blouse || 'Unstitched blouse piece included.',
    care: p.care || 'Dry clean only.',
    best: Boolean(p.best),
    isNew: Boolean(p.isNew ?? p.is_new),
    hex: p.hex || HEX[p.colour] || '#888888',
    images: imgs,
  }
}

/**
 * Merges updates on top of base catalog deterministically.
 * Preserves baseline products while applying database additions and updates.
 */
function mergeCatalogs(baseList, incomingList) {
  const deleted = getDeletedIds()
  const map = new Map()

  // 1. Seed with baseline products (skip deleted)
  baseList.forEach((p) => {
    if (p && p.id && !deleted.has(p.id)) {
      const sanitized = sanitizeProduct(p)
      if (sanitized) map.set(sanitized.id, sanitized)
    }
  })

  // 2. Apply incoming updates (override existing, append new)
  if (Array.isArray(incomingList)) {
    incomingList.forEach((p) => {
      if (p && p.id && !deleted.has(p.id) && !p.deleted) {
        const existing = map.get(p.id) || {}
        const merged = sanitizeProduct({ ...existing, ...p })
        if (merged) map.set(merged.id, merged)
      }
    })
  }

  return Array.from(map.values())
}

function load(incomingProducts = null, serverSettings = null) {
  const cached = rd(KEY, null)
  let base = seed

  // If cached data is present, merge with seed
  if (Array.isArray(cached) && cached.length > 0) {
    base = mergeCatalogs(seed, cached)
  }

  // Merge incoming remote products if provided
  const combined = incomingProducts ? mergeCatalogs(base, incomingProducts) : base

  products.splice(0, products.length, ...combined)
  Object.keys(byId).forEach((k) => delete byId[k])
  combined.forEach((p) => {
    byId[p.id] = p
  })

  // Load site images
  const siteSettings = serverSettings || rd(IK, {})
  ;['hero', 'banner', 'about'].forEach((k) => {
    IMG[k] = siteSettings[k] || D[k]
  })
  COLLECTIONS.forEach((c) => {
    IMG.collections[c] = siteSettings['c:' + c] || D.collections[c]
  })

  // Cache to localStorage
  try {
    localStorage.setItem(KEY, JSON.stringify(combined))
    if (serverSettings) localStorage.setItem(IK, JSON.stringify(serverSettings))
  } catch {}
}

// Initial synchronous load
load()

// Asynchronous multi-database synchronization
export async function syncCatalogWithServer() {
  try {
    let fbProds = []
    let sbProds = []
    let apiProds = []
    let settings = null

    // 0. Sync from Cloud Firestore
    if (isFirebaseConfigured() && db) {
      try {
        const snap = await getDocs(collection(db, 'products'))
        if (!snap.empty) {
          snap.forEach((docSnap) => {
            const data = docSnap.data()
            if (!data.deleted) {
              fbProds.push({ ...data, id: docSnap.id })
            } else {
              markDeletedId(docSnap.id)
            }
          })
        }
      } catch (fbErr) {
        console.info('[Firestore catalog sync notice]:', fbErr.message)
      }
    }

    // 1. Sync from Supabase cloud database
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*')
        if (!error && Array.isArray(data) && data.length > 0) {
          sbProds = data.map((item) => ({
            ...item,
            images: Array.isArray(item.images)
              ? item.images
              : typeof item.images === 'string'
              ? JSON.parse(item.images || '[]')
              : [],
          }))
        }
      } catch (sbErr) {
        console.warn('[Supabase catalog sync notice]:', sbErr.message)
      }
    }

    // 2. Sync from backend Node API if reachable
    try {
      const [prodRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/api/products`),
        fetch(`${API_BASE}/api/settings`),
      ])

      if (prodRes.ok) {
        const data = await prodRes.json().catch(() => null)
        if (Array.isArray(data) && data.length > 0) apiProds = data
      }
      if (setRes.ok) {
        const setData = await setRes.json().catch(() => null)
        if (setData && typeof setData === 'object') settings = setData
      }
    } catch {}

    // Combine all incoming databases with Firestore taking highest priority
    const combinedUpdates = [
      ...apiProds,
      ...sbProds,
      ...fbProds,
    ]

    if (combinedUpdates.length > 0 || settings) {
      load(combinedUpdates, settings)
      emit()
    }
  } catch (err) {
    console.info('[Catalog] Running with local/cached catalog:', err.message)
  }
}

// Real-time listener for Firestore updates
let firestoreProductUnsub = null
function setupFirestoreProductsListener() {
  if (firestoreProductUnsub) return
  if (!isFirebaseConfigured() || !db) return
  try {
    firestoreProductUnsub = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteProds = []
          snapshot.forEach((docSnap) => {
            const data = docSnap.data()
            if (!data.deleted) {
              remoteProds.push({ ...data, id: docSnap.id })
            } else {
              markDeletedId(docSnap.id)
            }
          })
          if (remoteProds.length > 0) {
            load(remoteProds)
            emit()
          }
        }
      },
      (err) => console.info('[Firestore Products Listener Notice]:', err.message)
    )
  } catch {}
}

// IndexedDB persistent storage for products & full-resolution images
const IDB_PRODUCT_KEY = 'kfs_catalog_data'

function getProductsDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('kfs_products_db', 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function idbGetProducts() {
  const db = await getProductsDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('products', 'readonly')
      const store = tx.objectStore('products')
      const req = store.get(IDB_PRODUCT_KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function idbSaveProducts(prods) {
  const db = await getProductsDB()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('products', 'readwrite')
      const store = tx.objectStore('products')
      store.put(prods, IDB_PRODUCT_KEY)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    // Restore products and images from IndexedDB if available
    idbGetProducts().then((idbProds) => {
      if (Array.isArray(idbProds) && idbProds.length > 0) {
        load(idbProds)
        emit()
      }
    }).catch(() => {})

    syncCatalogWithServer()
    setupFirestoreProductsListener()
  }, 10)

  window.addEventListener('storage', () => {
    load()
    emit()
  })
}

export const useCatalog = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => ver
  )

const saveLocal = (k, v) => {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch (err) {
    // If quota exceeded due to large uploaded photos, save lightweight version to localStorage
    try {
      const lightweight = Array.isArray(v)
        ? v.map((prod) => ({
            ...prod,
            images: Array.isArray(prod.images)
              ? prod.images.map((im) => (typeof im === 'string' && im.length > 500 ? im.slice(0, 100) + '...' : im))
              : [],
          }))
        : v
      localStorage.setItem(k, JSON.stringify(lightweight))
    } catch {}
    return false
  }
}

export async function saveProduct(p) {
  const sanitized = sanitizeProduct(p)
  if (!sanitized) throw new Error('Invalid product data. Please check product fields.')

  // Unmark from deleted tracking if previously deleted
  unmarkDeletedId(sanitized.id)

  // 1. If any image is base64 / dataUrl, upload to storage
  const processedImages = []
  for (const img of sanitized.images) {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      try {
        const upRes = await uploadImageToFirebase({
          file: img,
          title: sanitized.name,
          category: 'Catalogue Products',
        })
        if (upRes?.url) {
          processedImages.push(upRes.url)
          continue
        }
      } catch (err) {
        console.warn('Image upload fallback, using original:', err.message)
      }
    }
    processedImages.push(img)
  }
  sanitized.images = processedImages

  // 2. Save to Cloud Firestore (Primary Real-time Cloud Store)
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'products', sanitized.id), sanitized, { merge: true })
    } catch (fbErr) {
      console.warn('[Firestore saveProduct notice]:', fbErr.message)
    }
  }

  // 3. Save to Supabase Cloud Database (if connected)
  if (isSupabaseConfigured && supabase) {
    try {
      const { error: sbError } = await supabase.from('products').upsert(
        [
          {
            id: sanitized.id,
            sku: sanitized.sku || '',
            name: sanitized.name.trim(),
            collection: sanitized.collection || 'Kanchipuram Silk Sarees',
            colour: sanitized.colour || 'Maroon',
            fabric: sanitized.fabric || '',
            zari: sanitized.zari || '',
            price: sanitized.price,
            original_price: sanitized.originalPrice || sanitized.price,
            discount: sanitized.discount || 0,
            stock: Boolean(sanitized.stock),
            stock_count: sanitized.stockCount ?? 10,
            length: sanitized.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m',
            description: sanitized.description || '',
            hex: sanitized.hex,
            images: sanitized.images,
            blouse: sanitized.blouse || '',
            care: sanitized.care || '',
            best: Boolean(sanitized.best),
            is_new: Boolean(sanitized.isNew),
          },
        ],
        { onConflict: 'id' }
      )
      if (sbError) {
        console.warn('[Supabase saveProduct warning]:', sbError.message)
      }
    } catch (e) {
      console.warn('[Supabase saveProduct exception]:', e.message)
    }
  }

  // 4. Save to backend Node / SQLite server (if running)
  try {
    const headers = getAdminAuthHeaders()
    await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sanitized),
    })
  } catch {}

  // 5. Update in-memory catalogue and local cache immediately
  const existingIdx = products.findIndex((x) => x.id === sanitized.id)
  let next = []
  if (existingIdx >= 0) {
    next = products.map((x) => (x.id === sanitized.id ? sanitized : x))
  } else {
    next = [sanitized, ...products]
  }
  products.splice(0, products.length, ...next)
  byId[sanitized.id] = sanitized
  saveLocal(KEY, next)
  idbSaveProducts(next).catch(() => {})
  emit()

  return sanitized
}

export async function deleteProduct(id) {
  if (!id) return

  // 1. Mark in deleted tracking set
  markDeletedId(id)

  // 2. Delete from Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'products', id), { deleted: true }, { merge: true })
      await deleteDoc(doc(db, 'products', id))
    } catch (fbErr) {
      console.warn('[Firestore deleteProduct notice]:', fbErr.message)
    }
  }

  // 3. Delete from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('products').delete().eq('id', id)
    } catch (e) {
      console.warn('[Supabase deleteProduct warning]:', e.message)
    }
  }

  // 4. Delete from local backend API
  try {
    const headers = getAdminAuthHeaders()
    await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    })
  } catch {}

  // 5. Remove from in-memory catalogue and local cache
  const next = products.filter((p) => p.id !== id)
  products.splice(0, products.length, ...next)
  delete byId[id]
  saveLocal(KEY, next)
  idbSaveProducts(next).catch(() => {})
  emit()
  return true
}

export const siteImg = (k) => (k.startsWith('c:') ? IMG.collections[k.slice(2)] : IMG[k])

export async function setSiteImage(k, v) {
  const o = rd(IK, {})
  if (v) o[k] = v
  else delete o[k]

  if (k.startsWith('c:')) {
    IMG.collections[k.slice(2)] = v || D.collections[k.slice(2)]
  } else {
    IMG[k] = v || D[k]
  }

  saveLocal(IK, o)
  emit()

  // 1. Persist to Firestore site_settings/images in cloud
  try {
    await setActiveWebsiteImage(k, v)
  } catch (err) {
    console.warn('[setSiteImage] Firestore sync error:', err.message)
  }

  // 2. Persist to local backend server if running
  try {
    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ key: k, value: v }),
    })
  } catch {}

  return true
}

export async function resetCatalog() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(KEY)
    localStorage.removeItem(DELETED_KEY)
    localStorage.removeItem(IK)
  }

  try {
    await fetch(`${API_BASE}/api/products/reset`, { method: 'POST', headers: getAdminAuthHeaders() })
    await fetch(`${API_BASE}/api/settings/reset`, { method: 'POST', headers: getAdminAuthHeaders() })
  } catch {}

  load(seed, D)
  emit()
}
