import {useState, useEffect} from 'react'
import {Link} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr} from '../data/products'
import {addOrder,updateOrder} from '../data/orders'
import {sendOrderNotification} from '../data/email'
import {SHOP} from '../config/shop'
import {Wrap,Field,validate,btnP} from '../components/ui'
import {useAuthStatus} from '../data/auth'

const K=['name','email','phone','address']

export default function Checkout(){
  const {lines,total: cartTotal,clear} = useStore()
  const session = useAuthStatus()
  const [v,setV] = useState({ 
    name: session?.name || '', 
    email: session?.email || '', 
    phone: session?.phone || '', 
    address: session?.address || '' 
  })
  const [err,setErr] = useState({})
  const [order,setOrder] = useState(null)
  const [emailStatus,setEmailStatus] = useState('idle')
  const [emailError,setEmailError] = useState('')

  // Loyalty State
  const [loyaltyConfig, setLoyaltyConfig] = useState(null)
  const [loyaltyBalance, setLoyaltyBalance] = useState(0)
  const [pointsRedeemed, setPointsRedeemed] = useState(0)
  const [inputPoints, setInputPoints] = useState('')
  const [redeemError, setRedeemError] = useState('')
  const [copiedNo, setCopiedNo] = useState(false)
  const [paymentReported, setPaymentReported] = useState(false)

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);

    // Fetch config
    fetch('/api/loyalty/config').then(r=>r.json()).then(data => {
      setLoyaltyConfig(data)
    }).catch(console.error)
  }, []);

  // Fetch balance when email is valid
  useEffect(() => {
    if (v.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
      fetch(`/api/loyalty/customer?email=${encodeURIComponent(v.email)}`)
        .then(r=>r.json())
        .then(data => {
          setLoyaltyBalance(data.balance || 0)
          if ((data.balance || 0) < pointsRedeemed) {
            setPointsRedeemed(0) // reset if they change email to someone with less points
          }
        })
        .catch(console.error)
    } else {
      setLoyaltyBalance(0)
      setPointsRedeemed(0)
    }
  }, [v.email])

  const ch = e => setV({...v,[e.target.name]:e.target.value})

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

  const submit = async e => {
    e.preventDefault();
    const er=validate(v,K);
    setErr(er);
    if(Object.keys(er).length){
      document.getElementById(Object.keys(er)[0])?.focus();
      return
    }
    
    setEmailStatus('sending')
    setEmailError('')
    const paymentMethodVal = e.target.payment?.value || 'razorpay';
    const paymentMethodName = paymentMethodVal === 'razorpay' ? 'Razorpay (Card/UPI/NetBanking)' : 'Cash on Delivery (COD)';
    
    const items = lines.map(l=>({
      productId: l.id,
      sku: l.sku || l.id.toUpperCase(),
      name: l.name,
      category: l.collection,
      image: l.images?.[0] || `/images/products/${l.id}-1.jpg`,
      price: l.price,
      q: l.q
    }));
    
    const orderPayload = {
      ...v, 
      total: finalTotal, 
      subtotal: cartTotal, 
      discount: discountValue,
      pointsRedeemed,
      paymentMethod: paymentMethodName, 
      paymentStatus: 'Pending', 
      orderStatus: 'Confirmed', 
      items 
    }

    if (paymentMethodVal === 'razorpay') {
      try {
        const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
        // If live/test Razorpay API credentials are configured, try in-app Razorpay modal
        if (keyId && typeof window !== 'undefined' && window.Razorpay) {
          try {
            const rzRes = await fetch('/api/razorpay/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: finalTotal })
            });
            const rzData = await rzRes.json();
            if (rzRes.ok && rzData && rzData.id && !rzData.useDirectLink) {
              const savedOrder = await addOrder(orderPayload);
              if (!savedOrder) throw new Error('Failed to create order on server');

              const options = {
                key: keyId,
                amount: rzData.amount,
                currency: rzData.currency || 'INR',
                name: SHOP.name,
                description: `Order ${savedOrder.no}`,
                order_id: rzData.id,
                handler: async function (response) {
                  try {
                    const verifyRes = await fetch('/api/razorpay/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        order_no: savedOrder.no
                      })
                    });
                    if (verifyRes.ok) {
                      setOrder({ ...savedOrder, paymentStatus: 'Paid' });
                      clear();
                    } else {
                      setOrder(savedOrder);
                      clear();
                    }
                  } catch {
                    setOrder(savedOrder);
                    clear();
                  }
                },
                prefill: { name: v.name, email: v.email, contact: v.phone },
                theme: { color: '#4a0e18' }
              };
              const rzp = new window.Razorpay(options);
              rzp.on('payment.failed', function () {
                setOrder(savedOrder);
                clear();
              });
              rzp.open();
              setEmailStatus('idle');
              return;
            }
          } catch (modalErr) {
            console.info('Switching to direct Razorpay portal:', modalErr);
          }
        }

        // Direct Razorpay.me payment flow (@srikandanfamilyshop)
        const savedOrder = await addOrder(orderPayload);
        if (savedOrder) {
          setOrder(savedOrder);
          clear();
          setEmailStatus('idle');
        } else {
          setEmailStatus('error');
          setEmailError('Failed to create order on server');
        }
      } catch(err) {
        setEmailStatus('error');
        setEmailError(err.message || 'Razorpay order error');
      }
    } else {
      const savedOrder = await addOrder(orderPayload);
      if (savedOrder) {
        setOrder(savedOrder);
        clear();
        setEmailStatus('idle');
      } else {
        setEmailStatus('error');
        setEmailError('Failed to create order on server');
      }
    }
  }

  if(order){
   const isRazorpay = (order.paymentMethod || '').toLowerCase().includes('razorpay');
   const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
   const razorpayUrl = SHOP.razorpayUrl || 'https://razorpay.me/@srikandanfamilyshop';

   return (
    <Wrap className="max-w-2xl py-12">
      <div className="border border-emerald-500/40 bg-white p-6 sm:p-8 shadow-md rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</span>
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
                navigator.clipboard.writeText(order.no);
                setCopiedNo(true);
                setTimeout(() => setCopiedNo(false), 2500);
              }
            }}
            className="rounded-lg border border-gold/40 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-gold/10 transition-colors shadow-sm"
          >
            {copiedNo ? '✓ Copied' : '📋 Copy Order No'}
          </button>
        </div>

        {/* Dedicated Razorpay Payment Card for Online Orders */}
        {isRazorpay && !isPaid && (
          <div className="mt-6 rounded-2xl border-2 border-emerald-600/30 bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/50 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💳</span>
                <div>
                  <h3 className="font-bold text-emerald-950 text-base">Pay via Razorpay / UPI</h3>
                  <p className="text-xs text-emerald-800/80">
                    Official Handle: <strong className="font-mono text-primary font-bold">{SHOP.razorpayHandle || '@srikandanfamilyshop'}</strong>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-xs font-bold text-amber-900">
                Amount to Pay: {inr(order.total)}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs sm:text-sm text-ink/80 bg-white rounded-xl p-4 border border-gold/20 shadow-xs">
              <p className="font-bold text-primary text-xs uppercase tracking-wider">Quick Steps to Complete Payment:</p>
              <ol className="list-decimal list-inside space-y-1 text-ink/80">
                <li>Click <strong>“Pay {inr(order.total)} on Razorpay”</strong> below to open our official page.</li>
                <li>Enter the exact amount: <strong className="text-emerald-800">{inr(order.total)}</strong></li>
                <li>In the comment field, paste your Order Number: <strong className="font-mono text-primary">{order.no}</strong></li>
                <li>Complete your payment via Google Pay, PhonePe, Paytm, any UPI app, Debit/Credit Card, or NetBanking.</li>
              </ol>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <a
                href={razorpayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all hover:shadow-lg flex items-center justify-center gap-2 text-base"
              >
                <span>Pay {inr(order.total)} on Razorpay</span>
                <span className="text-base">↗</span>
              </a>

              <a
                href={`https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(`Hello Sri Kandan Family Shop, I placed order ${order.no} for ${inr(order.total)}. I am paying via Razorpay (@srikandanfamilyshop).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <span>💬 WhatsApp Us</span>
              </a>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-ink/60">Already paid?</span>
              <button
                type="button"
                onClick={() => setPaymentReported(true)}
                className={`rounded-lg px-3 py-1 font-semibold transition-colors ${
                  paymentReported
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-gold/40 text-primary hover:bg-gold/10'
                }`}
              >
                {paymentReported ? '✓ Payment Submitted for Verification' : 'I have completed this payment'}
              </button>
            </div>

            {paymentReported && (
              <p className="mt-2 text-xs text-emerald-800 bg-emerald-100/70 p-2.5 rounded-lg border border-emerald-300">
                🎉 Thank you! Our accounts team will reconcile your payment with Order <strong>{order.no}</strong> and dispatch your parcel swiftly.
              </p>
            )}
          </div>
        )}

        {order.pointsAwarded && order.pointsEarned > 0 ? (
          <div className="mt-4 bg-emerald/10 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-300">
            <span className="text-xl">💎</span>
            <span>You earned <strong>{order.pointsEarned} loyalty points</strong> on this order! Available in your account.</span>
          </div>
        ) : estimatedPointsEarned > 0 ? (
          <div className="mt-4 bg-emerald/10 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-300">
            <span className="text-xl">💎</span>
            <span>You will earn <strong>{estimatedPointsEarned} loyalty points</strong> upon order delivery!</span>
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-gold/40">{order.items.map(l=><li key={l.id || l.productId || l.name} className="flex justify-between py-2 text-sm"><span>{l.name} × {l.q}</span><span className="font-semibold">{inr(l.price*l.q)}</span></li>)}</ul>
        <p className="mt-3 flex justify-between text-lg font-bold border-t border-gold/40 pt-3"><span>Total Amount</span><span className="text-primary">{inr(order.total)}</span></p>
        <div className="mt-4 space-y-1 border-t border-gold/40 pt-4 text-sm text-ink/80">
          <p><b>Delivery address:</b> {order.address}</p>
          <p><b>Customer:</b> {order.name}</p>
          <p><b>Customer email:</b> {order.email}</p>
          <p><b>Payment Method:</b> {order.paymentMethod}</p>
          <p><b>Payment Status:</b> <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{isPaid ? 'Paid' : 'Pending Verification'}</span></p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/orders" className={btnP + ' flex-1 text-center'}>View My Orders</Link>
          <Link to="/shop" className={btnO + ' flex-1 text-center'}>Continue Shopping</Link>
        </div>
      </div>
    </Wrap>
   );
  }
  if(!lines.length)return <Wrap className="py-12 text-center"><h1 className="text-3xl font-serif">Your Cart is Empty</h1><Link to="/shop" className={btnP+' mt-6'}>Browse collections</Link></Wrap>
 
  return (
    <Wrap className="py-10">
      <h1 className="text-4xl">Checkout</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_350px]">
        <form onSubmit={submit} noValidate className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-primary border-b border-gold/30 pb-2">1. Delivery Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Full name" id="name" autoComplete="name" value={v.name||''} onChange={ch} error={err.name}/></div>
              <Field label="Email" id="email" type="email" autoComplete="email" value={v.email||''} onChange={ch} error={err.email}/>
              <Field label="Phone (10-digit mobile)" id="phone" type="tel" autoComplete="tel" value={v.phone||''} onChange={ch} error={err.phone}/>
              <div className="sm:col-span-2"><Field area label="Delivery address" id="address" autoComplete="street-address" value={v.address||''} onChange={ch} error={err.address}/></div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-primary border-b border-gold/30 pb-2">2. Secure Payment Method</h2>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 p-4 border-2 border-primary/40 rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors">
                <input type="radio" name="payment" value="razorpay" defaultChecked className="accent-primary w-4 h-4 mt-1" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="block font-bold text-sm text-primary">Razorpay (Cards / UPI / NetBanking)</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">Fast & Verified</span>
                  </div>
                  <span className="block text-xs text-ink/70 mt-1">
                    Pay securely to <strong>{SHOP.razorpayHandle || '@srikandanfamilyshop'}</strong> via Google Pay, PhonePe, Paytm, UPI, Cards, or NetBanking.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xl">
                  <span title="UPI & Cards">💳</span>
                  <span title="Instant Mobile UPI">📱</span>
                </div>
              </label>
              <label className="flex items-start gap-3 p-4 border border-gold/40 rounded-xl cursor-pointer bg-white hover:bg-ivory/50 transition-colors">
                <input type="radio" name="payment" value="cod" className="accent-primary w-4 h-4 mt-1" />
                <div className="flex-1">
                  <span className="block font-bold text-sm text-ink">Cash on Delivery (COD)</span>
                  <span className="block text-xs text-ink/60 mt-0.5">Pay in cash when you receive the package at your doorstep</span>
                </div>
                <span className="text-xl shrink-0">🚚</span>
              </label>
            </div>
          </div>

          <button className={btnP + ' w-full py-4 text-lg font-bold tracking-wide'} disabled={emailStatus==='sending'}>
            {emailStatus==='sending' ? 'Processing...' : `Place Secure Order — ${inr(finalTotal)}`}
          </button>
          {emailError && <p className="text-red-600 text-sm font-semibold">{emailError}</p>}
        </form>
        
        <aside className="h-fit space-y-4">
          <div className="border border-gold/50 bg-white p-5 shadow-sm rounded-xl space-y-4">
            <h2 className="text-2xl font-serif text-primary">Order Summary</h2>
            <div className="divide-y divide-gold/20 border-b border-gold/20 pb-2">
              {lines.map(l=><p key={l.id} className="py-3 flex justify-between text-sm text-ink/80"><span className="pr-4">{l.name} <span className="text-ink/50">× {l.q}</span></span><span className="font-bold text-ink whitespace-nowrap">{inr(l.price*l.q)}</span></p>)}
            </div>
            
            <div className="pt-2 space-y-2 text-sm text-ink/70">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(cartTotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span className="text-emerald-700 font-bold">Free</span></div>
              {pointsRedeemed > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Loyalty Discount ({pointsRedeemed} pts)</span>
                  <span>-{inr(discountValue)}</span>
                </div>
              )}
            </div>

            <p className="pt-4 flex justify-between border-t border-gold/40 text-xl font-bold text-primary"><span>Total</span><span>{inr(finalTotal)}</span></p>
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
                Balance: <strong>{loyaltyBalance} pts</strong> <br/>
                Value: 1 pt = {inr(pointValue)} <br/>
                Max allowed: {maxRedeemablePoints} pts
              </p>

              {pointsRedeemed > 0 ? (
                <div className="bg-white border border-emerald/20 p-3 rounded flex justify-between items-center text-sm">
                  <span className="font-bold text-emerald-800">{pointsRedeemed} points applied!</span>
                  <button type="button" onClick={removePoints} className="text-xs underline text-ink/60 hover:text-red-600">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={inputPoints} 
                    onChange={e => setInputPoints(e.target.value)}
                    className="h-9 flex-1 rounded border border-emerald/30 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" 
                    placeholder="Enter points" 
                  />
                  <button type="button" onClick={applyPoints} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded text-sm font-bold transition-colors">Apply</button>
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
