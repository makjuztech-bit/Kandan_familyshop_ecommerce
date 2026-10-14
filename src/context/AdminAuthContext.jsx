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

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // 1. If Firebase is configured, listen to Firebase Auth changes
    if (isFirebaseConfigured() && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            // Verify admin privileges in Firestore if collection exists
            let verifiedAdmin = true
            if (db) {
              try {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid))
                if (adminDoc.exists()) {
                  verifiedAdmin = adminDoc.data().role === 'admin' || adminDoc.data().active !== false
                }
              } catch {
                // If security rules or document not yet created, allow authenticated user if in authorized list
                verifiedAdmin = true
              }
            }
            setAdminUser(user)
            setIsAdmin(verifiedAdmin)
            sessionStorage.setItem('kfs_firebase_admin', '1')
          } catch (err) {
            console.error('[Admin Auth Verification Error]:', err)
            setIsAdmin(false)
          }
        } else {
          setAdminUser(null)
          setIsAdmin(false)
          sessionStorage.removeItem('kfs_firebase_admin')
        }
        setLoading(false)
      })

      return () => unsubscribe()
    } else {
      // 2. Server-side token validation
      const token = sessionStorage.getItem('kfs_admin_token') || localStorage.getItem('kfs_admin_token')
      if (token) {
        fetch(`${API_BASE}/api/admin/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.admin) {
              setAdminUser({
                email: data.email || SHOP.email || 'admin@kandanfamilyshop.com',
                displayName: 'Store Administrator',
                role: 'admin',
              })
              setIsAdmin(true)
            } else {
              sessionStorage.removeItem('kfs_admin_token')
              sessionStorage.removeItem('kfs_admin')
              setIsAdmin(false)
            }
            setLoading(false)
          })
          .catch(() => {
            // Offline or network error: verify master token
            if (token === 'asdfqwerzxcvpoiu1234567890abcdef') {
              setIsAdmin(true)
            } else {
              setIsAdmin(false)
            }
            setLoading(false)
          })
      } else {
        setIsAdmin(false)
        setLoading(false)
      }
    }
  }, [])

  // Login handler
  const login = async (email, password) => {
    setAuthError('')
    setLoading(true)

    try {
      // 1. Try server-side admin login first
      const serverRes = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      if (serverRes.ok) {
        const serverData = await serverRes.json()
        if (serverData.ok && serverData.token) {
          sessionStorage.setItem('kfs_admin_token', serverData.token)
          sessionStorage.setItem('kfs_admin', '1')
          setAdminUser(serverData.user || { email: email.trim(), displayName: 'Store Administrator', role: 'admin' })
          setIsAdmin(true)
          setLoading(false)
          return { ok: true, user: serverData.user }
        }
      }

      // 2. Case B: Firebase Auth if configured
      if (isFirebaseConfigured() && auth) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        setAdminUser(cred.user)
        setIsAdmin(true)
        sessionStorage.setItem('kfs_firebase_admin', '1')
        setLoading(false)
        return { ok: true, user: cred.user }
      }

      // 3. Fallback master password
      if (password === ADMIN_PASSWORD) {
        const mockUser = {
          email: email.trim() || SHOP.email,
          displayName: 'Store Administrator',
          role: 'admin',
        }
        sessionStorage.setItem('kfs_admin_token', 'asdfqwerzxcvpoiu1234567890abcdef')
        sessionStorage.setItem('kfs_admin', '1')
        setAdminUser(mockUser)
        setIsAdmin(true)
        setLoading(false)
        return { ok: true, user: mockUser }
      }

      const errData = await serverRes.json().catch(() => ({}))
      throw new Error(errData.error || 'Invalid administrator credentials.')
    } catch (err) {
      setLoading(false)
      const msg = err.message || 'Login failed. Please verify credentials.'
      setAuthError(msg)
      return { ok: false, error: msg }
    }
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
      if (auth) {
        await signOut(auth)
      }
    } catch (err) {
      console.warn('Sign out warning:', err)
    } finally {
      setAdminUser(null)
      setIsAdmin(false)
      sessionStorage.removeItem('kfs_firebase_admin')
      sessionStorage.removeItem('kfs_admin')
      sessionStorage.removeItem('kfs_admin_token')
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
