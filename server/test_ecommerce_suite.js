import assert from 'node:assert'
import { createHmac } from 'node:crypto'

const BASE = 'http://localhost:3001'

async function run() {
  console.log('--- STARTING E-COMMERCE SUITE TEST ---')

  // 1. Customer Registration
  const testEmail = `test_${Date.now()}@example.com`
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`
  const testPassword = 'Password123!'

  console.log('1. Testing Customer Registration...')
  const regRes = await fetch(`${BASE}/api/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Sundaram',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      address: '15 Gandhi Road, Kanchipuram',
      city: 'Kanchipuram',
      pincode: '631501',
    }),
  })

  const regData = await regRes.json()
  assert.strictEqual(regRes.status, 201, `Expected status 201, got ${regRes.status}`)
  assert.strictEqual(regData.ok, true)
  assert.ok(regData.token, 'Expected session token')
  assert.strictEqual(regData.user.email, testEmail)
  assert.strictEqual(regData.user.name, 'Priya Sundaram')
  console.log('✓ Customer registration passed')

  // 2. Customer Login
  console.log('2. Testing Customer Login (Email & Password)...')
  const loginRes = await fetch(`${BASE}/api/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  })
  const loginData = await loginRes.json()
  assert.strictEqual(loginRes.status, 200)
  assert.strictEqual(loginData.ok, true)
  assert.ok(loginData.token)
  const token = loginData.token
  console.log('✓ Customer login passed')

  // 3. Customer Profile
  console.log('3. Testing Authenticated Customer Profile & Update...')
  const meRes = await fetch(`${BASE}/api/customer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const meData = await meRes.json()
  assert.strictEqual(meRes.status, 200)
  assert.strictEqual(meData.user.name, 'Priya Sundaram')

  const updateRes = await fetch(`${BASE}/api/customer/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Priya S. Kandan',
      address: '25 Temple View Lane',
    }),
  })
  const updateData = await updateRes.json()
  assert.strictEqual(updateRes.status, 200)
  assert.strictEqual(updateData.user.name, 'Priya S. Kandan')
  assert.strictEqual(updateData.user.address, '25 Temple View Lane')
  console.log('✓ Customer profile read & update passed')

  // 4. Order Creation
  console.log('4. Testing Order Creation & Order Total Validation...')
  const orderNo = `KFS-TEST-${Date.now()}`
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      no: orderNo,
      customer_name: 'Priya S. Kandan',
      email: testEmail,
      phone: testPhone,
      address: '25 Temple View Lane',
      subtotal: 12500,
      total: 12500,
      paymentMethod: 'Razorpay (Cards / UPI / NetBanking)',
      paymentStatus: 'Pending',
      orderStatus: 'Pending Payment',
      items: [
        {
          productId: 'kfs-bridal-kanchipuram-pure-silk-saree',
          name: 'Bridal Kanchipuram Pure Silk Saree',
          price: 12500,
          q: 1,
        },
      ],
    }),
  })
  const orderData = await orderRes.json()
  assert.ok(orderRes.status === 200 || orderRes.status === 201, `Expected 200 or 201, got ${orderRes.status}`)
  const savedOrder = orderData.order || orderData
  assert.strictEqual(savedOrder.no, orderNo)
  assert.strictEqual(savedOrder.total, 12500)
  console.log('✓ Order creation passed')

  // 5. Razorpay Create Order
  console.log('5. Testing Razorpay Create Order...')
  const rzpRes = await fetch(`${BASE}/api/razorpay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNo: orderNo,
      amount: 12500,
      customer: {
        name: 'Priya S. Kandan',
        email: testEmail,
        phone: testPhone,
      },
    }),
  })
  const rzpData = await rzpRes.json()
  assert.strictEqual(rzpRes.status, 200)
  assert.ok(rzpData.id, 'Expected Razorpay Order ID')
  assert.strictEqual(rzpData.amount, 1250000, 'Expected amount in paise')
  console.log('✓ Razorpay create order passed (Order ID:', rzpData.id, ')')

  // 6. Razorpay Server Signature Verification
  console.log('6. Testing Razorpay Server HMAC-SHA256 Signature Verification...')
  const fakeSecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_kfs_demo_test'
  const fakePaymentId = 'pay_test_' + Date.now()
  const payload = rzpData.id + '|' + fakePaymentId
  const validSignature = createHmac('sha256', fakeSecret).update(payload).digest('hex')

  // First verify that an invalid / forged signature is strictly rejected
  const badVerifyRes = await fetch(`${BASE}/api/razorpay/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: rzpData.id,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: 'fake_tampered_signature_12345',
      order_no: orderNo,
    }),
  })
  assert.strictEqual(badVerifyRes.status, 400, 'Server must reject invalid signatures')
  console.log('✓ Invalid payment signature rejected correctly')

  const verifyRes = await fetch(`${BASE}/api/razorpay/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: rzpData.id,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
      order_no: orderNo,
    }),
  })
  const verifyData = await verifyRes.json()
  assert.strictEqual(verifyRes.status, 200)
  assert.strictEqual(verifyData.ok, true)
  assert.strictEqual(verifyData.status, 'verified')
  assert.strictEqual(verifyData.order.paymentStatus, 'Paid')
  assert.strictEqual(verifyData.order.orderStatus, 'Confirmed')
  console.log('✓ Razorpay server signature verification passed')

  // 7. Customer Orders Retrieval Isolation
  console.log('7. Testing Authenticated Customer Orders Isolation...')
  const custOrdersRes = await fetch(`${BASE}/api/customer/orders?email=${encodeURIComponent(testEmail)}`)
  const custOrdersData = await custOrdersRes.json()
  assert.strictEqual(custOrdersRes.status, 200)
  const custOrdersList = Array.isArray(custOrdersData) ? custOrdersData : (custOrdersData.orders || [])
  assert.ok(Array.isArray(custOrdersList))
  assert.strictEqual(custOrdersList.length, 1)
  assert.strictEqual(custOrdersList[0].no, orderNo)
  assert.strictEqual(custOrdersList[0].paymentStatus, 'Paid')

  // Ensure another customer cannot see this order
  const otherRes = await fetch(`${BASE}/api/customer/orders?email=stranger@example.com`)
  const otherData = await otherRes.json()
  const otherList = Array.isArray(otherData) ? otherData : (otherData.orders || [])
  assert.strictEqual(otherList.length, 0, 'Stranger should not see orders of another customer')
  console.log('✓ Customer order isolation passed')

  // 8. Verified Purchase Review Submission
  console.log('8. Testing Verified Purchase Review Submission & Duplicate Prevention...')
  const reviewRes = await fetch(`${BASE}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'kfs-bridal-kanchipuram-pure-silk-saree',
      name: 'Priya S. Kandan',
      email: testEmail,
      rating: 5,
      title: 'Exquisite bridal saree of heirloom quality',
      description: 'The zari work and silk weight are absolutely authentic. Truly proud of Kanchipuram craftsmanship.',
    }),
  })
  const reviewData = await reviewRes.json()
  assert.strictEqual(reviewRes.status, 201)
  assert.strictEqual(reviewData.verified, true, 'Review should be automatically verified since customer has Paid order for this product')
  assert.strictEqual(reviewData.status, 'approved')

  // Test duplicate review prevention
  const dupReviewRes = await fetch(`${BASE}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'kfs-bridal-kanchipuram-pure-silk-saree',
      name: 'Priya S. Kandan',
      email: testEmail,
      rating: 4,
      title: 'Second review attempt',
      description: 'Trying to post another review for the same item.',
    }),
  })
  assert.strictEqual(dupReviewRes.status, 409, 'Expected 409 Conflict for duplicate review')
  console.log('✓ Verified purchase review and duplicate prevention passed')

  // 9. Customer Reviews Endpoint
  console.log('9. Testing Customer Reviews Endpoint...')
  const custRevRes = await fetch(`${BASE}/api/customer/reviews?email=${encodeURIComponent(testEmail)}`)
  const custRevData = await custRevRes.json()
  assert.strictEqual(custRevRes.status, 200)
  assert.strictEqual(custRevData.items.length, 1)
  assert.strictEqual(custRevData.items[0].rating, 5)
  assert.strictEqual(custRevData.items[0].verified, 1)
  console.log('✓ Customer reviews retrieval passed')

  // 10. Customer Logout
  console.log('10. Testing Customer Logout & Token Invalidation...')
  const logoutRes = await fetch(`${BASE}/api/customer/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.strictEqual(logoutRes.status, 200)

  // Verify token is now rejected
  const afterLogoutRes = await fetch(`${BASE}/api/customer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.strictEqual(afterLogoutRes.status, 401, 'Token should be invalid after logout')
  console.log('✓ Customer logout and token invalidation passed')

  console.log('\n=============================================')
  console.log('🎉 ALL 10 E-COMMERCE TESTS PASSED SUCCESSFULLY!')
  console.log('=============================================\n')
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err)
  process.exit(1)
})
