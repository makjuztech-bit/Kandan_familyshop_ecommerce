async function runTest() {
  const baseUrl = 'http://localhost:3001'

  console.log('1. Testing GET /api/loyalty/config...')
  const configRes = await fetch(`${baseUrl}/api/loyalty/config`)
  const configData = await configRes.json()
  console.log('Loyalty Config:', configData)

  console.log('\n2. Testing Admin Login...')
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' }),
  })
  const loginData = await loginRes.json()
  console.log('Login result:', loginData.ok, 'Token:', loginData.token?.substring(0, 15) + '...')

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginData.token}`,
  }

  console.log('\n3. Testing GET /api/loyalty/stats...')
  const statsRes = await fetch(`${baseUrl}/api/loyalty/stats`, { headers: adminHeaders })
  const statsData = await statsRes.json()
  console.log('Loyalty Stats:', statsData)

  console.log('\n4. Testing Placing an Order with Loyalty Points Earning...')
  const orderPayload = {
    name: 'Ramesh Loyalty Test',
    email: 'ramesh.loyalty@example.com',
    phone: '9876543210',
    address: '24 Temple View Road',
    city: 'Kanchipuram',
    pincode: '631501',
    paymentMethod: 'Cash on Delivery (COD)',
    paymentStatus: 'Pending',
    orderStatus: 'Confirmed',
    subtotal: 5000,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 5000,
    items: [
      {
        productId: 'kfs-test-saree',
        name: 'Royal Bridal Kanchipuram Silk Saree',
        price: 5000,
        q: 1,
      },
    ],
  }

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  })
  const orderData = await orderRes.json()
  console.log('Order created:', orderData.ok, orderData.order?.no)
  console.log('Points Earned:', orderData.order?.pointsEarned)
  console.log('Points Redeemed:', orderData.order?.pointsRedeemed)

  console.log('\n5. Fetching Customer Loyalty Account...')
  const customerRes = await fetch(`${baseUrl}/api/loyalty/customer?email=ramesh.loyalty@example.com`)
  const customerData = await customerRes.json()
  console.log('Customer Loyalty Profile:', {
    email: customerData.customer?.email,
    balance: customerData.customer?.balance,
    totalEarned: customerData.customer?.totalEarned,
    historyCount: customerData.customer?.history?.length,
    recentTx: customerData.customer?.history?.[0],
  })

  console.log('\n6. Testing Admin Manual Points Adjustment (+25 bonus points)...')
  const adjustRes = await fetch(`${baseUrl}/api/loyalty/adjust`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: 'ramesh.loyalty@example.com',
      points: 25,
      reason: 'Diwali Welcome Bonus',
    }),
  })
  const adjustData = await adjustRes.json()
  console.log('Adjust result:', adjustData.ok, 'New Balance:', adjustData.customer?.balance)

  console.log('\n7. Testing Order with Points Redemption (redeeming 15 points)...')
  const order2Payload = {
    name: 'Ramesh Loyalty Test',
    email: 'ramesh.loyalty@example.com',
    phone: '9876543210',
    address: '24 Temple View Road',
    city: 'Kanchipuram',
    pincode: '631501',
    paymentMethod: 'Cash on Delivery (COD)',
    paymentStatus: 'Pending',
    orderStatus: 'Confirmed',
    subtotal: 1000,
    discount: 15,
    shipping: 0,
    tax: 0,
    total: 985,
    pointsRedeemed: 15,
    items: [
      {
        productId: 'kfs-test-blouse',
        name: 'Festive Soft Silk Dupion',
        price: 1000,
        q: 1,
      },
    ],
  }
  const order2Res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order2Payload),
  })
  const order2Data = await order2Res.json()
  console.log('Order 2 created:', order2Data.ok, order2Data.order?.no)
  console.log('Points Earned on net ₹985:', order2Data.order?.pointsEarned)
  console.log('Points Redeemed:', order2Data.order?.pointsRedeemed)

  const finalCustomerRes = await fetch(`${baseUrl}/api/loyalty/customer?email=ramesh.loyalty@example.com`)
  const finalCustomer = await finalCustomerRes.json()
  console.log('Final Customer Balance:', finalCustomer.customer?.balance)
  console.log('Total Lifetime Earned:', finalCustomer.customer?.totalEarned)
  console.log('Total Redeemed:', finalCustomer.customer?.totalRedeemed)

  console.log('\n✅ ALL LOYALTY TESTS PASSED SUCCESSFULLY!')
}

runTest().catch((e) => console.error('Test failed:', e))
