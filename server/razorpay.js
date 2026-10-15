import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import { getOrderByNo, getOrderByRazorpayOrderId, markOrderAsPaid, markOrderPaymentFailed, updateOrderInDatabase } from './orders.js'

export function registerRazorpayRoutes(app) {
  // Public config endpoint: safely exposes only public key_id and payment configs to frontend
  app.get('/api/razorpay/config', (_req, res) => {
    const key_id = process.env.RAZORPAY_KEY_ID?.trim() || ''
    const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim() || ''
    const razorpayMeUrl = process.env.RAZORPAY_ME_URL?.trim() || 'https://razorpay.me/@srikandanfamilyshop'
    res.json({
      configured: Boolean(key_id && key_secret),
      keyId: key_id,
      currency: 'INR',
      razorpayMeUrl,
    })
  })

  // 1. Create Razorpay Order
  // Validates order amount server-side and associates it with the database order
  app.post('/api/razorpay/create-order', async (req, res) => {
    try {
      const { orderNo, amount, customer } = req.body || {}
      const key_id = process.env.RAZORPAY_KEY_ID?.trim()
      const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim()

      if (!key_id || !key_secret) {
        return res.status(503).json({
          configured: false,
          error: 'Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured on server.',
        })
      }

      // Calculate and validate order total on backend - do not trust arbitrary client amount if order exists!
      let orderTotal = 0
      let dbOrder = null
      if (orderNo) {
        dbOrder = getOrderByNo(orderNo)
        if (dbOrder) {
          orderTotal = Number(dbOrder.total)
        }
      }

      if (!orderTotal) {
        orderTotal = Number(amount || 0)
      }

      if (!orderTotal || orderTotal <= 0) {
        return res.status(400).json({ error: 'Valid order amount is required' })
      }

      const amountInPaise = Math.round(orderTotal * 100)
      const instance = new Razorpay({ key_id, key_secret })

      // Razorpay receipt length limit is 40 characters
      const receipt = (orderNo || ('rcpt_' + Date.now())).substring(0, 40)
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          orderNo: orderNo || '',
          customerName: customer?.name || dbOrder?.customerName || '',
          customerEmail: customer?.email || dbOrder?.email || '',
          customerPhone: customer?.phone || dbOrder?.phone || '',
        },
      }

      const rzpOrder = await instance.orders.create(options)

      // Associate razorpay_order_id with the database order
      if (orderNo && dbOrder) {
        updateOrderInDatabase(orderNo, {
          razorpayOrderId: rzpOrder.id,
          orderStatus: 'Pending Payment',
          paymentStatus: 'Pending',
        })
      }

      res.json({
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: key_id,
        orderNo: orderNo || '',
      })
    } catch (err) {
      console.error('❌ Razorpay Order Create Error:', err)
      res.status(500).json({ error: err.message || 'Failed to create Razorpay order' })
    }
  })

  // 2. Verify Razorpay Payment Signature
  // Strictly verifies HMAC-SHA256 signature using RAZORPAY_KEY_SECRET and validates payment status with Razorpay API
  app.post('/api/razorpay/verify', async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_no } = req.body || {}

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          ok: false,
          status: 'invalid_request',
          error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required for verification.',
        })
      }

      const key_id = process.env.RAZORPAY_KEY_ID?.trim()
      const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim()
      if (!key_secret) {
        return res.status(503).json({ ok: false, error: 'Razorpay secret key is not configured on the server.' })
      }

      // Step 1: Verify HMAC SHA-256 signature
      const expectedPayload = razorpay_order_id + '|' + razorpay_payment_id
      const expectedSignature = crypto
        .createHmac('sha256', key_secret)
        .update(expectedPayload)
        .digest('hex')

      if (expectedSignature !== razorpay_signature) {
        console.warn(`❌ [Razorpay Security] Signature mismatch for order ${order_no || razorpay_order_id}`)
        return res.status(400).json({
          ok: false,
          status: 'verification_failed',
          error: 'Payment verification failed: Digital signature does not match.',
        })
      }

      // Step 2: Fetch payment details directly from Razorpay API to verify status
      let paymentDetails = null
      if (key_id) {
        try {
          const instance = new Razorpay({ key_id, key_secret })
          paymentDetails = await instance.payments.fetch(razorpay_payment_id)
        } catch (fetchErr) {
          console.warn('[Razorpay Fetch Notice]:', fetchErr.message)
        }
      }

      if (paymentDetails && !['captured', 'authorized'].includes(paymentDetails.status)) {
        return res.status(400).json({
          ok: false,
          status: 'payment_not_captured',
          error: `Payment status is ${paymentDetails.status}. Payment has not been captured.`,
        })
      }

      // Step 3: Locate the order in our database
      let order = order_no ? getOrderByNo(order_no) : getOrderByRazorpayOrderId(razorpay_order_id)
      if (!order) {
        return res.status(404).json({ ok: false, error: 'Order not found for verification.' })
      }

      // Step 4: Validate payment amount against order total
      if (paymentDetails?.amount) {
        const expectedPaise = Math.round(order.total * 100)
        if (Math.abs(paymentDetails.amount - expectedPaise) > 100) {
          console.error(`❌ [Razorpay Fraud Check] Amount mismatch: Order ${order.no} total ₹${order.total}, but payment was ${paymentDetails.amount} paise`)
          return res.status(400).json({ ok: false, error: 'Paid amount does not match order total.' })
        }
      }

      // Step 5: Idempotency check - if already confirmed, do not double-process
      if (order.paymentStatus?.toLowerCase() === 'paid' && order.orderStatus?.toLowerCase() === 'confirmed') {
        return res.json({ ok: true, status: 'already_verified', order })
      }

      // Step 6: Update order to Paid and Confirmed
      const paymentMethodStr = 'Razorpay (' + (paymentDetails?.method ? paymentDetails.method.toUpperCase() : 'Online') + ')'
      const updatedOrder = markOrderAsPaid(order.no, {
        paymentId: razorpay_payment_id,
        paymentMethod: paymentMethodStr,
        razorpayOrderId: razorpay_order_id,
      })

      console.log(`✅ [Razorpay Success] Order ${order.no} successfully verified, paid and confirmed!`)
      res.json({ ok: true, status: 'verified', order: updatedOrder })
    } catch (err) {
      console.error('❌ Razorpay Verify Exception:', err)
      res.status(500).json({ ok: false, error: err.message || 'Payment verification error' })
    }
  })

  // 3. Payment Failed / Cancelled Endpoint
  // Records payment failure while preserving order in 'Pending Payment' status so customer can retry
  app.post('/api/razorpay/payment-failed', (req, res) => {
    try {
      const { order_no, error_code, error_description, payment_id, razorpay_order_id } = req.body || {}
      if (order_no) {
        const updated = markOrderPaymentFailed(order_no, {
          error_code,
          error_description,
          payment_id,
          razorpay_order_id,
        })
        return res.json({ ok: true, order: updated })
      }
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 4. Official Razorpay Webhooks Endpoint
  // Validates webhook signature using raw request body and processes payment.captured, order.paid, payment.failed
  app.post('/api/razorpay/webhook', (req, res) => {
    try {
      const webhookSignature = req.headers['x-razorpay-signature']
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || process.env.RAZORPAY_KEY_SECRET?.trim()

      if (!webhookSecret) {
        console.warn('⚠️ [Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET is not configured on server.')
        return res.status(503).json({ error: 'Webhook secret not configured on server' })
      }

      if (!webhookSignature) {
        return res.status(400).json({ error: 'Missing x-razorpay-signature header' })
      }

      // Official signature verification using raw request body
      const rawBody = req.rawBody ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody) : JSON.stringify(req.body)
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')

      if (webhookSignature !== expectedSignature) {
        console.warn('❌ [Razorpay Webhook] Invalid webhook signature!')
        return res.status(400).json({ error: 'Invalid webhook signature' })
      }

      const event = req.body?.event
      console.log(`🔔 [Razorpay Webhook] Verified event: ${event}`)

      if (event === 'payment.captured' || event === 'order.paid') {
        const payment = req.body?.payload?.payment?.entity
        const rzpOrderId = payment?.order_id || req.body?.payload?.order?.entity?.id
        const paymentId = payment?.id
        const orderNo = payment?.notes?.orderNo || req.body?.payload?.order?.entity?.notes?.orderNo

        let order = orderNo ? getOrderByNo(orderNo) : (rzpOrderId ? getOrderByRazorpayOrderId(rzpOrderId) : null)
        if (order) {
          if (order.paymentStatus?.toLowerCase() === 'paid' && order.orderStatus?.toLowerCase() === 'confirmed') {
            console.log(`ℹ️ [Razorpay Webhook] Order ${order.no} is already confirmed (idempotent).`)
            return res.json({ status: 'ok', already_processed: true })
          }

          markOrderAsPaid(order.no, {
            paymentId: paymentId || '',
            paymentMethod: 'Razorpay (' + (payment?.method ? payment.method.toUpperCase() : 'Online') + ')',
            razorpayOrderId: rzpOrderId || '',
          })
          console.log(`✅ [Razorpay Webhook] Order ${order.no} confirmed via ${event}`)
        }
      } else if (event === 'payment.failed') {
        const payment = req.body?.payload?.payment?.entity
        const rzpOrderId = payment?.order_id
        const orderNo = payment?.notes?.orderNo
        let order = orderNo ? getOrderByNo(orderNo) : (rzpOrderId ? getOrderByRazorpayOrderId(rzpOrderId) : null)
        if (order && order.paymentStatus?.toLowerCase() !== 'paid') {
          markOrderPaymentFailed(order.no, {
            error_code: payment?.error_code,
            error_description: payment?.error_description,
            payment_id: payment?.id,
            razorpay_order_id: rzpOrderId,
          })
          console.log(`⚠️ [Razorpay Webhook] Order ${order.no} payment failed via webhook: ${payment?.error_description}`)
        }
      }

      res.json({ status: 'ok' })
    } catch (err) {
      console.error('❌ Razorpay Webhook Error:', err)
      res.status(500).json({ error: err.message })
    }
  })
}
