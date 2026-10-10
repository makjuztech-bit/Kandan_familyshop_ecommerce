import { useState } from 'react'
import { Link } from 'react-router-dom'
import { inr } from '../data/products'
import {
  useLoyaltyConfig,
  useCustomerLoyalty,
  calculatePointsEarned,
  calculateRedemptionDiscount,
} from '../data/loyalty'

/**
 * Compact Loyalty Points Pill for Header & Nav
 * Shows: "⭐ 125 pts"
 */
export function LoyaltyHeaderBadge({ email }) {
  const config = useLoyaltyConfig()
  const customer = useCustomerLoyalty(email)

  if (!config.enabled) return null
  const balance = customer?.balance || 0

  return (
    <Link
      to="/account?tab=points"
      title={`Loyalty Points: ${balance} points (Spend ₹${config.spendPerPoint} = Earn ${config.pointsPerUnit} Point)`}
      className="group relative flex items-center gap-1.5 rounded-full border border-gold/60 bg-gradient-to-r from-amber-50 to-gold/20 px-2.5 py-1 text-xs font-bold text-primary shadow-sm hover:border-primary/50 hover:shadow transition-all"
    >
      <span className="text-amber-500 group-hover:scale-110 transition-transform">⭐</span>
      <span>{balance.toLocaleString('en-IN')} <span className="font-normal text-[11px] text-ink/70">pts</span></span>
    </Link>
  )
}

/**
 * Customer Dashboard Loyalty Points Card
 * Small card matching:
 * ┌─────────────────────────────┐
 * │       LOYALTY POINTS        │
 * │                             │
 * │          ⭐ 125             │
 * │       Available Points      │
 * │                             │
 * │  Earn 1 point for every     │
 * │       ₹100 purchase         │
 * └─────────────────────────────┘
 * Plus: "You have 125 loyalty points. Earn 1 point for every ₹100 you purchase."
 */
export function LoyaltyDashboardCard({ email, onOpenDetails }) {
  const config = useLoyaltyConfig()
  const customer = useCustomerLoyalty(email)

  if (!config.enabled) return null
  const balance = customer?.loyaltyPoints ?? customer?.balance ?? 0
  const totalEarned = customer?.totalPointsEarned ?? customer?.totalEarned ?? 0
  const totalUsed = customer?.totalPointsUsed ?? customer?.totalRedeemed ?? 0
  const rupeeValue = balance * config.pointValueInInr

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-amber-50/70 via-white to-gold/15 p-6 shadow-sm">
      {/* Informative banner text requested */}
      <div className="mb-4 rounded-xl border border-gold/40 bg-white/90 p-3 text-xs sm:text-sm text-ink/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p>
          You have <strong className="text-primary font-serif text-base">{balance.toLocaleString('en-IN')}</strong> loyalty points. <span className="text-ink/70">Earn 1 point for every ₹100 you purchase.</span>
        </p>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            className="text-xs font-bold text-primary hover:underline text-left sm:text-right"
          >
            View Full Points History →
          </button>
        ) : (
          <Link
            to="/account?tab=points"
            className="text-xs font-bold text-primary hover:underline text-left sm:text-right"
          >
            View Full Points History →
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
        {/* Exact Framed Loyalty Card requested */}
        <div className="w-full sm:w-72 rounded-2xl border-2 border-gold/70 bg-gradient-to-b from-white via-amber-50/60 to-gold/20 p-5 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            LOYALTY POINTS
          </p>
          <div className="my-3 flex items-center justify-center gap-1.5 font-serif text-4xl font-extrabold text-primary">
            <span className="text-3xl text-amber-500">⭐</span>
            <span>{balance.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-xs font-bold text-ink/80">Available Points</p>
          <div className="mt-4 border-t border-gold/40 pt-3">
            <p className="text-xs font-medium text-ink/70">
              Earn 1 point for every <span className="font-bold text-ink">₹100 purchase</span>
            </p>
          </div>
        </div>

        {/* Breakdown & Quick Stats */}
        <div className="flex-1 w-full space-y-4">
          <div>
            <h3 className="font-serif text-2xl font-bold text-ink">
              My Loyalty Points
            </h3>
            <p className="text-xs text-ink/70 mt-1">
              Points are automatically calculated on every successful order (₹100 = 1 Point). Worth <strong>{inr(rupeeValue)}</strong> in shopping discounts.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gold/30 bg-white p-3 text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-wide text-ink/50 font-bold">Current Points</p>
              <p className="font-serif text-lg sm:text-xl font-bold text-primary mt-0.5">{balance.toLocaleString('en-IN')} Points</p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-white p-3 text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-wide text-ink/50 font-bold">Total Points Earned</p>
              <p className="font-serif text-lg sm:text-xl font-bold text-emerald-800 mt-0.5">+{totalEarned.toLocaleString('en-IN')} Points</p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-white p-3 text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-wide text-ink/50 font-bold">Points Used</p>
              <p className="font-serif text-lg sm:text-xl font-bold text-ink/70 mt-0.5">{totalUsed.toLocaleString('en-IN')} Points</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Complete "My Points" tab view inside Customer Account
 */
export function MyPointsSection({ email, orders = [] }) {
  const config = useLoyaltyConfig()
  const customer = useCustomerLoyalty(email)

  const balance = customer?.loyaltyPoints ?? customer?.balance ?? 0
  const totalEarned = customer?.totalPointsEarned ?? customer?.totalEarned ?? 0
  const totalUsed = customer?.totalPointsUsed ?? customer?.totalRedeemed ?? 0
  const history = customer?.history || []

  // Filter orders for this customer
  const myOrders = orders.filter(
    (o) => (o.email || '').toLowerCase() === (email || '').toLowerCase()
  )

  return (
    <div className="space-y-6">
      {/* 1. Main Hero Metric Widget */}
      <div className="overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-amber-50 via-white to-gold/20 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                My Loyalty Points
              </p>
            </div>
            <h2 className="mt-2 font-serif text-4xl font-bold text-ink">
              Available Points: <span className="text-primary">{balance.toLocaleString('en-IN')}</span>
            </h2>
            <p className="mt-2 text-sm text-ink/80 font-medium">
              You have {balance.toLocaleString('en-IN')} loyalty points. Earn 1 point for every ₹100 you purchase.
            </p>
          </div>

          <div className="flex flex-col items-start rounded-xl border border-gold/40 bg-white/90 p-4 shadow-sm md:items-end">
            <span className="text-xs font-bold text-ink/60">Redeemable Value</span>
            <span className="font-serif text-3xl font-bold text-emerald-800">
              {inr(balance * config.pointValueInInr)}
            </span>
            <span className="text-[11px] text-ink/50 mt-0.5">
              1 point = ₹1 discount at checkout
            </span>
          </div>
        </div>

        {/* 3 Metric cards requested */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gold/40 bg-white p-4 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Current Points</p>
            <p className="mt-1 font-serif text-2xl font-bold text-primary">
              {balance.toLocaleString('en-IN')} Points
            </p>
            <p className="mt-1 text-xs text-ink/60">Available Points: {balance}</p>
          </div>

          <div className="rounded-xl border border-gold/40 bg-white p-4 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Total Points Earned</p>
            <p className="mt-1 font-serif text-2xl font-bold text-emerald-800">
              {totalEarned.toLocaleString('en-IN')} Points
            </p>
            <p className="mt-1 text-xs text-ink/60">Lifetime points from orders</p>
          </div>

          <div className="rounded-xl border border-gold/40 bg-white p-4 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Points Used</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink/80">
              {totalUsed.toLocaleString('en-IN')} Points
            </p>
            <p className="mt-1 text-xs text-ink/60">Total savings: {inr(totalUsed * config.pointValueInInr)}</p>
          </div>
        </div>
      </div>

      {/* 2. LOYALTY POINT HISTORY */}
      <div className="rounded-2xl border border-gold/40 bg-white p-6 shadow-sm">
        <div className="border-b border-gold/30 pb-3 mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-primary uppercase tracking-wider">
            LOYALTY POINT HISTORY
          </h3>
          <span className="text-xs text-ink/60">{history.length} records</span>
        </div>

        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/60 bg-ivory/40 rounded-xl">
            No points transactions recorded yet. Complete an order to automatically earn points!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((tx) => {
              const isReversed = tx.type === 'REVERSED' || tx.type === 'reversed'
              const isEarned = tx.type === 'EARNED' || tx.type === 'earned'
              const isRedeemed = tx.type === 'REDEEMED' || tx.type === 'redeemed'
              const isPositive = tx.points > 0

              return (
                <div
                  key={tx.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isReversed
                      ? 'border-red-200 bg-red-50/40'
                      : isEarned
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-gold/30 bg-ivory/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs font-bold text-primary">
                        Order #{tx.orderNo || tx.orderId || 'Direct'}
                      </p>
                      <p className="text-xs font-semibold text-ink/80 mt-0.5">
                        {isEarned ? 'Purchase' : isReversed ? 'Cancelled / Refund' : isRedeemed ? 'Redeemed' : 'Adjustment'}
                      </p>
                    </div>
                    <span
                      className={`font-serif text-lg font-bold ${
                        isPositive ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isPositive ? `+${tx.points}` : tx.points} Points
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gold/20 pt-2 text-xs text-ink/65">
                    <span>
                      {tx.orderTotal > 0 ? inr(tx.orderTotal) : '—'}
                    </span>
                    <span>{tx.date || tx.createdAt?.slice(0, 10)}</span>
                  </div>

                  {tx.description && (
                    <p className="mt-1 text-[11px] text-ink/50 italic truncate">
                      {tx.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Recent Purchases & Points Earned */}
      <div className="rounded-2xl border border-gold/30 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl font-bold text-primary mb-4">
          Recent Purchases &amp; Points Earned
        </h3>

        {myOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/60 bg-ivory/40 rounded-xl">
            No orders found for this account.
          </p>
        ) : (
          <div className="space-y-3">
            {myOrders.map((order) => {
              const earned = order.pointsEarned || calculatePointsEarned(order.total, config)
              const redeemed = order.pointsRedeemed || 0
              return (
                <div
                  key={order.no}
                  className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-ivory/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{order.no}</span>
                      <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-ink/80">
                        {order.status || 'Confirmed'}
                      </span>
                    </div>
                    <p className="text-xs text-ink/60 mt-0.5">{order.at || order.createdAt}</p>
                    <p className="text-xs text-ink/80 mt-1 font-semibold">
                      Total: {inr(order.total)} · {(order.items || []).length} items
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block text-xs text-ink/60">Points from order:</span>
                      <span className="font-bold text-emerald-700">+{earned} points</span>
                      {redeemed > 0 && (
                        <span className="block text-[11px] text-amber-800">
                          (-{redeemed} pts redeemed)
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/order/${order.no}`}
                      className="rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-ivory transition-colors"
                    >
                      View Order
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Interactive Checkout Loyalty Points Card
 * Enables customer to see points to earn and redeem points for instant discount
 */
export function CheckoutLoyaltyBox({
  email,
  orderTotal,
  pointsToRedeem,
  onPointsRedeemChange,
}) {
  const config = useLoyaltyConfig()
  const customer = useCustomerLoyalty(email)

  if (!config.enabled) return null

  const availableBalance = customer?.balance || 0
  const pointsToEarn = calculatePointsEarned(orderTotal, config)

  // Max points eligible to redeem:
  // Cannot exceed available balance, and cannot exceed max allowed percentage of order
  const maxDiscountAllowed = Math.floor(orderTotal * (config.maxRedemptionPercent / 100))
  const maxPointsAllowed = Math.min(
    availableBalance,
    Math.floor(maxDiscountAllowed / config.pointValueInInr)
  )

  const canRedeem =
    config.redemptionEnabled &&
    availableBalance >= config.minPointsToRedeem &&
    maxPointsAllowed > 0

  const discountAmount = calculateRedemptionDiscount(pointsToRedeem, config)

  const handleToggleRedeem = (e) => {
    if (e.target.checked) {
      // Default to redeeming all allowed points or up to order limit
      onPointsRedeemChange(maxPointsAllowed)
    } else {
      onPointsRedeemChange(0)
    }
  }

  const handleSliderChange = (e) => {
    onPointsRedeemChange(Number(e.target.value) || 0)
  }

  return (
    <div className="rounded-xl border border-gold/50 bg-gradient-to-br from-amber-50/80 via-white to-gold/15 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gold/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <div>
            <h4 className="font-serif text-base font-bold text-primary">
              Loyalty Points &amp; Rewards
            </h4>
            <p className="text-[11px] text-ink/60">
              Spend ₹{config.spendPerPoint} = Earn {config.pointsPerUnit} Point
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-ink/60 block">Your Balance</span>
          <span className="font-bold text-xs text-primary">
            {availableBalance} pts ({inr(availableBalance * config.pointValueInInr)})
          </span>
        </div>
      </div>

      {/* Points to be earned on this order */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 border border-emerald-200">
        <span className="flex items-center gap-1.5 font-semibold">
          <span>✨</span> You will earn from this purchase:
        </span>
        <span className="font-bold text-emerald-800 text-sm">+{pointsToEarn} Points</span>
      </div>

      {/* Points Redemption Section */}
      {config.redemptionEnabled && (
        <div className="mt-3 pt-2">
          {canRedeem ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pointsToRedeem > 0}
                  onChange={handleToggleRedeem}
                  className="h-4 w-4 accent-primary rounded"
                />
                <span className="text-xs font-bold text-ink">
                  Redeem Points for instant discount (Up to {maxPointsAllowed} pts = {inr(maxPointsAllowed * config.pointValueInInr)})
                </span>
              </label>

              {pointsToRedeem > 0 && (
                <div className="rounded-lg bg-white p-3 border border-gold/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink/70">Points to Redeem:</span>
                    <span className="font-bold text-primary">{pointsToRedeem} Points</span>
                  </div>

                  <input
                    type="range"
                    min={config.minPointsToRedeem}
                    max={maxPointsAllowed}
                    step={1}
                    value={pointsToRedeem}
                    onChange={handleSliderChange}
                    className="w-full accent-primary"
                  />

                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 pt-1 border-t border-gold/20">
                    <span>Discount Applied:</span>
                    <span>-{inr(discountAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : availableBalance > 0 ? (
            <p className="text-[11px] text-ink/60">
              Min. {config.minPointsToRedeem} points required to redeem discount. Current balance: {availableBalance} pts.
            </p>
          ) : (
            <p className="text-[11px] text-ink/60">
              Earn points with this order and redeem discounts on your next saree purchase!
            </p>
          )}
        </div>
      )}
    </div>
  )
}

