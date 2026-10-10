import { useState, useMemo, useRef, useEffect } from 'react'
import { inr } from '../data/products'

// ─── constants ───────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Confirmed: 'bg-emerald-100 text-emerald-800',
  New:       'bg-amber-100 text-amber-800',
  Processing:'bg-blue-100 text-blue-800',
  Packed:    'bg-blue-100 text-blue-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-red-100 text-red-700',
  Refunded:  'bg-red-100 text-red-700',
}
const PAY_COLOR = {
  Paid:    'bg-emerald-100 text-emerald-800',
  paid:    'bg-emerald-100 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-800',
  unpaid:  'bg-amber-100 text-amber-800',
  COD:     'bg-blue-100 text-blue-800',
  Failed:  'bg-red-100 text-red-700',
}
const ALL_STATUSES = ['All', 'Confirmed', 'New', 'Processing', 'Packed', 'Delivered', 'Cancelled', 'Refunded']
const ALL_PAYMENTS = ['All', 'Paid', 'Pending', 'COD', 'Failed']

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${colorClass}`}>
      {label}
    </span>
  )
}

function StatPill({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-gold/40 bg-white p-3">
      <span className="text-xs text-ink/50 flex items-center gap-1">{icon} {label}</span>
      <span className="font-serif text-xl font-bold text-primary">{value}</span>
    </div>
  )
}

function OrderCard({ order }) {
  const [open, setOpen] = useState(false)
  const items = Array.isArray(order.items) ? order.items : []
  const statusCls = STATUS_COLOR[order.status || order.orderStatus] || 'bg-gold/20 text-ink'
  const payCls   = PAY_COLOR[order.paymentStatus]  || 'bg-gold/20 text-ink'

  return (
    <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-ivory/60 transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono text-xs font-bold text-primary shrink-0">{order.no}</span>
        <Badge label={order.status || 'New'} colorClass={statusCls} />
        <Badge label={order.paymentStatus || 'Pending'} colorClass={payCls} />
        <span className="ml-auto font-serif font-bold text-primary">{inr(order.total)}</span>
        <span className="text-xs text-ink/40">{order.at || (order.createdAt || '').slice(0, 10)}</span>
        <span className="text-ink/40 text-sm select-none">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gold/20 px-4 py-4 grid gap-4 sm:grid-cols-2 text-sm">
          <section>
            <h4 className="font-bold mb-1.5">Delivery</h4>
            <dl className="space-y-1 text-ink/70">
              <div><dt className="inline font-semibold text-ink">Address: </dt><dd className="inline">{order.address}</dd></div>
              {order.city && <div><dt className="inline font-semibold text-ink">City: </dt><dd className="inline">{order.city}{order.pincode ? ` – ${order.pincode}` : ''}</dd></div>}
              <div><dt className="inline font-semibold text-ink">Payment: </dt><dd className="inline">{order.paymentMethod || 'COD'}</dd></div>
            </dl>
          </section>
          <section>
            <h4 className="font-bold mb-1.5">Items</h4>
            <ul className="space-y-1 text-ink/70">
              {items.length
                ? items.map((item, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{typeof item === 'string' ? item : `${item.name} x ${item.q || item.quantity || 1}`}</span>
                      {item.price && <span className="font-semibold text-primary">{inr(item.price)}</span>}
                    </li>
                  ))
                : <li className="text-ink/40 italic">No item details</li>}
            </ul>
            {(order.subtotal > 0 || order.discount > 0 || order.shipping > 0) && (
              <div className="mt-2 border-t border-gold/20 pt-2 space-y-0.5 text-xs text-ink/60">
                {order.subtotal > 0 && <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>}
                {order.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{inr(order.discount)}</span></div>}
                {order.shipping > 0 && <div className="flex justify-between"><span>Shipping</span><span>{inr(order.shipping)}</span></div>}
                <div className="flex justify-between font-bold text-primary text-sm"><span>Total</span><span>{inr(order.total)}</span></div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function CustomerProfile({ customer, orders, onBack }) {
  const totalOrders  = orders.length
  const totalSpent   = orders.reduce((s, o) => s + Number(o.total || 0), 0)
  const deliveredCnt = orders.filter(o => (o.status || o.orderStatus) === 'Delivered').length
  const cancelledCnt = orders.filter(o => ['Cancelled','Refunded'].includes(o.status || o.orderStatus)).length
  const pendingCnt   = totalOrders - deliveredCnt - cancelledCnt
  const latestOrder  = orders[0]

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        &larr; Back to results
      </button>

      <div className="rounded-2xl border-2 border-gold/40 bg-white shadow-md overflow-hidden">
        {/* Customer banner */}
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-5 flex flex-wrap items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gold/20 flex items-center justify-center text-2xl font-bold text-gold shrink-0">
            {(customer.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-xl font-bold text-ivory truncate">{customer.name}</p>
            <p className="text-sm text-gold/80 truncate">{customer.email}</p>
            {customer.phone && <p className="text-xs text-ivory/60 mt-0.5">Phone: {customer.phone}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-ivory/60">Latest order</p>
            <p className="text-sm font-bold text-gold">{latestOrder?.at || '—'}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gold/20">
          <StatPill icon="🛒" label="Total orders" value={totalOrders} />
          <StatPill icon="💰" label="Total spent" value={inr(totalSpent)} />
          <StatPill icon="✅" label="Delivered" value={deliveredCnt} />
          <StatPill icon="📦" label="Pending" value={pendingCnt} />
        </div>

        {/* Order history */}
        <div className="p-4">
          <h3 className="font-bold text-sm text-ink/60 mb-3 uppercase tracking-wide">
            Order history ({totalOrders})
          </h3>
          <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-0.5">
            {orders.map(o => <OrderCard key={o.no} order={o} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function AdminOrderSearch({ orders }) {
  const [query, setQuery]         = useState('')
  const [statusFilter, setStatus] = useState('All')
  const [payFilter, setPay]       = useState('All')
  const [dateFrom, setFrom]       = useState('')
  const [dateTo, setTo]           = useState('')
  const [selectedEmail, setEmail] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.trim().toLowerCase()

  // Build customer map  email -> { name, email, phone, orders[] }
  const customerMap = useMemo(() => {
    const map = new Map()
    orders.forEach(o => {
      const key = (o.email || '').toLowerCase()
      if (!key) return
      if (!map.has(key)) {
        map.set(key, { name: o.name || o.customerName || '', email: o.email, phone: o.phone || '', orders: [] })
      }
      map.get(key).orders.push(o)
    })
    map.forEach(c => c.orders.sort(
      (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
    ))
    return map
  }, [orders])

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'All' && (o.status || o.orderStatus) !== statusFilter) return false
      if (payFilter !== 'All' && o.paymentStatus !== payFilter) return false
      if (dateFrom && (o.createdAt || o.created_at || '') < dateFrom) return false
      if (dateTo   && (o.createdAt || o.created_at || '') > dateTo + 'T23:59:59') return false
      if (!q) return true
      const text = [o.no, o.name, o.customerName, o.email, o.phone, o.address].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [orders, q, statusFilter, payFilter, dateFrom, dateTo])

  // Customer suggestions when searching
  const matchedCustomers = useMemo(() => {
    if (!q) return []
    return Array.from(customerMap.values()).filter(c => {
      const text = [c.name, c.email, c.phone].join(' ').toLowerCase()
      if (text.includes(q)) return true
      return c.orders.some(o => (o.no || '').toLowerCase().includes(q))
    })
  }, [customerMap, q])

  const selectedCustomer = selectedEmail ? customerMap.get(selectedEmail) : null
  const hasFilters = q || statusFilter !== 'All' || payFilter !== 'All' || dateFrom || dateTo

  if (selectedCustomer) {
    return (
      <CustomerProfile
        customer={selectedCustomer}
        orders={selectedCustomer.orders}
        onBack={() => setEmail(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <label htmlFor="order-search" className="sr-only">Search orders</label>
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input
          ref={inputRef}
          id="order-search"
          type="search"
          placeholder="Search by customer name, phone, email or order ID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full h-12 rounded-xl border-2 border-gold/50 bg-white pl-12 pr-12 text-base shadow-sm placeholder:text-ink/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute inset-y-0 right-4 flex items-center text-xl text-ink/40 hover:text-primary transition-colors"
            aria-label="Clear search"
          >x</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="filter-status" className="block text-xs font-bold text-ink/60 mb-1">Order status</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-gold/50 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filter-pay" className="block text-xs font-bold text-ink/60 mb-1">Payment</label>
          <select
            id="filter-pay"
            value={payFilter}
            onChange={e => setPay(e.target.value)}
            className="h-10 rounded-lg border border-gold/50 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            {ALL_PAYMENTS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filter-from" className="block text-xs font-bold text-ink/60 mb-1">From date</label>
          <input
            id="filter-from"
            type="date"
            value={dateFrom}
            onChange={e => setFrom(e.target.value)}
            className="h-10 rounded-lg border border-gold/50 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="filter-to" className="block text-xs font-bold text-ink/60 mb-1">To date</label>
          <input
            id="filter-to"
            type="date"
            value={dateTo}
            onChange={e => setTo(e.target.value)}
            className="h-10 rounded-lg border border-gold/50 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setQuery(''); setStatus('All'); setPay('All'); setFrom(''); setTo('') }}
            className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors self-end"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Customer suggestion cards */}
      {q && matchedCustomers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-ink/50 uppercase tracking-wide mb-2">
            {matchedCustomers.length} customer{matchedCustomers.length !== 1 ? 's' : ''} found — click to view full profile
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matchedCustomers.map(c => (
              <button
                key={c.email}
                type="button"
                onClick={() => setEmail(c.email.toLowerCase())}
                className="text-left rounded-xl border-2 border-gold/30 bg-white p-4 shadow-sm hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{c.name}</p>
                    <p className="text-xs text-ink/50 truncate">{c.email}</p>
                    {c.phone && <p className="text-xs text-ink/40">{c.phone}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-ink/60">
                  <span>Orders: {c.orders.length}</span>
                  <span>Spent: {inr(c.orders.reduce((s, o) => s + Number(o.total || 0), 0))}</span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">View full profile &rarr;</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm text-ink/60">
            <span className="font-bold text-primary">{filteredOrders.length}</span>
            {' '}{hasFilters ? 'matching' : 'total'} order{filteredOrders.length !== 1 ? 's' : ''}
          </p>
          {filteredOrders.length > 0 && (
            <p className="text-sm text-ink/60">
              Total value: <span className="font-bold text-primary">{inr(filteredOrders.reduce((s, o) => s + Number(o.total || 0), 0))}</span>
            </p>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-gold/30 bg-white p-12 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-bold text-ink/70">No orders found</p>
            <p className="text-sm text-ink/40 mt-1">Try a different search term or clear the filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(o => {
              const statusCls = STATUS_COLOR[o.status || o.orderStatus] || 'bg-gold/20 text-ink'
              const payCls   = PAY_COLOR[o.paymentStatus]  || 'bg-gold/20 text-ink'
              const items    = Array.isArray(o.items) ? o.items : []
              return (
                <div key={o.no} className="rounded-xl border border-gold/30 bg-white shadow-sm p-4 hover:shadow-md transition-all">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{o.no}</span>
                      <Badge label={o.status || 'New'} colorClass={statusCls} />
                      <Badge label={o.paymentStatus || 'Pending'} colorClass={payCls} />
                    </div>
                    <span className="font-serif font-bold text-primary">{inr(o.total)}</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <button
                        type="button"
                        onClick={() => setEmail((o.email || '').toLowerCase())}
                        className="font-bold hover:text-primary hover:underline transition-colors text-left"
                        title="View full customer profile"
                      >
                        {o.name || o.customerName}
                      </button>
                      <p className="text-xs text-ink/50">{o.email}</p>
                      {o.phone && <p className="text-xs text-ink/50">Phone: {o.phone}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-ink/50 mb-1">Date: {o.at || (o.createdAt || '').slice(0, 10)}</p>
                      <p className="text-xs text-ink/70 truncate">Address: {o.address}{o.city ? `, ${o.city}` : ''}</p>
                      {items.length > 0 && (
                        <p className="text-xs text-ink/50 mt-0.5 truncate">
                          Items: {items.slice(0, 2).map(i => typeof i === 'string' ? i : `${i.name} x${i.q||i.quantity||1}`).join(', ')}
                          {items.length > 2 ? ` +${items.length - 2} more` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

