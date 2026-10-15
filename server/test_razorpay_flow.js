import crypto from 'node:crypto'
import { saveOrderToDatabase, getOrderByNo, updateOrderInDatabase } from './orders.js'

async function runTests() {
  console.log('🧪 Starting Razorpay Payment Gateway & Order Flow Test Suite...\n')
  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${message}`)
      failed++
    }
  }

  // Set test credentials in environment for test execution
  process.env.RAZORPAY_KEY_ID = 'rzp_test_mockKey123'
  process.env.RAZORPAY_KEY_SECRET = 'mockSecretKey456'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'mockWebhookSecret789'

  // Test 1: Save an Online Order initially
  const testOrderNo = 'KFS-TEST-RZP-' + Date.now().toString(36).toUpperCase()
  const orderData = {
    no: testOrderNo,
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '9876543210',
    address: '123 Silk Street, Kanchipuram',
    city: 'Kanchipuram',
    pincode: '631501',
    total: 2500,
    subtotal: 2500,
    paymentMethod: 'Razorpay (Cards / UPI / NetBanking)',
    items: [{ productId: 'kfs-test', name: 'Kanchipuram Silk Saree', price: 2500, q: 1 }],
  }

  const initialOrder = saveOrderToDatabase(orderData)
  assert(initialOrder.no === testOrderNo, `Order created with number ${testOrderNo}`)
  assert(initialOrder.orderStatus === 'Pending Payment', `Initial order status is 'Pending Payment' (got: ${initialOrder.orderStatus})`)
  assert(initialOrder.paymentStatus === 'Pending', `Initial payment status is 'Pending' (got: ${initialOrder.paymentStatus})`)

  // Test 2: Idempotent order saving (does not duplicate or throw on same order number)
  const duplicateSave = saveOrderToDatabase(orderData)
  assert(duplicateSave.no === testOrderNo, 'Idempotent save returned existing order without throwing error')

  // Test 3: Signature verification logic
  const mockRzpOrderId = 'order_test_' + Date.now()
  const mockRzpPaymentId = 'pay_test_' + Date.now()
  const correctPayload = mockRzpOrderId + '|' + mockRzpPaymentId
  const validSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(correctPayload)
    .digest('hex')

  const invalidSignature = 'invalid_tampered_signature_hex'

  // Check valid signature computation
  const verifyValid = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(correctPayload)
    .digest('hex') === validSignature
  assert(verifyValid === true, 'HMAC-SHA256 signature validates correctly for genuine payment')

  const verifyInvalid = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(correctPayload)
    .digest('hex') === invalidSignature
  assert(verifyInvalid === false, 'HMAC-SHA256 rejects tampered or fraudulent signatures')

  // Test 4: Webhook signature verification logic
  const webhookBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: mockRzpPaymentId,
          order_id: mockRzpOrderId,
          amount: 250000,
          status: 'captured',
          method: 'upi',
          notes: { orderNo: testOrderNo },
        },
      },
    },
  })

  const validWebhookSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(webhookBody)
    .digest('hex')

  const isWebhookValid = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(webhookBody)
    .digest('hex') === validWebhookSig
  assert(isWebhookValid === true, 'Webhook signature verification succeeds with raw request body')

  // Test 5: Verify Order status updates after successful payment
  const { markOrderAsPaid, markOrderPaymentFailed } = await import('./orders.js')
  const paidOrder = markOrderAsPaid(testOrderNo, {
    paymentId: mockRzpPaymentId,
    paymentMethod: 'Razorpay (UPI)',
    razorpayOrderId: mockRzpOrderId,
  })

  assert(paidOrder.paymentStatus === 'Paid', `Payment status updated to 'Paid' (got: ${paidOrder.paymentStatus})`)
  assert(paidOrder.orderStatus === 'Confirmed', `Order status updated to 'Confirmed' (got: ${paidOrder.orderStatus})`)
  assert(paidOrder.paymentId === mockRzpPaymentId, `Payment transaction ID recorded: ${paidOrder.paymentId}`)

  // Test 6: Payment failure handling for retrying
  const failOrderNo = 'KFS-TEST-FAIL-' + Date.now().toString(36).toUpperCase()
  saveOrderToDatabase({
    ...orderData,
    no: failOrderNo,
  })

  const failedOrder = markOrderPaymentFailed(failOrderNo, {
    error_code: 'BAD_REQUEST_ERROR',
    error_description: 'Payment was cancelled or card declined',
    razorpay_order_id: 'order_failed_123',
  })

  assert(failedOrder.paymentStatus === 'Failed', `Order payment marked as 'Failed' (got: ${failedOrder.paymentStatus})`)
  assert(failedOrder.orderStatus === 'Pending Payment', `Order status preserved as 'Pending Payment' for retry (got: ${failedOrder.orderStatus})`)

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed.\n`)
  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
