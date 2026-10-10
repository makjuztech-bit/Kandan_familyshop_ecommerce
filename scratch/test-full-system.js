import 'dotenv/config'
import express from 'express'
import http from 'node:http'

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE SYSTEM TESTS ---')

  // We will start the server on a temporary port or test port, e.g. 3099
  process.env.PORT = '3099'
  const serverModule = await import('../server/index.js')
  
  // Wait 1 second for server to bind
  await new Promise(r => setTimeout(r, 1200))
  const BASE = 'http://localhost:3099'

  // Test 1: Health check
  console.log('\n[TEST 1] Health Check...')
  const hRes = await fetch(`${BASE}/api/health`)
  const hData = await hRes.json()
  console.log('Health:', hData)
  if (!hData.ok) throw new Error('Health check failed')

  // Test 2: Admin Login
  console.log('\n[TEST 2] Admin Login...')
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  })
  const loginData = await loginRes.json()
  console.log('Admin login status:', loginRes.status, loginData)
  if (!loginData.ok || !loginData.token) throw new Error('Admin login failed')
  const adminToken = loginData.token

  // Test 2b: Admin Login failure
  const badLoginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrongpassword' })
  })
  console.log('Admin bad login status (expected 401):', badLoginRes.status)
  if (badLoginRes.status !== 401) throw new Error('Expected 401 for bad password')

  // Test 3: Products Catalog
  console.log('\n[TEST 3] Get Products Catalog...')
  const prodRes = await fetch(`${BASE}/api/products`)
  const prods = await prodRes.json()
  console.log('Total products loaded:', prods.length)
  if (!Array.isArray(prods) || prods.length < 50) throw new Error('Products catalog incomplete')
  console.log('Sample product images:', prods[0].id, prods[0].images)
  if (!prods[0].images || prods[0].images.length === 0) throw new Error('Product images array is empty')

  // Test 4: Image Upload - Valid 1x1 PNG
  console.log('\n[TEST 4] Upload Valid Image to Storage...')
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const upRes = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      file: validPng,
      filename: 'sample-upload.png',
      folder: 'products'
    })
  })
  const upData = await upRes.json()
  console.log('Upload result:', upData)
  if (!upData.ok || !upData.url) throw new Error('Image upload failed')
  const uploadedImageUrl = upData.url

  // Test 4b: Verify uploaded image is accessible via HTTP
  console.log('\n[TEST 4b] Verify uploaded image URL accessibility...')
  const imgFetchRes = await fetch(uploadedImageUrl)
  console.log('Uploaded image HTTP status:', imgFetchRes.status, imgFetchRes.headers.get('content-type'))
  if (imgFetchRes.status !== 200) throw new Error('Uploaded image could not be fetched: ' + uploadedImageUrl)

  // Test 5: Image Upload - Invalid Type rejection
  console.log('\n[TEST 5] Reject Invalid Image Format...')
  const invalidFile = 'data:text/plain;base64,aGVsbG8gd29ybGQ='
  const invRes = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: invalidFile,
      filename: 'test.txt',
      folder: 'products'
    })
  })
  const invData = await invRes.json()
  console.log('Invalid upload status (expected 400):', invRes.status, invData)
  if (invRes.status !== 400) throw new Error('Expected 400 for invalid file type')

  // Test 6: Image Upload - Fake signature rejection
  console.log('\n[TEST 6] Reject Spoofed Image Signature...')
  const fakeJpg = 'data:image/jpeg;base64,bm90IGEgcmVhbCBqcGVn'
  const fakeRes = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: fakeJpg,
      filename: 'fake.jpg',
      folder: 'products'
    })
  })
  console.log('Fake signature status (expected 400):', fakeRes.status)
  if (fakeRes.status !== 400) throw new Error('Expected 400 for spoofed signature')

  // Test 7: Update Product with new uploaded image
  console.log('\n[TEST 7] Save Product with Uploaded Image...')
  const targetProd = prods[0]
  const updatedImages = [uploadedImageUrl, ...targetProd.images.slice(1)]
  const saveProdRes = await fetch(`${BASE}/api/products/${targetProd.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...targetProd,
      images: updatedImages
    })
  })
  const saveProdData = await saveProdRes.json()
  console.log('Product save result:', saveProdData.ok, saveProdData.product?.images?.[0])
  if (saveProdData.product?.images?.[0] !== uploadedImageUrl) throw new Error('Product image was not updated')

  // Test 7b: Re-fetch product to verify persistence in database
  const verifyProdRes = await fetch(`${BASE}/api/products/${targetProd.id}`)
  const verifiedProd = await verifyProdRes.json()
  console.log('Verified product image from database:', verifiedProd.images[0])
  if (verifiedProd.images[0] !== uploadedImageUrl) throw new Error('Product image did not persist in database')

  // Test 8: Site Settings & Background Persistence
  console.log('\n[TEST 8] Site Settings & Background Persistence...')
  const initialSettingsRes = await fetch(`${BASE}/api/settings`)
  const initialSettings = await initialSettingsRes.json()
  console.log('Initial settings:', initialSettings)

  const newBgUrl = uploadedImageUrl
  const saveSettingRes = await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'background', value: newBgUrl })
  })
  const savedSettingsData = await saveSettingRes.json()
  console.log('Updated settings result:', savedSettingsData.ok, savedSettingsData.settings?.background)
  if (savedSettingsData.settings?.background !== newBgUrl) throw new Error('Site background setting was not saved')

  // Test 8b: Fetch individual setting
  const getBgRes = await fetch(`${BASE}/api/settings/background`)
  const bgData = await getBgRes.json()
  console.log('Fetched background setting:', bgData)
  if (bgData.value !== newBgUrl) throw new Error('Background setting did not match')

  // Test 9: Orders and Loyalty
  console.log('\n[TEST 9] Orders System...')
  const ordersRes = await fetch(`${BASE}/api/orders`)
  const orders = await ordersRes.json()
  console.log('Existing orders count:', orders.length)

  console.log('\n========================================')
  console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY!')
  console.log('========================================')
  process.exit(0)
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
