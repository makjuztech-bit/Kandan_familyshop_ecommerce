import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.REVIEWS_DB_PATH || `${root}/data/reviews.sqlite`)
mkdirSync(dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)

// Initialize loyalty tables in SQLite
database.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS loyalty_config (
    id TEXT PRIMARY KEY DEFAULT 'config',
    enabled INTEGER NOT NULL DEFAULT 1,
    spend_per_point REAL NOT NULL DEFAULT 100,
    points_per_unit INTEGER NOT NULL DEFAULT 1,
    redemption_enabled INTEGER NOT NULL DEFAULT 1,
    point_value_in_inr REAL NOT NULL DEFAULT 1.0,
    min_points_to_redeem INTEGER NOT NULL DEFAULT 10,
    max_redemption_percent REAL NOT NULL DEFAULT 50,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loyalty_customers (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_redeemed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    order_no TEXT NOT NULL DEFAULT '',
    order_total REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_loyalty_tx_email ON loyalty_transactions(email);
  CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON loyalty_transactions(created_at DESC);
`)

// Safe schema migrations
try { database.exec(`ALTER TABLE loyalty_transactions ADD COLUMN order_total REAL DEFAULT 0`) } catch {}

// Default loyalty config seed
const initialConfigCheck = database.prepare(`SELECT * FROM loyalty_config WHERE id = 'config' LIMIT 1`).get()
if (!initialConfigCheck) {
  database.prepare(`
    INSERT INTO loyalty_config (
      id, enabled, spend_per_point, points_per_unit,
      redemption_enabled, point_value_in_inr, min_points_to_redeem,
      max_redemption_percent, updated_at
    ) VALUES (
      'config', 1, 1000, 1, 1, 1.0, 10, 50, ?
    )
  `).run(new Date().toISOString())
}

/**
 * Returns the loyalty program configuration.
 */
export function getLoyaltyConfig() {
  const row = database.prepare(`SELECT * FROM loyalty_config WHERE id = 'config' LIMIT 1`).get()
  if (!row) {
    return {
      enabled: true,
      spendPerPoint: 1000,
      pointsPerUnit: 1,
      redemptionEnabled: true,
      pointValueInInr: 1,
      minPointsToRedeem: 10,
      maxRedemptionPercent: 50,
      updatedAt: new Date().toISOString(),
    }
  }

  return {
    enabled: Boolean(row.enabled),
    spendPerPoint: Number(row.spend_per_point) || 1000,
    pointsPerUnit: Number(row.points_per_unit) || 1,
    redemptionEnabled: Boolean(row.redemption_enabled),
    pointValueInInr: Number(row.point_value_in_inr) || 1,
    minPointsToRedeem: Number(row.min_points_to_redeem) || 10,
    maxRedemptionPercent: Number(row.max_redemption_percent) || 50,
    updatedAt: row.updated_at,
  }
}

/**
 * Updates loyalty program settings.
 */
export function updateLoyaltyConfig(patch = {}) {
  const current = getLoyaltyConfig()
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  database.prepare(`
    UPDATE loyalty_config SET
      enabled = ?,
      spend_per_point = ?,
      points_per_unit = ?,
      redemption_enabled = ?,
      point_value_in_inr = ?,
      min_points_to_redeem = ?,
      max_redemption_percent = ?,
      updated_at = ?
    WHERE id = 'config'
  `).run(
    next.enabled ? 1 : 0,
    Number(next.spendPerPoint) || 1000,
    Number(next.pointsPerUnit) || 1,
    next.redemptionEnabled ? 1 : 0,
    Number(next.pointValueInInr) || 1,
    Number(next.minPointsToRedeem) || 10,
    Number(next.maxRedemptionPercent) || 50,
    next.updatedAt
  )

  return getLoyaltyConfig()
}

/**
 * Retrieves a customer's loyalty profile and recent transaction history.
 */
export function getCustomerLoyalty(email) {
  if (!email || typeof email !== 'string') return null
  const normalized = email.trim().toLowerCase()

  const customerRow = database.prepare(`SELECT * FROM loyalty_customers WHERE email = ? LIMIT 1`).get(normalized)
  const historyRows = database.prepare(`
    SELECT * FROM loyalty_transactions WHERE email = ? ORDER BY created_at DESC LIMIT 100
  `).all(normalized)

  const history = historyRows.map((r) => ({
    id: r.id,
    customerId: r.email,
    email: r.email,
    type: String(r.type).toUpperCase(), // 'EARNED', 'REVERSED', 'REDEEMED', 'ADJUSTED'
    points: Number(r.points),
    orderId: r.order_no,
    orderNo: r.order_no,
    orderTotal: Number(r.order_total) || 0,
    description: r.note,
    note: r.note,
    balanceAfter: Number(r.balance_after),
    createdAt: r.created_at,
    date: new Date(r.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  }))

  if (!customerRow) {
    return {
      customerId: normalized,
      email: normalized,
      name: '',
      phone: '',
      loyaltyPoints: 0,
      currentPoints: 0,
      availablePoints: 0,
      balance: 0,
      totalPointsEarned: 0,
      totalEarned: 0,
      totalPointsUsed: 0,
      totalRedeemed: 0,
      pointsUsed: 0,
      history: [],
      exists: false,
    }
  }

  const currentPoints = Number(customerRow.balance) || 0
  const totalEarned = Number(customerRow.total_earned) || 0
  const totalUsed = Number(customerRow.total_redeemed) || 0

  return {
    customerId: customerRow.email,
    email: customerRow.email,
    name: customerRow.name,
    phone: customerRow.phone,
    loyaltyPoints: currentPoints,
    currentPoints: currentPoints,
    availablePoints: currentPoints,
    balance: currentPoints,
    totalPointsEarned: totalEarned,
    totalEarned: totalEarned,
    totalPointsUsed: totalUsed,
    totalRedeemed: totalUsed,
    pointsUsed: totalUsed,
    createdAt: customerRow.created_at,
    updatedAt: customerRow.updated_at,
    history,
    exists: true,
  }
}

/**
 * Returns all customers in the loyalty program along with aggregate metrics.
 */
export function getAllLoyaltyCustomers() {
  const rows = database.prepare(`SELECT * FROM loyalty_customers ORDER BY balance DESC, updated_at DESC`).all()
  return rows.map((r) => {
    const currentPoints = Number(r.balance) || 0
    const totalEarned = Number(r.total_earned) || 0
    const totalUsed = Number(r.total_redeemed) || 0
    return {
      customerId: r.email,
      email: r.email,
      name: r.name,
      phone: r.phone,
      loyaltyPoints: currentPoints,
      currentPoints: currentPoints,
      availablePoints: currentPoints,
      balance: currentPoints,
      totalPointsEarned: totalEarned,
      totalEarned: totalEarned,
      totalPointsUsed: totalUsed,
      totalRedeemed: totalUsed,
      pointsUsed: totalUsed,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
}

/**
 * Returns overall loyalty stats across the entire platform.
 */
export function getLoyaltySummaryStats() {
  const config = getLoyaltyConfig()
  const totals = database.prepare(`
    SELECT
      COUNT(*) AS total_members,
      COALESCE(SUM(balance), 0) AS total_outstanding_points,
      COALESCE(SUM(total_earned), 0) AS total_issued_points,
      COALESCE(SUM(total_redeemed), 0) AS total_redeemed_points
    FROM loyalty_customers
  `).get()

  return {
    config,
    totalMembers: Number(totals.total_members) || 0,
    totalOutstandingPoints: Number(totals.total_outstanding_points) || 0,
    totalIssuedPoints: Number(totals.total_issued_points) || 0,
    totalRedeemedPoints: Number(totals.total_redeemed_points) || 0,
  }
}

/**
 * Returns recent transactions across all customers for Admin audit log.
 */
export function getAllLoyaltyTransactions(limit = 100) {
  const rows = database.prepare(`
    SELECT * FROM loyalty_transactions ORDER BY created_at DESC LIMIT ?
  `).all(limit)

  return rows.map((r) => ({
    id: r.id,
    customerId: r.email,
    email: r.email,
    type: String(r.type).toUpperCase(),
    points: Number(r.points),
    orderId: r.order_no,
    orderNo: r.order_no,
    orderTotal: Number(r.order_total) || 0,
    description: r.note,
    note: r.note,
    balanceAfter: Number(r.balance_after),
    createdAt: r.created_at,
    date: new Date(r.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  }))
}

/**
 * Internal helper to ensure or upsert customer account row.
 */
function ensureCustomerRow(email, name = '', phone = '') {
  const normalized = email.trim().toLowerCase()
  const existing = database.prepare(`SELECT * FROM loyalty_customers WHERE email = ? LIMIT 1`).get(normalized)
  const now = new Date().toISOString()

  if (!existing) {
    database.prepare(`
      INSERT INTO loyalty_customers (email, name, phone, balance, total_earned, total_redeemed, created_at, updated_at)
      VALUES (?, ?, ?, 0, 0, 0, ?, ?)
    `).run(normalized, name.trim(), phone.trim(), now, now)
    return { email: normalized, balance: 0, total_earned: 0, total_redeemed: 0 }
  }

  // Update name or phone if provided
  if ((name && name !== existing.name) || (phone && phone !== existing.phone)) {
    database.prepare(`
      UPDATE loyalty_customers SET
        name = COALESCE(NULLIF(?, ''), name),
        phone = COALESCE(NULLIF(?, ''), phone),
        updated_at = ?
      WHERE email = ?
    `).run(name.trim(), phone.trim(), now, normalized)
  }

  return existing
}

/**
 * Admin manual points adjustment (add or deduct).
 */
export function adjustCustomerPoints({ email, name = '', phone = '', points, reason = 'Admin adjustment' }) {
  if (!email || !points || Number.isNaN(Number(points))) {
    throw new Error('Valid customer email and points amount are required.')
  }

  const normalized = email.trim().toLowerCase()
  const pts = Math.round(Number(points))
  if (pts === 0) throw new Error('Points adjustment cannot be 0.')

  const customer = ensureCustomerRow(normalized, name, phone)
  const currentBalance = Number(customer.balance) || 0
  const newBalance = Math.max(0, currentBalance + pts)
  const now = new Date().toISOString()
  const txId = 'ltx_' + randomUUID()

  // Update customer balance
  if (pts > 0) {
    database.prepare(`
      UPDATE loyalty_customers SET
        balance = balance + ?,
        total_earned = total_earned + ?,
        updated_at = ?
      WHERE email = ?
    `).run(pts, pts, now, normalized)
  } else {
    const deductAmount = Math.min(currentBalance, Math.abs(pts))
    database.prepare(`
      UPDATE loyalty_customers SET
        balance = MAX(0, balance - ?),
        total_redeemed = total_redeemed + ?,
        updated_at = ?
      WHERE email = ?
    `).run(deductAmount, deductAmount, now, normalized)
  }

  // Record audit transaction
  database.prepare(`
    INSERT INTO loyalty_transactions (id, email, type, points, order_no, order_total, note, balance_after, created_at)
    VALUES (?, ?, 'ADJUSTED', ?, '', 0, ?, ?, ?)
  `).run(txId, normalized, pts, reason, newBalance, now)

  return getCustomerLoyalty(normalized)
}

/**
 * Processes points earning and redemption for a confirmed order.
 * 
 * IMPORTANT: Enforces Idempotency / Duplicate Prevention!
 * Points are awarded ONLY ONCE per order.
 * If the customer refreshes the success page, goes back, or calls the API twice,
 * points will NOT be added twice.
 */
export function processOrderLoyalty({
  orderNo,
  email,
  name = '',
  phone = '',
  eligibleAmount = 0,
  pointsToRedeem = 0,
  awardPoints = true,
  items = [],
}) {
  const config = getLoyaltyConfig()
  if (!config.enabled || !email) {
    return { pointsEarned: 0, pointsRedeemed: 0, discountApplied: 0, newBalance: 0 }
  }

  const normalized = email.trim().toLowerCase()

  // 1. Idempotency Check: Check if points have already been awarded for this order
  if (orderNo) {
    try {
      const existingOrder = database.prepare(`
        SELECT points_awarded, points_earned, points_redeemed, points_discount FROM orders WHERE no = ? LIMIT 1
      `).get(orderNo)

      if (existingOrder && existingOrder.points_awarded === 1) {
        console.log(`â„¹ï¸ [Loyalty] Points already awarded for order ${orderNo}, skipping duplicate addition.`)
        const cust = getCustomerLoyalty(normalized)
        return {
          pointsEarned: Number(existingOrder.points_earned) || 0,
          pointsRedeemed: Number(existingOrder.points_redeemed) || 0,
          discountApplied: Number(existingOrder.points_discount) || 0,
          newBalance: cust?.loyaltyPoints || 0,
          alreadyAwarded: true,
        }
      }
    } catch {}
  }

  ensureCustomerRow(normalized, name, phone)
  const customer = getCustomerLoyalty(normalized)

  let redeemedPoints = 0
  let discountApplied = 0
  const now = new Date().toISOString()

  // 2. Process Points Redemption (if requested and enabled)
  if (config.redemptionEnabled && pointsToRedeem > 0) {
    const requestedPoints = Math.round(Number(pointsToRedeem))
    // Customer cannot redeem more points than their available balance
    redeemedPoints = Math.min(customer.loyaltyPoints, requestedPoints)

    if (redeemedPoints > 0) {
      discountApplied = redeemedPoints * config.pointValueInInr
      const balanceAfterRedeem = customer.loyaltyPoints - redeemedPoints
      const txIdRedeem = 'ltx_' + randomUUID()

      database.prepare(`
        UPDATE loyalty_customers SET
          balance = balance - ?,
          total_redeemed = total_redeemed + ?,
          updated_at = ?
        WHERE email = ?
      `).run(redeemedPoints, redeemedPoints, now, normalized)

      database.prepare(`
        INSERT INTO loyalty_transactions (id, email, type, points, order_no, order_total, note, balance_after, created_at)
        VALUES (?, ?, 'REDEEMED', ?, ?, ?, ?, ?, ?)
      `).run(
        txIdRedeem,
        normalized,
        -redeemedPoints,
        orderNo || '',
        eligibleAmount,
        `Points redeemed on Order #${orderNo} (-â‚¹${discountApplied})`,
        balanceAfterRedeem,
        now
      )
    }
  }

  // 3. Calculate and Award Points Earned on eligible purchase amount
  // Rule: Points = Math.floor(Order Total / 1000)
  // â‚¹1000 = 1 point, â‚¹2000 = 2 points, â‚¹5000 = 5 points
  let pointsEarned = 0
  if (awardPoints) {
    const spendPerPoint = Math.max(1, config.spendPerPoint || 100)
    pointsEarned = Math.floor(Math.max(0, eligibleAmount) / spendPerPoint) * (config.pointsPerUnit || 1)
  }

  let finalBalance = (customer.loyaltyPoints - redeemedPoints)

  if (pointsEarned > 0) {
    finalBalance += pointsEarned
    const txIdEarn = 'ltx_' + randomUUID()

    database.prepare(`
      UPDATE loyalty_customers SET
        balance = balance + ?,
        total_earned = total_earned + ?,
        updated_at = ?
      WHERE email = ?
    `).run(pointsEarned, pointsEarned, now, normalized)

    database.prepare(`
      INSERT INTO loyalty_transactions (id, email, type, points, order_no, order_total, note, balance_after, created_at)
      VALUES (?, ?, 'EARNED', ?, ?, ?, ?, ?, ?)
    `).run(
      txIdEarn,
      normalized,
      pointsEarned,
      orderNo || '',
      eligibleAmount,
      `Points earned from Order #${orderNo}${items && items.length > 0 ? " (" + items.map(i => i.name).join(", ") + ")" : ""}`,
      finalBalance,
      now
    )
  }

  // 4. Mark order as points_awarded = 1 atomically in orders table
  if (orderNo) {
    try {
      database.prepare(`
        UPDATE orders SET
          points_awarded = ?,
          points_earned = ?,
          points_redeemed = CASE WHEN ? > 0 THEN ? ELSE points_redeemed END,
          points_discount = CASE WHEN ? > 0 THEN ? ELSE points_discount END
        WHERE no = ?
      `).run(awardPoints ? 1 : 0, pointsEarned, redeemedPoints, redeemedPoints, discountApplied, discountApplied, orderNo)
    } catch {}
  }

  return {
    pointsEarned,
    pointsRedeemed: redeemedPoints,
    discountApplied,
    newBalance: finalBalance,
    alreadyAwarded: false,
  }
}

/**
 * Reverses loyalty points earned on an order when that order is Cancelled or Refunded.
 * Ensures an order is reversed only once!
 */
export function reverseOrderLoyaltyPoints(orderNo) {
  if (!orderNo) return { reversed: false, message: 'Order number required' }

  try {
    const order = database.prepare(`SELECT * FROM orders WHERE no = ? LIMIT 1`).get(orderNo)
    if (!order) {
      return { reversed: false, message: 'Order not found' }
    }

    const pointsEarned = Number(order.points_earned) || 0
    const pointsAwarded = Number(order.points_awarded) === 1
    const pointsReversed = Number(order.points_reversed) === 1

    if (!pointsAwarded || pointsReversed || pointsEarned <= 0) {
      console.log(`â„¹ï¸ [Loyalty] Order ${orderNo} not eligible for points reversal (awarded: ${pointsAwarded}, reversed: ${pointsReversed}, earned: ${pointsEarned})`)
      return { reversed: false, message: 'Not eligible or already reversed' }
    }

    const email = (order.email || '').trim().toLowerCase()
    const now = new Date().toISOString()
    const txId = 'ltx_' + randomUUID()

    // Deduct points from customer
    database.prepare(`
      UPDATE loyalty_customers SET
        balance = MAX(0, balance - ?),
        total_earned = MAX(0, total_earned - ?),
        updated_at = ?
      WHERE email = ?
    `).run(pointsEarned, pointsEarned, now, email)

    const updatedCust = database.prepare(`SELECT balance FROM loyalty_customers WHERE email = ? LIMIT 1`).get(email)
    const balanceAfter = Number(updatedCust?.balance) || 0

    // Record REVERSED transaction
    database.prepare(`
      INSERT INTO loyalty_transactions (id, email, type, points, order_no, order_total, note, balance_after, created_at)
      VALUES (?, ?, 'REVERSED', ?, ?, ?, ?, ?, ?)
    `).run(
      txId,
      email,
      -pointsEarned,
      order.no,
      Number(order.total) || 0,
      `Points reversed for cancelled Order #${order.no}`,
      balanceAfter,
      now
    )

    // Mark order as points_reversed = 1
    database.prepare(`UPDATE orders SET points_reversed = 1 WHERE no = ?`).run(order.no)
    console.log(`âœ… [Loyalty] Reversed ${pointsEarned} points for cancelled order ${order.no} from ${email}`)

    return {
      reversed: true,
      pointsReversed: pointsEarned,
      orderNo: order.no,
      email,
      newBalance: balanceAfter,
    }
  } catch (err) {
    console.error(`âŒ [Loyalty] Failed to reverse points for order ${orderNo}:`, err.message)
    return { reversed: false, error: err.message }
  }
}

/**
 * Express API routes for loyalty program.
 */
export function registerLoyaltyRoutes(app) {
  app.get('/api/loyalty/config', (req, res) => {
    try {
      res.json(getLoyaltyConfig())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/loyalty/config', (req, res) => {
    try {
      res.json(updateLoyaltyConfig(req.body))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/loyalty/customer', (req, res) => {
    try {
      const { email } = req.query
      if (!email) return res.status(400).json({ error: 'Email is required' })
      const cust = getCustomerLoyalty(String(email))
      res.json({ ok: true, customer: cust, ...cust })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/customer/loyalty-points', (req, res) => {
    try {
      const { email } = req.query
      if (!email) return res.status(400).json({ error: 'Email is required' })
      const cust = getCustomerLoyalty(String(email))
      res.json({
        ok: true,
        points: cust.balance,
        balance: cust.balance,
        totalEarned: cust.totalEarned,
        totalRedeemed: cust.totalRedeemed,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/customer/loyalty-history', (req, res) => {
    try {
      const { email } = req.query
      if (!email) return res.status(400).json({ error: 'Email is required' })
      const cust = getCustomerLoyalty(String(email))
      res.json({ ok: true, history: cust.history || [] })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/loyalty/customers', (req, res) => {
    try {
      res.json(getAllLoyaltyCustomers())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/loyalty/stats', (req, res) => {
    try {
      res.json(getLoyaltySummaryStats())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/loyalty/transactions', (req, res) => {
    try {
      const limit = Number(req.query.limit) || 100
      res.json(getAllLoyaltyTransactions(limit))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/loyalty/adjust', (req, res) => {
    try {
      const { email, name, phone, points, reason } = req.body
      if (!email || !points) return res.status(400).json({ error: 'Email and points are required' })
      res.json(adjustCustomerPoints({ email, name, phone, points, reason }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}

