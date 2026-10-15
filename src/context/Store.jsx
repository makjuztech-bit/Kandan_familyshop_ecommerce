import { createContext, useContext, useEffect, useState } from 'react'
import { byId } from '../data/products'

const C = createContext()
const load = k => {
  try {
    return JSON.parse(localStorage.getItem(k)) || []
  } catch {
    return []
  }
}

export const useStore = () => useContext(C)

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => load('kfs_cart').filter(i => byId[i.id]))
  const [wish, setWish] = useState(() => load('kfs_wish').filter(id => byId[id]))

  useEffect(() => {
    try {
      localStorage.setItem('kfs_cart', JSON.stringify(cart))
    } catch {}
  }, [cart])

  useEffect(() => {
    try {
      localStorage.setItem('kfs_wish', JSON.stringify(wish))
    } catch {}
  }, [wish])

  const add = (id, q = 1) => {
    const p = byId[id]
    if (!p || p.stock === false) return
    const addQty = Math.max(1, Number(q) || 1)
    setCart(c =>
      c.some(i => i.id === id)
        ? c.map(i => (i.id === id ? { ...i, q: Math.min(10, (Number(i.q) || 1) + addQty) } : i))
        : [...c, { id, q: Math.min(10, addQty) }]
    )
  }

  const setQty = (id, q) =>
    setCart(c =>
      q < 1
        ? c.filter(i => i.id !== id)
        : c.map(i => (i.id === id ? { ...i, q: Math.min(10, Math.max(1, Number(q) || 1)) } : i))
    )

  const remove = id => setCart(c => c.filter(i => i.id !== id))
  const clear = () => setCart([])
  const toggleWish = id => setWish(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id]))

  const lines = cart
    .map(i => {
      const p = byId[i.id]
      if (!p) return null
      return { ...p, q: Math.max(1, Number(i.q) || 1) }
    })
    .filter(Boolean)

  const count = lines.reduce((s, l) => s + (l.q || 0), 0)
  const total = lines.reduce((s, l) => s + (l.q || 0) * (Number(l.price) || 0), 0)

  return (
    <C.Provider value={{ cart, lines, count, total, add, setQty, remove, clear, wish, toggleWish }}>
      {children}
    </C.Provider>
  )
}
