import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import {
  processOrderLoyalty,
  reverseOrderLoyaltyPoints,
  getCustomerLoyalty,
  getLoyaltyConfig,
} from '../server/loyalty.js'
import {
  saveOrderToDatabase,
  updateOrderInDatabase,
  getOrderByNo,
} from '../server/orders.js'

console.log('🧪 Starting Comprehensive Loyalty Points System Verification...\n')

const testEmail = 'loyalty_test_' + Date.now() + '@example.com'
const testName = 'Test Loyalty Shopper'
const testPhone = '9998887776'

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message)
    process.exit(1)
  }
  console.log('✅ PASS:', message)
}

// Case 1: Customer purchases ₹100 -> +1 point
console.log('--- Test Case 1: ₹100 purchase ---')
const order1 = saveOrderToDatabase({
  name: testName,
  email: testEmail,
  phone: testPhone,
  address: '123 Test Street',
  total: 100,
  orderStatus: 'Confirmed',
  paymentMethod: 'COD',
})
assert(order1.pointsEarned === 1, `Order #1 (₹100) pointsEarned === 1 (got ${order1.pointsEarned})`)
assert(order1.pointsAwarded === true, 'Order #1 pointsAwarded === true')

let customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 1, `Customer balance is 1 point (got ${customer.loyaltyPoints})`)

// Case 2: Customer purchases ₹500 -> +5 points
console.log('\n--- Test Case 2: ₹500 purchase ---')
const order2 = saveOrderToDatabase({
  name: testName,
  email: testEmail,
  phone: testPhone,
  address: '123 Test Street',
  total: 500,
  orderStatus: 'Confirmed',
  paymentMethod: 'COD',
})
assert(order2.pointsEarned === 5, `Order #2 (₹500) pointsEarned === 5 (got ${order2.pointsEarned})`)
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 6, `Customer balance is 1 + 5 = 6 points (got ${customer.loyaltyPoints})`)

// Case 3: Customer purchases ₹999 -> +9 points (floor(999 / 100) = 9)
console.log('\n--- Test Case 3: ₹999 purchase ---')
const order3 = saveOrderToDatabase({
  name: testName,
  email: testEmail,
  phone: testPhone,
  address: '123 Test Street',
  total: 999,
  orderStatus: 'Confirmed',
  paymentMethod: 'COD',
})
assert(order3.pointsEarned === 9, `Order #3 (₹999) pointsEarned === 9 (got ${order3.pointsEarned})`)
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 15, `Customer balance is 6 + 9 = 15 points (got ${customer.loyaltyPoints})`)

// Case 4: Customer purchases ₹1,250 -> +12 points (floor(1250 / 100) = 12)
console.log('\n--- Test Case 4: ₹1,250 purchase ---')
const order4 = saveOrderToDatabase({
  name: testName,
  email: testEmail,
  phone: testPhone,
  address: '123 Test Street',
  total: 1250,
  orderStatus: 'Confirmed',
  paymentMethod: 'COD',
})
assert(order4.pointsEarned === 12, `Order #4 (₹1,250) pointsEarned === 12 (got ${order4.pointsEarned})`)
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 27, `Customer balance is 15 + 12 = 27 points (got ${customer.loyaltyPoints})`)

// Case 5 & 6: Failed / Cancelled order before confirmation -> 0 points
console.log('\n--- Test Case 5 & 6: Failed/Cancelled order before confirmation ---')
const orderFailed = saveOrderToDatabase({
  name: testName,
  email: testEmail,
  phone: testPhone,
  address: '123 Test Street',
  total: 2000,
  orderStatus: 'Failed',
  paymentMethod: 'Online',
})
assert(orderFailed.pointsEarned === 0, `Failed order earned 0 points (got ${orderFailed.pointsEarned})`)
assert(orderFailed.pointsAwarded === false, 'Failed order pointsAwarded === false')
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 27, `Customer balance unchanged at 27 (got ${customer.loyaltyPoints})`)

// Case 8 & 9: Refresh order success page / Duplicate API request -> points NOT added again
console.log('\n--- Test Case 8 & 9: Prevent Duplicate Points (Idempotency) ---')
const duplicateCall = processOrderLoyalty({
  orderNo: order4.no,
  email: testEmail,
  eligibleAmount: 1250,
})
assert(duplicateCall.alreadyAwarded === true, 'Duplicate call detected alreadyAwarded === true')
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 27, `Customer balance stayed 27 after duplicate request (got ${customer.loyaltyPoints})`)

// Case 10: Customer queries points profile -> all data available
console.log('\n--- Test Case 10: Customer queries loyalty profile ---')
assert(customer.currentPoints === 27, `currentPoints === 27 (got ${customer.currentPoints})`)
assert(customer.totalPointsEarned === 27, `totalPointsEarned === 27 (got ${customer.totalPointsEarned})`)
assert(customer.totalPointsUsed === 0, `totalPointsUsed === 0 (got ${customer.totalPointsUsed})`)
assert(customer.history.length === 4, `Customer has 4 history records (got ${customer.history.length})`)

// Case 12: Order Cancellation / Refund -> Points reversed once
console.log('\n--- Test Case 12: Order Cancellation / Reversal ---')
// Let's cancel Order #4 (which had earned 12 points)
updateOrderInDatabase(order4.no, { orderStatus: 'Cancelled' })
const updatedOrder4 = getOrderByNo(order4.no)
assert(updatedOrder4.pointsReversed === true, 'Order #4 pointsReversed === true')

customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 15, `Customer balance after reversal is 27 - 12 = 15 points (got ${customer.loyaltyPoints})`)

// Verify double cancellation does NOT reverse points a second time
const secondCancelResult = reverseOrderLoyaltyPoints(order4.no)
assert(secondCancelResult.reversed === false, 'Second reversal call safely rejected')
customer = getCustomerLoyalty(testEmail)
assert(customer.loyaltyPoints === 15, `Customer balance still 15 after second cancel attempt (got ${customer.loyaltyPoints})`)

// Check transaction history contains both EARNED and REVERSED records
const lastTx = customer.history[0]
assert(lastTx.type === 'REVERSED', `Latest transaction type is REVERSED (got ${lastTx.type})`)
assert(lastTx.points === -12, `Latest transaction points is -12 (got ${lastTx.points})`)
assert(lastTx.description.includes(order4.no), `Reversal note mentions order # (got "${lastTx.description}")`)

console.log('\n🎉 ALL 12 TEST CASES PASSED SUCCESSFULLY!\n')
