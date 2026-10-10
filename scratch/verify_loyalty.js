import { saveOrderToDatabase, getOrderByNo } from './server/orders.js'
import { getCustomerLoyalty } from './server/loyalty.js'

function testOrder(amount, expectedPoints, paymentMethod = 'Online', paymentStatus = 'Paid') {
  const email = 'test_user_' + Date.now() + '@example.com'
  console.log(`\nTesting ₹${amount} with ${paymentStatus} payment...`)
  
  const order = saveOrderToDatabase({
    name: 'Test User',
    email,
    phone: '9999999999',
    address: '123 Main St',
    total: amount,
    subtotal: amount,
    paymentMethod,
    paymentStatus,
    orderStatus: 'Confirmed',
    items: [{ name: 'Test Saree', price: amount, q: 1 }]
  })
  
  const orderCheck = getOrderByNo(order.no)
  const cust = getCustomerLoyalty(email)
  
  const passed = orderCheck.pointsEarned === expectedPoints && cust.loyaltyPoints === expectedPoints
  
  if (passed) {
    console.log(`✅ Passed: Earned ${orderCheck.pointsEarned} points. Customer balance is ${cust.loyaltyPoints}.`)
  } else {
    console.log(`❌ Failed: Expected ${expectedPoints}, got Order Points = ${orderCheck.pointsEarned}, Customer Balance = ${cust.loyaltyPoints}`)
  }
}

testOrder(999, 0)
testOrder(1000, 1)
testOrder(1500, 1)
testOrder(2000, 2)
testOrder(3000, 3)

// Test COD (Pending payment)
testOrder(1000, 0, 'COD', 'Pending')
