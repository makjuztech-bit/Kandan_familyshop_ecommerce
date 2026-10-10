import { useEffect, useSyncExternalStore } from 'react'

const CONFIG_KEY = 'kfs_loyalty_config'
const DEFAULT_CONFIG = {
  enabled: true,
  spendPerPoint: 100, // ₹100 spent = 1 point
  pointsPerUnit: 1,
  redemptionEnabled: true,
  pointValueInInr: 1, // 1 point = ₹1
  minPointsToRedeem: 10,
  maxRedemptionPercent: 50,
}

// ─── CONFIG STORE ─────────────────────────────────────────────────────────────
const configSubs = new Set()

function readStoredConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

let activeConfig = readStoredConfig()

function broadcastConfig(newConfig) {
  activeConfig = newConfig
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig))
  } catch {}
  configSubs.forEach((cb) => cb())
}

export async function fetchLoyaltyConfig() {
  try {
    const res = await fetch('/api/loyalty/config')
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.config) {
        broadcastConfig(data.config)
        return data.config
      }
    }
  } catch {}
  return activeConfig
}

export async function updateLoyaltyConfigApi(patch) {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kfs_admin_token') : null
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch('/api/loyalty/config', {
      method: 'POST',
      headers,
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (data.ok && data.config) {
      broadcastConfig(data.config)
      return { ok: true, config: data.config }
    }
    throw new Error(data.error || 'Failed to update config')
  } catch (err) {
    const next = { ...activeConfig, ...patch }
    broadcastConfig(next)
    return { ok: true, config: next }
  }
}

export function useLoyaltyConfig() {
  return useSyncExternalStore(
    (cb) => {
      configSubs.add(cb)
      return () => configSubs.delete(cb)
    },
    () => activeConfig
  )
}

// ─── CUSTOMER LOYALTY STORE ───────────────────────────────────────────────────
const customerSubs = new Map() // email -> Set of callbacks
const customerCache = new Map() // email -> customer object

function getCustomerKey(email) {
  return 'kfs_loyalty_user_' + (email || '').trim().toLowerCase()
}

const emptyCustomer = (normalized) => ({
  email: normalized,
  name: '',
  phone: '',
  balance: 0,
  totalEarned: 0,
  totalRedeemed: 0,
  history: [],
})

function readStoredCustomer(normalized) {
  if (!normalized) return null
  try {
    const raw = localStorage.getItem(getCustomerKey(normalized))
    if (raw) return JSON.parse(raw)
  } catch {}
  return emptyCustomer(normalized)
}

function getCustomerSnapshot(normalized) {
  if (!normalized) return null
  if (customerCache.has(normalized)) {
    return customerCache.get(normalized)
  }
  const data = readStoredCustomer(normalized)
  customerCache.set(normalized, data)
  return data
}

function notifyCustomerSubs(email, data) {
  const normalized = email.trim().toLowerCase()
  customerCache.set(normalized, data)
  try {
    localStorage.setItem(getCustomerKey(normalized), JSON.stringify(data))
  } catch {}
  const subs = customerSubs.get(normalized)
  if (subs) {
    subs.forEach((cb) => cb())
  }
}

export async function fetchCustomerLoyaltyApi(email) {
  if (!email) return null
  const normalized = email.trim().toLowerCase()

  try {
    const res = await fetch(`/api/loyalty/customer?email=${encodeURIComponent(normalized)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.customer) {
        notifyCustomerSubs(normalized, data.customer)
        return data.customer
      }
    }
  } catch {}

  const local = readStoredCustomer(normalized)
  if (local) {
    notifyCustomerSubs(normalized, local)
  }
  return local
}

export async function fetchCustomerLoyaltyPointsApi(email) {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  try {
    const res = await fetch(`/api/customer/loyalty-points?email=${encodeURIComponent(normalized)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.ok) return data
    }
  } catch {}
  return null
}

export async function fetchCustomerLoyaltyHistoryApi(email) {
  if (!email) return []
  const normalized = email.trim().toLowerCase()
  try {
    const res = await fetch(`/api/customer/loyalty-history?email=${encodeURIComponent(normalized)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.history)) return data.history
    }
  } catch {}
  return []
}

export function useCustomerLoyalty(email) {
  const normalized = (email || '').trim().toLowerCase()

  useEffect(() => {
    if (normalized) {
      fetchCustomerLoyaltyApi(normalized)
    }
  }, [normalized])

  return useSyncExternalStore(
    (cb) => {
      if (!normalized) return () => {}
      if (!customerSubs.has(normalized)) {
        customerSubs.set(normalized, new Set())
      }
      customerSubs.get(normalized).add(cb)

      return () => {
        customerSubs.get(normalized)?.delete(cb)
      }
    },
    () => getCustomerSnapshot(normalized)
  )
}

// ─── ADMIN LOYALTY ACTIONS & QUERIES ──────────────────────────────────────────
export async function fetchAllLoyaltyCustomersApi() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kfs_admin_token') : null
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch('/api/loyalty/customers', { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.customers)) {
        return data.customers
      }
    }
  } catch {}
  return []
}

export async function fetchLoyaltyStatsApi() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kfs_admin_token') : null
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch('/api/loyalty/stats', { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.stats) {
        return data.stats
      }
    }
  } catch {}
  return {
    totalMembers: 0,
    totalOutstandingPoints: 0,
    totalIssuedPoints: 0,
    totalRedeemedPoints: 0,
  }
}

export async function fetchLoyaltyTransactionsApi(limit = 100) {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kfs_admin_token') : null
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`/api/loyalty/transactions?limit=${limit}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.transactions)) {
        return data.transactions
      }
    }
  } catch {}
  return []
}

export async function adjustCustomerPointsApi({ email, name, phone, points, reason }) {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kfs_admin_token') : null
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/loyalty/adjust', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, name, phone, points, reason }),
  })
  const data = await res.json()
  if (data.ok && data.customer) {
    notifyCustomerSubs(email, data.customer)
    return { ok: true, customer: data.customer }
  }
  throw new Error(data.error || 'Points adjustment failed.')
}

// ─── HELPER CALCULATIONS ──────────────────────────────────────────────────────
/**
 * Calculates points earned on an eligible order amount:
 * Default: 1 point per ₹100 spent.
 * ₹100 = 1 point, ₹500 = 5 points, ₹1,000 = 10 points.
 */
export function calculatePointsEarned(amount, config = activeConfig) {
  if (!config || !config.enabled) return 0
  const spendPerPoint = Math.max(1, Number(config.spendPerPoint) || 100)
  const pointsPerUnit = Number(config.pointsPerUnit) || 1
  return Math.floor(Math.max(0, Number(amount) || 0) / spendPerPoint) * pointsPerUnit
}

/**
 * Calculates Rupee value of points redeemed:
 * Default: 1 point = ₹1
 */
export function calculateRedemptionDiscount(points, config = activeConfig) {
  if (!config || !config.enabled || !config.redemptionEnabled) return 0
  const rate = Number(config.pointValueInInr) || 1
  return Math.max(0, Number(points) || 0) * rate
}

// Initial config fetch on load
if (typeof window !== 'undefined') {
  fetchLoyaltyConfig()
}
