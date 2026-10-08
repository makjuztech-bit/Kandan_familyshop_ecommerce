import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../context/Store'
import { useOrders } from '../data/orders'
import {
  changeDemoPassword,
  getDemoUser,
  isLoggedIn,
  loginDemoUserByPhone,
  loginDemoUser,
  logoutDemoUser,
  registerDemoUser,
  resetPasswordRequest,
  updateDemoProfile,
  useAuthStatus,
} from '../data/auth'
import { byId, inr, products } from '../data/products'
import { Wrap, Field, Img, btnP, btnO, validate } from '../components/ui'
import {CustomerReviews} from '../components/Reviews'
import {ReviewSummary,ProductSalesSummary} from '../components/Rating'

export function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('otp')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [values, setValues] = useState({ email: 'hello@kandanfamilyshop.com', password: 'demo123' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  if (isLoggedIn()) {
    return <Navigate to="/account" replace />
  }

  const onChange = e => setValues({ ...values, [e.target.name]: e.target.value })
  const generateOtp = e => {
    e.preventDefault()
    const nextErrors = validate({ phone }, ['phone'])
    setErrors(nextErrors)
    setMessage('')
    if (Object.keys(nextErrors).length) return

    if (!globalThis.crypto?.getRandomValues) {
      setMessage('Secure OTP generation is unavailable in this browser. Use email and password instead.')
      return
    }

    const random = new Uint32Array(1)
    globalThis.crypto.getRandomValues(random)
    const code = String(random[0] % 1000000).padStart(6, '0')
    setChallenge({ code, phone: phone.replace(/\D/g, ''), expiresAt: Date.now() + 5 * 60 * 1000 })
    setOtp('')
    setMessage('')
  }
  const verifyOtp = e => {
    e.preventDefault()
    const nextErrors = validate({ phone }, ['phone'])
    if (!/^\d{6}$/.test(otp)) nextErrors.otp = 'Enter the 6-digit OTP.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!challenge || challenge.phone !== phone.replace(/\D/g, '')) {
      setMessage('Generate a new OTP for this mobile number.')
      return
    }
    if (Date.now() > challenge.expiresAt) {
      setChallenge(null)
      setOtp('')
      setMessage('That demo OTP expired. Generate a new one.')
      return
    }
    if (otp !== challenge.code) {
      setErrors({ otp: 'That OTP is incorrect. Check the code and try again.' })
      return
    }

    const result = loginDemoUserByPhone(phone)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage('')
    navigate('/account')
  }
  const changePhone = e => {
    setPhone(e.target.value)
    setChallenge(null)
    setOtp('')
    setErrors({})
    setMessage('')
  }

  if (mode === 'otp') {
    return (
      <Wrap className="py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-gold/40 bg-white p-8 shadow-sm">
          <h1 className="text-3xl">Login with mobile</h1>
          <p className="mt-2 text-sm text-ink/70">Demo OTP login. No SMS is sent; the generated code appears here for testing.</p>
          <form onSubmit={generateOtp} noValidate className="mt-6 space-y-4">
            <Field label="Mobile number" id="phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={changePhone} error={errors.phone} />
            <button className={btnP + ' w-full'}>Generate demo OTP</button>
          </form>
          {challenge && <div className="mt-4 rounded-md bg-gold/15 p-3 text-sm" role="status">
            <p>Demo OTP for {phone}: <strong className="font-mono text-lg tracking-widest">{challenge.code}</strong></p>
            <p className="mt-1 text-ink/70">For this demo only; valid for 5 minutes. This code is not sent by SMS.</p>
          </div>}
          {challenge && <form onSubmit={verifyOtp} noValidate className="mt-4 space-y-4">
            <Field label="6-digit OTP" id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} error={errors.otp} />
            <button className={btnP + ' w-full'}>Verify OTP and login</button>
          </form>}
          {message && <p role="alert" className="mt-4 rounded-md bg-gold/15 p-3 text-sm text-ink/80">{message}</p>}
          <p className="mt-5 text-center text-sm text-ink/70">
            <button type="button" className="font-bold text-maroon" onClick={() => { setMode('email'); setMessage(''); setErrors({}) }}>Use email and password instead</button>
          </p>
          <p className="mt-3 text-center text-sm text-ink/70">New here? <Link to="/register" className="font-bold text-maroon">Create account</Link></p>
        </div>
      </Wrap>
    )
  }

  const submit = e => {
    e.preventDefault()
    const nextErrors = validate(values, ['email'])
    if (!values.password) {
      nextErrors.password = 'Enter your password.'
    }
    const result = loginDemoUser(values)

    if (Object.keys(nextErrors).length || !result.ok) {
      setErrors({ ...nextErrors, email: result.ok ? nextErrors.email : 'Incorrect email or password.' })
      setMessage(result.message || 'Please check your details.')
      return
    }

    setMessage('')
    navigate('/account')
  }

  return (
    <Wrap className="py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-gold/40 bg-white p-8 shadow-sm">
        <h1 className="text-3xl">Login</h1>
        <p className="mt-2 text-sm text-ink/70">Welcome back to Kandan Family Shop. Demo login uses the default account.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Email" id="email" type="email" name="email" value={values.email} onChange={onChange} error={errors.email} />
          <Field label="Password" id="password" type="password" name="password" value={values.password} onChange={onChange} error={errors.password} />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-maroon" defaultChecked />
              Remember me
            </label>
            <Link to="/forgot-password" className="font-bold text-maroon">Forgot password?</Link>
          </div>
          <button className={btnP + ' w-full'}>Login</button>
          {message && <p role="status" className="rounded-md bg-gold/15 p-3 text-sm text-ink/80">{message}</p>}
          <p className="text-center text-sm text-ink/70">
            <button type="button" className="font-bold text-maroon" onClick={() => { setMode('otp'); setMessage(''); setErrors({}) }}>Login with mobile OTP</button>
          </p>
          <p className="text-center text-sm text-ink/70">
            New here? <Link to="/register" className="font-bold text-maroon">Create account</Link>
          </p>
        </form>
      </div>
    </Wrap>
  )
}

export function Register() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: 'Aisha Kandan', email: 'hello@kandanfamilyshop.com', phone: '9876543210', password: 'demo123', confirmPassword: 'demo123' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  if (isLoggedIn()) {
    return <Navigate to="/account" replace />
  }

  const onChange = e => setValues({ ...values, [e.target.name]: e.target.value })
  const submit = e => {
    e.preventDefault()
    const nextErrors = validate(values, ['name', 'email', 'phone'])

    if (values.password.length < 6) {
      nextErrors.password = 'Use at least 6 characters.'
    }
    if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setMessage('Please fix the highlighted fields.')
      return
    }

    const result = registerDemoUser({
      name: values.name,
      email: values.email,
      phone: values.phone,
      password: values.password,
      address: '22 Silk Lane, Chennai 600001',
    })

    if (!result.ok) {
      setMessage(result.message)
      return
    }

    navigate('/account')
  }

  return (
    <Wrap className="py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-gold/40 bg-white p-8 shadow-sm">
        <h1 className="text-3xl">Register</h1>
        <p className="mt-2 text-sm text-ink/70">Create an account to save favorites, track orders and manage your profile.</p>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Full name" id="name" name="name" value={values.name} onChange={onChange} error={errors.name} />
          </div>
          <Field label="Email" id="email" type="email" name="email" value={values.email} onChange={onChange} error={errors.email} />
          <Field label="Phone" id="phone" type="tel" name="phone" value={values.phone} onChange={onChange} error={errors.phone} />
          <Field label="Password" id="password" type="password" name="password" value={values.password} onChange={onChange} error={errors.password} />
          <Field label="Confirm password" id="confirmPassword" type="password" name="confirmPassword" value={values.confirmPassword} onChange={onChange} error={errors.confirmPassword} />
          <div className="md:col-span-2">
            <button className={btnP + ' w-full'}>Create account</button>
          </div>
          {message && <p className="md:col-span-2 rounded-md bg-gold/15 p-3 text-sm text-ink/80">{message}</p>}
          <p className="md:col-span-2 text-center text-sm text-ink/70">
            Already have an account? <Link to="/login" className="font-bold text-maroon">Log in</Link>
          </p>
        </form>
      </div>
    </Wrap>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('hello@kandanfamilyshop.com')
  const [message, setMessage] = useState('')
  const submit = e => {
    e.preventDefault()
    const result = resetPasswordRequest(email)
    setMessage(result.message)
  }

  return (
    <Wrap className="py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-gold/40 bg-white p-8 shadow-sm">
        <h1 className="text-3xl">Forgot password</h1>
        <p className="mt-2 text-sm text-ink/70">Enter your email to receive a secure reset link. Demo mode only.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Email" id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <button className={btnP + ' w-full'}>Send reset link</button>
          {message && <p role="status" className="rounded-md bg-gold/15 p-3 text-sm text-ink/80">{message}</p>}
          <p className="text-center text-sm text-ink/70">
            Back to <Link to="/login" className="font-bold text-maroon">login</Link>
          </p>
        </form>
      </div>
    </Wrap>
  )
}

export function Account() {
  const { wish, toggleWish } = useStore()
  const orders = useOrders()
  const session = useAuthStatus()
  const [tab, setTab] = useState('profile')
  const user = getDemoUser()
  const myOrders=orders.filter(order=>(order.email||'').toLowerCase()===(session?.email||'').toLowerCase())
  const [profile, setProfile] = useState({ name: user.name, email: user.email, phone: user.phone, address: user.address })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState('')

  if (!session || !session.loggedIn) {
    return <Navigate to="/login" replace />
  }

  const saveProfile = e => {
    e.preventDefault()
    const result = updateDemoProfile(profile)
    setStatus(result.ok ? 'Profile updated.' : result.message)
  }

  const savePassword = e => {
    e.preventDefault()
    if (passwords.newPassword !== passwords.confirmPassword) {
      setStatus('New passwords do not match.')
      return
    }
    const result = changeDemoPassword(passwords.currentPassword, passwords.newPassword)
    setStatus(result.ok ? 'Password updated successfully.' : result.message)
  }

  const wishlistItems = wish.map(id => byId[id]).filter(Boolean)
  const tabs = ['profile', 'orders', 'wishlist', 'reviews', 'security']

  return (
    <Wrap className="py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-maroon">My account</p>
          <h1 className="text-4xl">Hello, {session.name}</h1>
        </div>
        <button className={btnO} onClick={() => logoutDemoUser()}>Logout</button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              'min-h-11 rounded-full px-4 text-sm font-bold ' +
              (tab === key ? 'bg-maroon text-ivory' : 'border border-gold/40 bg-white text-maroon')
            }
          >
            {key === 'profile' ? 'Profile' : key === 'orders' ? 'Orders' : key === 'wishlist' ? 'Wishlist' : key === 'reviews' ? 'Reviews' : 'Password'}
          </button>
        ))}
      </div>

      {status && <p className="mb-4 rounded-md bg-gold/15 p-3 text-sm text-ink/80">{status}</p>}

      {tab === 'profile' && (
        <form onSubmit={saveProfile} noValidate className="grid gap-4 rounded-2xl border border-gold/40 bg-white p-6 md:grid-cols-2">
          <Field label="Full name" id="profile-name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
          <Field label="Email" id="profile-email" type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
          <Field label="Phone" id="profile-phone" type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
          <div className="md:col-span-2">
            <Field label="Primary address" id="profile-address" area value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button className={btnP}>Save profile</button>
          </div>
        </form>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          {myOrders.length === 0 ? (
            <div className="rounded-2xl border border-gold/40 bg-white p-8 text-center text-ink/70">
              You have not placed any orders yet.
            </div>
          ) : (
            myOrders.map(order => (
              <div key={order.no} className="rounded-2xl border border-gold/40 bg-white p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold">{order.no}</p>
                    <p className="text-sm text-ink/70">{order.at}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold">{order.status || 'New'}</span>
                    <Link to={'/order/' + order.no} className="font-bold text-maroon">View details</Link>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-ink/70">
                  <span>{(order.items||[]).length} item(s) · Payment {order.paymentStatus||'unpaid'}</span>
                  <span className="font-bold text-maroon">{inr(order.total || 0)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {wishlistItems.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-gold/40 bg-white p-8 text-center text-ink/70">
              Your wishlist is empty. <Link to="/shop" className="font-bold text-maroon">Browse sarees</Link>
            </div>
          ) : (
            wishlistItems.map(product => (
              <div key={product.id} className="rounded-2xl border border-gold/40 bg-white p-4">
                <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark">
                  <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <h2 className="mt-3 text-lg">{product.name}</h2>
                <p className="text-sm text-ink/70">{product.collection}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-bold text-maroon">{inr(product.price)}</span>
                  <button className={btnO} onClick={() => toggleWish(product.id)}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="rounded-2xl border border-gold/30 bg-ivory/50 p-4 sm:p-6">
          <CustomerReviews initialName={session.name||user.name} initialEmail={session.email||user.email}/>
        </div>
      )}

      {tab === 'security' && (
        <form onSubmit={savePassword} noValidate className="grid gap-4 rounded-2xl border border-gold/40 bg-white p-6 md:max-w-xl">
          <Field label="Current password" id="currentPassword" type="password" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          <Field label="New password" id="newPassword" type="password" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} />
          <Field label="Confirm new password" id="confirmPassword" type="password" value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} />
          <button className={btnP}>Update password</button>
        </form>
      )}
    </Wrap>
  )
}

export function OrderDetails() {
  const { orderId } = useParams()
  const orders = useOrders()
  const session = useAuthStatus()
  const order = orders.find(item => item.no === orderId&&(item.email||'').toLowerCase()===(session?.email||'').toLowerCase())

  if (!session?.loggedIn) return <Navigate to="/login" replace />
  if (!order) {
    return <Navigate to="/account" replace />
  }

  const items=(order.items||[]).map(item=>({...item,product:byId[item.productId]||products.find(product=>product.name===item.name)}))
  const status=order.status||'New'
  const paymentStatus=String(order.paymentStatus||'unpaid').toLowerCase()
  const placed=order.createdAt?new Date(order.createdAt):new Date(order.at)
  const orderDate=Number.isNaN(placed.getTime())?order.at:placed.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})
  const steps=['New','Packed','Delivered']
  const stepIndex=steps.indexOf(status)
  return (
    <Wrap className="py-10">
      <div className="mb-6 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm uppercase tracking-[0.2em] text-maroon">My order</p><h1 className="mt-1 text-3xl sm:text-4xl">#{order.no}</h1><p className="mt-2 text-sm text-ink/60">Placed on {orderDate}</p></div>
          <Link to="/account" className={btnO}>Back to my orders</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-ivory/70 p-4"><p className="text-xs uppercase tracking-wide text-ink/60">Order status</p><p className="mt-1 font-bold text-maroon">{status}</p></div>
          <div className="rounded-xl bg-ivory/70 p-4"><p className="text-xs uppercase tracking-wide text-ink/60">Payment</p><p className="mt-1 font-bold capitalize">{paymentStatus}</p></div>
          <div className="rounded-xl bg-ivory/70 p-4"><p className="text-xs uppercase tracking-wide text-ink/60">Delivery</p><p className="mt-1 font-bold">{status==='Delivered'?'Delivered':status==='Cancelled'?'Cancelled':'In progress'}</p></div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,.8fr)]">
        <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-2xl">Purchased products</h2><p className="mt-1 text-sm text-ink/60">{items.length} item(s)</p></div><p className="font-serif text-2xl font-bold text-maroon">{inr(order.total||0)}</p></div>
          <ul className="space-y-4">{items.map((item,index)=>{
            const product=item.product,productId=item.productId||product?.id
            return <li key={`${productId||item.name}-${index}`} className="rounded-xl border border-gold/20 p-4">
              <div className="flex gap-4">
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">{product?<Img src={item.image||product.images[0]} alt={item.name} tone={product.hex} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs">Product photo</div>}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-ink/60">SKU {item.sku||productId||'—'}{(item.category||product?.collection)&&` · ${item.category||product.collection}`}</p>
                  <p className="mt-2 text-sm">Qty {item.q||1} × {inr(item.price||0)}</p><p className="mt-1 font-bold text-maroon">{inr((item.price||0)*(item.q||1))}</p>
                  {productId&&<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><ReviewSummary productId={productId}/><ProductSalesSummary productId={productId}/></div>}
                </div>
              </div>
              {status==='Delivered'&&productId&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ivory/70 p-3"><div><p className="font-bold">How was your product?</p><p className="text-xs text-ink/60">Share your feedback; reviews appear after shop moderation.</p></div><Link to={`/product/${productId}?review=1#product-reviews-heading`} className={btnO}>Rate this product</Link></div>}
            </li>
          })}</ul>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm"><h2 className="text-xl">Delivery details</h2><p className="mt-3 font-bold">{order.name}</p><p className="mt-1 text-sm text-ink/70">{order.address}</p><p className="mt-2 text-sm text-ink/70">{order.phone}</p><p className="break-all text-sm text-ink/70">{order.email}</p></section>
          <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm"><h2 className="text-xl">Payment summary</h2><div className="mt-3 flex justify-between gap-3 text-sm"><span>Payment method</span><span className="text-right">{order.paymentMethod||'Not recorded'}</span></div><div className="mt-3 flex justify-between border-t border-gold/20 pt-3 font-bold"><span>Order total</span><span className="text-maroon">{inr(order.total||0)}</span></div><p className="mt-3 text-xs text-ink/60">This storefront uses demo checkout. No payment is collected unless a payment provider is configured.</p></section>
        </aside>
      </div>

      <div className="mt-6 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
        <h2 className="text-xl">Order progress</h2>
        {status==='Cancelled'||status==='Refunded'?<p className="mt-3 rounded-lg bg-red-50 p-3 font-bold text-red-800">{status}</p>:<div className="mt-4 grid gap-3 sm:grid-cols-3">{steps.map((step,index)=><div key={step} className="flex items-center gap-3"><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold '+(index<=stepIndex?'bg-maroon text-ivory':'bg-gold/20 text-maroon')}>{index<=stepIndex?'✓':index+1}</span><span className={index<=stepIndex?'font-bold':'text-ink/60'}>{step}</span></div>)}</div>}
      </div>
    </Wrap>
  )
}

export function CategoryPage() {
  const { category } = useParams()
  const label = decodeURIComponent(category || '').replace(/-/g, ' ')
  const items = products.filter(product => product.collection === label)

  return (
    <Wrap className="py-10">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-maroon">Collection</p>
          <h1 className="text-4xl">{label}</h1>
        </div>
        <Link to="/shop" className={btnO}>Browse all</Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-gold/40 bg-white p-10 text-center text-ink/70">No products found in this collection.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map(product => (
            <div key={product.id} className="rounded-2xl border border-gold/40 bg-white p-3">
              <Link to={'/product/' + product.id}>
                <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark">
                  <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <h2 className="mt-3 text-lg">{product.name}</h2>
              </Link>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-bold text-maroon">{inr(product.price)}</span>
                <Link to={'/product/' + product.id} className={btnP}>View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  )
}
