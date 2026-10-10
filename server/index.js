import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerReviewRoutes } from './reviews.js'
import { registerLoyaltyRoutes } from './loyalty.js'
import { saveOrderToDatabase, getAllOrders, getOrderByNo, updateOrderInDatabase, deleteOrderFromDatabase, sendOrderConfirmationEmail } from './orders.js'
import { registerRazorpayRoutes } from './razorpay.js'
import { uploadImage, parseDataUrl, deleteImage } from './uploads.js'
import { getAllProducts, getProductById, saveProductToDatabase, deleteProductFromDatabase, resetProductsToSeed } from './products.js'
import { getAllSettings, getSetting, saveSetting, resetSettings } from './settings.js'
import { isServerSupabaseConfigured } from './supabase.js'

const root = dirname(fileURLToPath(import.meta.url))
const app = express()
const port = Number(process.env.PORT) || 3001
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_TOKEN = process.env.REVIEWS_ADMIN_TOKEN || 'asdfqwerzxcvpoiu1234567890abcdef'

app.disable('x-powered-by')
app.use(express.json({ limit: '25mb', type: 'application/json' }))

// Serve uploaded assets statically as persistent fallback
app.use('/images/uploads', express.static(resolve(root, '../public/images/uploads')))

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
  if (!user || !password || password === 'password' || password.includes('your_16_character') || !emailPattern.test(user)) return null

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
  })
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    emailConfigured: !!createTransport(),
    supabaseConfigured: isServerSupabaseConfigured,
  })
})

// Admin Authentication
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {}
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true, token: ADMIN_TOKEN })
  }
  return res.status(401).json({ error: 'Incorrect password.' })
})

// Image Upload Endpoint (JPG, JPEG, PNG, WebP up to 10MB)
app.post('/api/upload', async (req, res) => {
  try {
    const { file, filename, folder = 'general' } = req.body || {}
    if (!file) return res.status(400).json({ error: 'No image file provided.' })

    const parsed = parseDataUrl(file)
    if (parsed.error) return res.status(400).json({ error: parsed.error })

    const result = await uploadImage({
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      folder,
      originalName: filename || 'image',
    })

    if (result.error) return res.status(400).json({ error: result.error })
    return res.json(result)
  } catch (err) {
    console.error('Upload API failure:', err)
    return res.status(500).json({ error: err.message || 'Image upload failed.' })
  }
})

// Delete Image Endpoint
app.post('/api/upload/delete', async (req, res) => {
  try {
    const { url } = req.body || {}
    const result = await deleteImage(url)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// Products Catalog API (backed by SQLite & synced to Supabase)
app.get('/api/products', (_req, res) => {
  try {
    res.json(getAllProducts())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products/:id', (req, res) => {
  try {
    const product = getProductById(req.params.id)
    if (!product) return res.status(404).json({ error: 'Product not found.' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/products', (req, res) => {
  try {
    const product = saveProductToDatabase(req.body)
    res.json({ ok: true, product })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/products/:id', (req, res) => {
  try {
    const product = saveProductToDatabase({ ...req.body, id: req.params.id })
    res.json({ ok: true, product })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.delete('/api/products/:id', (req, res) => {
  try {
    deleteProductFromDatabase(req.params.id)
    res.json({ ok: true, message: 'Product deleted.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/products/reset', (_req, res) => {
  try {
    const products = resetProductsToSeed()
    res.json({ ok: true, products })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Site Settings & Background API
app.get('/api/settings', (_req, res) => {
  try {
    res.json(getAllSettings())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/settings/:key', (req, res) => {
  try {
    const value = getSetting(req.params.key)
    res.json({ key: req.params.key, value })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body || {}
    if (!key) return res.status(400).json({ error: 'Setting key is required.' })
    saveSetting(key, value)
    res.json({ ok: true, settings: getAllSettings() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/settings/reset', (_req, res) => {
  try {
    const settings = resetSettings()
    res.json({ ok: true, settings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

registerReviewRoutes(app)
registerLoyaltyRoutes(app)
registerRazorpayRoutes(app)

app.get('/api/orders', (req, res) => {
  try {
    res.json(getAllOrders())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/orders/:no', (req, res) => {
  try {
    const order = getOrderByNo(req.params.no)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body
    const order = saveOrderToDatabase(orderData)
    
    // Attempt to send email asynchronously (do not block)
    sendOrderConfirmationEmail(order).catch(console.error)

    res.json({ ok: true, order })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/orders/:no', (req, res) => {
  try {
    const order = updateOrderInDatabase(req.params.no, req.body)
    res.json({ ok: true, order })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/orders/:no', (req, res) => {
  try {
    deleteOrderFromDatabase(req.params.no)
    res.json({ ok: true, message: 'Order deleted successfully.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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
    console.warn('Demo mode: Skipping email send because GMAIL_APP_PASSWORD is not configured.')
    return res.json({ ok: true, message: 'Demo mode: Order notification email skipped.' })
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
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large. Customer photos are limited to 2 MB.' })
  }
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

setInterval(() => {}, 1000 * 60 * 60)
