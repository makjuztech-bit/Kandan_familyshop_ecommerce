import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'

// 1. Read config from Vite environment variables or admin-saved configuration
function getFirebaseConfig() {
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  }

  // Also support admin-saved configuration from browser for instant onboarding
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('kfs_firebase_config')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.apiKey && parsed.projectId) {
          return { ...envConfig, ...parsed }
        }
      }
    } catch {}
  }

  return envConfig
}

export const firebaseConfig = getFirebaseConfig()

export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig()
  return Boolean(
    cfg.apiKey &&
    cfg.projectId &&
    cfg.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    cfg.projectId !== 'YOUR_FIREBASE_PROJECT_ID'
  )
}

export function saveCustomFirebaseConfig(config) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kfs_firebase_config', JSON.stringify(config))
    window.location.reload()
  }
}

export function clearCustomFirebaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kfs_firebase_config')
    window.location.reload()
  }
}

// 2. Initialize Firebase instances safely
let app = null
let auth = null
let db = null
let storage = null
let analytics = null

try {
  const cfg = getFirebaseConfig()
  if (cfg.apiKey && cfg.projectId) {
    app = getApps().length ? getApp() : initializeApp(cfg)
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)
    if (typeof window !== 'undefined' && cfg.measurementId) {
      isSupported().then((supported) => {
        if (supported) {
          analytics = getAnalytics(app)
        }
      }).catch(() => {})
    }
  }
} catch (err) {
  console.warn('[Firebase Initialization Warning]:', err.message)
}

export { app, auth, db, storage, analytics }
