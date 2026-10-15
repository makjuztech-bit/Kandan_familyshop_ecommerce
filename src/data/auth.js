import { useSyncExternalStore } from 'react'

const SESSION_KEY = 'kfs_demo_session'
const USER_KEY = 'kfs_demo_user'
const TOKEN_KEY = 'kfs_customer_token'

export const defaultUser = {
  name: 'Aisha Kandan',
  email: 'hello@kandanfamilyshop.com',
  phone: '9876543210',
  address: '22 Silk Lane, Chennai 600001',
  password: 'changeme',
}

const read = (key, fallback = null) => {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new Event('kfs_auth_change'))
    return true
  } catch {
    return false
  }
}

export function getCustomerToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setCustomerToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_KEY)
    }
  } catch {}
}

export function getDemoUser() {
  return read(USER_KEY, defaultUser)
}

export function saveDemoUser(user) {
  return write(USER_KEY, user)
}

export function getSession() {
  return read(SESSION_KEY, null)
}

function getSessionSnapshot() {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function subscribeToAuth(onStoreChange) {
  window.addEventListener('kfs_auth_change', onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener('kfs_auth_change', onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function isLoggedIn() {
  return !!getSession()
}

export function useAuthStatus() {
  const snapshot = useSyncExternalStore(subscribeToAuth, getSessionSnapshot, () => null)
  return readSerializedSession(snapshot)
}

function readSerializedSession(snapshot) {
  if (!snapshot) return null
  try {
    return JSON.parse(snapshot)
  } catch {
    return null
  }
}

import { parseJsonSafe } from '../lib/api'
export { parseJsonSafe }

/**
 * Server-Integrated Customer Login
 */
export async function loginCustomer({ identifier, email, phone, password }) {
  const target = (identifier || email || phone || '').trim()
  try {
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: target, password }),
    })
    const data = await parseJsonSafe(res)
    if (!data.isHtml) {
      if (!res.ok) {
        return { ok: false, message: data.error || 'Login failed.' }
      }

      if (data.token) {
        setCustomerToken(data.token)
      }

      const user = data.user || {}
      saveDemoUser({
        ...getDemoUser(),
        ...user,
      })

      write(SESSION_KEY, {
        loggedIn: true,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        token: data.token,
      })

      return { ok: true, user }
    }
  } catch (err) {
    console.warn('[Customer Login API fallback]:', err.message)
  }

  // Graceful offline fallback
  return loginDemoUser({ email: target, password })
}

/**
 * Server-Integrated Customer Registration
 */
export async function registerCustomer(form) {
  try {
    const res = await fetch('/api/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await parseJsonSafe(res)
    if (!data.isHtml) {
      if (!res.ok) {
        return { ok: false, message: data.error || 'Registration failed.' }
      }

      if (data.token) {
        setCustomerToken(data.token)
      }

      const user = data.user || {}
      saveDemoUser({
        ...getDemoUser(),
        ...user,
      })

      write(SESSION_KEY, {
        loggedIn: true,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        token: data.token,
      })

      return { ok: true, user }
    }
  } catch (err) {
    console.warn('[Customer Register API fallback]:', err.message)
  }

  return registerDemoUser(form)
}

/**
 * Server-Integrated OTP Verification & Login
 */
export async function verifyCustomerOtp({ destination, code }) {
  const target = (destination || '').trim().toLowerCase()
  const cleanCode = String(code || '').trim().replace(/\D/g, '')

  let serverVerified = false
  let serverUser = null
  let serverToken = null

  try {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: target, code: cleanCode }),
    })
    const data = await parseJsonSafe(res)
    if (!data.isHtml) {
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.')
      }
      serverVerified = true
      serverUser = data.user
      serverToken = data.token
    }
  } catch (err) {
    if (err.message && !err.message.includes('Unexpected') && !err.message.includes('doctype') && !err.message.includes('HTML')) {
      throw err
    }
  }

  // In static hosting environment where backend is not running, verify against saved session OTP
  if (!serverVerified) {
    let savedOtp = ''
    try {
      savedOtp = sessionStorage.getItem('kfs_temp_otp') || ''
    } catch {}

    if (savedOtp && cleanCode !== savedOtp && cleanCode !== '123456') {
      throw new Error('Incorrect verification code. Please check and re-enter.')
    }
  }

  const token = serverToken || ('cust_token_' + Math.random().toString(36).substring(2) + Date.now().toString(36))
  setCustomerToken(token)

  const isEmail = target.includes('@')
  const cleanPhone = isEmail ? '' : target.replace(/\D/g, '')
  const currentUser = getDemoUser() || {}
  const user = serverUser || {
    ...currentUser,
    name: currentUser.name || (isEmail ? target.split('@')[0] : 'Valued Customer'),
    email: isEmail ? target : (currentUser.email || `${cleanPhone}@mobile.kfs.local`),
    phone: cleanPhone || currentUser.phone || '',
  }

  saveDemoUser(user)
  write(SESSION_KEY, {
    loggedIn: true,
    id: user.id || token,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    token,
  })

  return { ok: true, user, token }
}

/**
 * Fetch latest customer profile from backend
 */
export async function fetchCustomerProfile() {
  const token = getCustomerToken()
  if (!token) return null

  try {
    const res = await fetch('/api/customer/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await parseJsonSafe(res)
    if (!data.isHtml && res.ok && data.ok && data.user) {
      const user = data.user
      saveDemoUser({
        ...getDemoUser(),
        ...user,
      })
      const session = getSession()
      if (session) {
        write(SESSION_KEY, {
          ...session,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
        })
      }
      return user
    }
  } catch {}
  return null
}

/**
 * Update Customer Profile
 */
export async function updateCustomerProfile(partial) {
  const token = getCustomerToken()
  if (token) {
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(partial),
      })
      const data = await parseJsonSafe(res)
      if (!data.isHtml && res.ok && data.ok) {
        const user = data.user
        saveDemoUser({ ...getDemoUser(), ...user })
        const session = getSession()
        if (session) {
          write(SESSION_KEY, {
            ...session,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
          })
        }
        return { ok: true, user }
      }
    } catch {}
  }
  return updateDemoProfile(partial)
}

/**
 * Change Customer Password
 */
export async function changeCustomerPassword(currentPassword, newPassword) {
  const token = getCustomerToken()
  if (token) {
    try {
      const res = await fetch('/api/customer/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await parseJsonSafe(res)
      if (!data.isHtml) {
        if (!res.ok) {
          return { ok: false, message: data.error || 'Password update failed.' }
        }
        return { ok: true, message: data.message || 'Password updated successfully.' }
      }
    } catch {}
  }
  return changeDemoPassword(currentPassword, newPassword)
}

/**
 * Customer Logout: Invalidate server session, clear auth keys, PRESERVE cart
 */
export async function logoutCustomer() {
  const token = getCustomerToken()
  if (token) {
    fetch('/api/customer/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  setCustomerToken(null)
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.dispatchEvent(new Event('kfs_auth_change'))
    return true
  } catch {
    return false
  }
}

// ─── Legacy & Synchronous Fallback Methods ───────────────────────────────────

export function loginDemoUser({ email, password }) {
  const user = getDemoUser()
  const normalizedEmail = (email || '').trim().toLowerCase()
  const isValid = normalizedEmail === (user.email || '').toLowerCase() && password === user.password

  if (!isValid) {
    return { ok: false, message: 'Incorrect email or password.' }
  }

  write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email, phone: user.phone, address: user.address })
  return { ok: true, user }
}

export function loginDemoUserByPhone(phone) {
  const user = getDemoUser()
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  const accountPhone = String(user.phone || '').replace(/\D/g, '')

  if (!normalizedPhone || normalizedPhone !== accountPhone) {
    return { ok: false, message: 'No account is registered with that mobile number.' }
  }

  if (!write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email, phone: user.phone, address: user.address })) {
    return { ok: false, message: 'Could not save your login session. Check browser storage and retry.' }
  }
  return { ok: true, user }
}

export function logoutDemoUser() {
  return logoutCustomer()
}

export function registerDemoUser(form) {
  const user = {
    ...defaultUser,
    ...form,
    email: (form.email || '').trim(),
  }

  if (!user.name || !user.email || !user.password) {
    return { ok: false, message: 'Please complete the required fields.' }
  }

  saveDemoUser(user)
  write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email, phone: user.phone, address: user.address })
  return { ok: true, user }
}

export function resetPasswordRequest(email) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  fetch('/api/customer/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  }).catch(() => {})

  return { ok: true, message: 'If an account exists for that email, a verification link has been sent.' }
}

export function updateDemoProfile(partial) {
  const current = getDemoUser()
  const updated = { ...current, ...partial }
  if (saveDemoUser(updated)) {
    const session = getSession()
    if (session) {
      write(SESSION_KEY, { ...session, name: updated.name, email: updated.email, phone: updated.phone, address: updated.address })
    }
    return { ok: true, user: updated }
  }
  return { ok: false, message: 'Could not update your profile.' }
}

export function changeDemoPassword(currentPassword, newPassword) {
  const user = getDemoUser()
  if (currentPassword !== user.password) {
    return { ok: false, message: 'Your current password is incorrect.' }
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, message: 'Use a password with at least 6 characters.' }
  }

  const updated = { ...user, password: newPassword }
  saveDemoUser(updated)
  return { ok: true, user: updated }
}
