import { useSyncExternalStore } from 'react'
import { IMG, API_BASE } from '../config/shop'
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
  const validImages = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : defaultImages

  return {
    ...p,
    sku: p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`,
    hex: p.hex || HEX[p.colour] || HEX['White'],
    images: validImages,
  }
})

const seedById = Object.fromEntries(seed.map((p) => [p.id, p]))

const KEY = 'kfs_catalog_v4'
const IK = 'kfs_site_images'
const subs = new Set()
const D = structuredClone(IMG)

// Clear legacy cached catalogs from older versions
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('kfs_catalog')
    localStorage.removeItem('kfs_catalog_v2')
    localStorage.removeItem('kfs_catalog_v3')
  } catch {}
}

const rd = (k, d) => {
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

function sanitizeProduct(p) {
  if (!p) return null
  const defaultImages = seedById[p.id]?.images || [
    `/images/products/${p.id}-1.jpg`,
    `/images/products/${p.id}-2.jpg`,
    `/images/products/${p.id}-3.jpg`,
    `/images/products/${p.id}-4.jpg`,
  ]

  let imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  if (imgs.length === 0) imgs = defaultImages

  return {
    ...p,
    sku: p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`,
    hex: p.hex || HEX[p.colour] || '#888888',
    images: imgs,
    price: Number(p.price) || 0,
    originalPrice: Number(p.originalPrice || p.price),
    discount: Number(p.discount || 0),
    stock: p.stock !== false,
  }
}

function load(serverProducts = null, serverSettings = null) {
  let list = serverProducts
  if (!list) {
    const cached = rd(KEY, null)
    // Accept cached list containing added/modified products
    if (Array.isArray(cached) && cached.length > 0) {
      list = cached
    } else {
      list = seed
    }
  }

  const sanitized = list.map(sanitizeProduct).filter(Boolean)
  products.splice(0, products.length, ...sanitized)
  Object.keys(byId).forEach((k) => delete byId[k])
  sanitized.forEach((p) => {
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

  // Cache to localStorage for instant startup on next reload
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitized))
    localStorage.setItem(IK, JSON.stringify(siteSettings))
  } catch {}
}

// Initial synchronous load from local cache or seed
load()

// Asynchronous background sync with backend server / database
export async function syncCatalogWithServer() {
  try {
    const [prodRes, setRes] = await Promise.all([
      fetch(`${API_BASE}/api/products`),
      fetch(`${API_BASE}/api/settings`),
    ])

    let prods = null
    let settings = null

    if (prodRes.ok) {
      const data = await prodRes.json()
      if (Array.isArray(data) && data.length > 0) prods = data
    }
    if (setRes.ok) {
      settings = await setRes.json()
    }

    if (prods || settings) {
      load(prods, settings)
      emit()
    }
  } catch (err) {
    console.info('[Catalog] Running with cached/local catalog:', err.message)
  }
}

if (typeof window !== 'undefined') {
  // Trigger server sync immediately on client
  setTimeout(syncCatalogWithServer, 10)

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
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

function getAdminAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token =
      sessionStorage.getItem('kfs_admin_token') ||
      sessionStorage.getItem('kfs_firebase_admin_token') ||
      localStorage.getItem('kfs_admin_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  return headers
}

export async function saveProduct(p) {
  const sanitized = sanitizeProduct(p)
  if (!sanitized) throw new Error('Invalid product data.')

  // If any image is base64 / dataUrl, upload to server /api/upload first
  const processedImages = []
  for (const img of sanitized.images) {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      try {
        const upRes = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: getAdminAuthHeaders(),
          body: JSON.stringify({ file: img, filename: `${sanitized.id}.jpg`, folder: 'products' }),
        })
        if (upRes.ok) {
          const upData = await upRes.json()
          processedImages.push(upData.url || img)
          continue
        }
      } catch (err) {
        console.warn('Image upload failed, using original:', err.message)
      }
    }
    processedImages.push(img)
  }
  sanitized.images = processedImages

  // Save to backend database first
  const headers = getAdminAuthHeaders()
  const res = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(sanitized),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Server failed to save product (HTTP ${res.status}).`)
  }

  const data = await res.json()
  const saved = sanitizeProduct(data.product || sanitized)

  // Update in-memory catalogue and local cache
  const i = products.findIndex((x) => x.id === saved.id)
  const next = i < 0 ? [saved, ...products] : products.map((x) => (x.id === saved.id ? saved : x))
  products.splice(0, products.length, ...next)
  byId[saved.id] = saved
  saveLocal(KEY, next)
  emit()

  return saved
}

export async function deleteProduct(id) {
  if (!id) return
  const headers = getAdminAuthHeaders()
  const res = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'DELETE',
    headers,
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Server failed to delete product (HTTP ${res.status}).`)
  }

  const next = products.filter((p) => p.id !== id)
  products.splice(0, products.length, ...next)
  delete byId[id]
  saveLocal(KEY, next)
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

  // Persist to backend server / database
  try {
    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ key: k, value: v }),
    })
  } catch (err) {
    console.warn('[setSiteImage] Server sync error:', err.message)
  }

  return true
}

export async function resetCatalog() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(IK)

  try {
    await fetch(`${API_BASE}/api/products/reset`, { method: 'POST' })
    await fetch(`${API_BASE}/api/settings/reset`, { method: 'POST' })
  } catch {}

  load(seed, D)
  emit()
}
