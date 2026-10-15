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

// Asynchronous background sync with cloud database (Supabase) and local API
export async function syncCatalogWithServer() {
  try {
    let prods = null
    let settings = null

    // 0. Sync live products from Cloud Firestore if configured
    if (isFirebaseConfigured() && db) {
      try {
        const snap = await getDocs(collection(db, 'products'))
        if (!snap.empty) {
          const fbProds = []
          snap.forEach(docSnap => {
            fbProds.push({ ...docSnap.data(), id: docSnap.id })
          })
          if (fbProds.length > 0) prods = fbProds
        }
      } catch (fbErr) {
        console.info('[Firestore catalog sync notice]:', fbErr.message)
      }
    }

    // 1. Sync live products from Supabase cloud database if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*')
        if (!error && Array.isArray(data) && data.length > 0) {
          prods = data.map((item) => ({
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

    // 2. Also try API if running local Node server
    try {
      const [prodRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/api/products`),
        fetch(`${API_BASE}/api/settings`),
      ])

      if (prodRes.ok) {
        const data = await prodRes.json().catch(() => null)
        if (Array.isArray(data) && data.length > 0) prods = data
      }
      if (setRes.ok) {
        const setData = await setRes.json().catch(() => null)
        if (setData && typeof setData === 'object') settings = setData
      }
    } catch {}

    if (prods || settings) {
      load(prods, settings)
      emit()
    }
  } catch (err) {
    console.info('[Catalog] Running with cached/local catalog:', err.message)
  }
}

let firestoreProductUnsub = null
function setupFirestoreProductsListener() {
  if (firestoreProductUnsub) return
  if (!isFirebaseConfigured() || !db) return
  try {
    firestoreProductUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      if (!snapshot.empty) {
        const remoteProds = []
        snapshot.forEach(docSnap => {
          remoteProds.push({ ...docSnap.data(), id: docSnap.id })
        })
        if (remoteProds.length > 0) {
          load(remoteProds)
          emit()
        }
      }
    }, () => {})
  } catch {}
}

if (typeof window !== 'undefined') {
  // Trigger server sync immediately on client
  setTimeout(() => {
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
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

export async function saveProduct(p) {
  const sanitized = sanitizeProduct(p)
  if (!sanitized) throw new Error('Invalid product data.')

  // If any image is base64 / dataUrl, upload to Firebase Storage or cloud store
  const processedImages = []
  for (const img of sanitized.images) {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      try {
        const upRes = await uploadImageToFirebase({
          file: img,
          title: sanitized.name,
          category: 'Product Showcase',
        })
        if (upRes?.url) {
          processedImages.push(upRes.url)
          continue
        }
      } catch (err) {
        console.warn('Image upload failed, using original:', err.message)
      }
    }
    processedImages.push(img)
  }
  sanitized.images = processedImages

  // 0. Save to Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'products', sanitized.id), sanitized, { merge: true })
    } catch (fbErr) {
      console.warn('[Firestore saveProduct notice]:', fbErr.message)
    }
  }

  // 1. Save to Supabase cloud database if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { error: sbError } = await supabase.from('products').upsert([
        {
          id: sanitized.id,
          name: sanitized.name.trim(),
          collection: sanitized.collection || 'Kanchipuram Silk Sarees',
          colour: sanitized.colour || 'Maroon',
          fabric: sanitized.fabric || '',
          zari: sanitized.zari || '',
          price: sanitized.price,
          stock: Boolean(sanitized.stock),
          hex: sanitized.hex,
          images: sanitized.images,
          blouse: sanitized.blouse || '',
          care: sanitized.care || '',
          best: Boolean(sanitized.best),
          is_new: Boolean(sanitized.is_new),
        },
      ])
      if (sbError) {
        console.warn('[Supabase saveProduct warning]:', sbError.message)
      }
    } catch (e) {
      console.warn('[Supabase saveProduct exception]:', e.message)
    }
  }

  // 2. Also try local backend API if available
  try {
    const headers = getAdminAuthHeaders()
    await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sanitized),
    })
  } catch {}

  // Update in-memory catalogue and local cache
  const i = products.findIndex((x) => x.id === savedProductLocal(sanitized).id)
  const next = i < 0 ? [sanitized, ...products] : products.map((x) => (x.id === sanitized.id ? sanitized : x))
  products.splice(0, products.length, ...next)
  byId[sanitized.id] = sanitized
  saveLocal(KEY, next)
  emit()

  return sanitized
}

function savedProductLocal(p) {
  return p
}

export async function deleteProduct(id) {
  if (!id) return

  // 0. Delete from Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'products', id))
    } catch (fbErr) {
      console.warn('[Firestore deleteProduct notice]:', fbErr.message)
    }
  }

  // 1. Delete from Supabase if connected
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('products').delete().eq('id', id)
    } catch (e) {
      console.warn('[Supabase deleteProduct warning]:', e.message)
    }
  }

  // 2. Delete from local backend if running
  try {
    const headers = getAdminAuthHeaders()
    await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers,
    })
  } catch {}

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
  localStorage.removeItem(KEY)
  localStorage.removeItem(IK)

  try {
    await fetch(`${API_BASE}/api/products/reset`, { method: 'POST', headers: getAdminAuthHeaders() })
    await fetch(`${API_BASE}/api/settings/reset`, { method: 'POST', headers: getAdminAuthHeaders() })
  } catch {}

  load(seed, D)
  emit()
}
