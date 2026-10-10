import { createHmac, randomBytes } from 'node:crypto'
import Razorpay from 'razorpay'

const keyId = process.env.RAZORPAY_KEY_ID?.trim() || ''
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || ''

export const isRazorpayConfigured = Boolean(
  keyId &&
  keySecret &&
  !keyId.includes('your-key-id') &&
  !keySecret.includes('your-key-secret')
)

let razorpayInstance = null
if (isRazorpayConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })
    console.log('💳 Razorpay Payment Gateway initialized with Key ID:', keyId.substring(0, 8) + '...')
  } catch (err) {
    console.error('❌ Failed to initialize Razorpay SDK:', err.message)
  }
} else {
  console.info('ℹ️ Razorpay keys not set in .env. Running in test/mock gateway mode.')
}

/**
 * Creates a payment order (in INR Paise).
 */
export async function createPaymentGatewayOrder({ amount, receipt, notes = {} }) {
  // Amount in INR rupees converted to paise (1 INR = 100 paise)
  const amountInPaise = Math.round(Number(amount) * 100)

  if (isRazorpayConfigured && razorpayInstance) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt.substring(0, 40),
        notes,
      })
      console.log('✅ Razorpay order created:', order.id)
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
        isMock: false,
      }
    } catch (err) {
      console.error('❌ Razorpay order creation failed:', err.message)
      throw new Error('Payment gateway order could not be created: ' + err.message)
    }
  }

  // Fallback test/mock order when credentials haven't been placed in .env yet
  const mockOrderId = 'order_mock_' + Date.now().toString(36) + '_' + randomBytes(4).toString('hex')
  console.log('🧪 Mock payment order generated (Razorpay keys not yet in .env):', mockOrderId)

  return {
    id: mockOrderId,
    amount: amountInPaise,
    currency: 'INR',
    keyId: keyId || 'rzp_test_mock_mode',
    isMock: true,
  }
}

/**
 * Verifies Razorpay payment signature (HMAC SHA-256).
 */
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!razorpayOrderId || !razorpayPaymentId) {
    return false
  }

  // Handle mock orders
  if (razorpayOrderId.startsWith('order_mock_')) {
    return true
  }

  if (!isRazorpayConfigured || !keySecret) {
    return true // Allow development flow
  }

  try {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = createHmac('sha256', keySecret).update(text).digest('hex')
    return expectedSignature === razorpaySignature
  } catch (err) {
    console.error('❌ Error validating payment signature:', err.message)
    return false
  }
}
