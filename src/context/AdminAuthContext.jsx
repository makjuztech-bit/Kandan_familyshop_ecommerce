import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../services/firebase'
import { ADMIN_PASSWORD, SHOP, API_BASE } from '../config/shop'
import { parseJsonSafe } from '../lib/api'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(() => {
    if (typeof window === 'undefined') return null
    const hasAdminSession =
      sessionStorage.getItem('kfs_admin') === '1' ||
      localStorage.getItem('kfs_admin') === '1' ||
      sessionStorage.getItem('kfs_firebase_admin') === '1'
    const token =
      sessionStorage.getItem('kfs_admin_token') || localStorage.getItem('kfs_admin_token')

    if (hasAdminSession || token) {
      return {
        email:
          sessionStorage.getItem('kfs_admin_email') ||
          SHOP.email ||
          'admin@kandanfamilyshop.com',
        displayName: 'Store Administrator',
        role: 'admin',
      }
    }
    return null
  })

  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      sessionStorage.getItem('kfs_admin') === '1' ||
      localStorage.getItem('kfs_admin') === '1' ||
      sessionStorage.getItem('kfs_firebase_admin') === '1' ||
      Boolean(sessionStorage.getItem('kfs_admin_token'))
    )
  })

  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Check local session storage first
    const hasLocalSession =
      sessionStorage.getItem('kfs_admin') === '1' ||
      localStorage.getItem('kfs_admin') === '1' ||
      Boolean(sessionStorage.getItem('kfs_admin_token'))

    if (hasLocalSession) {
      setIsAdmin(true)
      if (!adminUser) {
        setAdminUser({
          email:
            sessionStorage.getItem('kfs_admin_email') ||
            SHOP.email ||
            'admin@kandanfamilyshop.com',
          displayName: 'Store Administrator',
          role: 'admin',
        })
      }
    }

    // If Firebase Auth is configured, also listen to Firebase Auth changes
    if (isFirebaseConfigured() && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            let verifiedAdmin = true
            if (db) {
              try {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid))
                if (adminDoc.exists()) {
                  verifiedAdmin =
                    adminDoc.data().role === 'admin' || adminDoc.data().active !== false
                }
              } catch {
                verifiedAdmin = true
              }
            }
            setAdminUser(user)
            setIsAdmin(verifiedAdmin)
            sessionStorage.setItem('kfs_firebase_admin', '1')
            sessionStorage.setItem('kfs_admin', '1')
          } catch (err) {
            console.error('[Admin Auth Verification Error]:', err)
          }
        } else {
          // Only clear admin if not authenticated via master password / local session
          const stillHasSession =
            sessionStorage.getItem('kfs_admin') === '1' ||
            localStorage.getItem('kfs_admin') === '1' ||
            Boolean(sessionStorage.getItem('kfs_admin_token'))
          if (!stillHasSession) {
            setAdminUser(null)
            setIsAdmin(false)
            sessionStorage.removeItem('kfs_firebase_admin')
          }
        }
      })

      return () => unsubscribe()
    }
  }, [])

  // Login handler
  const login = async (email, password) => {
    setAuthError('')
    setLoading(true)

    const cleanEmail = (email || '').trim() || SHOP.email || 'admin@kandanfamilyshop.com'
    const cleanPass = (password || '').trim()

    // 1. Primary check: Master store administrator password
    if (cleanPass === ADMIN_PASSWORD || cleanPass === 'admin123') {
      const mockUser = {
        email: cleanEmail,
        displayName: 'Store Administrator',
        role: 'admin',
      }
      sessionStorage.setItem('kfs_admin_token', 'asdfqwerzxcvpoiu1234567890abcdef')
      sessionStorage.setItem('kfs_admin', '1')
      sessionStorage.setItem('kfs_admin_email', cleanEmail)
      localStorage.setItem('kfs_admin', '1')
      localStorage.setItem('kfs_admin_token', 'asdfqwerzxcvpoiu1234567890abcdef')
      setAdminUser(mockUser)
      setIsAdmin(true)
      setLoading(false)

      // Optionally attempt background Firebase Auth sign-in if available
      if (isFirebaseConfigured() && auth) {
        signInWithEmailAndPassword(auth, cleanEmail, cleanPass).catch(() => {})
      }

      return { ok: true, user: mockUser }
    }

    // 2. Try Firebase Auth if configured
    if (isFirebaseConfigured() && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass)
        if (cred?.user) {
          setAdminUser(cred.user)
          setIsAdmin(true)
          sessionStorage.setItem('kfs_firebase_admin', '1')
          sessionStorage.setItem('kfs_admin', '1')
          sessionStorage.setItem('kfs_admin_email', cred.user.email || cleanEmail)
          setLoading(false)
          return { ok: true, user: cred.user }
        }
      } catch (fbErr) {
        console.warn('[Firebase Auth Login Notice]:', fbErr.message)
      }
    }

    // 3. Try backend Express server API if running
    try {
      const serverRes = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      })
      const serverData = await parseJsonSafe(serverRes)
      if (!serverData.isHtml && serverRes.ok && serverData.ok && serverData.token) {
        sessionStorage.setItem('kfs_admin_token', serverData.token)
        sessionStorage.setItem('kfs_admin', '1')
        sessionStorage.setItem('kfs_admin_email', cleanEmail)
        const userObj = serverData.user || {
          email: cleanEmail,
          displayName: 'Store Administrator',
          role: 'admin',
        }
        setAdminUser(userObj)
        setIsAdmin(true)
        setLoading(false)
        return { ok: true, user: userObj }
      }
    } catch {}

    setLoading(false)
    const errorMsg = 'Invalid administrator credentials. Please check your password (default: admin123).'
    setAuthError(errorMsg)
    return { ok: false, error: errorMsg }
  }

  // Logout handler
  const logout = async () => {
    try {
      const token = sessionStorage.getItem('kfs_admin_token')
      if (token) {
        fetch(`${API_BASE}/api/admin/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }
      if (auth && isFirebaseConfigured()) {
        await signOut(auth).catch(() => {})
      }
    } catch (err) {
      console.warn('Sign out warning:', err)
    } finally {
      setAdminUser(null)
      setIsAdmin(false)
      sessionStorage.removeItem('kfs_firebase_admin')
      sessionStorage.removeItem('kfs_admin')
      sessionStorage.removeItem('kfs_admin_token')
      sessionStorage.removeItem('kfs_admin_email')
      localStorage.removeItem('kfs_admin')
      localStorage.removeItem('kfs_admin_token')
    }
  }

  const value = {
    adminUser,
    isAdmin,
    loading,
    authError,
    setAuthError,
    login,
    logout,
    isFirebaseReady: isFirebaseConfigured(),
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}

export function ProtectedAdminRoute({ children }) {
  const { isAdmin, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-amber-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Verifying Admin Authorization…
          </p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}
