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
            <h2 id="qv-title" className="text-2xl font-serif sm:text-3xl font-bold text-ink">
              {product.name}
            </h2>

            {/* Price block */}
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-3xl font-bold text-primary">{inr(product.price)}</span>
            </div>

            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Authentic textile piece handcrafted with exceptional care and quality materials.
            </p>

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

