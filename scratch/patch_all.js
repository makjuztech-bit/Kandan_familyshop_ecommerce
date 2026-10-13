const fs = require('fs');
const path = require('path');

const repoDir = 'c:\\Users\\sabar\\Downloads\\Durgas_website_-main\\Durgas_website_-main';

function updateFile(relPath, updater) {
  const fullPath = path.join(repoDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath);
    return false;
  }
  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = updater(original);
  if (original === updated) {
    console.log(`[No Change] ${relPath}`);
  } else {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log(`[Updated] ${relPath}`);
  }
  return true;
}

console.log('--- Starting Durgas Website Bug Fixes and Theme Upgrades ---');

// ========================================================
// 1. BACKEND: productController.js (Fix image path resolution)
// ========================================================
updateFile('backend/controllers/productController.js', (content) => {
  // Replace file.path in addProduct
  let res = content.replace(
    /const imageValues = files\.map\(\(file, i\) => \[\s*productId,\s*file\.path \|\| \('\/uploads\/' \+ file\.filename\),\s*i === 0,\s*\]\);/g,
    `const imageValues = files.map((file, i) => {
        const webPath = (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://')))
          ? file.path
          : ('/uploads/' + file.filename);
        return [productId, webPath, i === 0];
      });`
  );

  // Replace file.path in updateProduct
  res = res.replace(
    /const imageValues = files\.map\(\(file, i\) => \[\s*productId,\s*file\.path \|\| \('\/uploads\/' \+ file\.filename\),\s*i === 0,\s*\]\);/g,
    `const imageValues = files.map((file, i) => {
        const webPath = (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://')))
          ? file.path
          : ('/uploads/' + file.filename);
        return [productId, webPath, i === 0];
      });`
  );

  return res;
});

// ========================================================
// 2. BACKEND: middleware/auth.js (Add optionalAuth)
// ========================================================
updateFile('backend/middleware/auth.js', (content) => {
  if (content.includes('optionalAuth')) return content;
  
  const toAdd = `
// Optional auth helper: attaches user if token/cookie valid, otherwise passes through as guest
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token || req.cookies?.['sb-access-token'];
  if (!token) return next();
  return verifyToken(req, res, (err) => {
    // If token error, continue gracefully as guest
    next();
  });
}

module.exports = { verifyToken, requireAdmin, auth: verifyToken, adminOnly: requireAdmin, optionalAuth };
`;
  return content.replace(/module\.exports\s*=\s*\{\s*verifyToken,\s*requireAdmin,\s*auth:\s*verifyToken,\s*adminOnly:\s*requireAdmin\s*\};/, toAdd.trim());
});

// ========================================================
// 3. BACKEND: routes/orderRoutes.js (Use optionalAuth on POST /)
// ========================================================
updateFile('backend/routes/orderRoutes.js', (content) => {
  let res = content.replace(
    /const\s*\{\s*auth,\s*adminOnly\s*\}\s*=\s*require\('\.\.\/middleware\/auth'\);/,
    `const { auth, adminOnly, optionalAuth } = require('../middleware/auth');`
  );
  res = res.replace(
    /router\.post\('\/',\s*auth,\s*orderController\.createOrder\);/,
    `router.post('/', optionalAuth, orderController.createOrder);`
  );
  return res;
});

// ========================================================
// 4. BACKEND: controllers/orderController.js (Support Guest & Direct Items Checkout)
// ========================================================
updateFile('backend/controllers/orderController.js', (content) => {
  // Update createOrder to handle items array from body (guest and buy-now support)
  const oldCreateOrder = `exports.createOrder = (req, res) => {
  const {
    shipping_address, shipping_city, shipping_state,
    shipping_pincode, shipping_phone, payment_method,
  } = req.body;

  if (payment_method === 'razorpay') {
    return res.status(400).json({ message: 'Use Razorpay checkout for online payment.' });
  }

  if (!['cod'].includes(payment_method || 'cod')) {
    return res.status(400).json({ message: 'Payment method must be COD or Razorpay.' });
  }
  if (!validShipping({ shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_phone })) {
    return res.status(400).json({ message: 'Complete shipping details are required.' });
  }

  const shippingData = {
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_pincode,
    shipping_phone,
  };

  placeOrderTransaction(req.user.id, shippingData, payment_method || 'cod').then((orderSummary) => {
    res.status(201).json({
      message: 'Order placed successfully',
      ...orderSummary,
    });
  }).catch((err) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Order placement failed.' });
  });
};`;

  const newCreateOrder = `exports.createOrder = async (req, res) => {
  const {
    customer_name, customer_phone, shipping_address, shipping_city, shipping_state,
    shipping_pincode, shipping_phone, payment_method, items
  } = req.body;

  if (payment_method === 'razorpay') {
    return res.status(400).json({ message: 'Use Razorpay checkout for online payment.' });
  }

  if (!['cod'].includes(payment_method || 'cod')) {
    return res.status(400).json({ message: 'Payment method must be COD.' });
  }

  const phone = shipping_phone || customer_phone;
  if (!validShipping({ shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_phone: phone })) {
    return res.status(400).json({ message: 'Complete shipping details (address, city, state, pincode, phone) are required.' });
  }

  const shippingData = {
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_pincode,
    shipping_phone: phone,
    customer_name: customer_name || req.user?.full_name || 'Valued Customer'
  };

  // Case A: Items are explicitly sent in the body (Guest checkout or Buy Now direct checkout)
  if (Array.isArray(items) && items.length > 0) {
    const connection = await new Promise((resolve, reject) => db.getConnection((err, conn) => err ? reject(err) : resolve(conn)));
    try {
      await query(connection, 'START TRANSACTION');
      const gstRate = parseFloat(process.env.JEWELLERY_GST_RATE || '3.0');
      const verifiedItems = [];

      for (const item of items) {
        const prodId = item.product_id || item.id;
        const qty = parseInt(item.quantity, 10) || 1;
        if (qty < 1) throw Object.assign(new Error('Invalid item quantity.'), { status: 400 });

        const prodRows = await query(connection, 'SELECT id, name, price, stock, is_active FROM products WHERE id = ? FOR UPDATE', [prodId]);
        if (!prodRows.length || !prodRows[0].is_active) {
          throw Object.assign(new Error('One or more selected products are no longer available.'), { status: 400 });
        }
        const prod = prodRows[0];
        if (prod.stock < qty) {
          throw Object.assign(new Error(\`Insufficient stock for \${prod.name}. Only \${prod.stock} available.\`), { status: 409 });
        }
        verifiedItems.push({
          product_id: prod.id,
          name: prod.name,
          price: Number(prod.price),
          quantity: qty,
          metal_composition: item.metal_composition || 'Verified Jewellery Spec'
        });
      }

      const total = verifiedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const subtotal = Math.round((total / (1 + (gstRate / 100))) * 100) / 100;
      const taxAmount = Math.round((total - subtotal) * 100) / 100;
      const orderNumber = generateOrderNumber();
      const invoiceNumber = generateInvoiceNumber();

      const orderResult = await query(connection, \`INSERT INTO orders
        (user_id, order_number, subtotal_amount, tax_amount, total_amount, invoice_number, 
         shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_phone, 
         payment_method, payment_status, status, order_source, customer_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'pending', 'website', ?)\`, [
        req.user?.id || null,
        orderNumber, subtotal, taxAmount, total, invoiceNumber,
        shippingData.shipping_address.trim(), shippingData.shipping_city.trim(),
        shippingData.shipping_state.trim(), shippingData.shipping_pincode.trim(), shippingData.shipping_phone.trim(),
        shippingData.customer_name.trim()
      ]);

      const orderId = orderResult.insertId;

      for (const it of verifiedItems) {
        const lineTotal = it.price * it.quantity;
        const lineSubtotal = Math.round((lineTotal / (1 + (gstRate / 100))) * 100) / 100;
        const lineTax = Math.round((lineTotal - lineSubtotal) * 100) / 100;

        await query(connection, \`INSERT INTO order_items 
          (order_id, product_id, product_name, quantity, price, tax_rate, tax_amount, hallmark_details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
          [orderId, it.product_id, it.name, it.quantity, it.price, gstRate, lineTax, 'Durgas Showroom Verified Composition']
        );

        await query(connection, 'UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.product_id]);
      }

      // If user was logged in and had server cart items, clear them
      if (req.user?.id) {
        await query(connection, 'DELETE FROM cart WHERE user_id = ?', [req.user.id]).catch(() => {});
      }

      await query(connection, 'COMMIT');

      return res.status(201).json({
        message: 'Order placed successfully',
        order_id: orderId,
        order_number: orderNumber,
        invoice_number: invoiceNumber,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        payment_method: 'cod',
        payment_status: 'pending'
      });
    } catch (err) {
      await query(connection, 'ROLLBACK').catch(() => {});
      const status = err.status || 500;
      return res.status(status).json({ message: err.message || 'Order placement failed.' });
    } finally {
      connection.release();
    }
  }

  // Case B: Standard logged-in user ordering from server cart table
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Please provide cart items or log in to checkout.' });
  }

  placeOrderTransaction(req.user.id, shippingData, payment_method || 'cod').then((orderSummary) => {
    res.status(201).json({
      message: 'Order placed successfully',
      ...orderSummary,
    });
  }).catch((err) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Order placement failed.' });
  });
};`;

  if (content.includes('exports.createOrder = (req, res) => {')) {
    return content.replace(oldCreateOrder, newCreateOrder);
  }
  return content;
});

// ========================================================
// 5. FRONTEND: js/products.js (Fix category & search load bug)
// ========================================================
updateFile('frontend/js/products.js', (content) => {
  // Update initialization block at bottom
  const oldInit = `  // 3. Load shop catalogue if on shop page
  if (document.getElementById('shopGrid')) {
    loadCategories().then(() => {
      const categoryParam = params.get('category');
      if (categoryParam) {
        filterByCategory(categoryParam);
      } else {
        loadShopProducts();
      }
    });
  }`;

  const newInit = `  // 3. Load shop catalogue if on shop page
  if (document.getElementById('shopGrid')) {
    loadCategories().then(async () => {
      await loadShopProducts();
      const categoryParam = params.get('category');
      const queryParam = params.get('q');
      if (categoryParam) {
        filterByCategory(categoryParam);
      }
      if (queryParam) {
        const searchInput = document.getElementById('shopSearchInput');
        if (searchInput) searchInput.value = queryParam;
        onShopSearch(queryParam);
      }
    });
  }`;

  let res = content.replace(oldInit, newInit);

  // In buildProductCard: add image fallback onerror
  res = res.replace(
    /<img src="\$\{img\}" alt="\$\{p\.name\}" loading="lazy" decoding="async">/,
    `<img src="\${img}" alt="\${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80';">`
  );

  return res;
});

// ========================================================
// 6. FRONTEND: js/api.js (Ensure image error handling and Buy Now storage)
// ========================================================
updateFile('frontend/js/api.js', (content) => {
  let res = content.replace(
    /<img src="\$\{img\}" alt="\$\{p\.name\}" loading="lazy" decoding="async">/,
    `<img src="\${img}" alt="\${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80';">`
  );
  return res;
});

// ========================================================
// 7. FRONTEND: js/cart.js (Preserve local cart in Buy Now mode & API unification)
// ========================================================
updateFile('frontend/js/cart.js', (content) => {
  // Fix clear cart in showOrderConfirmation
  let res = content.replace(
    /cartItems = \[\];\s*try \{\s*localStorage\.removeItem\('durgas_local_cart'\);\s*sessionStorage\.removeItem\('durgas_buy_now'\);\s*\} catch \(e\) \{\}/,
    `cartItems = [];
  try {
    if (isBuyNowMode) {
      sessionStorage.removeItem('durgas_buy_now');
      isBuyNowMode = false;
    } else {
      localStorage.removeItem('durgas_local_cart');
    }
  } catch (e) {}`
  );

  // Use API constant for WhatsApp order inquiry
  res = res.replace(
    /fetch\('\/api\/orders\/whatsapp'/g,
    `fetch((typeof API !== 'undefined' ? API : '/api') + '/orders/whatsapp'`
  );

  return res;
});

// ========================================================
// 8. FRONTEND: js/whatsapp.js (Unify API endpoints)
// ========================================================
updateFile('frontend/js/whatsapp.js', (content) => {
  let res = content.replace(
    /const res = await fetch\('\/api\/settings'\);/g,
    `const apiUrl = (typeof API !== 'undefined' ? API.replace(/\\/api$/, '') : '') + '/api/settings';
      const res = await fetch(apiUrl);`
  );

  res = res.replace(
    /await fetch\('\/api\/orders\/whatsapp',/g,
    `const waApiUrl = (typeof API !== 'undefined' ? API : '/api') + '/orders/whatsapp';
      await fetch(waApiUrl,`
  );

  return res;
});

// ========================================================
// 9. FRONTEND: js/auth.js (Quiet guest profile refresh)
// ========================================================
updateFile('frontend/js/auth.js', (content) => {
  const oldRefresh = `async function refreshUserProfile() {
  try {
    await fetch(API + '/auth/csrf', { credentials: 'include' });
    const res = await apiFetch('/auth/profile');
    if (!res.ok) throw new Error('Profile refresh failed');
    currentUser = await res.json();
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateAccountBtn();
  } catch (err) {
    console.warn('Unable to refresh profile:', err.message);
    userToken = null;
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAccountBtn();
  }
}`;

  const newRefresh = `async function refreshUserProfile() {
  try {
    await fetch(API + '/auth/csrf', { credentials: 'include' }).catch(() => {});
    // Only attempt profile fetch if user was previously saved or cookie exists
    const hasSavedUser = Boolean(localStorage.getItem('currentUser'));
    const hasAuthCookie = document.cookie.includes('auth_token') || document.cookie.includes('sb-access-token');
    if (!hasSavedUser && !hasAuthCookie) {
      updateAccountBtn();
      return;
    }
    const res = await apiFetch('/auth/profile');
    if (res.ok) {
      currentUser = await res.json();
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      userToken = null;
      currentUser = null;
      localStorage.removeItem('currentUser');
    }
    updateAccountBtn();
  } catch (err) {
    userToken = null;
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAccountBtn();
  }
}`;

  return content.replace(oldRefresh, newRefresh);
});

// ========================================================
// 10. FRONTEND: pages/profile.html (Fix DOM globals & add luxury styling)
// ========================================================
updateFile('frontend/pages/profile.html', (content) => {
  let res = content.replace(
    /full_name:\s*profileName\.value,\s*phone:\s*profilePhone\.value,\s*address:\s*profileAddress\.value,\s*city:\s*profileCity\.value,\s*state:\s*profileState\.value,\s*pincode:\s*profilePincode\.value/,
    `full_name: document.getElementById('profileName').value, phone: document.getElementById('profilePhone').value, address: document.getElementById('profileAddress').value, city: document.getElementById('profileCity').value, state: document.getElementById('profileState').value, pincode: document.getElementById('profilePincode').value`
  );

  if (!res.includes('Cormorant+Garamond')) {
    res = res.replace(
      '<head>',
      `<head>\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">`
    );
  }

  return res;
});

// ========================================================
// 11. ADMINISTRATOR: index.html (Persistent login check)
// ========================================================
updateFile('administrator/index.html', (content) => {
  const oldAuto = `// Auto-login if token exists
if (token) {
  apiFetch('/auth/profile').then(res => {
    if (res.ok) return res.json();
    throw new Error();
  }).then(user => {
    if (user.role === 'superadmin') {
      document.getElementById('adminName').textContent = user.full_name;
      showDashboard();
    } else adminLogout();
  }).catch(() => adminLogout());
}`;

  const newAuto = `// Auto-login check on page load via active session cookie
apiFetch('/auth/profile').then(res => {
  if (res.ok) return res.json();
  throw new Error();
}).then(user => {
  if (user.role === 'superadmin' || user.role === 'admin') {
    document.getElementById('adminName').textContent = user.full_name;
    showDashboard();
  } else {
    adminLogout();
  }
}).catch(() => {
  // Stay on login screen
});`;

  return content.replace(oldAuto, newAuto);
});

// ========================================================
// 12. FRONTEND: index.html (Brand copy & Instagram handle)
// ========================================================
updateFile('frontend/index.html', (content) => {
  let res = content.replace(/@lumiere\.jewels/g, '@durgasjewellers');
  res = res.replace(/Mumbai, India/g, 'South India');
  return res;
});

console.log('--- All patches applied successfully! ---');
