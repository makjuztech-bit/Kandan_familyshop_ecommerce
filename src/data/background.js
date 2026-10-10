import { useSyncExternalStore } from 'react'
import { IMG, API_BASE } from '../config/shop'

export const DEFAULT_BACKGROUND = '/images/hero-silk-showroom.jpg'
const STORAGE_KEY = 'kfs_website_background'
const DB_NAME = 'kfs_assets_db'
const DB_STORE = 'settings'

// In-memory cache
let currentBackground = DEFAULT_BACKGROUND
const subscribers = new Set()

// Initialize from localStorage synchronously
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    // Clear stale external URLs (e.g. old Unsplash presets) — always use local showroom image
    const isExternalUrl = saved && saved.startsWith('http') && !saved.startsWith(window.location.origin)
    if (saved && typeof saved === 'string' && saved.trim() && saved !== '__idb_stored__' && !isExternalUrl) {
      currentBackground = saved
      IMG.hero = saved
    } else {
      // Clear any stale external URL from storage
      if (isExternalUrl) {
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      }
      currentBackground = DEFAULT_BACKGROUND
      IMG.hero = DEFAULT_BACKGROUND
    }
  } catch {
    currentBackground = DEFAULT_BACKGROUND
  }
}

// IndexedDB helper for reliable storage of large images
function getDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGet(key) {
  const db = await getDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readonly')
      const store = tx.objectStore(DB_STORE)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key, value) {
  const db = await getDB()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite')
      const store = tx.objectStore(DB_STORE)
      store.put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

async function idbDelete(key) {
  const db = await getDB()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite')
      const store = tx.objectStore(DB_STORE)
      store.delete(key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

// Background sync with persistent database & server settings
export async function syncBackgroundWithServer() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`)
    if (res.ok) {
      const data = await res.json()
      const serverBg = data.background || data.hero
      if (serverBg && typeof serverBg === 'string' && serverBg.trim() && serverBg !== currentBackground) {
        currentBackground = serverBg.trim()
        IMG.hero = currentBackground
        try {
          localStorage.setItem(STORAGE_KEY, currentBackground)
        } catch {}
        emitChange()
      }
    }
  } catch {}
}

// On startup in browser: check IndexedDB and server database
if (typeof window !== 'undefined') {
  idbGet(STORAGE_KEY).then((storedImage) => {
    // Skip stale external URLs (e.g. old Unsplash presets)
    const isExternal = storedImage && typeof storedImage === 'string' && storedImage.startsWith('http') && !storedImage.startsWith(window.location.origin)
    if (storedImage && typeof storedImage === 'string' && !isExternal && storedImage !== currentBackground) {
      currentBackground = storedImage
      IMG.hero = storedImage
      emitChange()
    } else if (isExternal) {
      idbDelete(STORAGE_KEY)
    }
  })

  setTimeout(syncBackgroundWithServer, 20)

  // Cross-tab synchronization
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const next = e.newValue || DEFAULT_BACKGROUND
      if (next !== currentBackground && next !== '__idb_stored__') {
        currentBackground = next
        IMG.hero = next
        emitChange()
      }
    }
  })

  window.addEventListener('kfs_background_change', () => {
    emitChange()
  })
}

function emitChange() {
  subscribers.forEach((callback) => {
    try {
      callback()
    } catch {}
  })
}

/**
 * Returns the current fixed background image.
 */
export function getBackgroundImage() {
  return currentBackground
}

/**
 * React hook to access the background image.
 * Guarantees persistent, immutable display that changes ONLY when setBackgroundImage is manually called.
 */
export function useBackgroundImage() {
  return useSyncExternalStore(
    (callback) => {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    () => currentBackground,
    () => DEFAULT_BACKGROUND
  )
}

/**
 * Manually set and permanently save a new background image.
 * Saves to IndexedDB, localStorage, and persistent database API.
 */
export async function setBackgroundImage(newImage) {
  if (!newImage || typeof newImage !== 'string' || !newImage.trim()) {
    return false
  }

  const cleanImage = newImage.trim()
  currentBackground = cleanImage
  IMG.hero = cleanImage

  // 1. Save to IndexedDB
  await idbSet(STORAGE_KEY, cleanImage)

  // 2. Save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, cleanImage)
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, '__idb_stored__')
    } catch {}
  }

  // 3. Persist to server / database settings
  try {
    await Promise.all([
      fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'background', value: cleanImage }),
      }),
      fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hero', value: cleanImage }),
      }),
    ])
  } catch (err) {
    console.warn('[setBackgroundImage] Server sync notice:', err.message)
  }

  // 4. Notify all components & other tabs
  emitChange()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kfs_background_change'))
  }

  return true
}

/**
 * Reset back to the default boutique showroom background image.
 */
export async function resetBackgroundImage() {
  currentBackground = DEFAULT_BACKGROUND
  IMG.hero = DEFAULT_BACKGROUND

  await idbDelete(STORAGE_KEY)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}

  try {
    await Promise.all([
      fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'background', value: DEFAULT_BACKGROUND }),
      }),
      fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hero', value: DEFAULT_BACKGROUND }),
      }),
    ])
  } catch {}

  emitChange()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kfs_background_change'))
  }
}
