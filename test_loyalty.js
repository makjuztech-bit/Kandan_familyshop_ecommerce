import { saveOrderToDatabase, getOrderByNo, updateOrderInDatabase } from './server/orders.js'
import { getCustomerLoyalty, processOrderLoyalty } from './server/loyalty.js'

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

console.log("\nTesting COD update to Delivered...")
const email = 'cod_test@example.com'
const order = saveOrderToDatabase({
  name: 'COD Test',
  email,
  phone: '9999999999',
  address: '123 Main St',
  total: 1000,
  subtotal: 1000,
  paymentMethod: 'COD',
  paymentStatus: 'Pending',
  orderStatus: 'Confirmed',
  items: [{ name: 'Test Saree', price: 1000, q: 1 }]
})
console.log("Initial state:", getOrderByNo(order.no).pointsEarned)
updateOrderInDatabase(order.no, { orderStatus: 'Delivered', paymentStatus: 'Pending' })
console.log("After delivery:", getOrderByNo(order.no).pointsEarned, "| Customer balance:", getCustomerLoyalty(email).loyaltyPoints)
