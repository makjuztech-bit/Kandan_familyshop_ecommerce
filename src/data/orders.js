import {useSyncExternalStore} from 'react'
import { API_BASE } from '../config/shop'

let list = []
let loaded = false
const subs = new Set()

const emit = () => subs.forEach(f => f())

// Moved below useOrders
let initialLoadDone = false;

export async function addOrder(orderData) {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (res.ok) {
      const { order } = await res.json();
      list = [order, ...list];
      emit();
      return order;
    }
  } catch (err) {
    console.error('Failed to add order', err);
  }
  return null;
}

export async function updateOrder(no, patch) {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${no}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const { order } = await res.json();
      list = list.map(o => o.no === no ? order : o);
      emit();
      return order;
    }
  } catch (err) {
    console.error('Failed to update order', err);
  }
  return null;
}

export async function deleteOrder(no) {
  try {
    await fetch(`${API_BASE}/api/orders/${no}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to delete order on server:', err);
  }
  list = list.filter(o => o.no !== no);
  emit();
}

export const useOrders = () => {
  if (typeof window !== 'undefined' && !initialLoadDone) {
    initialLoadDone = true;
    setTimeout(() => loadOrders(true), 0);
  }
  return useSyncExternalStore(f => {
    subs.add(f)
    return () => subs.delete(f)
  }, () => list)
}

// Add an optional force parameter to loadOrders
export async function loadOrders(force = false) {
  if (loaded && !force) return list;
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (res.ok) {
      list = await res.json();
      loaded = true;
      emit();
    }
  } catch (err) {
    console.error('Failed to load orders', err);
  }
  return list;
}
