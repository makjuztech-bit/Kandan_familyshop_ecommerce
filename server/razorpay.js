import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import { markOrderAsPaid } from './orders.js'

export function registerRazorpayRoutes(app) {
  app.post('/api/razorpay/create-order', async (req, res) => {
    try {
      const { amount, receipt } = req.body
      if (!amount) return res.status(400).json({ error: 'Amount is required' })

      const key_id = process.env.RAZORPAY_KEY_ID
      const key_secret = process.env.RAZORPAY_KEY_SECRET

      if (!key_id || !key_secret) {
        return res.status(503).json({ error: 'Razorpay keys not configured' })
      }

      const instance = new Razorpay({ key_id, key_secret })

      const options = {
        amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
        currency: 'INR',
        receipt: receipt || 'receipt_' + Date.now()
      }

      const order = await instance.orders.create(options)
      res.json(order)
    } catch (err) {
      console.error('Razorpay Order Create Error:', err)
      res.status(500).json({ error: err.message || 'Failed to create Razorpay order' })
    }
  })

  app.post('/api/razorpay/verify', (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_no } = req.body
      
      const key_secret = process.env.RAZORPAY_KEY_SECRET
      if (!key_secret) return res.status(503).json({ error: 'Razorpay secret not configured' })

      const body = razorpay_order_id + '|' + razorpay_payment_id

      const expectedSignature = crypto
        .createHmac('sha256', key_secret)
        .update(body.toString())
        .digest('hex')

      if (expectedSignature === razorpay_signature) {
        // Payment is legit!
        if (order_no) {
           markOrderAsPaid(order_no, { paymentId: razorpay_payment_id, paymentMethod: 'Razorpay' })
        }
        res.json({ ok: true, status: 'verified' })
      } else {
        res.status(400).json({ ok: false, status: 'verification_failed' })
      }
    } catch (err) {
      console.error('Razorpay Verify Error:', err)
      res.status(500).json({ error: err.message })
    }
  })
}
