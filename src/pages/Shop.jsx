import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { products, useCatalog, inr } from '../data/products'
import { Wrap, Grid, btnP, btnO } from '../components/ui'

const sel = 'min-h-11 w-full border border-gold-dark/50 bg-white px-3'
const lab = 'mb-1 block text-sm font-bold'

export function CategoryPage() {
  useCatalog()
  return (
    <Wrap className="py-10">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-serif font-bold text-primary">All Products</h1>
          <p className="mt-1 text-sm text-ink/70">Explore our authentic textile catalogue</p>
        </div>
        <Link to="/shop" className={btnO}>Browse all</Link>
      </div>
      <Grid items={products} />
    </Wrap>
  )
}

export default function Shop() {
  useCatalog()
  const [sp, setSp] = useSearchParams()
  const [drawer, setDrawer] = useState(false)
  const g = (k) => sp.get(k) || ''

  const f = {
    q: g('q'),
    max: +g('max') || 5000,
    sort: g('sort') || 'name',
  }

  const set = (k, v) => {
    const n = new URLSearchParams(sp)
    if (v === '' || v === false || (k === 'max' && +v >= 5000)) {
      n.delete(k)
    } else {
      n.set(k, v === true ? '1' : v)
    }
    setSp(n, { replace: true })
  }

  const list = products
    .filter((p) => (!f.q || p.name.toLowerCase().includes(f.q.toLowerCase())) && p.price <= f.max)
    .sort((a, b) => (f.sort === 'low' ? a.price - b.price : f.sort === 'high' ? b.price - a.price : a.name.localeCompare(b.name)))

  const Filters = ({ x }) => (
    <div className="space-y-5 rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
      <div>
        <label className={lab} htmlFor={x + 'q'}>Search by Name</label>
        <input
          id={x + 'q'}
          type="search"
          placeholder="Search product name..."
          className={sel}
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
        />
      </div>
      <div>
        <label className={lab} htmlFor={x + 'p'}>
          Maximum Price: {inr(f.max)}
        </label>
        <input
          id={x + 'p'}
          type="range"
          min="200"
          max="3000"
          step="25"
          value={f.max > 3000 ? 3000 : f.max}
          onChange={(e) => set('max', e.target.value)}
          className="h-11 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-ink/60">
          <span>₹200</span>
          <span>₹3,000</span>
        </div>
      </div>
      <button className={btnO + ' w-full'} onClick={() => setSp({})}>
        Clear Filters
      </button>
    </div>
  )

  return (
    <Wrap className="py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gold/30 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">Product Catalogue</h1>
          <p className="mt-1 text-sm text-ink/70">Authentic textile collection ({products.length} products)</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={btnO + ' lg:hidden'} onClick={() => setDrawer(true)}>
            Filters
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-ink/80" htmlFor="sort">Sort:</label>
            <select
              id="sort"
              className="min-h-11 rounded-lg border border-gold-dark/50 bg-white px-3 text-sm"
              value={f.sort}
              onChange={(e) => set('sort', e.target.value === 'name' ? '' : e.target.value)}
            >
              <option value="name">Name A–Z</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <Filters x="s" />
        </aside>
        <div>
          {list.length ? (
            <Grid items={list} />
          ) : (
            <div className="rounded-2xl border border-gold/50 bg-white p-12 text-center shadow-sm">
              <h2 className="text-2xl font-serif font-bold text-ink">No products match your search</h2>
              <p className="mt-2 text-ink/70">Try searching with a different product name or adjusting the price slider.</p>
              <button className={btnP + ' mt-5'} onClick={() => setSp({})}>
                View All Products
              </button>
            </div>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-ivory p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-primary">Filters</h2>
              <button className="h-11 w-11 text-xl font-bold" aria-label="Close filters" onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <Filters x="d" />
            <button className={btnP + ' mt-6 w-full'} onClick={() => setDrawer(false)}>
              Show {list.length} Products
            </button>
          </div>
        </div>
      )}
    </Wrap>
  )
}
