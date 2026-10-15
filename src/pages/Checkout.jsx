import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../context/Store'
import { inr } from '../data/products'
import { addOrder, updateOrder } from '../data/orders'
import { SHOP, API_BASE } from '../config/shop'
import { Wrap, Field, validate, btnP, btnO } from '../components/ui'
import { useAuthStatus } from '../data/auth'

const K = ['name', 'email', 'phone', 'address']

export default function Checkout() {
  const { lines, total: cartTotal, clear } = useStore()
  const session = useAuthStatus()
  const [v, setV] = useState({
    name: session?.name || '',
    email: session?.email || '',
    phone: session?.phone || '',
    address: session?.address || '',
  })
  const [err, setErr] = useState({})
  const [order, setOrder] = useState(null)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [emailStatus, setEmailStatus] = useState('idle') // 'idle' | 'initiating' | 'verifying' | 'error'
  const [emailError, setEmailError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paying, setPaying] = useState(false)
  const [razorpayConfig, setRazorpayConfig] = useState(null)

  // Loyalty State
  const [loyaltyConfig, setLoyaltyConfig] = useState(null)
  const [loyaltyBalance, setLoyaltyBalance] = useState(0)
  const [pointsRedeemed, setPointsRedeemed] = useState(0)
  const [inputPoints, setInputPoints] = useState('')
  const [redeemError, setRedeemError] = useState('')
  const [copiedNo, setCopiedNo] = useState(false)

  useEffect(() => {
    // 1. Preload Razorpay Checkout SDK Script
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }

    // 2. Load public Razorpay config from backend
    fetch(`${API_BASE}/api/razorpay/config`)
      .then((r) => r.json())
      .then((data) => setRazorpayConfig(data))
      .catch(() => {})

    // 3. Load loyalty config
    fetch(`${API_BASE}/api/loyalty/config`)
      .then((r) => r.json())
      .then((data) => setLoyaltyConfig(data))
      .catch(console.error)
  }, [])

  // Fetch balance when email is valid
  useEffect(() => {
    if (v.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
      fetch(`${API_BASE}/api/loyalty/customer?email=${encodeURIComponent(v.email)}`)
        .then((r) => r.json())
        .then((data) => {
          setLoyaltyBalance(data.balance || 0)
          if ((data.balance || 0) < pointsRedeemed) {
            setPointsRedeemed(0)
          }
        })
        .catch(console.error)
    } else {
      setLoyaltyBalance(0)
      setPointsRedeemed(0)
    }
  }, [v.email])

  const ch = (e) => setV({ ...v, [e.target.name]: e.target.value })

  // Loyalty calculations
  const isRedemptionEnabled = loyaltyConfig?.enabled && loyaltyConfig?.redemptionEnabled
  const pointValue = loyaltyConfig?.pointValueInInr || 1
  const maxRedemptionPercent = loyaltyConfig?.maxRedemptionPercent || 50

  const maxDiscountAllowed = (cartTotal * maxRedemptionPercent) / 100
  const maxPointsAllowedForOrder = Math.floor(maxDiscountAllowed / pointValue)
  const maxRedeemablePoints = Math.min(loyaltyBalance, maxPointsAllowedForOrder)

  const applyPoints = () => {
    setRedeemError('')
    const pts = parseInt(inputPoints, 10)
    if (isNaN(pts) || pts <= 0) {
      setRedeemError('Enter a valid number of points.')
      return
    }
    if (pts > loyaltyBalance) {
      setRedeemError(`You only have ${loyaltyBalance} points.`)
      return
    }
    if (loyaltyConfig?.minPointsToRedeem && pts < loyaltyConfig.minPointsToRedeem) {
      setRedeemError(`Minimum ${loyaltyConfig.minPointsToRedeem} points required to redeem.`)
      return
    }
    if (pts > maxRedeemablePoints) {
      setRedeemError(`You can only redeem up to ${maxRedeemablePoints} points for this order.`)
      return
    }
    setPointsRedeemed(pts)
    setInputPoints('')
  }

  const removePoints = () => {
    setPointsRedeemed(0)
    setRedeemError('')
  }

  const discountValue = pointsRedeemed * pointValue
  const finalTotal = Math.max(0, cartTotal - discountValue)

  // Estimated points earned on this order
  const spendPerPoint = loyaltyConfig?.spendPerPoint || 1000
  const pointsPerUnit = loyaltyConfig?.pointsPerUnit || 1
  const estimatedPointsEarned = loyaltyConfig?.enabled ? Math.floor(finalTotal / spendPerPoint) * pointsPerUnit : 0

  /**
   * Triggers the Razorpay payment checkout modal for an existing pending order.
   * Prevents duplicate orders and strictly confirms order only after backend verification.
   */
  const triggerRazorpayPayment = async (targetOrder) => {
    setPaying(true)
    setEmailStatus('initiating')
    setEmailError('')
    setPaymentError('')

    try {
      // 1. Create order on backend Razorpay Orders API
      const rzRes = await fetch(`${API_BASE}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: targetOrder.no,
          amount: targetOrder.total,
          customer: {
            name: targetOrder.name || v.name,
            email: targetOrder.email || v.email,
            phone: targetOrder.phone || v.phone,
          },
        }),
      })

      const rzData = await rzRes.json()

      if (!rzRes.ok || !rzData?.id) {
        throw new Error(rzData?.error || 'Failed to initialize Razorpay payment. Please try again.')
      }

      // 2. Ensure Razorpay Checkout SDK is ready
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://checkout.razorpay.com/v1/checkout.js'
          s.onload = resolve
          s.onerror = () => reject(new Error('Could not load Razorpay payment window script.'))
          document.body.appendChild(s)
        })
      }

      // 3. Configure Razorpay Options
      const options = {
        key: rzData.keyId || razorpayConfig?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: rzData.amount,
        currency: rzData.currency || 'INR',
        name: SHOP.name || 'Sri Kandan Family Shop',
        description: `Order ${targetOrder.no}`,
        order_id: rzData.id,
        prefill: {
          name: targetOrder.name || v.name,
          email: targetOrder.email || v.email,
          contact: targetOrder.phone || v.phone,
        },
        theme: {
          color: '#4a0e18',
        },
        modal: {
          ondismiss: function () {
            setPaying(false)
            setEmailStatus('idle')
            setPendingOrder(targetOrder)
            setPaymentError('Payment window was closed. Your order is safely saved — click "Retry Payment" whenever you are ready.')
            fetch(`${API_BASE}/api/razorpay/payment-failed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_no: targetOrder.no,
                error_code: 'PAYMENT_CANCELLED',
                error_description: 'Checkout modal was dismissed by customer.',
                razorpay_order_id: rzData.id,
              }),
            }).catch(() => {})
          },
        },
        handler: async function (response) {
          // CRITICAL: A frontend callback or redirect alone must NEVER confirm an order!
          // We strictly verify the signature on backend server before confirming.
          setPaying(true)
          setEmailStatus('verifying')
          try {
            const verifyRes = await fetch(`${API_BASE}/api/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_no: targetOrder.no,
              }),
            })

            const verifyData = await verifyRes.json()

            if (verifyRes.ok && (verifyData.ok || verifyData.status === 'verified')) {
              // Confirmed ONLY on verified backend response!
              const confirmedOrder = verifyData.order || {
                ...targetOrder,
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed',
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
              }
              await updateOrder(targetOrder.no, {
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed',
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
              })
              setOrder(confirmedOrder)
              setPendingOrder(null)
              setPaymentError('')
              setEmailStatus('idle')
              setPaying(false)
              clear() // Clear cart ONLY after verified payment!
            } else {
              setPaying(false)
              setEmailStatus('idle')
              setPendingOrder(targetOrder)
              setPaymentError(verifyData.error || 'Payment signature verification failed on server. Please contact support if your bank account was debited.')
            }
          } catch (verifyErr) {
            setPaying(false)
            setEmailStatus('idle')
            setPendingOrder(targetOrder)
            setPaymentError('Could not verify payment with server: ' + verifyErr.message)
          }
        },
      }

      const rzp = new window.Razorpay(options)

      rzp.on('payment.failed', function (resp) {
        setPaying(false)
        setEmailStatus('idle')
        setPendingOrder(targetOrder)
        const desc = resp.error?.description || 'Payment was declined or cancelled.'
        setPaymentError(`Payment Failed: ${desc}`)
        fetch(`${API_BASE}/api/razorpay/payment-failed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_no: targetOrder.no,
            error_code: resp.error?.code,
            error_description: desc,
            payment_id: resp.error?.metadata?.payment_id,
            razorpay_order_id: rzData.id,
          }),
        }).catch(() => {})
      })

      rzp.open()
      setPaying(false)
      setEmailStatus('idle')
    } catch (err) {
      setPaying(false)
      setEmailStatus('idle')
      setPendingOrder(targetOrder)
      setPaymentError(err.message || 'Payment initiation error. Please retry.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const er = validate(v, K)
    setErr(er)
    if (Object.keys(er).length) {
      document.getElementById(Object.keys(er)[0])?.focus()
      return
    }

    setEmailError('')
    setPaymentError('')
    const paymentMethodVal = e.target.payment?.value || 'razorpay'

    const items = lines.map((l) => ({
      productId: l.id,
      sku: l.sku || l.id.toUpperCase(),
      name: l.name,
      category: l.collection,
      image: l.images?.[0] || `/images/products/${l.id}-1.jpg`,
      price: l.price,
      q: l.q,
    }))

    if (paymentMethodVal === 'razorpay') {
      setEmailStatus('initiating')

      // Reuse existing pendingOrder if customer is retrying payment to avoid duplicate orders
      let targetOrder = pendingOrder
      if (!targetOrder) {
        const orderPayload = {
          ...v,
          total: finalTotal,
          subtotal: cartTotal,
          discount: discountValue,
          pointsRedeemed,
          paymentMethod: 'Razorpay (Cards / UPI / NetBanking)',
          paymentStatus: 'Pending',
          orderStatus: 'Pending Payment',
          items,
        }
        targetOrder = await addOrder(orderPayload)
      }

      if (!targetOrder) {
        setEmailStatus('error')
        setEmailError('Could not create order on server. Please try again.')
        return
      }

      setPendingOrder(targetOrder)
      await triggerRazorpayPayment(targetOrder)
    } else {
      // Cash on Delivery (COD) Flow
      setEmailStatus('sending')
      const orderPayload = {
        ...v,
        total: finalTotal,
        subtotal: cartTotal,
        discount: discountValue,
        pointsRedeemed,
        paymentMethod: 'Cash on Delivery (COD)',
        paymentStatus: 'Pending',
        orderStatus: 'Confirmed',
        items,
      }
      const savedOrder = await addOrder(orderPayload)
      if (savedOrder) {
        setOrder(savedOrder)
        setPendingOrder(null)
        clear()
        setEmailStatus('idle')
      } else {
        setEmailStatus('error')
        setEmailError('Failed to create order on server. Please try again.')
      }
    }
  }

  // 1. ORDER CONFIRMED SCREEN (Rendered ONLY after payment is verified or COD is placed)
  if (order) {
    const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid'

    return (
      <Wrap className="max-w-2xl py-12">
        <div className="border border-emerald-500/40 bg-white p-6 sm:p-8 shadow-md rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">
              ✓
            </span>
            <div>
              <h1 className="text-3xl text-emerald-800 font-serif">Order Confirmed!</h1>
              <p className="text-sm text-ink/70">Thank you for shopping with Sri Kandan Family Shop.</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-ivory/60 border border-gold/30 p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60">Order Number</p>
              <p className="font-mono text-xl font-bold text-primary">{order.no}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(order.no)
                  setCopiedNo(true)
                  setTimeout(() => setCopiedNo(false), 2500)
                }
              }}
              className="rounded-lg border border-gold/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-gold/10 transition-colors shadow-sm"
            >
              {copiedNo ? '✓ Copied' : '📋 Copy Order No'}
            </button>
          </div>

          {order.pointsAwarded && order.pointsEarned > 0 ? (
            <div className="mt-4 bg-emerald/10 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-300">
              <span className="text-xl">💎</span>
              <span>
                You earned <strong>{order.pointsEarned} loyalty points</strong> on this order! Available in your account.
              </span>
            </div>
          ) : estimatedPointsEarned > 0 ? (
            <div className="mt-4 bg-emerald/10 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-300">
              <span className="text-xl">💎</span>
              <span>You will earn <strong>{estimatedPointsEarned} loyalty points</strong> upon order delivery!</span>
            </div>
          ) : null}

          <ul className="mt-4 divide-y divide-gold/40">
            {order.items.map((l) => (
              <li key={l.id || l.productId || l.name} className="flex justify-between py-2 text-sm">
                <span>
                  {l.name} × {l.q}
                </span>
                <span className="font-semibold">{inr(l.price * l.q)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between text-lg font-bold border-t border-gold/40 pt-3">
            <span>Total Amount</span>
            <span className="text-primary">{inr(order.total)}</span>
          </p>
          <div className="mt-4 space-y-1.5 border-t border-gold/40 pt-4 text-sm text-ink/80">
            <p>
              <b>Delivery address:</b> {order.address}
            </p>
            <p>
              <b>Customer:</b> {order.name} ({order.phone})
            </p>
            <p>
              <b>Email:</b> {order.email}
            </p>
            <p>
              <b>Payment Method:</b> {order.paymentMethod}
            </p>
            <p>
              <b>Payment Status:</b>{' '}
              <span
                className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {isPaid ? '✓ Paid & Confirmed' : 'Pending Verification'}
              </span>
            </p>
            {order.paymentId && (
              <p>
                <b>Transaction ID (Razorpay):</b>{' '}
                <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {order.paymentId}
                </span>
              </p>
            )}
            {order.razorpayOrderId && (
              <p>
                <b>Razorpay Order ID:</b>{' '}
                <span className="font-mono text-xs text-ink/70">{order.razorpayOrderId}</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/orders" className={btnP + ' flex-1 text-center'}>
              View My Orders
            </Link>
            <Link to="/shop" className={btnO + ' flex-1 text-center'}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </Wrap>
    )
  }

  // 2. EMPTY CART VIEW
  if (!lines.length) {
    return (
      <Wrap className="py-12 text-center">
        <h1 className="text-3xl font-serif">Your Cart is Empty</h1>
        <Link to="/shop" className={btnP + ' mt-6'}>
          Browse collections
        </Link>
      </Wrap>
    )
  }

  // 3. MAIN CHECKOUT FORM
  const isInitiating = emailStatus === 'initiating' || paying
  const isVerifying = emailStatus === 'verifying'

  return (
    <Wrap className="py-10">
      <h1 className="text-4xl">Checkout</h1>

      {/* PENDING PAYMENT / RETRY BANNER */}
      {pendingOrder && (
        <div className="mt-6 rounded-2xl border-2 border-amber-500/50 bg-amber-50/80 p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-amber-950 text-base">
                  Payment Pending for Order #{pendingOrder.no}
                </h3>
                <span className="rounded-full bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-xs font-bold">
                  Status: Pending Payment
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-1">
                Your order information is safely saved. Payment has not been captured yet. You can complete your payment now without re-entering your details.
              </p>
              {paymentError && (
                <p className="mt-2 text-xs font-semibold text-red-700 bg-red-100/70 p-2.5 rounded-lg border border-red-200">
                  ⚠ {paymentError}
                </p>
              )}
            </div>
          </div>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isInitiating || isVerifying}
              onClick={() => triggerRazorpayPayment(pendingOrder)}
              className="flex-1 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold py-3 px-5 rounded-xl shadow transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>💳 Retry Payment Now ({inr(pendingOrder.total)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingOrder(null)
                setPaymentError('')
              }}
              className="text-xs text-ink/70 underline hover:text-ink px-2 py-1"
            >
              Start New Order Instead
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_350px]">
        <form onSubmit={submit} noValidate className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-primary border-b border-gold/30 pb-2">
              1. Delivery Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Full name"
                  id="name"
                  autoComplete="name"
                  value={v.name || ''}
                  onChange={ch}
                  error={err.name}
                />
              </div>
              <Field
                label="Email"
                id="email"
                type="email"
                autoComplete="email"
                value={v.email || ''}
                onChange={ch}
                error={err.email}
              />
              <Field
                label="Phone (10-digit mobile)"
                id="phone"
                type="tel"
                autoComplete="tel"
                value={v.phone || ''}
                onChange={ch}
                error={err.phone}
              />
              <div className="sm:col-span-2">
                <Field
                  area
                  label="Delivery address"
                  id="address"
                  autoComplete="street-address"
                  value={v.address || ''}
                  onChange={ch}
                  error={err.address}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-primary border-b border-gold/30 pb-2">
              2. Secure Payment Method
            </h2>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 p-4 border-2 border-primary/40 rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="razorpay"
                  defaultChecked
                  className="accent-primary w-4 h-4 mt-1"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="block font-bold text-sm text-primary">
                      Razorpay (Cards / UPI / NetBanking / Wallets)
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                      Instant &amp; Verified
                    </span>
                  </div>
                  <span className="block text-xs text-ink/70 mt-1">
                    Pay securely using Google Pay, PhonePe, Paytm, any UPI app, Debit/Credit Card, or NetBanking. Order confirms automatically upon verified payment.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xl">
                  <span title="Cards">💳</span>
                  <span title="UPI">📱</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border border-gold/40 rounded-xl cursor-pointer bg-white hover:bg-ivory/50 transition-colors">
                <input type="radio" name="payment" value="cod" className="accent-primary w-4 h-4 mt-1" />
                <div className="flex-1">
                  <span className="block font-bold text-sm text-ink">Cash on Delivery (COD)</span>
                  <span className="block text-xs text-ink/60 mt-0.5">
                    Pay in cash when you receive the package at your doorstep
                  </span>
                </div>
                <span className="text-xl shrink-0">🚚</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className={btnP + ' w-full py-4 text-lg font-bold tracking-wide flex items-center justify-center gap-2'}
            disabled={isInitiating || isVerifying}
          >
            {isVerifying ? (
              <>
                <span className="animate-spin text-xl">⏳</span>
                <span>Verifying Payment with Server...</span>
              </>
            ) : isInitiating ? (
              <>
                <span className="animate-spin text-xl">⏳</span>
                <span>Connecting to Secure Razorpay Gateway...</span>
              </>
            ) : pendingOrder ? (
              `Retry Payment for Order #${pendingOrder.no} — ${inr(finalTotal)}`
            ) : (
              `Place Secure Order — ${inr(finalTotal)}`
            )}
          </button>

          {emailError && <p className="text-red-600 text-sm font-semibold">{emailError}</p>}
        </form>

        <aside className="h-fit space-y-4">
          <div className="border border-gold/50 bg-white p-5 shadow-sm rounded-xl space-y-4">
            <h2 className="text-2xl font-serif text-primary">Order Summary</h2>
            <div className="divide-y divide-gold/20 border-b border-gold/20 pb-2">
              {lines.map((l) => (
                <p key={l.id} className="py-3 flex justify-between text-sm text-ink/80">
                  <span className="pr-4">
                    {l.name} <span className="text-ink/50">× {l.q}</span>
                  </span>
                  <span className="font-bold text-ink whitespace-nowrap">{inr(l.price * l.q)}</span>
                </p>
              ))}
            </div>

            <div className="pt-2 space-y-2 text-sm text-ink/70">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{inr(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-emerald-700 font-bold">Free</span>
              </div>
              {pointsRedeemed > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Loyalty Discount ({pointsRedeemed} pts)</span>
                  <span>-{inr(discountValue)}</span>
                </div>
              )}
            </div>

            <p className="pt-4 flex justify-between border-t border-gold/40 text-xl font-bold text-primary">
              <span>Total</span>
              <span>{inr(finalTotal)}</span>
            </p>
            {estimatedPointsEarned > 0 && (
              <p className="text-xs text-emerald-700 font-bold text-center mt-2 bg-emerald/10 py-1.5 rounded-md">
                💎 You will earn {estimatedPointsEarned} points
              </p>
            )}
          </div>

          {/* Loyalty Points Redemption Box */}
          {isRedemptionEnabled && loyaltyBalance > 0 && (
            <div className="border border-emerald/30 bg-emerald/5 p-5 shadow-sm rounded-xl">
              <h3 className="font-bold text-emerald-800 mb-1 flex items-center gap-2">💎 Redeem Points</h3>
              <p className="text-xs text-emerald-700/80 mb-3">
                Balance: <strong>{loyaltyBalance} pts</strong> <br />
                Value: 1 pt = {inr(pointValue)} <br />
                Max allowed: {maxRedeemablePoints} pts
              </p>

              {pointsRedeemed > 0 ? (
                <div className="bg-white border border-emerald/20 p-3 rounded flex justify-between items-center text-sm">
                  <span className="font-bold text-emerald-800">{pointsRedeemed} points applied!</span>
                  <button
                    type="button"
                    onClick={removePoints}
                    className="text-xs underline text-ink/60 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={inputPoints}
                    onChange={(e) => setInputPoints(e.target.value)}
                    className="h-9 flex-1 rounded border border-emerald/30 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    placeholder="Enter points"
                  />
                  <button
                    type="button"
                    onClick={applyPoints}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded text-sm font-bold transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
              {redeemError && <p className="text-red-600 text-xs mt-2 font-bold">{redeemError}</p>}
            </div>
          )}
        </aside>
      </div>
    </Wrap>
  )
}
