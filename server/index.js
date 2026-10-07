import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'

const app = express()
const port = Number(process.env.PORT) || 3001
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

app.disable('x-powered-by')
app.use(express.json({ limit: '24kb', type: 'application/json' }))

const orderEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many order-email requests. Please try again later.' },
})

function validateOrder(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return 'Invalid order request.'
  }

  const { no, name, email, phone, address, total, items } = order
  if (typeof no !== 'string' || !/^KFS-[A-Z0-9-]{4,40}$/.test(no)) return 'Invalid order number.'
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return 'Invalid customer name.'
  if (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email.trim())) return 'Invalid customer email.'
  if (typeof phone !== 'string' || !/^[+\d\s()-]{7,24}$/.test(phone.trim())) return 'Invalid customer phone number.'
  if (typeof address !== 'string' || address.trim().length < 10 || address.trim().length > 600) return 'Invalid delivery address.'
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0 || total > 100000000) return 'Invalid order total.'
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) return 'Invalid order items.'

  for (const item of items) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 160) return 'Invalid order item.'
    if (!Number.isInteger(item.q) || item.q < 1 || item.q > 10) return 'Invalid item quantity.'
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) return 'Invalid item price.'
  }
  return null
}

function createTransport() {
  const user = process.env.GMAIL_USER?.trim()
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !password || !emailPattern.test(user)) return null

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
  })
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, emailConfigured: !!createTransport() })
})

app.post('/api/order-email', orderEmailLimiter, async (req, res) => {
  const validationError = validateOrder(req.body)
  if (validationError) return res.status(400).json({ error: validationError })

  const from = process.env.GMAIL_USER?.trim()
  const to = process.env.SHOP_EMAIL?.trim() || from
  if (!from || !emailPattern.test(from)) {
    return res.status(503).json({ error: 'Set a valid GMAIL_USER in the server .env file.' })
  }
  if (!to || !emailPattern.test(to)) {
    return res.status(503).json({ error: 'Set a valid SHOP_EMAIL in the server .env file.' })
  }

  const transporter = createTransport()
  if (!transporter) {
    return res.status(503).json({ error: 'Set GMAIL_APP_PASSWORD in the server .env file, then restart the server.' })
  }

  const { no, name, email, phone, address, total, items } = req.body
  const body = [
    `Order: ${no}`,
    `Customer: ${name.trim()}`,
    `Customer email: ${email.trim()}`,
    `Phone: ${phone.trim()}`,
    `Delivery address: ${address.trim()}`,
    '',
    'Items:',
    ...items.map(item => `- ${item.name.trim()} x ${item.q}: INR ${(item.price * item.q).toFixed(2)}`),
    '',
    `Order total: INR ${total.toFixed(2)}`,
  ].join('\n')

  try {
    await transporter.sendMail({
      from: `Kandan Family Shop <${from}>`,
      to,
      replyTo: email.trim(),
      subject: `New order ${no}`,
      text: body,
    })
    return res.json({ ok: true, message: 'Order notification email sent.' })
  } catch (error) {
    console.error('Order email delivery failed:', error instanceof Error ? error.message : 'Unknown SMTP error')
    return res.status(502).json({ error: 'Gmail could not send the order email. Check the server SMTP setup and retry.' })
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  console.error('API request failed:', error instanceof Error ? error.message : 'Unknown server error')
  return res.status(500).json({ error: 'The email service encountered an unexpected error.' })
})

app.listen(port, () => {
  console.log(`Order email API listening on port ${port}`)
  if (!createTransport()) console.warn('Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.')
})
