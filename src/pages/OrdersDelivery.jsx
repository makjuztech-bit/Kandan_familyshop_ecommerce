import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, getOrderByNo, fetchCustomerOrders } from '../data/orders'
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
  const [searchParams, setSearchParams] = useSearchParams()

  const urlQuery = searchParams.get('order') || searchParams.get('q') || ''
  const [searchInput, setSearchInput] = useState(urlQuery)
  const [searchedOrders, setSearchedOrders] = useState([])
  const [searching, setSearching] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // Sync with URL parameter
  useEffect(() => {
    if (urlQuery) {
      setSearchInput(urlQuery)
      performLookup(urlQuery)
    }
  }, [urlQuery])

  // Automatically fetch customer's orders from server if logged in
  useEffect(() => {
    if (session?.loggedIn && (session?.email || session?.phone)) {
      fetchCustomerOrders({
        email: session.email || '',
        phone: session.phone || '',
      }).catch(() => {})
    }
  }, [session?.loggedIn, session?.email, session?.phone])

  const performLookup = async (queryStr) => {
    const q = (queryStr || '').trim()
    if (!q) {
      setSearchedOrders([])
      setHasSearched(false)
      setErrorMsg('')
      return
    }

    setSearching(true)
    setErrorMsg('')
    setHasSearched(true)

    try {
      // 1. Check local memory first
      const qLower = q.toLowerCase()
      const cleanDigits = q.replace(/\D/g, '')
      const localMatches = orders.filter((o) => {
        const noMatch = (o.no || '').toLowerCase().includes(qLower)
        const emailMatch = (o.email || '').toLowerCase().includes(qLower)
        const phoneMatch = cleanDigits && (o.phone || '').replace(/\D/g, '').includes(cleanDigits)
        return noMatch || emailMatch || phoneMatch
      })

      // 2. Query backend API
      let remoteMatches = []
      try {
        if (/^KFS-/i.test(q)) {
          const single = await getOrderByNo(q)
          if (single) remoteMatches.push(single)
        } else {
          remoteMatches = await fetchCustomerOrders({
            no: q,
            email: q.includes('@') ? q : '',
            phone: cleanDigits || '',
          })
        }
      } catch (apiErr) {
        console.warn('Lookup notice:', apiErr.message)
      }

      // Merge results
      const map = new Map()
      ;[...localMatches, ...remoteMatches].forEach((o) => {
        if (o && o.no) map.set(o.no, o)
      })

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )

      setSearchedOrders(combined)
    } catch (err) {
      setErrorMsg('Unable to locate orders right now. Please check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchParams({ order: searchInput.trim() })
    } else {
      setSearchParams({})
      setHasSearched(false)
      setSearchedOrders([])
    }
    performLookup(searchInput)
  }

  // Orders belonging to logged-in user
  const userEmail = (session?.email || '').trim().toLowerCase()
  const userPhone = (session?.phone || '').replace(/\D/g, '')
  const myAccountOrders = session?.loggedIn
    ? orders.filter((o) => {
        const oEmail = (o.email || '').trim().toLowerCase()
        const oPhone = (o.phone || '').replace(/\D/g, '')
        if (userEmail && oEmail && oEmail === userEmail) return true
        if (userPhone && oPhone && (oPhone.endsWith(userPhone) || userPhone.endsWith(oPhone))) return true
        return false
      })
    : []

  // Final display list
  const displayOrders = hasSearched ? searchedOrders : myAccountOrders

  return (
    <Wrap className="py-10">
      {/* Top Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Orders & Tracking</p>
          <h1 className="text-4xl font-serif font-bold text-ink">My Orders</h1>
          <p className="mt-1 text-sm text-ink/60">
            {session?.loggedIn
              ? `Manage and track orders associated with ${session.email || session.name || 'your account'}`
              : 'Track guest orders or sign in to view your complete order history'}
          </p>
        </div>
        <div className="flex gap-2">
          {session?.loggedIn ? (
            <Link to="/account" className={btnO}>
              ← Back to Account
            </Link>
          ) : (
            <Link to="/login" className={btnP}>
              Sign In to View All Orders
            </Link>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-8 rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="order-search-input" className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1">
              Find an order by Order ID or Mobile Number
            </label>
            <input
              id="order-search-input"
              type="search"
              placeholder="e.g. KFS-17... or 9876543210"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-11 w-full rounded-xl border border-gold-dark/40 bg-ivory/30 px-3.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-gold focus:bg-white"
            />
          </div>
          <div className="flex gap-2 sm:self-end">
            <button type="submit" className={btnP + ' h-11 px-6 rounded-xl'}>
              Search
            </button>
            {hasSearched && (
              <button
                type="button"
                className={btnO + ' h-11 px-4 rounded-xl'}
                onClick={() => {
                  setSearchInput('')
                  setSearchParams({})
                  setHasSearched(false)
                  setSearchedOrders([])
                  setErrorMsg('')
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Loading Indicator */}
      {searching && (
        <div className="py-12 text-center text-ink/70">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
          <p className="text-sm font-semibold">Searching order database…</p>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-center text-sm font-medium text-red-800">
          <p>{errorMsg}</p>
          <button
            onClick={() => performLookup(searchInput)}
            className="mt-2 text-xs font-bold text-red-900 underline hover:no-underline"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Empty State */}
      {!searching && displayOrders.length === 0 && (
        <div className="rounded-2xl border border-gold/40 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 text-4xl">
            {hasSearched ? '🔍' : '🛒'}
          </div>
          <h2 className="text-2xl font-serif font-bold text-ink">
            {hasSearched ? `No orders found for "${searchInput}"` : 'No orders found'}
          </h2>
          <p className="mt-2 text-sm text-ink/60 max-w-md mx-auto">
            {hasSearched
              ? 'Please double check your Order ID (format: KFS-...) or mobile phone number, or browse our shop.'
              : session?.loggedIn
              ? "You haven't placed any orders yet. Browse our exquisite collection and find your perfect saree!"
              : 'Have you placed an order as a guest? Enter your Order ID above or sign in to access your orders.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/shop" className={btnP}>
              Browse Saree Collection
            </Link>
            <Link to="/delivery" className={btnO}>
              Delivery Tracking
            </Link>
          </div>
        </div>
      )}

      {/* Order List */}
      {!searching && displayOrders.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Showing {displayOrders.length} order{displayOrders.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-5">
            {displayOrders.map((order) => {
              const status = order.status || order.orderStatus || 'Confirmed'
              const paymentStatus = String(order.paymentStatus || 'unpaid').toLowerCase()
              const isPaid = paymentStatus === 'paid'
              const isRazorpay = String(order.paymentMethod || '').toLowerCase().includes('razorpay')
              const items = Array.isArray(order.items) ? order.items : []

              return (
                <li key={order.no} className="overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-sm transition-all hover:shadow-md">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 bg-ivory/60 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-wide text-ink/50">Order</span>
                      <span className="font-mono text-base font-bold text-primary">{order.no}</span>
                      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${BADGE[status] || 'bg-gold/20 text-ink'}`}>
                        {status}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-ink/60">{order.at || order.createdAt}</span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      {/* Left: Customer & Delivery Info */}
                      <div className="space-y-2 text-sm text-ink/80 flex-1">
                        <p>
                          <span className="font-semibold text-ink">👤 Customer:</span>{' '}
                          {order.name || order.customerName || 'Customer'}
                        </p>
                        <p>
                          <span className="font-semibold text-ink">📞 Phone:</span>{' '}
                          {order.phone || '—'}
                        </p>
                        <p>
                          <span className="font-semibold text-ink">📍 Delivery:</span>{' '}
                          {order.address || '—'}
                        </p>
                        <p>
                          <span className="font-semibold text-ink">💳 Payment:</span>{' '}
                          <span className={`font-bold capitalize px-2 py-0.5 rounded text-xs ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {order.paymentStatus || 'Pending'}
                          </span>{' '}
                          <span className="text-xs text-ink/60">({order.paymentMethod || 'COD'})</span>
                        </p>
                      </div>

                      {/* Right: Total & Action Buttons */}
                      <div className="flex flex-col items-start lg:items-end justify-between border-t border-gold/20 pt-4 lg:border-t-0 lg:pt-0">
                        <p className="text-xs uppercase tracking-wider text-ink/50">Order Total</p>
                        <p className="font-serif text-3xl font-bold text-primary">{inr(order.total || 0)}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {!isPaid && isRazorpay && (
                            <a
                              href={SHOP.razorpayUrl || 'https://razorpay.me/@srikandanfamilyshop'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold transition-colors shadow-sm"
                            >
                              <span>💳 Pay via Razorpay</span>
                              <span>↗</span>
                            </a>
                          )}
                          <Link to={`/order/${order.no}`} className={btnP + ' rounded-xl px-4 py-2 text-xs'}>
                            View Details
                          </Link>
                          <Link to={`/delivery?order=${order.no}`} className={btnO + ' rounded-xl px-4 py-2 text-xs'}>
                            Track Delivery
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Items Preview */}
                    {items.length > 0 && (
                      <div className="mt-5 border-t border-gold/20 pt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-2">
                          Ordered Items ({items.length}):
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-gold/15 bg-ivory/30 p-2 text-xs">
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-ink">{item.name}</p>
                                <p className="text-ink/60">
                                  Qty {item.q || 1} × {inr(item.price || 0)}
                                </p>
                              </div>
                            </div>
                          ))}
                          {items.length > 3 && (
                            <Link
                              to={`/order/${order.no}`}
                              className="flex items-center justify-center rounded-xl border border-dashed border-gold/40 p-2 text-xs font-bold text-primary hover:bg-ivory/50"
                            >
                              + {items.length - 3} more items →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
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
