import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { supabaseServer, isServerSupabaseConfigured } from './supabase.js'
import { processOrderLoyalty, reverseOrderLoyaltyPoints } from './loyalty.js'

const root = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.REVIEWS_DB_PATH || `${root}/data/reviews.sqlite`)
mkdirSync(dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)

// Initialize orders table in SQLite
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    pincode TEXT NOT NULL DEFAULT '',
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    shipping REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'COD',
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    order_status TEXT NOT NULL DEFAULT 'Confirmed',
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    email_sent INTEGER NOT NULL DEFAULT 0,
    email_error TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
`)

// Safe schema migrations for payment columns & loyalty points
try { database.exec(`ALTER TABLE orders ADD COLUMN payment_id TEXT DEFAULT ''`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT DEFAULT ''`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN points_redeemed INTEGER DEFAULT 0`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN points_discount REAL DEFAULT 0`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN points_awarded INTEGER DEFAULT 0`) } catch {}
try { database.exec(`ALTER TABLE orders ADD COLUMN points_reversed INTEGER DEFAULT 0`) } catch {}

const insertStmt = database.prepare(`
  INSERT INTO orders (
    id, no, customer_name, email, phone, address, city, pincode,
    subtotal, discount, shipping, tax, total,
    payment_method, payment_status, order_status,
    items_json, created_at, email_sent, email_error,
    payment_id, razorpay_order_id,
    points_earned, points_redeemed, points_discount,
    points_awarded, points_reversed
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?,
    ?, ?
  )
`)

const selectAllStmt = database.prepare(`
  SELECT * FROM orders ORDER BY created_at DESC
`)

const selectByNoStmt = database.prepare(`
  SELECT * FROM orders WHERE no = ? LIMIT 1
`)

const updateEmailStmt = database.prepare(`
  UPDATE orders SET email_sent = ?, email_error = ? WHERE no = ?
`)

const updateStatusStmt = database.prepare(`
  UPDATE orders SET order_status = COALESCE(?, order_status), payment_status = COALESCE(?, payment_status) WHERE no = ?
`)

const deleteStmt = database.prepare(`
  DELETE FROM orders WHERE no = ?
`)

function formatRow(row) {
  if (!row) return null
  let items = []
  try {
    items = JSON.parse(row.items_json)
  } catch {
    items = []
  }

  const fullAddress = [row.address, row.city, row.pincode].filter(Boolean).join(', ')

  return {
    id: row.id,
    no: row.no,
    name: row.customer_name,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    address: fullAddress,
    streetAddress: row.address,
    city: row.city,
    pincode: row.pincode,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    tax: Number(row.tax),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    status: row.order_status,
    paymentId: row.payment_id || '',
    razorpayOrderId: row.razorpay_order_id || '',
    pointsEarned: Number(row.points_earned) || 0,
    pointsRedeemed: Number(row.points_redeemed) || 0,
    pointsDiscount: Number(row.points_discount) || 0,
    pointsAwarded: Boolean(row.points_awarded),
    pointsReversed: Boolean(row.points_reversed),
    items,
    createdAt: row.created_at,
    at: new Date(row.created_at).toLocaleString('en-IN'),
    emailSent: Boolean(row.email_sent),
    emailError: row.email_error,
  }
}

/**
 * Saves a new validated order to the SQLite database and Supabase (if configured).
 */
export function saveOrderToDatabase(orderData) {
  const id = 'ord_' + randomUUID()
  const randomSuffix = randomBytes(2).toString('hex').toUpperCase()
  const no = 'KFS-' + Date.now().toString(36).toUpperCase() + '-' + randomSuffix
  const createdAt = new Date().toISOString()

  const subtotal = Number(orderData.subtotal ?? orderData.total)
  const discount = Number(orderData.discount ?? 0)
  const shipping = Number(orderData.shipping ?? 0)
  const tax = Number(orderData.tax ?? 0)
  const total = Number(orderData.total)

  const paymentMethod = orderData.paymentMethod || 'Cash on Delivery (COD)'
  const paymentStatus = orderData.paymentStatus || (paymentMethod.includes('COD') ? 'Pending' : 'Paid')
  const orderStatus = orderData.orderStatus || 'Confirmed'
  const itemsJson = JSON.stringify(orderData.items || [])
  const paymentId = (orderData.paymentId || '').trim()
  const razorpayOrderId = (orderData.razorpayOrderId || '').trim()

  // 1. Insert order record initially into SQLite database
  try {
    insertStmt.run(
      id,
      no,
      orderData.name.trim(),
      orderData.email.trim(),
      orderData.phone.trim(),
      orderData.address.trim(),
      (orderData.city || '').trim(),
      (orderData.pincode || '').trim(),
      subtotal,
      discount,
      shipping,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      orderStatus,
      itemsJson,
      createdAt,
      0,
      '',
      paymentId,
      razorpayOrderId,
      0, // points_earned (calculated by backend)
      0, // points_redeemed
      0, // points_discount
      0, // points_awarded (default false)
      0  // points_reversed (default false)
    )
    console.log('✅ Order record created in database:', no)
  } catch (dbErr) {
    console.error('❌ Database error:', dbErr.message)
    throw new Error('Database insertion failed: ' + dbErr.message)
  }

  // 2. Automatically Process Loyalty Points on Server
  // Rule: ₹100 purchase = 1 loyalty point (Points = Math.floor(Order Total / 100))
  // Strict backend calculation: Never trust points value from the browser!
  let pointsEarned = 0
  let pointsRedeemed = 0
  let pointsDiscount = 0
  let newLoyaltyBalance = 0

  const isEligibleForRedemption = !['cancelled', 'failed'].includes((orderStatus || '').toLowerCase())
  const isEligibleForEarning = isEligibleForRedemption && (paymentStatus.toLowerCase() === 'paid' || ['delivered', 'completed', 'paid'].includes((orderStatus || '').toLowerCase()))

  if (isEligibleForRedemption) {
    try {
      const loyaltyResult = processOrderLoyalty({
        orderNo: no,
        email: orderData.email,
        name: orderData.name,
        phone: orderData.phone,
        eligibleAmount: Math.max(0, total),
        pointsToRedeem: orderData.pointsRedeemed || 0,
        awardPoints: isEligibleForEarning,
        items: orderData.items || []
      })
      pointsEarned = loyaltyResult.pointsEarned
      pointsRedeemed = loyaltyResult.pointsRedeemed
      pointsDiscount = loyaltyResult.discountApplied
      newLoyaltyBalance = loyaltyResult.newBalance
      console.log(`✅ [Loyalty] Order ${no}: +${pointsEarned} pts awarded automatically (Balance: ${newLoyaltyBalance} pts)`)
    } catch (loyaltyErr) {
      console.warn('⚠️ Loyalty points calculation error:', loyaltyErr.message)
    }
  }

  // Also sync to Supabase if configured on server
  if (isServerSupabaseConfigured && supabaseServer) {
    supabaseServer
      .from('orders')
      .insert([
        {
          no,
          name: orderData.name.trim(),
          email: orderData.email.trim(),
          phone: orderData.phone.trim(),
          address: [orderData.address, orderData.city, orderData.pincode].filter(Boolean).join(', '),
          total,
          status: orderStatus,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          items: orderData.items,
          created_at: createdAt,
          at: new Date(createdAt).toLocaleString('en-IN'),
        },
      ])
      .then(({ error }) => {
        if (error) console.warn('[Supabase Sync Warning]:', error.message)
      })
      .catch((e) => console.warn('[Supabase Sync Exception]:', e.message))
  }

  return formatRow({
    id,
    no,
    customer_name: orderData.name.trim(),
    email: orderData.email.trim(),
    phone: orderData.phone.trim(),
    address: orderData.address.trim(),
    city: (orderData.city || '').trim(),
    pincode: (orderData.pincode || '').trim(),
    subtotal,
    discount,
    shipping,
    tax,
    total,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    order_status: orderStatus,
    payment_id: paymentId,
    razorpay_order_id: razorpayOrderId,
    points_earned: pointsEarned,
    points_redeemed: pointsRedeemed,
    points_discount: pointsDiscount,
    points_awarded: pointsEarned > 0 ? 1 : 0,
    points_reversed: 0,
    items_json: itemsJson,
    created_at: createdAt,
    email_sent: 0,
    email_error: '',
  })
}

export function getAllOrders() {
  const rows = selectAllStmt.all()
  return rows.map(formatRow)
}

export function getOrderByNo(no) {
  const row = selectByNoStmt.get(no)
  return formatRow(row)
}

export function updateOrderInDatabase(no, patch = {}) {
  const orderStatus = patch.orderStatus || patch.status || null
  const paymentStatus = patch.paymentStatus || null
  
  if (orderStatus || paymentStatus) {
    updateStatusStmt.run(orderStatus, paymentStatus, no)
  }
  
  // Handle Cancellation or Refund reversal automatically
  if (orderStatus && ['cancelled', 'refunded'].includes(orderStatus.trim().toLowerCase())) {
    try {
      reverseOrderLoyaltyPoints(no)
    } catch (err) {
      console.error(`❌ Error reversing loyalty points for order ${no}:`, err.message)
    }
  } else {
    const current = getOrderByNo(no)
    if (current && !current.pointsAwarded && (current.paymentStatus?.toLowerCase() === 'paid' || ['delivered', 'completed'].includes(current.orderStatus?.toLowerCase()))) {
      try {
        const res = processOrderLoyalty({
          orderNo: no,
          email: current.email,
          name: current.name,
          phone: current.phone,
          eligibleAmount: Math.max(0, current.total),
          awardPoints: true,
          items: current.items || []
        })
        console.log(`✅ [Loyalty] Order ${no} delivered: +${res.pointsEarned} pts awarded`)
      } catch (err) {
        console.error(`❌ Error awarding loyalty points for order ${no}:`, err.message)
      }
    }
  }

  return getOrderByNo(no)
}

export function deleteOrderFromDatabase(no) {
  try {
    deleteStmt.run(no)
    return true
  } catch (err) {
    console.error('Error deleting order from database:', err.message)
    return false
  }
}

export function markOrderAsPaid(no, { paymentId, paymentMethod = 'UPI / Online (Razorpay)' }) {
  try {
    database.prepare(`
      UPDATE orders SET payment_status = 'Paid', payment_method = ?, payment_id = ? WHERE no = ?
    `).run(paymentMethod, paymentId || '', no)

    // Automatically award loyalty points if not already awarded
    const order = getOrderByNo(no)
    if (order && !order.pointsAwarded) {
      processOrderLoyalty({
        orderNo: no,
        email: order.email,
        name: order.name,
        phone: order.phone,
        eligibleAmount: Math.max(0, order.total),
        items: order.items || [],
      })
    }
  } catch (err) {
    console.error('Error marking order as paid:', err.message)
  }
  return getOrderByNo(no)
}

export function recordEmailResult(no, sent, errorMsg = '') {
  try {
    updateEmailStmt.run(sent ? 1 : 0, errorMsg || '', no)
  } catch {}
}

/**
 * Sends order confirmation email via Nodemailer (Gmail).
 * Non-blocking: returns boolean without throwing, so order never fails if SMTP fails.
 */
export async function sendOrderConfirmationEmail(order) {
  const user = process.env.GMAIL_USER?.trim()
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')

  if (!user || !pass || pass === 'password' || pass.includes('replace-with') || pass.includes('your_16_character')) {
    console.warn('⚠️ GMAIL_APP_PASSWORD is not configured. Email confirmation skipped.')
    recordEmailResult(order.no, false, 'GMAIL_APP_PASSWORD is not configured in .env')
    return false
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const shopEmail = process.env.SHOP_EMAIL?.trim() || user
  const customerEmail = order.email?.trim()

  const itemsListText = (order.items || [])
    .map((item) => `- ${item.name} x ${item.q || item.quantity}: ₹${((item.price || 0) * (item.q || item.quantity || 1)).toLocaleString('en-IN')}`)
    .join('\n')

  const itemsListHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e9dcc0;">
          <strong>${item.name}</strong>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e9dcc0; text-align: center;">${item.q || item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9dcc0; text-align: right;">₹${Number(item.price || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9dcc0; text-align: right; font-weight: bold;">₹${((item.price || 0) * (item.q || item.quantity || 1)).toLocaleString('en-IN')}</td>
      </tr>
    `
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - Kandan Family Shop</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #faf4e8; color: #2a1a1a; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #b8964f; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="background-color: #4a0e18; color: #faf4e8; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-family: Georgia, serif; color: #b8964f;">Kandan Family Shop</h1>
          <p style="margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Order Placed Successfully</p>
        </div>

        <div style="padding: 24px;">
          <h2 style="font-size: 20px; color: #4a0e18; margin-top: 0;">Thank you, ${order.name}!</h2>
          <p style="font-size: 14px; line-height: 1.6;">Your order has been received and confirmed. Below are your order details:</p>

          <div style="background: #fdfaf4; border-left: 4px solid #b8964f; padding: 12px 16px; margin: 18px 0; font-size: 14px;">
            <strong>Order Number:</strong> <span style="font-family: monospace; font-size: 16px; color: #4a0e18;">${order.no}</span><br>
            <strong>Date:</strong> ${order.at}<br>
            <strong>Status:</strong> ${order.orderStatus || 'Confirmed'}<br>
            <strong>Payment Method:</strong> ${order.paymentMethod}<br>
            <strong>Payment Status:</strong> ${order.paymentStatus}
          </div>

          <h3 style="font-size: 16px; color: #4a0e18; border-bottom: 2px solid #b8964f; padding-bottom: 6px; margin-top: 24px;">Delivery Address</h3>
          <p style="font-size: 14px; line-height: 1.5; margin: 8px 0;">
            ${order.name}<br>
            ${order.address}<br>
            Phone: ${order.phone}
          </p>

          <h3 style="font-size: 16px; color: #4a0e18; border-bottom: 2px solid #b8964f; padding-bottom: 6px; margin-top: 24px;">Ordered Items</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px;">
            <thead>
              <tr style="background-color: #faf4e8; text-align: left;">
                <th style="padding: 8px 10px;">Item</th>
                <th style="padding: 8px 10px; text-align: center;">Qty</th>
                <th style="padding: 8px 10px; text-align: right;">Price</th>
                <th style="padding: 8px 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 12px 10px; text-align: right; font-weight: bold; border-top: 2px solid #b8964f;">Grand Total:</td>
                <td style="padding: 12px 10px; text-align: right; font-weight: bold; font-size: 16px; color: #4a0e18; border-top: 2px solid #b8964f;">₹${Number(order.total).toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 30px; padding: 16px; background-color: #faf4e8; border-radius: 6px; text-align: center; font-size: 13px;">
            <p style="margin: 0 0 6px; font-weight: bold; color: #4a0e18;">Need Assistance with Your Order?</p>
            <p style="margin: 0;">Visit us or call: 8925155521 / 8925155526 | Email: ${shopEmail}</p>
          </div>
        </div>

        <div style="background: #2a1a1a; color: #faf4e8; padding: 16px; text-align: center; font-size: 12px;">
          © ${new Date().getFullYear()} Kandan Family Shop, Kanchipuram. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `

  const text = [
    `Kandan Family Shop - Order Confirmation`,
    `=====================================`,
    `Order Number: ${order.no}`,
    `Customer: ${order.name}`,
    `Phone: ${order.phone}`,
    `Delivery Address: ${order.address}`,
    `Payment Method: ${order.paymentMethod}`,
    `Payment Status: ${order.paymentStatus}`,
    `Order Status: ${order.orderStatus}`,
    ``,
    `Items:`,
    itemsListText,
    ``,
    `Grand Total: ₹${Number(order.total).toLocaleString('en-IN')}`,
    ``,
    `Thank you for shopping with Kandan Family Shop!`,
    `Showroom: No. 1A, Thiruchakkarapuram Street, Kanchipuram - 631 501`,
  ].join('\n')

  try {
    await transporter.sendMail({
      from: `Kandan Family Shop <${user}>`,
      to: customerEmail,
      bcc: shopEmail,
      replyTo: shopEmail,
      subject: `Order Confirmation: ${order.no} - Kandan Family Shop`,
      text,
      html,
    })
    console.log('✅ Confirmation email sent to', customerEmail)
    recordEmailResult(order.no, true, '')
    return true
  } catch (err) {
    console.error('❌ Email sending failed:', err.message)
    recordEmailResult(order.no, false, err.message)
    return false
  }
}
