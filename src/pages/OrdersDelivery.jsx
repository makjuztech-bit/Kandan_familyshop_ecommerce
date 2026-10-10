import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useOrders } from '../data/orders'
import { useAuthStatus } from '../data/auth'
import { inr } from '../data/products'
import { Wrap, btnP, btnO } from '../components/ui'

// ─── Customer Orders Page ────────────────────────────────────────────────────
export function CustomerOrders() {
  const orders = useOrders()
  const session = useAuthStatus()
  const navigate = useNavigate()

  if (!session?.loggedIn) return <Navigate to="/login" replace />

  const myOrders = orders.filter(o =>
    (o.email || '').toLowerCase() === (session?.email || '').toLowerCase()
  )

  const BADGE = {
    New: 'bg-amber-100 text-amber-800',
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Pending: 'bg-amber-100 text-amber-800',
    Processing: 'bg-blue-100 text-blue-800',
    Packed: 'bg-blue-100 text-blue-800',
    Shipped: 'bg-indigo-100 text-indigo-800',
    Delivered: 'bg-emerald-100 text-emerald-800',
    Cancelled: 'bg-red-100 text-red-700',
    Refunded: 'bg-red-100 text-red-700',
  }

  return (
    <Wrap className="py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">My Account</p>
          <h1 className="text-4xl">My Orders</h1>
          <p className="mt-1 text-sm text-ink/60">Track and manage all your orders</p>
        </div>
        <Link to="/account" className={btnO}>← Back to Account</Link>
      </div>

      {myOrders.length === 0 ? (
        <div className="rounded-2xl border border-gold/40 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-4xl">🛒</div>
          <h2 className="text-2xl">No orders yet</h2>
          <p className="mt-2 text-ink/60">You haven't placed any orders. Browse our collection and find the perfect saree!</p>
          <Link to="/shop" className={btnP + ' mt-6'}>Browse Collection</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {myOrders.map(order => (
            <li key={order.no} className="overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-sm">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 bg-ivory/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink/50">Order</span>
                  <span className="font-mono font-bold text-primary">{order.no}</span>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${BADGE[order.status || 'New'] || 'bg-gold/20 text-ink'}`}>
                    {order.status || 'New'}
                  </span>
                </div>
                <span className="text-xs text-ink/50">{order.at}</span>
              </div>
              {/* Body */}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 text-sm text-ink/70">
                    <p><span className="font-semibold text-ink">📦 Items:</span> {(order.items || []).length} item(s)</p>
                    <p><span className="font-semibold text-ink">💳 Payment:</span> <span className="capitalize">{order.paymentStatus || 'unpaid'}</span></p>
                    <p><span className="font-semibold text-ink">📍 Delivery:</span> {order.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-2xl font-bold text-primary">{inr(order.total || 0)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      <Link to={`/order/${order.no}`} className={btnP}>View Details</Link>
                      <Link to={`/delivery?order=${order.no}`} className={btnO}>Track Delivery</Link>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Wrap>
  )
}

// ─── Customer Delivery Tracking Page ─────────────────────────────────────────
export function CustomerDelivery() {
  const orders = useOrders()
  const session = useAuthStatus()
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  if (!session?.loggedIn) return <Navigate to="/login" replace />

  const myOrders = orders.filter(o =>
    (o.email || '').toLowerCase() === (session?.email || '').toLowerCase()
  )

  // If ?order=KFS-xxx in URL, pre-filter
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const preFilter = params.get('order') || ''
  const [filter, setFilter] = useState(preFilter)

  const displayOrders = myOrders.filter(o =>
    !filter || o.no.toLowerCase().includes(filter.toLowerCase())
  )

  const steps = ['Confirmed', 'Packed', 'Delivered']
  const STEP_ICON = ['📋', '📦', '🚚']

  const BADGE = {
    New: 'bg-amber-100 text-amber-800',
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Pending: 'bg-amber-100 text-amber-800',
    Processing: 'bg-blue-100 text-blue-800',
    Packed: 'bg-blue-100 text-blue-800',
    Shipped: 'bg-indigo-100 text-indigo-800',
    Delivered: 'bg-emerald-100 text-emerald-800',
    Cancelled: 'bg-red-100 text-red-700',
    Refunded: 'bg-red-100 text-red-700',
  }

  return (
    <Wrap className="py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">My Account</p>
          <h1 className="text-4xl">Delivery Tracking</h1>
          <p className="mt-1 text-sm text-ink/60">Real-time delivery status for your orders</p>
        </div>
        <div className="flex gap-2">
          <Link to="/orders" className={btnO}>← My Orders</Link>
          <Link to="/account" className={btnO}>Account</Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <label htmlFor="delivery-search" className="mb-1 block text-sm font-bold">Search by order number</label>
        <input
          id="delivery-search"
          type="search"
          placeholder="e.g. KFS-ABC123"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="h-11 w-full max-w-sm border border-gold-dark/50 bg-white px-3 text-sm"
        />
      </div>

      {myOrders.length === 0 ? (
        <div className="rounded-2xl border border-gold/40 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-4xl">🚚</div>
          <h2 className="text-2xl">No orders to track</h2>
          <p className="mt-2 text-ink/60">Place an order and check back here to track its delivery status.</p>
          <Link to="/shop" className={btnP + ' mt-6'}>Shop Now</Link>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="rounded-xl border border-gold/40 bg-white p-8 text-center text-ink/60">
          No orders found matching "{filter}". <button className="font-bold text-primary underline" onClick={() => setFilter('')}>Clear</button>
        </div>
      ) : (
        <ul className="space-y-6">
          {displayOrders.map(order => {
            const status = order.status || 'New'
            const getStepIndex = (st) => {
              const s = (st || '').toLowerCase()
              if (s === 'delivered' || s === 'completed') return 2
              if (s === 'packed' || s === 'shipped' || s === 'processing') return 1
              return 0
            }
            const stepIndex = getStepIndex(status)
            const isCancelled = status === 'Cancelled' || status === 'Refunded'

            return (
              <li key={order.no} className="overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-sm">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 bg-ivory/60 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink/50">Order</span>
                    <span className="font-mono font-bold text-primary">{order.no}</span>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${BADGE[status] || 'bg-gold/20 text-ink'}`}>
                      {status}
                    </span>
                  </div>
                  <span className="text-xs text-ink/50">{order.at}</span>
                </div>

                {/* Delivery info */}
                <div className="p-5">
                  <div className="mb-5 text-sm text-ink/70">
                    <p><span className="font-semibold text-ink">📍 Delivery address:</span> {order.address}</p>
                    <p className="mt-1"><span className="font-semibold text-ink">📞 Phone:</span> {order.phone}</p>
                  </div>

                  {/* Progress tracker */}
                  {isCancelled ? (
                    <div className="rounded-xl bg-red-50 p-4 text-center font-bold text-red-800">
                      This order has been {status.toLowerCase()}.
                    </div>
                  ) : (
                    <div className="relative">
                      {/* connector line */}
                      <div className="absolute left-[calc(16.66%-0.5px)] right-[calc(16.66%-0.5px)] top-5 h-1 rounded-full bg-gold/20 sm:left-[calc(16.66%)] sm:right-[calc(16.66%)]" />
                      <div
                        className="absolute left-[calc(16.66%-0.5px)] top-5 h-1 rounded-full bg-primary transition-all duration-700"
                        style={{ width: stepIndex === 0 ? '0%' : stepIndex === 1 ? '50%' : '100%', right: 'auto', maxWidth: 'calc(100% - 33.33%)' }}
                      />
                      <div className="relative flex justify-between gap-1">
                        {steps.map((step, i) => (
                          <div key={step} className="flex flex-1 flex-col items-center gap-2">
                            <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all duration-500 ${
                              i <= stepIndex
                                ? 'bg-primary text-ivory shadow-lg shadow-primary/30'
                                : 'bg-gold/20 text-primary/40'
                            }`}>
                              {i <= stepIndex ? '✓' : STEP_ICON[i]}
                            </div>
                            <span className={`text-center text-xs font-semibold ${i <= stepIndex ? 'text-primary' : 'text-ink/40'}`}>
                              {step}
                            </span>
                            {i === stepIndex && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Current</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Status message */}
                      <div className={`mt-5 rounded-xl p-3 text-sm text-center font-semibold ${
                        status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : status === 'Packed'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {status === 'Delivered'
                          ? '🎉 Your order has been delivered! We hope you love it.'
                          : status === 'Packed'
                          ? '📦 Your order is packed and ready for dispatch.'
                          : '📋 Your order has been received and is being processed.'}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <Link to={`/order/${order.no}`} className={btnO}>Full Details</Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Wrap>
  )
}

