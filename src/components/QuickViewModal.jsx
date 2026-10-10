import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inr } from '../data/products'
import { useStore } from '../context/Store'
import { Img, btnP, btnO } from './ui'
import { ReviewSummary } from './Rating'

export default function QuickViewModal({ product, onClose }) {
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { add, wish, toggleWish } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    setActiveImg(0)
    setQty(1)
    setAdded(false)
  }, [product])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!product) return null

  const isWish = wish.includes(product.id)
  const images = product.images || []
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discountPct = product.discount || (hasDiscount ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0)

  const handleAddToCart = () => {
    add(product.id, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  const handleBuyNow = () => {
    add(product.id, qty)
    onClose()
    navigate('/checkout')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qv-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gold/50 bg-ivory p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close Quick View"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-xl font-bold text-ink/70 hover:bg-primary hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark border border-gold/30">
              <Img
                src={images[activeImg] || images[0]}
                alt={`${product.name} view ${activeImg + 1}`}
                tone={product.hex}
                className="h-full w-full object-cover transition-all duration-300"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={img + idx}
                    type="button"
                    onClick={() => setActiveImg(idx)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      idx === activeImg ? 'border-primary scale-105 shadow-md' : 'border-gold/40 hover:border-primary/60'
                    }`}
                  >
                    <Img src={img} alt="" tone={product.hex} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                {product.collection}
              </span>
              {product.sku && (
                <span className="text-xs text-ink/50 font-mono tracking-wider">
                  SKU: {product.sku}
                </span>
              )}
            </div>

            <h2 id="qv-title" className="mt-2 text-2xl font-serif sm:text-3xl font-bold text-ink">
              {product.name}
            </h2>

            <div className="mt-2">
              <ReviewSummary productId={product.id} />
            </div>

            {/* Price block */}
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-3xl font-bold text-primary">{inr(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-ink/50 line-through">{inr(product.originalPrice)}</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {discountPct}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Stock status */}
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  product.stock ? 'bg-emerald-600' : 'bg-red-500'
                }`}
              />
              <span className={`text-sm font-semibold ${product.stock ? 'text-emerald-800' : 'text-red-700'}`}>
                {product.stock ? `In Stock (${product.stockCount || 10} available)` : 'Out of Stock'}
              </span>
            </div>

            <p className="mt-3 text-sm text-ink/80 line-clamp-3 leading-relaxed">
              {product.description || 'Authentic traditional weave crafted with premium fabrics and exquisite attention to detail.'}
            </p>

            <dl className="mt-4 space-y-1.5 border-y border-gold/30 py-3 text-xs sm:text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-ink/60">Fabric:</dt>
                <dd className="font-medium text-ink">{product.fabric}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink/60">Colour:</dt>
                <dd className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: product.hex }} />
                  {product.colour}
                </dd>
              </div>
              {product.length && (
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink/60">Length / Size:</dt>
                  <dd className="font-medium text-ink">{product.length}</dd>
                </div>
              )}
            </dl>

            {/* Quantity Selector & Action buttons */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold">Qty:</span>
                <div className="flex items-center rounded-lg border border-gold-dark/50 bg-white">
                  <button
                    type="button"
                    className="h-9 w-9 text-lg font-bold hover:bg-gold/10"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{qty}</span>
                  <button
                    type="button"
                    className="h-9 w-9 text-lg font-bold hover:bg-gold/10"
                    onClick={() => setQty(Math.min(10, qty + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={!product.stock}
                  onClick={handleAddToCart}
                  className={`${btnP} flex-1`}
                >
                  {added ? '✓ Added to Cart' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  disabled={!product.stock}
                  onClick={handleBuyNow}
                  className={`${btnO} flex-1`}
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={() => toggleWish(product.id)}
                  aria-label="Wishlist"
                  className="grid h-11 w-11 place-items-center rounded-lg border border-primary text-xl text-primary hover:bg-primary/10 transition-colors"
                >
                  {isWish ? '♥' : '♡'}
                </button>
              </div>

              <div className="text-center pt-1">
                <Link
                  to={`/product/${product.id}`}
                  onClick={onClose}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View Full Product Details →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

