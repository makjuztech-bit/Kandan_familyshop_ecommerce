import { useSyncExternalStore } from 'react'
import { API_BASE, getAdminAuthHeaders } from '../config/shop'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const ORDERS_KEY = 'kfs_orders_cache'
let list = []
let loaded = false
let initialLoadDone = false
const subs = new Set()
const emit = () => subs.forEach(f => {
  try { f() } catch {}
})

// Initialize orders synchronously from localStorage cache
if (typeof localStorage !== 'undefined') {
  try {
    const cached = localStorage.getItem(ORDERS_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed
      }
    }
  } catch {}
}

function saveCache(newList) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(newList))
    } catch {}
  }
}

export async function addOrder(orderData) {
  let created = null

  // 1. Try cloud database (Supabase) if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('orders').insert([
        {
          no: orderData.no,
          customer_name: orderData.name,
          email: orderData.email,
          phone: orderData.phone,
          address: orderData.address,
          total: orderData.total,
          items_json: JSON.stringify(orderData.items || []),
          payment_method: orderData.paymentMethod || 'COD',
          payment_status: orderData.paymentStatus || 'Pending',
          order_status: orderData.status || 'Confirmed',
          created_at: new Date().toISOString(),
        }
      ]).select().single()

      if (!error && data) {
        created = {
          ...orderData,
          id: data.id || orderData.id,
          at: new Date().toLocaleString('en-IN')
        }
      }
    } catch (sbErr) {
      console.warn('[Supabase addOrder notice]:', sbErr.message)
    }
  }

  // 2. Try backend API server
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })
    if (res.ok) {
      const { order } = await res.json()
      if (order) created = order
    }
  } catch (err) {
    console.warn('Failed to add order via API:', err.message)
  }

  const finalOrder = created || {
    ...orderData,
    at: new Date().toLocaleString('en-IN')
  }

  list = [finalOrder, ...list]
  saveCache(list)
  emit()
  return finalOrder
}

export async function updateOrder(no, patch) {
  let updated = null

  // 1. Try cloud database (Supabase) if available
  if (isSupabaseConfigured && supabase) {
    try {
      const sbPatch = {}
      if (patch.status) sbPatch.order_status = patch.status
      if (patch.paymentStatus) sbPatch.payment_status = patch.paymentStatus
      await supabase.from('orders').update(sbPatch).eq('no', no)
    } catch (sbErr) {
      console.warn('[Supabase updateOrder notice]:', sbErr.message)
    }
  }

  // 2. Try backend API server
  try {
    const res = await fetch(`${API_BASE}/api/orders/${no}`, {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(patch)
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.order) updated = data.order
    }
  } catch (err) {
    console.warn('Failed to update order on server:', err.message)
  }

  list = list.map(o => {
    if (o.no === no) {
      return updated || { ...o, ...patch }
    }
    return o
  })
  saveCache(list)
  emit()
  return list.find(o => o.no === no) || null
}

export async function deleteOrder(no) {
  // 1. Try cloud database (Supabase)
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('orders').delete().eq('no', no)
    } catch (sbErr) {
      console.warn('[Supabase deleteOrder notice]:', sbErr.message)
    }
  }

  // 2. Try backend API server
  try {
    await fetch(`${API_BASE}/api/orders/${no}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders()
    })
  } catch (err) {
    console.warn('Failed to delete order on server:', err.message)
  }

  list = list.filter(o => o.no !== no)
  saveCache(list)
  emit()
}

export const useOrders = () => {
  if (typeof window !== 'undefined' && !initialLoadDone) {
    initialLoadDone = true
    setTimeout(() => loadOrders(true), 0)
  }
  return useSyncExternalStore(f => {
    subs.add(f)
    return () => subs.delete(f)
  }, () => list)
}

// Load orders from Supabase or backend API
export async function loadOrders(force = false) {
  if (loaded && !force && list.length > 0) return list

  let serverOrders = null

  // 1. Fetch from Supabase cloud database if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        serverOrders = data.map(row => {
          let items = []
          try {
            items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || [])
          } catch {
            items = []
          }
          return {
            id: row.id,
            no: row.no,
            name: row.customer_name || row.name,
            email: row.email,
            phone: row.phone,
            address: row.address,
            total: Number(row.total || 0),
            paymentMethod: row.payment_method || 'COD',
            paymentStatus: row.payment_status || 'Pending',
            status: row.order_status || row.status || 'Confirmed',
            items,
            createdAt: row.created_at,
            at: row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : 'Recent',
            emailStatus: row.email_sent ? 'sent' : 'none',
          }
        })
      }
    } catch (sbErr) {
      console.info('[Supabase orders sync notice]:', sbErr.message)
    }
  }

  // 2. Fallback to Express backend if running
  if (!serverOrders || serverOrders.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: getAdminAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          serverOrders = data
        }
      }
    } catch (err) {
      // Local fallback
    }
  }

  if (Array.isArray(serverOrders) && serverOrders.length > 0) {
    list = serverOrders
    saveCache(list)
    loaded = true
    emit()
  } else if (!loaded) {
    loaded = true
  }

  return list
}
