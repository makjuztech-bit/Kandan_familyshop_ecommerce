import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, getOrderByNo } from '../data/orders'
import { useAuthStatus } from '../data/auth'
import { inr } from '../data/products'
import { Wrap, btnP, btnO } from '../components/ui'
import { SHOP } from '../config/shop'

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

const DELIVERY_STEPS = [
  { key: 'Confirmed', label: 'Order Placed', icon: '📋' },
  { key: 'Processing', label: 'Processing', icon: '⚙️' },
  { key: 'Packed', label: 'Packed & Dispatched', icon: '📦' },
  { key: 'Delivered', label: 'Delivered', icon: '🚚' },
]

function getDeliveryStepIndex(status) {
  const s = (status || '').toLowerCase()
  if (s === 'delivered' || s === 'completed') return 3
  if (s === 'packed' || s === 'shipped') return 2
  if (s === 'processing') return 1
  if (s === 'confirmed' || s === 'new' || s === 'pending') return 0
  return 0
}

// ─── Customer Orders Page ────────────────────────────────────────────────────
export function CustomerOrders() {
  const orders = useOrders()
  const session = useAuthStatus()
  const navigate = useNavigate()

  if (!session?.loggedIn) return <Navigate to="/login" replace />

  const myOrders = orders.filter(o =>
    (o.email || '').trim().toLowerCase() === (session?.email || '').trim().toLowerCase()
  )

  return (
    <Wrap className="py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">My Account</p>
          <h1 className="text-4xl">My Orders</h1>
          <p className="mt-1 text-sm text-ink/60">Track and manage all your boutique orders</p>
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
                    <p><span className="font-semibold text-ink">💳 Payment:</span> <span className="capitalize">{order.paymentStatus || 'unpaid'}</span> ({order.paymentMethod || 'COD'})</p>
                    <p><span className="font-semibold text-ink">📍 Delivery:</span> {order.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-2xl font-bold text-primary">{inr(order.total || 0)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {String(order.paymentStatus).toLowerCase() !== 'paid' && String(order.paymentMethod).toLowerCase().includes('razorpay') && (
                        <a
                          href={SHOP.razorpayUrl || 'https://razorpay.me/@srikandanfamilyshop'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition-colors shadow-sm"
                        >
                          <span>💳 Pay via Razorpay</span>
                          <span>↗</span>
                        </a>
                      )}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const preFilter = searchParams.get('order') || ''
  const [filter, setFilter] = useState(preFilter)
  const [searchedOrder, setSearchedOrder] = useState(null)
  const [searching, setSearching] = useState(false)

  // Keep search filter in sync with URL
  useEffect(() => {
    if (preFilter) setFilter(preFilter)
  }, [preFilter])

  // Try fetching single order if not in local store
  useEffect(() => {
    if (filter.trim() && !orders.some(o => o.no.toLowerCase() === filter.trim().toLowerCase())) {
      let active = true
      setSearching(true)
      getOrderByNo(filter.trim()).then(res => {
        if (active && res) setSearchedOrder(res)
        if (active) setSearching(false)
      }).catch(() => {
        if (active) setSearching(false)
      })
      return () => { active = false }
    } else {
      setSearchedOrder(null)
    }
  }, [filter, orders])

  const myOrders = session?.loggedIn
    ? orders.filter(o => (o.email || '').trim().toLowerCase() === (session?.email || '').trim().toLowerCase())
    : []

  // Combine matching orders from account or searched order
  let displayOrders = []
  if (filter.trim()) {
    const q = filter.trim().toLowerCase()
    displayOrders = orders.filter(o => o.no.toLowerCase().includes(q) || (o.phone && o.phone.includes(q)))
    if (displayOrders.length === 0 && searchedOrder) {
      displayOrders = [searchedOrder]
    }
  } else if (session?.loggedIn) {
    displayOrders = myOrders
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (filter.trim()) {
      setSearchParams({ order: filter.trim() })
    } else {
      setSearchParams({})
    }
  }

  return (
    <Wrap className="py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Live Tracking</p>
          <h1 className="text-4xl">Delivery Tracking</h1>
          <p className="mt-1 text-sm text-ink/60">Real-time delivery progress for your handloom textile orders</p>
        </div>
        <div className="flex gap-2">
          {session?.loggedIn && <Link to="/orders" className={btnO}>← My Orders</Link>}
          <Link to={session?.loggedIn ? "/account" : "/login"} className={btnO}>
            {session?.loggedIn ? "Account" : "Sign In"}
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="mb-6">
        <label htmlFor="delivery-search" className="mb-1 block text-sm font-bold text-ink">
          Search by order number or phone
        </label>
        <div className="flex gap-2 max-w-md">
          <input
            id="delivery-search"
            type="search"
            placeholder="e.g. KFS-..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-11 flex-1 border border-gold-dark/50 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
          <button type="submit" className={btnP + ' px-5'}>
            Track
          </button>
        </div>
      </form>

      {searching && (
        <div className="py-8 text-center text-ink/70">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
          <p className="text-sm">Locating delivery details for {filter}…</p>
        </div>
      )}

      {!searching && displayOrders.length === 0 ? (
        <div className="rounded-2xl border border-gold/40 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-4xl">🚚</div>
          <h2 className="text-2xl">
            {filter ? `No delivery record found for "${filter}"` : 'Enter an Order Number to Track'}
          </h2>
          <p className="mt-2 text-ink/60 max-w-md mx-auto">
            {filter
              ? 'Please verify your order number format (e.g. KFS-...) and check back, or contact boutique support.'
              : 'Enter your order confirmation number above to check delivery status in real-time.'}
          </p>
          {filter && (
            <button className="mt-4 font-bold text-primary underline" onClick={() => { setFilter(''); setSearchParams({}) }}>
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-6">
          {displayOrders.map(order => {
            const status = order.status || order.orderStatus || 'Confirmed'
            const stepIndex = getDeliveryStepIndex(status)
            const isCancelled = status === 'Cancelled' || status === 'Refunded'
            const orderItems = Array.isArray(order.items) ? order.items : []

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
                  <span className="text-xs text-ink/50">{order.at || order.createdAt}</span>
                </div>

                {/* Delivery info */}
                <div className="p-5">
                  <div className="mb-5 grid gap-3 sm:grid-cols-2 text-sm text-ink/80">
                    <div>
                      <p><span className="font-semibold text-ink">👤 Recipient:</span> {order.name || order.customerName}</p>
                      <p className="mt-1"><span className="font-semibold text-ink">📞 Contact Phone:</span> {order.phone}</p>
                      <p className="mt-1"><span className="font-semibold text-ink">📍 Address:</span> {order.address}</p>
                    </div>
                    <div className="sm:text-right">
                      <p><span className="font-semibold text-ink">💳 Total:</span> <strong className="font-serif text-lg text-primary">{inr(order.total || 0)}</strong></p>
                      <p className="mt-1"><span className="font-semibold text-ink">Payment:</span> <span className="capitalize">{order.paymentStatus || 'unpaid'}</span> ({order.paymentMethod || 'COD'})</p>
                    </div>
                  </div>

                  {/* Progress tracker */}
                  {isCancelled ? (
                    <div className="rounded-xl bg-red-50 p-4 text-center font-bold text-red-800 border border-red-200">
                      ⚠️ This order has been {status.toLowerCase()}.
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="flex items-center justify-between">
                        {DELIVERY_STEPS.map((st, idx) => {
                          const isDone = idx <= stepIndex
                          return (
                            <div key={st.key} className="flex flex-1 items-center">
                              <div className="flex flex-col items-center flex-1">
                                <span
                                  className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold transition-all shadow-sm ${
                                    isDone
                                      ? 'bg-primary text-ivory ring-2 ring-gold'
                                      : 'bg-ivory border border-gold/40 text-ink/40'
                                  }`}
                                >
                                  {isDone ? '✓' : st.icon}
                                </span>
                                <span className={`mt-1.5 text-center text-xs font-semibold ${isDone ? 'text-primary' : 'text-ink/40'}`}>
                                  {st.label}
                                </span>
                              </div>
                              {idx < DELIVERY_STEPS.length - 1 && (
                                <div className={`h-1 flex-1 mx-1 rounded-full transition-all ${idx < stepIndex ? 'bg-primary' : 'bg-gold/20'}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Status message */}
                      <div className={`mt-5 rounded-xl p-3 text-sm text-center font-semibold ${
                        status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : status === 'Packed'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {status === 'Delivered'
                          ? '🎉 Your order has been delivered! We hope you cherish your exquisite handloom fabrics.'
                          : status === 'Packed'
                          ? '📦 Your order has been carefully packaged and handed over for courier dispatch.'
                          : status === 'Processing'
                          ? '⚙️ Your order is being inspected and hand-packed at our Kanchipuram showroom.'
                          : '📋 Your order has been received and confirmed by Sri Kandan Family Shop.'}
                      </div>
                    </div>
                  )}

                  {/* Items Summary */}
                  {orderItems.length > 0 && (
                    <div className="mt-4 border-t border-gold/20 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-2">
                        Ordered Items ({orderItems.length}):
                      </p>
                      <div className="divide-y divide-gold/10">
                        {orderItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between py-1 text-xs text-ink/80">
                            <span>{item.name} × {item.q}</span>
                            <span className="font-semibold text-ink">{inr(item.price * item.q)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2 border-t border-gold/20 pt-3">
                    <Link to={`/order/${order.no}`} className={btnO}>Full Order Details</Link>
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
