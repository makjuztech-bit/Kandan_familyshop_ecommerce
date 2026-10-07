import { useSyncExternalStore } from 'react'

const SESSION_KEY = 'kfs_demo_session'
const USER_KEY = 'kfs_demo_user'

export const defaultUser = {
  name: 'Aisha Kandan',
  email: 'hello@kandanfamilyshop.com',
  phone: '9876543210',
  address: '22 Silk Lane, Chennai 600001',
  password: 'demo123',
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

export function loginDemoUser({ email, password }) {
  const user = getDemoUser()
  const normalizedEmail = (email || '').trim().toLowerCase()
  const isValid = normalizedEmail === (user.email || '').toLowerCase() && password === user.password

  if (!isValid) {
    return { ok: false, message: 'Incorrect email or password.' }
  }

  write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email })
  return { ok: true, user }
}

export function loginDemoUserByPhone(phone) {
  const user = getDemoUser()
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  const accountPhone = String(user.phone || '').replace(/\D/g, '')

  if (!normalizedPhone || normalizedPhone !== accountPhone) {
    return { ok: false, message: 'No demo account is registered with that mobile number.' }
  }

  if (!write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email, phone: user.phone })) {
    return { ok: false, message: 'Could not save your login session. Check browser storage and retry.' }
  }
  return { ok: true, user }
}

export function logoutDemoUser() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.dispatchEvent(new Event('kfs_auth_change'))
    return true
  } catch {
    return false
  }
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
  write(SESSION_KEY, { loggedIn: true, name: user.name, email: user.email })
  return { ok: true, user }
}

export function resetPasswordRequest(email) {
  const user = getDemoUser()
  const normalizedEmail = (email || '').trim().toLowerCase()
  const matches = normalizedEmail === (user.email || '').toLowerCase()

  return matches
    ? { ok: true, message: 'A password reset email was sent to your inbox (demo mode).' }
    : { ok: true, message: 'If an account exists for that email, a reset link has been sent.' }
}

export function updateDemoProfile(partial) {
  const current = getDemoUser()
  const updated = { ...current, ...partial }
  if (saveDemoUser(updated)) {
    const session = getSession()
    if (session) {
      write(SESSION_KEY, { ...session, name: updated.name, email: updated.email })
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
