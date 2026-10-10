
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
      res.json(getCustomerLoyalty(String(email)))
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
