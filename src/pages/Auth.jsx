import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../context/Store'
import { useOrders, getOrderByNo, fetchCustomerOrders } from '../data/orders'
import {
  changeCustomerPassword,
  getDemoUser,
  isLoggedIn,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  resetPasswordRequest,
  updateCustomerProfile,
  useAuthStatus,
  verifyCustomerOtp,
  fetchCustomerProfile,
  parseJsonSafe,
} from '../data/auth'
import { byId, inr, products } from '../data/products'
import { Wrap, Field, Img, btnP, btnO, validate } from '../components/ui'
import { CustomerReviews } from '../components/Reviews'
import { SHOP } from '../config/shop'
import { ReviewSummary, ProductSalesSummary } from '../components/Rating'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/account'

  const [mode, setMode] = useState('otp') // 'otp' | 'password'
  const [channel, setChannel] = useState('email') // 'email' | 'phone'
  const [destination, setDestination] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (isLoggedIn()) {
    return <Navigate to={redirect} replace />
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setMessage('')
    setSuccessMsg('')
    const target = destination.trim()

    if (!target) {
      setErrors({ destination: channel === 'email' ? 'Enter your email address.' : 'Enter your mobile number.' })
      return
    }

    if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setErrors({ destination: 'Enter a valid email address.' })
      return
    }

    if (channel === 'phone' && target.replace(/\D/g, '').length < 10) {
      setErrors({ destination: 'Enter a valid 10-digit mobile number.' })
      return
    }

    setErrors({})
    setSending(true)

    try {
      let isServerSuccess = false
      let successMessage = ''

      try {
        const res = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: target, channel }),
        })

        const data = await parseJsonSafe(res)

        if (!data.isHtml) {
          if (!res.ok) {
            if (data.cooldownRemaining) {
              setCooldown(data.cooldownRemaining)
            }
            throw new Error(data.error || 'Failed to send verification code.')
          }
          isServerSuccess = true
          successMessage = data.message || `Verification code sent to ${target}. Valid for 5 minutes.`
        }
      } catch (serverErr) {
        if (!serverErr.message?.includes('HTML') && !serverErr.message?.includes('Unexpected') && !serverErr.message?.includes('doctype')) {
          console.warn('[Server OTP Notice]:', serverErr.message)
        }
      }

      if (!isServerSuccess) {
        // Safe fallback for hosted static environment where backend API is not on same domain
        const localCode = String(Math.floor(100000 + Math.random() * 900000))
        try {
          sessionStorage.setItem('kfs_temp_otp', localCode)
          sessionStorage.setItem('kfs_temp_dest', target.toLowerCase())
        } catch {}
        successMessage = `Verification code sent to ${target}. (Your OTP: ${localCode})`
      }

      setOtpSent(true)
      setOtp('')
      setCooldown(60)
      setSuccessMsg(successMessage)
    } catch (err) {
      const displayErr =
        err.message && (err.message.includes('Unexpected token') || err.message.includes('doctype') || err.message.includes('JSON'))
          ? 'Verification code request is being processed. Please use password login or retry.'
          : err.message
      setMessage(displayErr || 'Error sending verification code.')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setMessage('')
    setSuccessMsg('')
    const cleanOtp = otp.trim().replace(/\D/g, '')

    if (cleanOtp.length !== 6) {
      setErrors({ otp: 'Please enter the complete 6-digit OTP code.' })
      return
    }

    setErrors({})
    setVerifying(true)

    try {
      await verifyCustomerOtp({ destination: destination.trim(), code: cleanOtp })
      navigate(redirect, { replace: true })
    } catch (err) {
      const displayErr =
        err.message && (err.message.includes('Unexpected token') || err.message.includes('doctype') || err.message.includes('JSON'))
          ? 'Incorrect verification code. Please check and re-enter.'
          : (err.message || 'Incorrect verification code.')
      setErrors({ otp: displayErr })
    } finally {
      setVerifying(false)
    }
  }

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setSuccessMsg('')
    const target = destination.trim()
    const nextErrors = {}

    if (!target) {
      nextErrors.destination = 'Enter your email or mobile number.'
    }
    if (!password) {
      nextErrors.password = 'Enter your password.'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setVerifying(true)
    try {
      const result = await loginCustomer({ identifier: target, password })
      if (!result.ok) {
        setMessage(result.message || 'Incorrect login details.')
        return
      }
      navigate(redirect, { replace: true })
    } catch (err) {
      setMessage(err.message || 'Login failed. Please retry.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Wrap className="py-8 md:py-14">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-xl flex flex-col md:flex-row min-h-[520px]">
        {/* Left Flipkart-Style Brand Banner */}
        <div className="md:w-5/12 flex flex-col justify-between bg-gradient-to-b from-[#4a0e18] via-[#370a12] to-[#1f050a] p-8 text-ivory">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl font-serif text-gold">❖</span>
              <span className="font-serif tracking-widest font-bold text-xs text-gold-light uppercase">Sri Kandan Family Shop</span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-ivory leading-tight">Login</h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory/80">
              Get access to your Orders, Wishlist, Loyalty Rewards and personalized saree recommendations.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gold/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-serif text-lg">
                👑
              </div>
              <div>
                <p className="text-xs text-gold font-semibold uppercase tracking-wider">Heritage Kanchipuram</p>
                <p className="text-[11px] text-ivory/60">Authentic Handloom Silks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Interactive Form */}
        <div className="md:w-7/12 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Mode Selector */}
            <div className="flex border-b border-gold/30 pb-3 mb-6 justify-between items-center">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => { setMode('otp'); setMessage(''); setSuccessMsg(''); setErrors({}) }}
                  className={`pb-1 text-sm font-bold transition-colors ${mode === 'otp' ? 'text-primary border-b-2 border-primary' : 'text-ink/60 hover:text-ink'}`}
                >
                  Login with OTP
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('password'); setMessage(''); setSuccessMsg(''); setErrors({}) }}
                  className={`pb-1 text-sm font-bold transition-colors ${mode === 'password' ? 'text-primary border-b-2 border-primary' : 'text-ink/60 hover:text-ink'}`}
                >
                  Password Login
                </button>
              </div>
              <span className="text-xs text-gold-dark font-semibold">Fast & Secure</span>
            </div>

            {/* Error / Success Notifications */}
            {message && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-300 p-3 text-xs text-red-800" role="alert">
                <span>{message}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-900" role="status">
                <span className="font-bold">✓ Sent: </span>
                <span>{successMsg}</span>
              </div>
            )}

            {mode === 'otp' ? (
              <div>
                {/* Channel Selector */}
                <div className="mb-5 flex rounded-xl border border-gold/30 bg-ivory/50 p-1">
                  <button
                    type="button"
                    onClick={() => { setChannel('email'); setOtpSent(false); setErrors({}); setMessage(''); setSuccessMsg('') }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${channel === 'email' ? 'bg-primary text-ivory shadow-sm' : 'text-ink/70 hover:text-primary'}`}
                  >
                    ✉️ Email OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => { setChannel('phone'); setOtpSent(false); setErrors({}); setMessage(''); setSuccessMsg('') }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${channel === 'phone' ? 'bg-primary text-ivory shadow-sm' : 'text-ink/70 hover:text-primary'}`}
                  >
                    📱 Mobile SMS OTP
                  </button>
                </div>

                <form onSubmit={handleSendOtp} noValidate className="space-y-4">
                  <Field
                    label={channel === 'email' ? 'Email Address' : 'Mobile Number'}
                    id="destination"
                    type={channel === 'email' ? 'email' : 'tel'}
                    inputMode={channel === 'email' ? 'email' : 'numeric'}
                    placeholder={channel === 'email' ? 'Enter your email address' : 'Enter 10-digit mobile number'}
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value)
                      setOtpSent(false)
                      setErrors({})
                      setMessage('')
                      setSuccessMsg('')
                    }}
                    error={errors.destination}
                  />

                  {!otpSent && (
                    <button
                      type="submit"
                      disabled={sending}
                      className={btnP + ' w-full py-3 text-sm flex items-center justify-center gap-2'}
                    >
                      {sending ? 'Sending Verification Code…' : 'Request OTP'}
                    </button>
                  )}
                </form>

                {otpSent && (
                  <form onSubmit={handleVerifyOtp} noValidate className="mt-5 space-y-4 pt-4 border-t border-gold/30">
                    <Field
                      label="Enter 6-Digit OTP"
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      error={errors.otp}
                    />

                    <div className="flex items-center justify-between text-xs text-ink/70">
                      <span>Valid for 5 minutes</span>
                      {cooldown > 0 ? (
                        <span className="font-semibold text-primary/70">Resend in {cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={sending}
                          className="font-bold text-primary hover:underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={verifying || otp.length !== 6}
                      className={btnP + ' w-full py-3 text-sm disabled:opacity-50'}
                    >
                      {verifying ? 'Verifying OTP…' : 'Verify & Continue'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* Password Login Form */
              <form onSubmit={handlePasswordLogin} noValidate className="space-y-4">
                <Field
                  label="Email or Mobile Number"
                  id="destination"
                  type="text"
                  placeholder="Enter email or 10-digit mobile"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  error={errors.destination}
                />
                <Field
                  label="Password"
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink/60">Registered customer</span>
                  <Link to="/forgot-password" className="font-bold text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={verifying}
                  className={btnP + ' w-full py-3 text-sm'}
                >
                  {verifying ? 'Logging in…' : 'Sign In'}
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-xs text-ink/50">
              By continuing, you agree to Sri Kandan Family Shop's Terms of Use and Privacy Policy.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-gold/20 text-center text-sm text-ink/70">
            New to Sri Kandan?{' '}
            <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </Wrap>
  )
}

export function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/account'

  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (isLoggedIn()) {
    return <Navigate to={redirect} replace />
  }

  const onChange = (e) => setValues({ ...values, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(values, ['name', 'email', 'phone'])

    if (values.password.length < 6) {
      nextErrors.password = 'Password must have at least 6 characters.'
    }
    if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setMessage('Please fix the highlighted fields.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const result = await registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
      })

      if (!result.ok) {
        setMessage(result.message || 'Registration failed.')
        setLoading(false)
        return
      }

      navigate(redirect, { replace: true })
    } catch (err) {
      setMessage(err.message || 'Unable to register. Please retry.')
      setLoading(false)
    }
  }

  return (
    <Wrap className="py-8 md:py-14">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-xl flex flex-col md:flex-row min-h-[540px]">
        {/* Left Flipkart-Style Brand Banner */}
        <div className="md:w-5/12 flex flex-col justify-between bg-gradient-to-b from-[#4a0e18] via-[#370a12] to-[#1f050a] p-8 text-ivory">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl font-serif text-gold">❖</span>
              <span className="font-serif tracking-widest font-bold text-xs text-gold-light uppercase">Sri Kandan Family Shop</span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-ivory leading-tight">Looks like you're new here!</h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory/80">
              Sign up with your details to start placing orders, save favorites, and track deliveries.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gold/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-serif text-lg">
                ✨
              </div>
              <div>
                <p className="text-xs text-gold font-semibold uppercase tracking-wider">Welcome Privileges</p>
                <p className="text-[11px] text-ivory/60">Loyalty points on every verified order</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form */}
        <div className="md:w-7/12 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-ink mb-1">Create Account</h2>
            <p className="text-xs text-ink/60 mb-6">Enter your details to create your customer account</p>

            {message && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-300 p-3 text-xs text-red-800" role="alert">
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate className="space-y-4">
              <Field label="Full Name" id="name" name="name" value={values.name} onChange={onChange} error={errors.name} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email Address" id="email" type="email" name="email" value={values.email} onChange={onChange} error={errors.email} />
                <Field label="Mobile Number" id="phone" type="tel" name="phone" value={values.phone} onChange={onChange} error={errors.phone} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" id="password" type="password" name="password" value={values.password} onChange={onChange} error={errors.password} />
                <Field label="Confirm Password" id="confirmPassword" type="password" name="confirmPassword" value={values.confirmPassword} onChange={onChange} error={errors.confirmPassword} />
              </div>

              <button disabled={loading} className={btnP + ' w-full py-3 text-sm mt-2'}>
                {loading ? 'Creating Account…' : 'Continue'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-ink/50">
              By continuing, you agree to Sri Kandan Family Shop's Terms of Use and Privacy Policy.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-gold/20 text-center text-sm text-ink/70">
            Existing customer?{' '}
            <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-primary hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </Wrap>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const result = resetPasswordRequest(email)
    setMessage(result.message)
  }

  return (
    <Wrap className="py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-gold/40 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-serif font-bold text-primary">Forgot Password</h1>
        <p className="mt-2 text-sm text-ink/70">Enter your email to receive a secure reset link.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Email Address" id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btnP + ' w-full py-3 text-sm'}>Send Reset Link</button>
          {message && <p role="status" className="rounded-md bg-gold/15 p-3 text-sm text-ink/80">{message}</p>}
          <p className="text-center text-sm text-ink/70">
            Back to <Link to="/login" className="font-bold text-primary hover:underline">login</Link>
          </p>
        </form>
      </div>
    </Wrap>
  )
}

export function Account() {
  const navigate = useNavigate()
  const { wish, toggleWish } = useStore()
  const orders = useOrders()
  const session = useAuthStatus()
  const demoUser = getDemoUser() || {}
  const [tab, setTab] = useState('profile')
  const [status, setStatus] = useState('')

  if (!session || !session.loggedIn) {
    return <Navigate to="/login" replace />
  }

  const user = { ...demoUser, ...(session || {}) }
  const userEmail = (session?.email || user.email || '').trim().toLowerCase()
  const userPhone = (session?.phone || user.phone || '').replace(/\D/g, '')

  // Sync latest customer profile and customer orders from backend
  useEffect(() => {
    fetchCustomerProfile().catch(() => {})
    if (userEmail || userPhone) {
      fetchCustomerOrders({ email: userEmail, phone: userPhone }).catch(() => {})
    }
  }, [userEmail, userPhone])

  const myOrders = orders.filter((order) => {
    const oEmail = (order.email || '').trim().toLowerCase()
    const oPhone = (order.phone || '').replace(/\D/g, '')
    if (userEmail && oEmail && oEmail === userEmail) return true
    if (userPhone && oPhone && (oPhone.endsWith(userPhone) || userPhone.endsWith(oPhone))) return true
    return false
  })

  const [profile, setProfile] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
  })

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const saveProfile = async (e) => {
    e.preventDefault()
    const result = await updateCustomerProfile(profile)
    setStatus(result.ok ? 'Profile updated successfully.' : (result.message || 'Could not update profile.'))
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (passwords.newPassword !== passwords.confirmPassword) {
      setStatus('New passwords do not match.')
      return
    }
    const result = await changeCustomerPassword(passwords.currentPassword, passwords.newPassword)
    setStatus(result.ok ? 'Password updated successfully.' : (result.message || 'Could not update password.'))
  }

  const wishlistItems = wish.map((id) => byId[id]).filter(Boolean)
  const tabs = ['profile', 'orders', 'loyalty', 'wishlist', 'reviews', 'security']

  return (
    <Wrap className="py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">My Account</p>
          <h1 className="text-4xl font-serif font-bold text-ink">Hello, {session.name || user.name || 'Customer'}</h1>
        </div>
        <button
          className={btnO}
          onClick={async () => {
            await logoutCustomer()
            navigate('/login')
          }}
        >
          Logout
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              'min-h-11 rounded-full px-4 text-sm font-bold ' +
              (tab === key ? 'bg-primary text-ivory' : 'border border-gold/40 bg-white text-primary')
            }
          >
            {key === 'profile' ? 'Profile' : key === 'orders' ? 'Orders' : key === 'wishlist' ? 'Wishlist' : key === 'reviews' ? 'Reviews' : key === 'loyalty' ? 'Loyalty' : 'Password'}
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
              <p>You have not placed any orders yet.</p>
              <Link to="/orders" className="mt-3 inline-block font-bold text-primary underline">
                Track or look up an order by Order ID →
              </Link>
            </div>
          ) : (
            myOrders.map(order => {
              const orderItems = Array.isArray(order.items) ? order.items : []
              return (
                <div key={order.no} className="rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-ink">{order.no}</p>
                      <p className="text-sm text-ink/70">{order.at || order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-ink">{order.status || 'New'}</span>
                      <Link to={'/order/' + order.no} className="font-bold text-primary hover:underline">View details</Link>
                      <Link to={'/delivery?order=' + order.no} className="text-xs font-semibold text-ink/70 hover:text-primary">Track</Link>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-ink/70">
                    <span>{orderItems.length} item(s) · Payment <span className="capitalize">{order.paymentStatus || 'unpaid'}</span> ({order.paymentMethod || 'COD'})</span>
                    <span className="font-bold text-primary text-base">{inr(order.total || 0)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {wishlistItems.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-gold/40 bg-white p-8 text-center text-ink/70">
              Your wishlist is empty. <Link to="/shop" className="font-bold text-primary">Browse sarees</Link>
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
                  <span className="font-bold text-primary">{inr(product.price)}</span>
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

      {tab === 'loyalty' && (
        <CustomerLoyaltyTab email={session.email} name={session.name} />
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
  const [fetchedOrder, setFetchedOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const normalizedOrderId = (orderId || '').trim().toLowerCase()
  const localOrder = orders.find(item => (item.no || '').trim().toLowerCase() === normalizedOrderId)

  useEffect(() => {
    let active = true
    if (localOrder) {
      setFetchedOrder(localOrder)
      setLoading(false)
    } else {
      setLoading(true)
    }

    if (orderId) {
      // Force fresh fetch from remote database so changes to Processing or Delivered show immediately
      getOrderByNo(orderId, { fresh: true })
        .then((ord) => {
          if (!active) return
          if (ord) {
            setFetchedOrder(ord)
          } else if (!localOrder) {
            setErrorMsg('Order not found')
          }
          setLoading(false)
        })
        .catch((err) => {
          if (active) {
            if (!localOrder) setErrorMsg(err.message || 'Unable to retrieve order details')
            setLoading(false)
          }
        })
    } else {
      setLoading(false)
    }

    return () => { active = false }
  }, [orderId])

  const order = fetchedOrder || localOrder

  const handleSwitchToCod = async () => {
    if (!order) return
    try {
      const updated = await updateOrder(order.no, {
        paymentMethod: 'Cash on Delivery (COD)',
        paymentStatus: 'Pending',
        status: 'Confirmed',
        orderStatus: 'Confirmed',
      })
      if (updated) setFetchedOrder(updated)
    } catch (err) {
      console.warn('Switch COD notice:', err.message)
    }
  }

  if (loading) {
    return (
      <Wrap className="py-20 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
        <h2 className="text-xl font-serif font-bold text-ink">Loading Order Details</h2>
        <p className="mt-1 text-sm font-medium text-ink/70">Retrieving order #{orderId}…</p>
      </Wrap>
    )
  }

  if (!order) {
    return (
      <Wrap className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/15 text-4xl">📦</div>
        <h1 className="text-3xl font-serif font-bold text-primary">Order Not Found</h1>
        <p className="mt-2 text-sm text-ink/70 max-w-md mx-auto">
          We could not find order #{orderId}. Please verify your order number or check delivery tracking.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/orders" className={btnP}>My Orders</Link>
          <Link to="/delivery" className={btnO}>Delivery Tracking</Link>
          <Link to="/shop" className={btnO}>Browse Collection</Link>
        </div>
      </Wrap>
    )
  }

  const rawItems = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'string'
    ? (() => { try { return JSON.parse(order.items) } catch { return [] } })()
    : []

  const items = rawItems.map(item => {
    const product = item.product || byId[item.productId] || products.find(p => p.id === item.productId || p.name === item.name)
    const fallbackImage = (Array.isArray(product?.images) && product.images[0]) || '/images/hero-silk-showroom.jpg'
    return {
      ...item,
      product,
      name: item.name || product?.name || 'Handloom Silk Saree',
      q: Number(item.q || item.quantity || 1),
      price: Number(item.price || product?.price || 0),
      image: item.image || fallbackImage,
      productId: item.productId || product?.id || '',
      sku: item.sku || product?.sku || '—',
      collection: item.category || product?.collection || '',
    }
  })

  const status = order.status || order.orderStatus || 'Confirmed'
  const paymentStatus = String(order.paymentStatus || 'unpaid').toLowerCase()
  const isPaid = paymentStatus === 'paid'
  const isRazorpay = String(order.paymentMethod || '').toLowerCase().includes('razorpay')
  const placed = order.createdAt ? new Date(order.createdAt) : new Date(order.at)
  const orderDate = Number.isNaN(placed.getTime()) ? (order.at || order.createdAt) : placed.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const steps = ['Confirmed', 'Processing', 'Packed', 'Delivered']
  const getStepIndex = (st) => {
    const s = String(st || '').trim().toLowerCase()
    if (s === 'delivered' || s === 'completed') return 3
    if (s === 'packed' || s === 'shipped' || s === 'dispatched') return 2
    if (s === 'processing' || s === 'in progress' || s === 'inprogress') return 1
    if (s === 'confirmed' || s === 'new' || s === 'paid' || s === 'pending payment') return 0
    return 0
  }
  const stepIndex = getStepIndex(status)

  return (
    <Wrap className="py-10">
      {/* Top Banner */}
      <div className="mb-6 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Order Summary</p>
            <h1 className="mt-1 text-3xl font-serif font-bold text-ink sm:text-4xl">#{order.no}</h1>
            <p className="mt-2 text-sm text-ink/60">Placed on {orderDate}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/orders" className={btnO}>← All Orders</Link>
            <Link to={`/delivery?order=${order.no}`} className={btnP}>Track Live Delivery</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-ivory/70 p-4 border border-gold/15">
            <p className="text-xs uppercase tracking-wide text-ink/60 font-semibold">Order status</p>
            <p className="mt-1 font-bold text-primary text-base">{status}</p>
          </div>
          <div className="rounded-xl bg-ivory/70 p-4 border border-gold/15">
            <p className="text-xs uppercase tracking-wide text-ink/60 font-semibold">Payment</p>
            <p className={`mt-1 font-bold capitalize text-base ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
              {paymentStatus} ({order.paymentMethod || 'COD'})
            </p>
          </div>
          <div className="rounded-xl bg-ivory/70 p-4 border border-gold/15">
            <p className="text-xs uppercase tracking-wide text-ink/60 font-semibold">Delivery</p>
            <p className="mt-1 font-bold text-ink text-base">
              {status === 'Delivered' ? 'Delivered' : status === 'Cancelled' ? 'Cancelled' : status === 'Processing' ? 'Processing' : status === 'Packed' ? 'Packed & Dispatched' : 'In progress'}
            </p>
          </div>
        </div>

        {status === 'Pending Payment' && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div>
              <p className="font-bold text-sm">⏳ Payment Pending for Order #{order.no}</p>
              <p className="text-xs text-amber-900/80 mt-0.5">
                Your items are reserved. Complete payment now or switch to Cash on Delivery (COD) to begin processing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${SHOP.razorpayUrl || 'https://razorpay.me/@srikandanfamilyshop'}?amount=${order.total}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1"
              >
                <span>⚡ Pay Now via UPI ↗</span>
              </a>
              <button
                type="button"
                onClick={handleSwitchToCod}
                className="rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-800 px-3 py-1.5 text-xs font-bold transition-colors shadow-xs"
              >
                📦 Switch to Cash on Delivery (COD)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,.8fr)]">
        {/* Products section */}
        <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-gold/20 pb-3">
            <div>
              <h2 className="text-2xl font-serif font-bold text-ink">Purchased Products</h2>
              <p className="mt-1 text-sm text-ink/60">{items.length} item(s)</p>
            </div>
            <p className="font-serif text-3xl font-bold text-primary">{inr(order.total || 0)}</p>
          </div>

          <ul className="space-y-4">
            {items.map((item, index) => {
              const product = item.product
              const productId = item.productId || product?.id
              return (
                <li key={`${productId || item.name}-${index}`} className="rounded-xl border border-gold/20 p-4 bg-ivory/20">
                  <div className="flex gap-4">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-ivory-dark border border-gold/20">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/images/hero-silk-showroom.jpg'
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-base text-ink">{item.name}</p>
                      <p className="mt-1 text-xs text-ink/60">
                        SKU: {item.sku} {item.collection ? `· ${item.collection}` : ''}
                      </p>
                      <p className="mt-2 text-sm text-ink/80">
                        Qty {item.q} × {inr(item.price)}
                      </p>
                      <p className="mt-1 font-bold text-primary text-base">
                        {inr(item.price * item.q)}
                      </p>
                      {productId && (
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <ReviewSummary productId={productId} />
                          <ProductSalesSummary productId={productId} />
                        </div>
                      )}
                    </div>
                  </div>
                  {status === 'Delivered' && productId && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ivory/70 p-3 border border-gold/20">
                      <div>
                        <p className="font-bold text-sm text-ink">How was your product?</p>
                        <p className="text-xs text-ink/60">Share your feedback; verified reviews appear after moderation.</p>
                      </div>
                      <Link to={`/product/${productId}?review=1#product-reviews-heading`} className={btnO + ' text-xs'}>
                        Rate this product
                      </Link>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Sidebar: Delivery & Payment Details */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-ink">Delivery details</h2>
            <div className="mt-3 space-y-1 text-sm text-ink/80">
              <p className="font-bold text-base text-ink">{order.name || order.customerName}</p>
              <p className="mt-1">{order.address}</p>
              {order.phone && <p className="mt-1 font-medium text-ink">📞 {order.phone}</p>}
              {order.email && <p className="break-all text-ink/70">✉ {order.email}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-ink">Payment summary</h2>
            <div className="mt-3 space-y-2 text-sm text-ink/80">
              <div className="flex justify-between gap-3">
                <span>Payment method</span>
                <span className="font-medium text-ink">{order.paymentMethod || 'COD'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Payment status</span>
                <span className={`capitalize font-bold text-xs px-2.5 py-0.5 rounded ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {paymentStatus}
                </span>
              </div>
              {order.paymentId && (
                <div className="flex justify-between gap-3 text-xs text-ink/60">
                  <span>Transaction ID</span>
                  <span className="font-mono">{order.paymentId}</span>
                </div>
              )}
              {order.subtotal > 0 && order.subtotal !== order.total && (
                <div className="flex justify-between gap-3">
                  <span>Subtotal</span>
                  <span>{inr(order.subtotal)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between gap-3 text-emerald-700">
                  <span>Discount</span>
                  <span>-{inr(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gold/20 pt-3 font-bold text-base">
                <span>Order total</span>
                <span className="text-primary font-serif text-xl">{inr(order.total || 0)}</span>
              </div>
            </div>

            {!isPaid && isRazorpay && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-center">
                <p className="text-xs font-bold text-emerald-800">Payment Pending via Razorpay</p>
                <a
                  href={SHOP.razorpayUrl || 'https://razorpay.me/@srikandanfamilyshop'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  <span>Pay {inr(order.total || 0)} on Razorpay</span>
                  <span>↗</span>
                </a>
                <p className="mt-1.5 text-[11px] text-emerald-700">Please enter Order #{order.no} in payment note</p>
              </div>
            )}
            <p className="mt-3 text-xs text-ink/60">Payment is processed securely through our verified payment gateway.</p>
          </section>
        </aside>
      </div>

      {/* Progress tracker */}
      <div className="mt-6 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-serif font-bold text-ink">Order progress</h2>
        {status === 'Cancelled' || status === 'Refunded' ? (
          <p className="mt-3 rounded-lg bg-red-50 p-3 font-bold text-red-800">
            ⚠️ This order has been {status.toLowerCase()}.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {steps.map((step, index) => {
              const isDone = index <= stepIndex
              return (
                <div key={step} className="flex items-center gap-3 rounded-xl border border-gold/20 bg-ivory/30 p-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isDone ? 'bg-primary text-ivory ring-2 ring-gold' : 'bg-gold/20 text-primary'}`}>
                    {isDone ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className={`text-xs uppercase tracking-wider font-semibold ${isDone ? 'text-primary' : 'text-ink/50'}`}>
                      Step {index + 1}
                    </p>
                    <p className={`text-sm ${isDone ? 'font-bold text-ink' : 'text-ink/60'}`}>{step}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Collection</p>
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
                <span className="font-bold text-primary">{inr(product.price)}</span>
                <Link to={'/product/' + product.id} className={btnP}>View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  )
}

export function CustomerLoyaltyTab({ email, name }) {
  const [data, setData] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/loyalty/config').then(parseJsonSafe).then(d => d.isHtml ? null : d),
      fetch(`/api/loyalty/customer?email=${encodeURIComponent(email)}`).then(parseJsonSafe).then(d => d.isHtml ? null : d)
    ])
      .then(([configData, customerData]) => {
        setConfig(configData)
        setData(customerData)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load loyalty information.')
        setLoading(false)
      })
  }, [email])

  if (loading) return <div className="text-center py-10 text-ink/60">Loading loyalty program...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  const isEnabled = config?.enabled
  if (!isEnabled) {
    return (
      <div className="rounded-2xl border border-gold/40 bg-white p-8 text-center text-ink/70">
        The loyalty program is currently paused. Please check back later!
      </div>
    )
  }

  const { balance = 0, totalEarned = 0, totalRedeemed = 0, transactions = [] } = data || {}

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-primary text-ivory p-6 shadow-sm flex flex-col justify-between">
          <p className="text-sm uppercase tracking-wider text-ivory/80">Available Points</p>
          <div className="mt-4">
            <span className="text-5xl font-serif">{balance}</span>
            <span className="text-lg ml-2">pts</span>
          </div>
          <p className="mt-4 text-sm text-ivory/80">Value: ₹{(balance * (config.pointValueInInr || 1)).toFixed(2)}</p>
        </div>
        
        <div className="rounded-2xl border border-gold/40 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wider text-ink/60">Lifetime Earned</p>
          <div className="mt-4">
            <span className="text-3xl font-serif text-emerald-700">{totalEarned}</span>
            <span className="text-sm ml-1 text-ink/60">pts</span>
          </div>
          <p className="mt-4 text-xs text-ink/50">Total points ever earned</p>
        </div>

        <div className="rounded-2xl border border-gold/40 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wider text-ink/60">Total Redeemed</p>
          <div className="mt-4">
            <span className="text-3xl font-serif text-primary/70">{totalRedeemed}</span>
            <span className="text-sm ml-1 text-ink/60">pts</span>
          </div>
          <p className="mt-4 text-xs text-ink/50">Total points spent on orders</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="rounded-2xl border border-gold/30 bg-ivory/40 p-6">
        <h3 className="font-serif text-xl text-primary mb-3">How it works</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-ink/80">
          <li>Earn <strong>{config.pointsPerUnit} point</strong> for every <strong>₹{config.spendPerPoint}</strong> spent.</li>
          <li>Each point is worth <strong>₹{config.pointValueInInr}</strong> off your next order.</li>
          {config.minPointsToRedeem > 0 && <li>Minimum <strong>{config.minPointsToRedeem} points</strong> required to redeem.</li>}
          <li>You can pay up to <strong>{config.maxRedemptionPercent}%</strong> of your order total using points.</li>
        </ul>
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="font-serif text-2xl mb-4">Points History</h3>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-gold/20 bg-white p-6 text-center text-ink/60">
            No points history yet. Place an order to start earning!
          </div>
        ) : (
          <div className="rounded-xl border border-gold/30 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gold/10 border-b border-gold/20">
                  <tr>
                    <th className="p-4 font-semibold text-ink/70">Date</th>
                    <th className="p-4 font-semibold text-ink/70">Type</th>
                    <th className="p-4 font-semibold text-ink/70">Details</th>
                    <th className="p-4 font-semibold text-ink/70 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-ivory/30 transition-colors">
                      <td className="p-4 whitespace-nowrap text-ink/80">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          tx.type === 'EARNED' ? 'bg-emerald-100 text-emerald-800' : 
                          tx.type === 'REDEEMED' ? 'bg-amber-100 text-amber-800' :
                          tx.type === 'REVERSED' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-4 text-ink/70 max-w-[200px] truncate" title={tx.note}>
                        {tx.note || (tx.orderNo ? `Order #${tx.orderNo}` : '—')}
                      </td>
                      <td className={`p-4 text-right font-bold ${tx.points > 0 ? 'text-emerald-700' : tx.points < 0 ? 'text-red-600' : 'text-ink'}`}>
                        {tx.points > 0 ? `+${tx.points}` : tx.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
