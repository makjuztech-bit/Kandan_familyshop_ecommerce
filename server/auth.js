import { randomBytes, randomInt, createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'

const root = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.REVIEWS_DB_PATH || `${root}/data/reviews.sqlite`)
const database = new DatabaseSync(databasePath)

// Initialize security tables
database.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otps (
    id TEXT PRIMARY KEY,
    destination TEXT NOT NULL,
    channel TEXT NOT NULL,
    hashed_otp TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    last_resend_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otps_dest ON otps(destination);

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

  CREATE TABLE IF NOT EXISTS customer_sessions (
    token TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cust_sessions ON customer_sessions(token);
`)

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const STATIC_ADMIN_TOKEN = process.env.REVIEWS_ADMIN_TOKEN || 'asdfqwerzxcvpoiu1234567890abcdef'
const SHOP_EMAIL = process.env.SHOP_EMAIL || process.env.GMAIL_USER || 'srikandanfamilyshop11726@gmail.com'
const OTP_SALT = process.env.REVIEWS_VOTE_SALT || 'kfs_otp_salt_secure_2026'
const PWD_SALT = process.env.CUSTOMER_PWD_SALT || 'kfs_customer_pwd_salt_secure_2026'

// Clean up expired tokens periodically
function cleanupExpired() {
  try {
    const now = Date.now()
    database.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(now)
    database.prepare('DELETE FROM customer_sessions WHERE expires_at < ?').run(now)
    database.prepare('DELETE FROM otps WHERE expires_at < ?').run(now - 3600000)
  } catch {}
}
setInterval(cleanupExpired, 10 * 60 * 1000)

function hashOtp(code) {
  return createHash('sha256').update(code + OTP_SALT).digest('hex')
}

function hashPassword(password) {
  return createHash('sha256').update(password + PWD_SALT).digest('hex')
}

// Helper: Gmail transporter
function createMailTransporter() {
  const user = process.env.GMAIL_USER?.trim()
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !password || password === 'password' || password.includes('your_16_character')) {
    return null
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
  })
}

// Helper: Send SMS using Fast2SMS / Twilio / MSG91
async function sendSmsNotification(phone, code) {
  const cleanPhone = phone.replace(/\D/g, '')
  const tenDigit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone

  // 1. Check Fast2SMS
  const fast2SmsKey = process.env.FAST2SMS_API_KEY?.trim()
  if (fast2SmsKey && !fast2SmsKey.includes('REPLACE')) {
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2SmsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: code,
          numbers: tenDigit,
        }),
      })
      const data = await res.json()
      if (data.return) {
        return { ok: true, provider: 'Fast2SMS' }
      }
      throw new Error(data.message || 'Fast2SMS rejected dispatch.')
    } catch (err) {
      console.error('[Fast2SMS Error]:', err.message)
      throw err
    }
  }

  // 2. Check Twilio
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN?.trim()
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim()
  if (twilioSid && twilioAuth && twilioFrom && !twilioSid.includes('REPLACE')) {
    try {
      const formattedTo = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${tenDigit}`
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`
      const params = new URLSearchParams()
      params.append('To', formattedTo)
      params.append('From', twilioFrom)
      params.append('Body', `Your Sri Kandan Family Shop verification code is: ${code}. Valid for 5 minutes.`)

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })
      const data = await res.json()
      if (data.sid) {
        return { ok: true, provider: 'Twilio' }
      }
      throw new Error(data.message || 'Twilio delivery failed.')
    } catch (err) {
      console.error('[Twilio Error]:', err.message)
      throw err
    }
  }

  // 3. No SMS provider configured
  return {
    ok: false,
    unconfigured: true,
    error: 'SMS provider is not configured on the server. Please set FAST2SMS_API_KEY or TWILIO credentials in .env, or use Email OTP verification.',
  }
}

/**
 * Server Authorization Middleware for Protected Admin Endpoints
 */
export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || ''
  const tokenHeader = req.headers['x-admin-token'] || ''
  const passwordHeader = req.headers['x-admin-password'] || ''

  let token = ''
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  } else if (tokenHeader) {
    token = tokenHeader.trim()
  }

  // Check 1: Master static admin token backup
  if (token && token === STATIC_ADMIN_TOKEN) {
    req.adminUser = { email: SHOP_EMAIL, role: 'admin' }
    return next()
  }

  // Check 2: Master password header
  if (passwordHeader && passwordHeader === ADMIN_PASSWORD) {
    req.adminUser = { email: SHOP_EMAIL, role: 'admin' }
    return next()
  }

  // Check 3: Active session in SQLite
  if (token) {
    try {
      const session = database.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token)
      if (session && session.expires_at > Date.now()) {
        req.adminUser = { email: session.user_email, role: 'admin' }
        return next()
      }
    } catch (err) {
      console.error('Session lookup error:', err)
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Administrator authentication required.',
  })
}

/**
 * Register all authentication and OTP routes
 */
export function registerAuthRoutes(app) {
  // Rate limiters
  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  })

  const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many OTP requests. Please wait a while before requesting again.' },
  })

  const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Please request a new OTP.' },
  })

  // 1. Admin Login
  app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    const { password, email } = req.body || {}

    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect administrator password.' })
    }

    // Generate secure session token with 24h expiration
    const token = randomBytes(32).toString('hex')
    const userEmail = email?.trim() || SHOP_EMAIL
    const now = Date.now()
    const expiresAt = now + 24 * 60 * 60 * 1000
    const createdAt = new Date(now).toISOString()

    try {
      database
        .prepare('INSERT INTO admin_sessions (token, user_email, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(token, userEmail, expiresAt, createdAt)
    } catch (err) {
      console.error('Failed to create admin session:', err.message)
    }

    return res.json({
      ok: true,
      token,
      expiresAt,
      user: {
        email: userEmail,
        role: 'admin',
        displayName: 'Store Administrator',
      },
    })
  })

  // 2. Admin Verify
  app.get('/api/admin/verify', (req, res) => {
    const authHeader = req.headers['authorization'] || ''
    const tokenHeader = req.headers['x-admin-token'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : tokenHeader.trim()

    if (token === STATIC_ADMIN_TOKEN) {
      return res.json({ ok: true, admin: true, email: SHOP_EMAIL })
    }

    if (token) {
      try {
        const session = database.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token)
        if (session && session.expires_at > Date.now()) {
          return res.json({ ok: true, admin: true, email: session.user_email })
        }
      } catch {}
    }

    return res.status(401).json({ ok: false, error: 'Session expired or invalid.' })
  })

  // 3. Admin Logout
  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers['authorization'] || ''
    const tokenHeader = req.headers['x-admin-token'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : tokenHeader.trim()

    if (token) {
      try {
        database.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token)
      } catch {}
    }
    return res.json({ ok: true, message: 'Logged out successfully.' })
  })

  // 4. Send OTP (Email or Phone)
  app.post('/api/auth/otp/send', otpSendLimiter, async (req, res) => {
    const { destination, channel } = req.body || {}
    if (!destination || typeof destination !== 'string') {
      return res.status(400).json({ error: 'Destination (email or phone) is required.' })
    }

    const normChannel = channel === 'email' || destination.includes('@') ? 'email' : 'phone'
    const target = destination.trim().toLowerCase()
    const now = Date.now()

    // Validation
    if (normChannel === 'email') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(target)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' })
      }
    } else {
      const digits = target.replace(/\D/g, '')
      if (digits.length < 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' })
      }
    }

    // Check resend cooldown (60 seconds)
    const existing = database
      .prepare('SELECT * FROM otps WHERE destination = ? AND verified = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1')
      .get(target, now)

    if (existing && now - existing.last_resend_at < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - existing.last_resend_at)) / 1000)
      return res.status(429).json({
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        cooldownRemaining: waitSeconds,
      })
    }

    // Generate cryptographically secure 6-digit OTP
    const code = String(randomInt(100000, 1000000))
    const hashed = hashOtp(code)
    const expiresAt = now + 5 * 60 * 1000 // 5 minutes expiry
    const id = 'otp_' + randomBytes(16).toString('hex')

    // Dispatch via channel
    if (normChannel === 'email') {
      const transporter = createMailTransporter()
      if (!transporter) {
        return res.status(503).json({
          error: 'Email service is temporarily unavailable. Gmail SMTP is not configured.',
        })
      }

      try {
        const fromEmail = process.env.GMAIL_USER?.trim()
        await transporter.sendMail({
          from: `Sri Kandan Family Shop <${fromEmail}>`,
          to: target,
          subject: `${code} is your Sri Kandan Family Shop verification code`,
          text: `Hello,\n\nYour one-time verification code is: ${code}\n\nThis code is valid for 5 minutes. Do not share this code with anyone.\n\nSri Kandan Family Shop, Kanchipuram`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5d8b8; border-radius: 16px; background-color: #fffdfa;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #064b38; margin: 0; font-size: 24px;">Sri Kandan Family Shop</h1>
                <p style="color: #b8964f; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Kanchipuram Heritage Textiles</p>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: #4a5568; font-size: 14px; margin: 0 0 16px 0;">Your one-time verification code for account login:</p>
                <div style="background-color: #064b38; color: #fbf5e6; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px; border-radius: 8px; display: inline-block; font-family: monospace;">
                  ${code}
                </div>
                <p style="color: #718096; font-size: 12px; margin: 16px 0 0 0;">Valid for <strong>5 minutes</strong>. Never share this OTP with anyone.</p>
              </div>
              <p style="color: #a0aec0; font-size: 11px; text-align: center; margin-top: 24px;">
                If you did not request this verification code, please ignore this email.
              </p>
            </div>
          `,
        })
      } catch (mailErr) {
        console.error('[OTP Email Dispatch Error]:', mailErr.message)
        return res.status(502).json({
          error: 'Could not send verification email. Please check your email address and retry.',
        })
      }
    } else {
      // Mobile SMS Channel
      try {
        const smsResult = await sendSmsNotification(target, code)
        if (!smsResult.ok) {
          return res.status(smsResult.unconfigured ? 501 : 502).json({
            error: smsResult.error,
            unconfigured: smsResult.unconfigured,
          })
        }
      } catch (smsErr) {
        return res.status(502).json({
          error: smsErr.message || 'SMS delivery failed. Please verify your mobile number or use Email OTP.',
        })
      }
    }

    // Save record to SQLite database only after successful provider dispatch
    try {
      database
        .prepare('INSERT INTO otps (id, destination, channel, hashed_otp, attempts, verified, expires_at, last_resend_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, target, normChannel, hashed, 0, 0, expiresAt, now, new Date(now).toISOString())
    } catch (dbErr) {
      console.error('[OTP Save Error]:', dbErr.message)
    }

    return res.json({
      ok: true,
      channel: normChannel,
      destination: target,
      message: `Verification code sent successfully to ${normChannel === 'email' ? target : 'your mobile number'}. Valid for 5 minutes.`,
      expiresInSeconds: 300,
    })
  })

  // 5. Verify OTP
  app.post('/api/auth/otp/verify', otpVerifyLimiter, (req, res) => {
    const { destination, code } = req.body || {}
    if (!destination || !code) {
      return res.status(400).json({ error: 'Destination and 6-digit OTP code are required.' })
    }

    const target = destination.trim().toLowerCase()
    const cleanCode = String(code).trim().replace(/\D/g, '')
    const now = Date.now()

    if (cleanCode.length !== 6) {
      return res.status(400).json({ error: 'Please enter the complete 6-digit OTP.' })
    }

    const record = database
      .prepare('SELECT * FROM otps WHERE destination = ? AND verified = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1')
      .get(target, now)

    if (!record) {
      return res.status(400).json({ error: 'The OTP has expired or is invalid. Please request a new code.' })
    }

    if (record.attempts >= 3) {
      database.prepare('DELETE FROM otps WHERE id = ?').run(record.id)
      return res.status(400).json({ error: 'Too many incorrect attempts. This OTP is locked. Please request a new code.' })
    }

    const hashedInput = hashOtp(cleanCode)
    if (hashedInput !== record.hashed_otp) {
      const nextAttempts = record.attempts + 1
      database.prepare('UPDATE otps SET attempts = ? WHERE id = ?').run(nextAttempts, record.id)
      const attemptsLeft = 3 - nextAttempts
      return res.status(400).json({
        error: `Incorrect OTP code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : 'Code locked.'}`,
      })
    }

    // OTP matched! Invalidate immediately to prevent reuse
    database.prepare('UPDATE otps SET verified = 1 WHERE id = ?').run(record.id)
    database.prepare('DELETE FROM otps WHERE id = ?').run(record.id)

    // Find or create customer
    let customer = null
    const isEmail = target.includes('@')
    const cleanDigits = target.replace(/\D/g, '')

    try {
      if (isEmail) {
        customer = database.prepare('SELECT * FROM customers WHERE email = ? LIMIT 1').get(target)
      } else if (cleanDigits) {
        customer = database.prepare('SELECT * FROM customers WHERE phone = ? OR phone LIKE ? LIMIT 1').get(cleanDigits, `%${cleanDigits.slice(-10)}`)
      }

      if (!customer) {
        const custId = 'cust_' + randomBytes(12).toString('hex')
        const custName = isEmail ? target.split('@')[0] : 'Valued Customer'
        const custEmail = isEmail ? target : `${cleanDigits || 'customer'}@mobile.kfs.local`
        const custPhone = isEmail ? '' : cleanDigits
        const isoNow = new Date(now).toISOString()

        database.prepare(`
          INSERT INTO customers (id, name, email, phone, password_hash, address, city, pincode, created_at, updated_at)
          VALUES (?, ?, ?, ?, '', '', '', '', ?, ?)
        `).run(custId, custName, custEmail, custPhone, isoNow, isoNow)

        customer = {
          id: custId,
          name: custName,
          email: custEmail,
          phone: custPhone,
          address: '',
          city: '',
          pincode: '',
        }
      }
    } catch (err) {
      console.error('[Customer OTP lookup/create error]:', err.message)
    }

    // Generate authenticated customer session (30-day expiry)
    const customerToken = randomBytes(32).toString('hex')
    const custExpiresAt = now + 30 * 24 * 60 * 60 * 1000

    if (customer?.id) {
      try {
        database.prepare(`
          INSERT INTO customer_sessions (token, customer_id, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).run(customerToken, customer.id, custExpiresAt, new Date(now).toISOString())
      } catch (sessErr) {
        console.error('[Customer Session Create Error]:', sessErr.message)
      }
    }

    return res.json({
      ok: true,
      message: 'OTP verified successfully.',
      token: customerToken,
      user: {
        id: customer?.id || 'cust_' + randomBytes(8).toString('hex'),
        name: customer?.name || (isEmail ? target.split('@')[0] : 'Valued Customer'),
        email: customer?.email || target,
        phone: customer?.phone || (isEmail ? '' : cleanDigits),
        address: customer?.address || '',
        city: customer?.city || '',
        pincode: customer?.pincode || '',
        channel: record.channel,
        verifiedAt: new Date().toISOString(),
      },
    })
  })

  // Helper middleware to authenticate customer
  function requireCustomer(req, res, next) {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (!token) {
      return res.status(401).json({ error: 'Please log in to continue.' })
    }

    try {
      const now = Date.now()
      const session = database.prepare('SELECT * FROM customer_sessions WHERE token = ? AND expires_at > ?').get(token, now)
      if (!session) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' })
      }

      const customer = database.prepare('SELECT * FROM customers WHERE id = ?').get(session.customer_id)
      if (!customer) {
        return res.status(401).json({ error: 'Customer account not found.' })
      }

      req.customer = customer
      req.customerSession = session
      return next()
    } catch (err) {
      console.error('[Customer Auth Middleware Error]:', err.message)
      return res.status(500).json({ error: 'Authentication service error.' })
    }
  }

  // 6. Customer Registration
  app.post('/api/customer/register', (req, res) => {
    const { name, email, phone, password, address, city, pincode } = req.body || {}

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (minimum 2 characters).' })
    }

    const cleanEmail = (email || '').trim().toLowerCase()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    }

    const cleanPhone = (phone || '').replace(/\D/g, '')
    const cleanAddress = (address || '').trim()
    const cleanCity = (city || '').trim()
    const cleanPincode = (pincode || '').trim()
    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    const hashedPassword = hashPassword(password)

    // Check if customer already exists
    const existing = database.prepare('SELECT * FROM customers WHERE email = ? LIMIT 1').get(cleanEmail)
    if (existing) {
      if (existing.password_hash) {
        return res.status(409).json({ error: 'An account with this email already exists. Please log in.' })
      }
      // Upgrade existing OTP-only profile with name, phone, password
      database.prepare(`
        UPDATE customers
        SET name = ?, phone = COALESCE(NULLIF(?, ''), phone), password_hash = ?, address = COALESCE(NULLIF(?, ''), address),
            city = COALESCE(NULLIF(?, ''), city), pincode = COALESCE(NULLIF(?, ''), pincode), updated_at = ?
        WHERE id = ?
      `).run(name.trim(), cleanPhone, hashedPassword, cleanAddress, cleanCity, cleanPincode, isoNow, existing.id)

      const token = randomBytes(32).toString('hex')
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000
      database.prepare('INSERT INTO customer_sessions (token, customer_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, existing.id, expiresAt, isoNow)

      return res.json({
        ok: true,
        message: 'Account registered successfully.',
        token,
        user: {
          id: existing.id,
          name: name.trim(),
          email: cleanEmail,
          phone: cleanPhone || existing.phone,
          address: cleanAddress || existing.address,
          city: cleanCity || existing.city,
          pincode: cleanPincode || existing.pincode,
        },
      })
    }

    const custId = 'cust_' + randomBytes(12).toString('hex')
    try {
      database.prepare(`
        INSERT INTO customers (id, name, email, phone, password_hash, address, city, pincode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(custId, name.trim(), cleanEmail, cleanPhone, hashedPassword, cleanAddress, cleanCity, cleanPincode, isoNow, isoNow)

      const token = randomBytes(32).toString('hex')
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000
      database.prepare('INSERT INTO customer_sessions (token, customer_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, custId, expiresAt, isoNow)

      return res.status(201).json({
        ok: true,
        message: 'Account created successfully.',
        token,
        user: {
          id: custId,
          name: name.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          address: cleanAddress,
          city: cleanCity,
          pincode: cleanPincode,
        },
      })
    } catch (err) {
      console.error('[Registration Error]:', err.message)
      return res.status(500).json({ error: 'Could not create account. Please try again.' })
    }
  })

  // 7. Customer Password Login
  app.post('/api/customer/login', (req, res) => {
    const { identifier, email, phone, password } = req.body || {}
    const rawTarget = (identifier || email || phone || '').trim()

    if (!rawTarget) {
      return res.status(400).json({ error: 'Please enter your email or mobile number.' })
    }

    if (!password) {
      return res.status(400).json({ error: 'Please enter your password.' })
    }

    const isEmail = rawTarget.includes('@')
    const cleanDigits = rawTarget.replace(/\D/g, '')

    let customer = null
    if (isEmail) {
      customer = database.prepare('SELECT * FROM customers WHERE email = ? LIMIT 1').get(rawTarget.toLowerCase())
    } else if (cleanDigits) {
      customer = database.prepare('SELECT * FROM customers WHERE phone = ? OR phone LIKE ? LIMIT 1').get(cleanDigits, `%${cleanDigits.slice(-10)}`)
    }

    if (!customer) {
      return res.status(401).json({ error: 'No account found with those credentials. Please register or sign in with OTP.' })
    }

    if (!customer.password_hash) {
      return res.status(401).json({ error: 'Your account was created via OTP. Please sign in with OTP or set a password in My Account.' })
    }

    const inputHash = hashPassword(password)
    if (inputHash !== customer.password_hash) {
      return res.status(401).json({ error: 'Incorrect password. Please try again or use OTP.' })
    }

    const token = randomBytes(32).toString('hex')
    const now = Date.now()
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000
    database.prepare('INSERT INTO customer_sessions (token, customer_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, customer.id, expiresAt, new Date(now).toISOString())

    return res.json({
      ok: true,
      token,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        pincode: customer.pincode,
      },
    })
  })

  // 8. Get Authenticated Customer Profile
  app.get('/api/customer/me', requireCustomer, (req, res) => {
    const cust = req.customer
    return res.json({
      ok: true,
      user: {
        id: cust.id,
        name: cust.name,
        email: cust.email,
        phone: cust.phone,
        address: cust.address,
        city: cust.city,
        pincode: cust.pincode,
        hasPassword: !!cust.password_hash,
      },
    })
  })

  // 9. Update Customer Profile
  app.put('/api/customer/profile', requireCustomer, (req, res) => {
    const { name, phone, address, city, pincode } = req.body || {}
    const cust = req.customer
    const updatedName = name !== undefined ? name.trim() : cust.name
    const updatedPhone = phone !== undefined ? phone.replace(/\D/g, '') : cust.phone
    const updatedAddress = address !== undefined ? address.trim() : cust.address
    const updatedCity = city !== undefined ? city.trim() : cust.city
    const updatedPincode = pincode !== undefined ? pincode.trim() : cust.pincode
    const isoNow = new Date().toISOString()

    try {
      database.prepare(`
        UPDATE customers
        SET name = ?, phone = ?, address = ?, city = ?, pincode = ?, updated_at = ?
        WHERE id = ?
      `).run(updatedName, updatedPhone, updatedAddress, updatedCity, updatedPincode, isoNow, cust.id)

      return res.json({
        ok: true,
        message: 'Profile updated successfully.',
        user: {
          id: cust.id,
          name: updatedName,
          email: cust.email,
          phone: updatedPhone,
          address: updatedAddress,
          city: updatedCity,
          pincode: updatedPincode,
        },
      })
    } catch (err) {
      console.error('[Update Profile Error]:', err.message)
      return res.status(500).json({ error: 'Failed to update profile.' })
    }
  })

  // 10. Change / Set Customer Password
  app.post('/api/customer/change-password', requireCustomer, (req, res) => {
    const { currentPassword, newPassword } = req.body || {}
    const cust = req.customer

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' })
    }

    if (cust.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please enter your current password.' })
      }
      if (hashPassword(currentPassword) !== cust.password_hash) {
        return res.status(401).json({ error: 'Current password is incorrect.' })
      }
    }

    const nextHash = hashPassword(newPassword)
    const isoNow = new Date().toISOString()
    database.prepare('UPDATE customers SET password_hash = ?, updated_at = ? WHERE id = ?').run(nextHash, isoNow, cust.id)

    return res.json({ ok: true, message: 'Password updated successfully.' })
  })

  // 11. Customer Forgot Password
  app.post('/api/customer/forgot-password', async (req, res) => {
    const { email } = req.body || {}
    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email address is required.' })
    }

    const customer = database.prepare('SELECT * FROM customers WHERE email = ? LIMIT 1').get(cleanEmail)
    // Always return safe friendly message to prevent email enumeration
    if (!customer) {
      return res.json({ ok: true, message: 'If an account exists with that email, a password reset email has been sent.' })
    }

    // Generate 6-digit reset code
    const resetCode = String(randomInt(100000, 1000000))
    const hashed = hashOtp(resetCode)
    const now = Date.now()
    const expiresAt = now + 15 * 60 * 1000 // 15 mins
    const id = 'otp_pwd_' + randomBytes(16).toString('hex')

    database.prepare('INSERT INTO otps (id, destination, channel, hashed_otp, attempts, verified, expires_at, last_resend_at, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)')
      .run(id, cleanEmail, 'email', hashed, expiresAt, now, new Date(now).toISOString())

    const transporter = createMailTransporter()
    if (transporter) {
      try {
        const fromEmail = process.env.GMAIL_USER?.trim()
        await transporter.sendMail({
          from: `Sri Kandan Family Shop <${fromEmail}>`,
          to: cleanEmail,
          subject: `${resetCode} is your Password Reset Code`,
          text: `Hello ${customer.name},\n\nYour password reset verification code is: ${resetCode}\n\nValid for 15 minutes.\n\nSri Kandan Family Shop`,
        })
      } catch (err) {
        console.error('[Forgot Password Mail Error]:', err.message)
      }
    }

    return res.json({ ok: true, message: 'If an account exists with that email, a password reset code has been sent.' })
  })

  // 12. Customer Logout
  app.post('/api/customer/logout', (req, res) => {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (token) {
      try {
        database.prepare('DELETE FROM customer_sessions WHERE token = ?').run(token)
      } catch {}
    }
    return res.json({ ok: true, message: 'Signed out successfully.' })
  })
}
