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
    const paymentMethodVal = e.target.payment?.value || 'cod';
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
        const rzRes = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: finalTotal })
        });
        if (!rzRes.ok) throw new Error('Could not initialize Razorpay');
        const rzOrder = await rzRes.json();
        
        const savedOrder = await addOrder(orderPayload);
        if (!savedOrder) throw new Error('Failed to create order on server');

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_demo',
          amount: rzOrder.amount,
          currency: rzOrder.currency,
          name: SHOP.name,
          description: 'Order Payment',
          order_id: rzOrder.id,
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
                setOrder({...savedOrder, paymentStatus: 'Paid'});
                clear();
              } else {
                setEmailStatus('error');
                setEmailError('Payment verification failed.');
              }
            } catch(e) {
              setEmailStatus('error');
              setEmailError('Failed to verify payment.');
            }
          },
          prefill: { name: v.name, email: v.email, contact: v.phone },
          theme: { color: '#4a0e18' }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function () {
          setEmailStatus('error');
          setEmailError('Payment was cancelled or failed.');
        });
        rzp.open();

      } catch(err) {
        setEmailStatus('error');
        setEmailError(err.message || 'Razorpay error');
      }
    } else {
      const savedOrder = await addOrder(orderPayload);
      if (savedOrder) {
        setOrder(savedOrder);
        clear();
      } else {
        setEmailStatus('error');
        setEmailError('Failed to create order on server');
      }
    }
  }

  if(order){
   return <Wrap className="max-w-2xl py-12"><div className="border border-emerald/40 bg-white p-8 shadow-sm rounded-xl"><h1 className="text-3xl text-emerald-800 font-serif">Order Confirmed!</h1><p className="mt-2 text-lg">Order number: <b className="font-mono text-primary">{order.no}</b></p><p className="text-sm text-ink/70">Thank you for shopping with Sri Kandan Family Shop.</p>
   
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
   
   <ul className="mt-4 divide-y divide-gold/40">{order.items.map(l=><li key={l.id || l.productId || l.name} className="flex justify-between py-2"><span>{l.name} × {l.q}</span><span>{inr(l.price*l.q)}</span></li>)}</ul>
   <p className="mt-3 flex justify-between text-lg font-bold border-t border-gold/40 pt-3"><span>Total Paid</span><span>{inr(order.total)}</span></p>
   <div className="mt-4 space-y-1 border-t border-gold/40 pt-4 text-sm text-ink/80"><p><b>Delivery address:</b> {order.address}</p><p><b>Customer:</b> {order.name}</p><p><b>Customer email:</b> {order.email}</p><p><b>Payment:</b> {order.paymentMethod}</p></div>
   
   <Link to="/shop" className={btnP+' mt-5 block text-center'}>Continue shopping</Link></div></Wrap>}
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
              <label className="flex items-center gap-3 p-4 border border-primary/40 rounded-lg cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors">
                <input type="radio" name="payment" value="razorpay" defaultChecked className="accent-primary w-4 h-4" />
                <div className="flex-1">
                  <span className="block font-bold text-sm text-primary">Razorpay (Cards / UPI / NetBanking)</span>
                  <span className="block text-xs text-ink/60 mt-0.5">Secure payment gateway</span>
                </div>
                <span className="text-xl">💳</span>
              </label>
              <label className="flex items-center gap-3 p-4 border border-gold/40 rounded-lg cursor-pointer bg-white hover:bg-ivory/50 transition-colors">
                <input type="radio" name="payment" value="cod" className="accent-primary w-4 h-4" />
                <div className="flex-1">
                  <span className="block font-bold text-sm text-ink">Cash on Delivery (COD)</span>
                  <span className="block text-xs text-ink/60 mt-0.5">Pay when you receive the order</span>
                </div>
                <span className="text-xl">🚚</span>
              </label>
            </div>
          </div>

          <button className={btnP + ' w-full py-4 text-lg font-bold tracking-wide'} disabled={emailStatus==='sending'}>
            {emailStatus==='sending' ? 'Processing...' : `Place Secure Order — ${inr(finalTotal)}`}
          </button>
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
