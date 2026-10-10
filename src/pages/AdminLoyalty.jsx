import { useState, useEffect } from 'react'
import { inr } from '../data/products'
import {
  useLoyaltyConfig,
  updateLoyaltyConfigApi,
  fetchAllLoyaltyCustomersApi,
  fetchLoyaltyStatsApi,
  fetchLoyaltyTransactionsApi,
  adjustCustomerPointsApi,
} from '../data/loyalty'
import { Field, btnP, btnO } from '../components/ui'

export default function AdminLoyalty() {
  const globalConfig = useLoyaltyConfig()
  const [configForm, setConfigForm] = useState(globalConfig)
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalOutstandingPoints: 0,
    totalIssuedPoints: 0,
    totalRedeemedPoints: 0,
  })
  const [customers, setCustomers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortType, setSortType] = useState('recent')

  // View Points History Modal State
  const [historyModal, setHistoryModal] = useState({
    open: false,
    customer: null,
    transactions: [],
  })

  // Adjust Points Modal State
  const [adjustModal, setAdjustModal] = useState({
    open: false,
    email: '',
    name: '',
    phone: '',
    points: 10,
    action: 'add', // 'add' | 'deduct'
    reason: '',
  })
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  // Sync config form with globalConfig
  useEffect(() => {
    setConfigForm(globalConfig)
  }, [globalConfig])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsData, custData, txData] = await Promise.all([
        fetchLoyaltyStatsApi(),
        fetchAllLoyaltyCustomersApi(),
        fetchLoyaltyTransactionsApi(150),
      ])
      setStats(statsData)
      setCustomers(custData)
      setTransactions(txData)
    } catch (err) {
      console.error('Failed to load loyalty admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target
    setConfigForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value) || value,
    }))
    setSaveMessage('')
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaveMessage('Saving configuration...')
    const result = await updateLoyaltyConfigApi(configForm)
    if (result.ok) {
      setSaveMessage('✅ Loyalty program configuration saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } else {
      setSaveMessage('❌ Failed to update configuration.')
    }
  }

  const openHistoryModal = (customer) => {
    const list = transactions.filter(
      (t) => (t.email || '').toLowerCase() === (customer.email || '').toLowerCase()
    )
    setHistoryModal({
      open: true,
      customer,
      transactions: list,
    })
  }

  const openAdjustModal = (customer) => {
    setAdjustModal({
      open: true,
      email: customer.email,
      name: customer.name || '',
      phone: customer.phone || '',
      points: 10,
      action: 'add',
      reason: 'Special store reward bonus',
    })
    setAdjustError('')
  }

  const handleAdjustSubmit = async (e) => {
    e.preventDefault()
    const pts = Math.abs(Number(adjustModal.points))
    if (!pts || pts <= 0) {
      setAdjustError('Please enter a valid points amount greater than 0.')
      return
    }

    const signedPoints = adjustModal.action === 'deduct' ? -pts : pts
    setAdjustSubmitting(true)
    setAdjustError('')

    try {
      await adjustCustomerPointsApi({
        email: adjustModal.email,
        name: adjustModal.name,
        phone: adjustModal.phone,
        points: signedPoints,
        reason: adjustModal.reason || (adjustModal.action === 'add' ? 'Manual Credit' : 'Manual Debit'),
      })
      setAdjustModal({ ...adjustModal, open: false })
      await loadData()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Points adjustment failed.')
    } finally {
      setAdjustSubmitting(false)
    }
  }

  const filteredCustomers = customers
    .filter((c) => {
      const q = globalSearch.toLowerCase().trim()
      const matchSearch = !q || (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.id || '').toLowerCase().includes(q)
      )
      
      let matchFilter = true
      if (filterType === 'earned') matchFilter = (c.totalPointsEarned ?? c.totalEarned ?? 0) > 0
      if (filterType === 'redeemed') matchFilter = (c.totalPointsUsed ?? c.totalRedeemed ?? 0) > 0
      if (filterType === 'available') matchFilter = (c.loyaltyPoints ?? c.balance ?? 0) >= (configForm.minPointsToRedeem || 1)

      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      if (sortType === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortType === 'points') return (b.loyaltyPoints ?? b.balance ?? 0) - (a.loyaltyPoints ?? a.balance ?? 0)
      return 0
    })

  const filteredTransactions = transactions
    .filter((tx) => {
      const q = globalSearch.toLowerCase().trim()
      const matchSearch = !q || (
        (tx.email || '').toLowerCase().includes(q) ||
        (tx.orderNo || '').toLowerCase().includes(q) ||
        (tx.id || '').toLowerCase().includes(q) ||
        (tx.note || '').toLowerCase().includes(q) ||
        (tx.type || '').toLowerCase().includes(q)
      )

      let matchFilter = true
      if (filterType === 'earned') matchFilter = tx.type === 'EARNED' || tx.type === 'earned'
      if (filterType === 'redeemed') matchFilter = tx.type === 'REDEEMED' || tx.type === 'redeemed' || tx.type === 'USED' || tx.type === 'used'

      return matchSearch && matchFilter
    })

  const resetSearch = () => {
    setGlobalSearch('')
    setFilterType('all')
    setSortType('recent')
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-serif">Loyalty Points &amp; Rewards Program</h1>
        <p className="mt-1 text-sm text-ink/60">
          Manage customer loyalty earning rates, redemption rules, customer balances, and points transaction audits.
        </p>
      </div>

      {/* Global Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gold/40 shadow-sm items-center justify-between">
        <div className="relative w-full md:flex-1">
          <span className="absolute left-3 top-2.5 text-ink/50">🔍</span>
          <input
            type="text"
            placeholder="Search customers, rewards, or transactions..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="h-10 w-full rounded border border-gold/40 pl-10 pr-10 text-sm"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-2.5 text-ink/50 hover:text-ink font-bold"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap w-full md:w-auto gap-3">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 rounded border border-gold/40 px-3 text-sm bg-white"
          >
            <option value="all">All Customers</option>
            <option value="earned">Points Earned</option>
            <option value="redeemed">Points Redeemed</option>
            <option value="available">Available Rewards</option>
          </select>

          <select 
            value={sortType} 
            onChange={(e) => setSortType(e.target.value)}
            className="h-10 rounded border border-gold/40 px-3 text-sm bg-white"
          >
            <option value="recent">Sort by Recent</option>
            <option value="name">Sort by Name</option>
            <option value="points">Sort by Points</option>
          </select>
          
          {(globalSearch || filterType !== 'all' || sortType !== 'recent') && (
            <button
              onClick={resetSearch}
              className="h-10 px-3 rounded bg-ink/5 text-ink/70 hover:bg-ink/10 text-sm font-bold whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 1. Summary Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-gold/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-ink/60 uppercase">Total Points Issued</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-emerald-800">
            +{stats.totalIssuedPoints.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-ink/50">Lifetime points awarded to customers</p>
        </div>

        <div className="border border-gold/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-ink/60 uppercase">Total Points Redeemed</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-amber-900">
            {stats.totalRedeemedPoints.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-ink/50">Savings redeemed on orders</p>
        </div>

        <div className="border border-gold/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-ink/60 uppercase">Outstanding Balance</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-primary">
            {stats.totalOutstandingPoints.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Total active points worth {inr(stats.totalOutstandingPoints * (configForm.pointValueInInr || 1))}
          </p>
        </div>

        <div className="border border-gold/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-ink/60 uppercase">Active Loyalty Members</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-ink">
            {stats.totalMembers.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-ink/50">Enrolled customer accounts</p>
        </div>
      </div>

      {/* 2. Program Rules & Settings Form */}
      <form onSubmit={handleSaveConfig} className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 pb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-primary">
              Program Settings &amp; Earning Rules
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">
              Configure how customers earn and redeem points across the e-commerce storefront.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-ivory-dark/40 px-3.5 py-1.5 rounded-lg border border-gold/30">
            <input
              type="checkbox"
              name="enabled"
              checked={configForm.enabled}
              onChange={handleConfigChange}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-bold">
              {configForm.enabled ? '🟢 Loyalty Program Active' : '⚪ Program Disabled'}
            </span>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Earning rule */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Spend Amount for 1 Point (₹) *
            </label>
            <input
              type="number"
              min="1"
              name="spendPerPoint"
              value={configForm.spendPerPoint}
              onChange={handleConfigChange}
              className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink/60">
              Default ₹1000. ₹1000 spend = 1 point, ₹5000 spend = 5 points.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Points Awarded per Unit *
            </label>
            <input
              type="number"
              min="1"
              name="pointsPerUnit"
              value={configForm.pointsPerUnit}
              onChange={handleConfigChange}
              className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink/60">Points credited per spend threshold (Default: 1 point).</p>
          </div>

          {/* Redemption toggle */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Enable Points Redemption at Checkout
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                name="redemptionEnabled"
                checked={configForm.redemptionEnabled}
                onChange={handleConfigChange}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs font-semibold text-ink">
                Allow customers to redeem points for order discounts
              </span>
            </div>
          </div>

          {/* Point Rupee value */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Value of 1 Point in Rupees (₹) *
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              name="pointValueInInr"
              value={configForm.pointValueInInr}
              onChange={handleConfigChange}
              className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink/60">e.g. 1 point = ₹1.0 discount.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Minimum Points Required to Redeem *
            </label>
            <input
              type="number"
              min="1"
              name="minPointsToRedeem"
              value={configForm.minPointsToRedeem}
              onChange={handleConfigChange}
              className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink/60">Customer must have at least this balance to redeem.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Maximum Redemption (% of order total) *
            </label>
            <input
              type="number"
              min="1"
              max="100"
              name="maxRedemptionPercent"
              value={configForm.maxRedemptionPercent}
              onChange={handleConfigChange}
              className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink/60">Caps max points discount per purchase (e.g. up to 50%).</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/30 pt-4">
          <button type="submit" className={btnP}>
            Save Loyalty Rules
          </button>
          {saveMessage && <p className="text-sm font-bold">{saveMessage}</p>}
        </div>
      </form>

      {/* 3. Customer Points Directory */}
      <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-4">
        {/* Informative notice */}
        <div className="rounded-lg border border-gold/30 bg-amber-50/50 p-3 text-xs text-ink/80 flex items-center gap-2">
          <span className="text-base">⚡</span>
          <p>
            <strong>Automatic Backend Processing:</strong> Purchase points are automatically calculated (₹1000 = 1 point) and awarded by the server upon order confirmation. Admin does not need to manually add points for purchases.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 pb-3">
          <div>
            <h2 className="text-xl font-serif font-bold text-primary">
              Customer Loyalty Accounts ({customers.length})
            </h2>
            <p className="text-xs text-ink/60">
              View customer names, emails, point balances, lifetime earning, and detailed points history.
            </p>
          </div>

        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink/60">Loading customer accounts...</p>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink/60">No loyalty accounts found matching your search.</p>
            {(globalSearch || filterType !== 'all') && (
              <button onClick={resetSearch} className="mt-3 text-primary text-sm font-bold hover:underline">
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-ivory-dark/60 text-xs font-bold uppercase text-ink/70">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Customer Email</th>
                  <th className="p-3 text-right">Current Points</th>
                  <th className="p-3 text-right">Total Points Earned</th>
                  <th className="p-3 text-right">Total Points Used</th>
                  <th className="p-3 text-right">Points History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/20">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.email} className="hover:bg-ivory/50">
                    <td className="p-3">
                      <p className="font-bold text-ink">{cust.name || 'Customer'}</p>
                      {cust.phone && <p className="text-[11px] text-ink/50">{cust.phone}</p>}
                    </td>
                    <td className="p-3 text-xs font-mono text-ink/70">
                      {cust.email}
                    </td>
                    <td className="p-3 text-right font-serif font-bold text-base text-primary">
                      {(cust.loyaltyPoints ?? cust.balance ?? 0).toLocaleString('en-IN')} Points
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-800 text-xs">
                      +{(cust.totalPointsEarned ?? cust.totalEarned ?? 0).toLocaleString('en-IN')} Points
                    </td>
                    <td className="p-3 text-right text-xs text-ink/70">
                      -{(cust.totalPointsUsed ?? cust.totalRedeemed ?? 0).toLocaleString('en-IN')} Points
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openHistoryModal(cust)}
                          className="rounded border border-gold/60 bg-gold/15 px-2.5 py-1 text-xs font-bold text-primary hover:bg-gold/30 transition-colors"
                          title="View customer points history"
                        >
                          📜 View History
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdjustModal(cust)}
                          className="rounded border border-primary/20 bg-white px-2 py-1 text-xs text-ink/60 hover:text-primary hover:border-primary/40 transition-colors"
                          title="Manual adjustment"
                        >
                          ±
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Complete Audit Transactions Log */}
      <div className="rounded-xl border border-gold/40 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-xl font-serif font-bold text-primary border-b border-gold/30 pb-3">
          Loyalty Transaction Ledger ({filteredTransactions.length})
        </h2>

        {filteredTransactions.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-ink/60">No transactions found matching your search.</p>
            {(globalSearch || filterType !== 'all') && (
              <button onClick={resetSearch} className="mt-3 text-primary text-sm font-bold hover:underline">
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-ivory-dark/60 text-xs font-bold uppercase text-ink/70 sticky top-0">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Customer Email</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Order / Note</th>
                  <th className="p-3 text-right">Points Delta</th>
                  <th className="p-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/20">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-ivory/50">
                    <td className="p-3 text-xs text-ink/60 whitespace-nowrap">{tx.date || tx.createdAt}</td>
                    <td className="p-3 text-xs font-semibold text-ink">{tx.email}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                          tx.type === 'earned'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.type === 'redeemed'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-ink/80">{tx.note || tx.orderNo || '—'}</td>
                    <td className="p-3 text-right font-bold text-xs whitespace-nowrap">
                      <span className={tx.points > 0 ? 'text-emerald-700' : 'text-amber-800'}>
                        {tx.points > 0 ? `+${tx.points}` : tx.points}
                      </span>
                    </td>
                    <td className="p-3 text-right font-serif font-bold text-ink">
                      {tx.balanceAfter} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Points Modal */}
      {adjustModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border-2 border-gold bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-serif font-bold text-primary">
              Manual Points Adjustment
            </h3>
            <p className="mt-1 text-xs text-ink/60">
              Customer: <strong>{adjustModal.name || adjustModal.email}</strong> ({adjustModal.email})
            </p>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                  <input
                    type="radio"
                    name="action"
                    value="add"
                    checked={adjustModal.action === 'add'}
                    onChange={() => setAdjustModal({ ...adjustModal, action: 'add' })}
                    className="accent-primary"
                  />
                  <span>➕ Add Points</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                  <input
                    type="radio"
                    name="action"
                    value="deduct"
                    checked={adjustModal.action === 'deduct'}
                    onChange={() => setAdjustModal({ ...adjustModal, action: 'deduct' })}
                    className="accent-primary"
                  />
                  <span>➖ Deduct Points</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Points Amount *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustModal.points}
                  onChange={(e) => setAdjustModal({ ...adjustModal, points: e.target.value })}
                  className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Reason / Adjustment Note *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer support bonus, festival gift, return deduction"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  className="h-10 w-full rounded border border-gold/40 px-3 text-sm"
                />
              </div>

              {adjustError && (
                <p className="text-xs font-bold text-red-700 bg-red-50 p-2 rounded">
                  {adjustError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModal({ ...adjustModal, open: false })}
                  className={btnO}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className={btnP}
                >
                  {adjustSubmitting ? 'Updating...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Points History Modal */}
      {historyModal.open && historyModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border-2 border-gold bg-white p-6 shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between border-b border-gold/30 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  LOYALTY POINT HISTORY
                </p>
                <h3 className="text-xl font-serif font-bold text-ink">
                  {historyModal.customer.name || 'Customer'}
                </h3>
                <p className="text-xs text-ink/60">{historyModal.customer.email}</p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryModal({ open: false, customer: null, transactions: [] })}
                className="rounded-full h-8 w-8 flex items-center justify-center bg-ivory-dark text-ink/60 hover:text-ink hover:bg-gold/30 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Balance Summary */}
            <div className="my-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gold/30 bg-amber-50/50 p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-ink/60">Current Points</p>
                <p className="font-serif text-lg font-bold text-primary mt-0.5">
                  {(historyModal.customer.loyaltyPoints ?? historyModal.customer.balance ?? 0).toLocaleString('en-IN')} Points
                </p>
              </div>
              <div className="rounded-xl border border-gold/30 bg-emerald-50/50 p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-ink/60">Total Points Earned</p>
                <p className="font-serif text-lg font-bold text-emerald-800 mt-0.5">
                  +{(historyModal.customer.totalPointsEarned ?? historyModal.customer.totalEarned ?? 0).toLocaleString('en-IN')} Points
                </p>
              </div>
              <div className="rounded-xl border border-gold/30 bg-ivory-dark/40 p-3 text-center">
                <p className="text-[10px] uppercase font-bold text-ink/60">Points Used</p>
                <p className="font-serif text-lg font-bold text-ink/70 mt-0.5">
                  -{(historyModal.customer.totalPointsUsed ?? historyModal.customer.totalRedeemed ?? 0).toLocaleString('en-IN')} Points
                </p>
              </div>
            </div>

            {/* Transaction Ledger */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {historyModal.transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/60">
                  No points activity recorded for this customer yet.
                </p>
              ) : (
                historyModal.transactions.map((tx) => {
                  const isEarned = tx.type === 'EARNED' || tx.type === 'earned'
                  const isReversed = tx.type === 'REVERSED' || tx.type === 'reversed'
                  const isPositive = tx.points > 0

                  return (
                    <div
                      key={tx.id}
                      className={`rounded-xl border p-3 flex items-center justify-between text-xs ${
                        isReversed
                          ? 'border-red-200 bg-red-50/40'
                          : isEarned
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-gold/30 bg-ivory/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">
                            {tx.orderNo ? `Order #${tx.orderNo}` : 'Account Credit'}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              isEarned
                                ? 'bg-emerald-100 text-emerald-800'
                                : isReversed
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </div>
                        <p className="text-ink/60 mt-0.5">{tx.date || tx.createdAt?.slice(0, 10)} · {tx.note || tx.description}</p>
                        {tx.orderTotal > 0 && (
                          <p className="text-[11px] font-semibold text-ink/80 mt-0.5">Order Total: {inr(tx.orderTotal)}</p>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-serif text-base font-bold ${
                            isPositive ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive ? `+${tx.points}` : tx.points} Points
                        </span>
                        <p className="text-[10px] text-ink/50 mt-0.5">Balance: {tx.balanceAfter} pts</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-4 border-t border-gold/30 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModal({ open: false, customer: null, transactions: [] })}
                className={btnO}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

