import { useSyncExternalStore } from 'react'
import { API_BASE, getAdminAuthHeaders } from '../config/shop'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { db, isFirebaseConfigured } from '../services/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'

const ORDERS_KEY = 'kfs_orders_cache'
let list = []
let loaded = false
let initialLoadDone = false
let firestoreUnsubscribe = null
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

function normalizeOrder(order) {
  if (!order || typeof order !== 'object') return null
  const now = new Date()
  const createdAt = order.createdAt || order.created_at || now.toISOString()
  let at = order.at
  if (!at) {
    try {
      at = new Date(createdAt).toLocaleString('en-IN')
    } catch {
      at = now.toLocaleString('en-IN')
    }
  }

  let items = []
  if (Array.isArray(order.items)) {
    items = order.items
  } else if (typeof order.items_json === 'string') {
    try { items = JSON.parse(order.items_json) } catch { items = [] }
  } else if (order.items_json && Array.isArray(order.items_json)) {
    items = order.items_json
  }

  const paymentMethod = order.paymentMethod || order.payment_method || 'COD'
  const isOnlinePayment = paymentMethod.toLowerCase().includes('razorpay') || paymentMethod.toLowerCase().includes('online') || paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('upi')
  const paymentStatus = order.paymentStatus || order.payment_status || 'Pending'
  const isPaid = paymentStatus.toLowerCase() === 'paid'
  const status = order.orderStatus || order.order_status || order.status || (isOnlinePayment && !isPaid ? 'Pending Payment' : 'Confirmed')

  return {
    ...order,
    id: order.id || order.no,
    no: order.no,
    name: order.name || order.customer_name || order.customerName || 'Customer',
    customerName: order.name || order.customer_name || order.customerName || 'Customer',
    email: order.email || '',
    phone: order.phone || '',
    address: order.address || '',
    city: order.city || '',
    pincode: order.pincode || '',
    total: Number(order.total || 0),
    subtotal: Number(order.subtotal || order.total || 0),
    discount: Number(order.discount || 0),
    status,
    orderStatus: status,
    paymentStatus,
    paymentMethod,
    paymentId: order.paymentId || order.payment_id || '',
    razorpayOrderId: order.razorpayOrderId || order.razorpay_order_id || '',
    items,
    createdAt,
    at,
    emailStatus: order.emailStatus || (order.email_sent ? 'sent' : 'none'),
  }
}

export async function addOrder(orderData) {
  const now = new Date()
  const orderNo =
    orderData.no ||
    ('KFS-' + now.getTime().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase())

  const preparedOrder = normalizeOrder({
    ...orderData,
    no: orderNo,
    createdAt: orderData.createdAt || now.toISOString(),
    at: now.toLocaleString('en-IN'),
  })

  let created = preparedOrder

  // 1. Save to Cloud Firestore (Real-time synchronization across all devices)
  if (isFirebaseConfigured() && db) {
    try {
      const orderRef = doc(db, 'orders', orderNo)
      await setDoc(orderRef, {
        ...preparedOrder,
        serverUpdatedAt: serverTimestamp(),
      }, { merge: true })
    } catch (fbErr) {
      console.warn('[Firestore addOrder notice]:', fbErr.message)
    }
  }

  // 2. Save to Supabase cloud database if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('orders').upsert([
        {
          no: preparedOrder.no,
          customer_name: preparedOrder.name,
          email: preparedOrder.email,
          phone: preparedOrder.phone,
          address: preparedOrder.address,
          total: preparedOrder.total,
          items_json: JSON.stringify(preparedOrder.items || []),
          payment_method: preparedOrder.paymentMethod,
          payment_status: preparedOrder.paymentStatus,
          order_status: preparedOrder.status,
          created_at: preparedOrder.createdAt,
        }
      ], { onConflict: 'no' }).select().single()

      if (!error && data) {
        created.id = data.id || created.id
      }
    } catch (sbErr) {
      console.warn('[Supabase addOrder notice]:', sbErr.message)
    }
  }

  // 3. Save to backend Express API server
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preparedOrder)
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.order) {
        created = normalizeOrder({ ...preparedOrder, ...data.order })
      }
    }
  } catch (err) {
    console.warn('API addOrder notice:', err.message)
  }

  // Merge into in-memory list without duplicates
  const existingIdx = list.findIndex(o => o.no === preparedOrder.no)
  if (existingIdx >= 0) {
    list[existingIdx] = created
  } else {
    list = [created, ...list]
  }
  saveCache(list)
  emit()
  return created
}

export async function updateOrder(no, patch) {
  let updated = null
  const existingOrder = list.find(o => o.no === no)
  const patchedStatus = patch.status || patch.orderStatus
  const patchedPayment = patch.paymentStatus

  // 1. Update in Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const orderRef = doc(db, 'orders', no)
      const fbPatch = { ...patch, serverUpdatedAt: serverTimestamp() }
      if (patchedStatus) fbPatch.status = patchedStatus
      if (patchedPayment) fbPatch.paymentStatus = patchedPayment
      await setDoc(orderRef, fbPatch, { merge: true })
    } catch (fbErr) {
      console.warn('[Firestore updateOrder notice]:', fbErr.message)
    }
  }

  // 2. Update in Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const sbPatch = {}
      if (patchedStatus) sbPatch.order_status = patchedStatus
      if (patchedPayment) sbPatch.payment_status = patchedPayment
      await supabase.from('orders').update(sbPatch).eq('no', no)
    } catch (sbErr) {
      console.warn('[Supabase updateOrder notice]:', sbErr.message)
    }
  }

  // 3. Update on backend API server
  try {
    const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(no)}`, {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(patch)
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.order) updated = normalizeOrder(data.order)
    }
  } catch (err) {
    console.warn('Backend updateOrder notice:', err.message)
  }

  list = list.map(o => {
    if (o.no === no) {
      return updated || normalizeOrder({ ...o, ...patch })
    }
    return o
  })
  saveCache(list)
  emit()
  return list.find(o => o.no === no) || null
}

export async function deleteOrder(no) {
  // 1. Delete from Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'orders', no))
    } catch (fbErr) {
      console.warn('[Firestore deleteOrder notice]:', fbErr.message)
    }
  }

  // 2. Delete from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('orders').delete().eq('no', no)
    } catch (sbErr) {
      console.warn('[Supabase deleteOrder notice]:', sbErr.message)
    }
  }

  // 3. Delete from backend API
  try {
    await fetch(`${API_BASE}/api/orders/${encodeURIComponent(no)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders()
    })
  } catch (err) {
    console.warn('Backend deleteOrder notice:', err.message)
  }

  list = list.filter(o => o.no !== no)
  saveCache(list)
  emit()
}

export async function getOrderByNo(no) {
  if (!no) return null
  const trimmed = String(no).trim()
  
  // 1. Check local in-memory cache
  const found = list.find(o => (o.no || '').toLowerCase() === trimmed.toLowerCase())
  if (found) return found

  // 2. Check Cloud Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, 'orders', trimmed))
      if (snap.exists()) {
        const order = normalizeOrder({ ...snap.data(), no: snap.id })
        list = [order, ...list.filter(o => o.no !== order.no)]
        saveCache(list)
        emit()
        return order
      }
    } catch {}
  }

  // 3. Check backend API
  try {
    const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(trimmed)}`)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data && data.no) {
        const order = normalizeOrder(data)
        list = [order, ...list.filter(o => o.no !== order.no)]
        saveCache(list)
        emit()
        return order
      }
    }
  } catch {}

  // 4. Check Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('orders').select('*').eq('no', trimmed).maybeSingle()
      if (data) {
        const order = normalizeOrder(data)
        list = [order, ...list.filter(o => o.no !== order.no)]
        saveCache(list)
        emit()
        return order
      }
    } catch {}
  }

  return null
}

export const useOrders = () => {
  if (typeof window !== 'undefined' && !initialLoadDone) {
    initialLoadDone = true
    setTimeout(() => loadOrders(true), 0)
    setupFirestoreListener()
  }
  return useSyncExternalStore(f => {
    subs.add(f)
    return () => subs.delete(f)
  }, () => list)
}

function setupFirestoreListener() {
  if (firestoreUnsubscribe) return
  if (!isFirebaseConfigured() || !db) return

  try {
    const ordersCol = collection(db, 'orders')
    firestoreUnsubscribe = onSnapshot(ordersCol, (snapshot) => {
      if (!snapshot.empty) {
        const remoteOrders = []
        snapshot.forEach(docSnap => {
          remoteOrders.push(normalizeOrder({ ...docSnap.data(), no: docSnap.id }))
        })

        // Merge remote orders with existing list
        const map = new Map()
        remoteOrders.forEach(o => map.set(o.no, o))
        list.forEach(o => {
          if (!map.has(o.no)) map.set(o.no, o)
        })

        list = Array.from(map.values()).sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        })

        saveCache(list)
        emit()
      }
    }, (err) => {
      console.info('[Firestore orders listener notice]:', err.message)
    })
  } catch (err) {
    console.info('[Firestore setup error]:', err.message)
  }
}

// Load orders from Firestore, Supabase, and backend API
export async function loadOrders(force = false) {
  if (loaded && !force && list.length > 0) return list

  let fetchedOrders = []

  // 1. Fetch from Firestore if configured
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, 'orders'))
      if (!snap.empty) {
        snap.forEach(docSnap => {
          fetchedOrders.push(normalizeOrder({ ...docSnap.data(), no: docSnap.id }))
        })
      }
    } catch (fbErr) {
      console.info('[Firestore fetch orders notice]:', fbErr.message)
    }
  }

  // 2. Fetch from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        const sbOrders = data.map(normalizeOrder).filter(Boolean)
        fetchedOrders = [...fetchedOrders, ...sbOrders]
      }
    } catch (sbErr) {
      console.info('[Supabase orders sync notice]:', sbErr.message)
    }
  }

  // 3. Fallback to Express backend if running
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: getAdminAuthHeaders()
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (Array.isArray(data) && data.length > 0) {
        const apiOrders = data.map(normalizeOrder).filter(Boolean)
        fetchedOrders = [...fetchedOrders, ...apiOrders]
      }
    }
  } catch {}

  // Deduplicate by order `no`
  if (fetchedOrders.length > 0) {
    const map = new Map()
    fetchedOrders.forEach(o => {
      if (o && o.no) map.set(o.no, o)
    })
    list.forEach(o => {
      if (o && o.no && !map.has(o.no)) map.set(o.no, o)
    })

    list = Array.from(map.values()).sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })

    saveCache(list)
    loaded = true
    emit()
  } else if (!loaded) {
    loaded = true
  }

  return list
}
