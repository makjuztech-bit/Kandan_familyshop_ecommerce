import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { byId, products, inr } from '../data/products'
import { useStore } from '../context/Store'
import { Img, Wrap, Grid, btnP, btnO, WhatsApp } from '../components/ui'
import { NotFound } from './Info'
import { CustomerReviews } from '../components/Reviews'
import { ReviewSummary } from '../components/Rating'

export default function Product() {
  const { id } = useParams()
  const location = useLocation()
  const p = byId[id]
  const { add, toggleWish, wish } = useStore()
  const nv = useNavigate()

  const [activeImgIndex, setActiveImgIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [addedToast, setAddedToast] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: 'center center' })
  const [isZooming, setIsZooming] = useState(false)

  // Reset state on route change
  useEffect(() => {
    setActiveImgIndex(0)
    setQty(1)
    setAddedToast(false)
    setLightboxOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [id])

  // Keyboard navigation for image gallery
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxOpen) {
        if (e.key === 'Escape') setLightboxOpen(false)
        if (e.key === 'ArrowRight') nextImage()
        if (e.key === 'ArrowLeft') prevImage()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, activeImgIndex])

  if (!p) return <NotFound />

  const images = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : [`/images/products/${p.id}-1.jpg`]

  const rel = products
    .filter((x) => x.collection === p.collection && x.id !== p.id)
    .slice(0, 4)

  const isWishlisted = wish.includes(p.id)
  const originalPrice = Number(p.originalPrice || p.price)
  const price = Number(p.price)
  const hasDiscount = originalPrice > price
  const discountPct = p.discount || (hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0)
  const pointsToEarn = Math.floor((price * qty) / 1000)

  const nextImage = () => {
    setActiveImgIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - left) / width) * 100
    const y = ((e.clientY - top) / height) * 100
    setZoomStyle({ transformOrigin: `${x}% ${y}%` })
  }

  const handleAddToCart = () => {
    if (!p.stock) return
    add(p.id, qty)
    setAddedToast(true)
    setTimeout(() => setAddedToast(false), 3000)
  }

  const handleBuyNow = () => {
    if (!p.stock) return
    add(p.id, qty)
    nv('/checkout')
  }

  const specRows = [
    { label: 'Collection', value: p.collection },
    { label: 'SKU Code', value: p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}` },
    { label: 'Primary Colour', value: p.colour },
    { label: 'Fabric Quality', value: p.fabric || 'Pure Mulberry Silk' },
    { label: 'Zari / Weave', value: p.zari || 'Pure Traditional Gold Zari' },
    { label: 'Length / Dimensions', value: p.length || 'Silk Saree: 5.5 m | Blouse: 0.8 m' },
    { label: 'Blouse Piece', value: p.blouse || 'Contrast unstitched blouse piece included' },
    { label: 'Care Instructions', value: p.care || 'Dry clean only. Store wrapped in muslin cloth.' },
    { label: 'Authenticity', value: '100% Handcrafted by Master Weavers · Pure Silk Certified' },
  ]

  return (
    <div className="bg-ivory-dark/20 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-gold/30 bg-white/70 py-3 text-xs text-ink/70">
        <Wrap className="flex flex-wrap items-center gap-2">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary transition-colors">Shop</Link>
          <span>/</span>
          <Link to={`/category/${encodeURIComponent(p.collection)}`} className="hover:text-primary transition-colors">
            {p.collection}
          </Link>
          <span>/</span>
          <span className="font-semibold text-primary truncate max-w-[200px] sm:max-w-xs">{p.name}</span>
        </Wrap>
      </div>

      <Wrap className="py-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          {/* ── Left Column: Interactive Product Gallery ── */}
          <div className="lg:col-span-7 space-y-4">
            {/* Main Image Container */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-gold/40 bg-white shadow-md">
              <div
                className="group relative aspect-[3/4] cursor-crosshair overflow-hidden bg-ivory-dark"
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onClick={() => setLightboxOpen(true)}
                title="Click to view full screen"
              >
                <div
                  className={`h-full w-full transition-transform duration-200 ease-out ${
                    isZooming ? 'scale-[1.8]' : 'scale-100'
                  }`}
                  style={zoomStyle}
                >
                  <Img
                    src={images[activeImgIndex] || images[0]}
                    alt={`${p.name} - view ${activeImgIndex + 1}`}
                    tone={p.hex}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Badges on Main Image */}
                <div className="absolute left-3 top-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                  {hasDiscount && (
                    <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow">
                      {discountPct}% OFF
                    </span>
                  )}
                  {p.best && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-ivory shadow">
                      ★ Bestseller
                    </span>
                  )}
                  {p.isNew && (
                    <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-primary shadow">
                      ✦ New Arrival
                    </span>
                  )}
                </div>

                {/* Zoom Hint Overlay */}
                <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm pointer-events-none flex items-center gap-1.5">
                  <span>🔍</span> Click or Hover to Zoom
                </div>
              </div>

              {/* Prev / Next Floating Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      prevImage()
                    }}
                    aria-label="Previous product image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary shadow-md hover:bg-primary hover:text-white transition-all z-10"
                  >
                    ❮
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      nextImage()
                    }}
                    aria-label="Next product image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary shadow-md hover:bg-primary hover:text-white transition-all z-10"
                  >
                    ❯
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 pt-1">
                {images.map((imgUrl, idx) => {
                  const isActive = idx === activeImgIndex
                  return (
                    <button
                      key={imgUrl + idx}
                      type="button"
                      onClick={() => setActiveImgIndex(idx)}
                      aria-label={`View photo ${idx + 1} of ${p.name}`}
                      aria-current={isActive}
                      className={`group relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-primary shadow-md ring-2 ring-gold/60 scale-[1.02]'
                          : 'border-gold/30 hover:border-gold opacity-75 hover:opacity-100'
                      }`}
                    >
                      <Img
                        src={imgUrl}
                        alt=""
                        tone={p.hex}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="sr-only">Thumbnail {idx + 1}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quality & Craftsmanship Guarantee Callout */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-gold/40 bg-white p-4 text-center text-xs shadow-sm">
              <div className="space-y-1">
                <span className="text-xl">✨</span>
                <p className="font-bold text-primary">100% Pure Silk</p>
                <p className="text-ink/60 text-[10px]">Authentic mulberry silk guarantee</p>
              </div>
              <div className="space-y-1 border-x border-gold/30 px-2">
                <span className="text-xl">🏛️</span>
                <p className="font-bold text-primary">Handcrafted</p>
                <p className="text-ink/60 text-[10px]">Woven on traditional pit-looms</p>
              </div>
              <div className="space-y-1">
                <span className="text-xl">🚚</span>
                <p className="font-bold text-primary">Free Express Delivery</p>
                <p className="text-ink/60 text-[10px]">Insured packaging across India</p>
              </div>
            </div>
          </div>

          {/* ── Right Column: Product Info & Purchase Actions ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {p.collection}
                </span>
                <span className="font-mono text-xs text-ink/50">
                  SKU: {p.sku || `KFS-${p.id.replace('kfs-', '').toUpperCase()}`}
                </span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl text-primary font-bold leading-tight">
                {p.name}
              </h1>

              {/* Reviews Summary */}
              <div className="flex items-center gap-3 pt-1">
                <ReviewSummary productId={p.id} />
                <a href="#reviews-section" className="text-xs text-gold-dark hover:underline font-semibold">
                  See Customer Reviews ↓
                </a>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="rounded-2xl border border-gold/40 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-primary">
                  {inr(price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-lg text-ink/40 line-through">
                      {inr(originalPrice)}
                    </span>
                    <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      Save {inr(originalPrice - price)} ({discountPct}% OFF)
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-ink/60">
                Inclusive of all taxes. Free shipping on all domestic orders.
              </p>

              {/* Loyalty Reward Preview */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💎</span>
                  <div>
                    <span className="font-bold text-emerald-900">Loyalty Rewards</span>
                    <p className="text-emerald-700">
                      Earn <strong>{pointsToEarn} points</strong> (worth {inr(pointsToEarn)})
                    </p>
                  </div>
                </div>
                <span className="rounded bg-emerald-200 px-2 py-0.5 font-bold text-emerald-900 text-[11px]">
                  Automatic Credit
                </span>
              </div>
            </div>

            {/* Stock Availability */}
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`inline-block h-3 w-3 rounded-full ${p.stock ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={p.stock ? 'text-emerald-800' : 'text-red-700'}>
                {p.stock
                  ? `In Stock — Ready for dispatch (${p.stockCount || 8} units available)`
                  : 'Currently Out of Stock'}
              </span>
            </div>

            {/* Quantity Selector & Add to Cart */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-4">
                <label htmlFor="qty-select" className="text-sm font-bold text-ink/80">
                  Quantity:
                </label>
                <div className="flex items-center rounded-xl border border-gold-dark/50 bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    disabled={qty <= 1 || !p.stock}
                    className="h-11 w-11 text-lg font-bold hover:bg-ivory transition-colors disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <output id="qty-select" className="w-12 text-center font-bold text-sm" aria-live="polite">
                    {qty}
                  </output>
                  <button
                    type="button"
                    onClick={() => setQty(Math.min(10, qty + 1))}
                    disabled={qty >= 10 || !p.stock}
                    className="h-11 w-11 text-lg font-bold hover:bg-ivory transition-colors disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Main Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!p.stock}
                  className={btnP + ' py-4 text-base font-bold shadow-md hover:shadow-lg transition-all'}
                >
                  🛒 Add to Cart
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!p.stock}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gold px-6 py-4 text-base font-bold text-primary hover:bg-gold-dark hover:text-ivory shadow-md transition-all disabled:opacity-50"
                >
                  ⚡ Buy Now
                </button>
              </div>

              {/* Wishlist & WhatsApp Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => toggleWish(p.id)}
                  aria-pressed={isWishlisted}
                  className={btnO + ' flex-1 min-w-[140px] text-xs py-2.5'}
                >
                  <span className="mr-1.5">{isWishlisted ? '♥' : '♡'}</span>
                  {isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
                </button>
                <WhatsApp
                  label="Enquire on WhatsApp"
                  text={`Hello Sri Kandan Family Shop, I would like to enquire about ${p.name} (SKU: ${p.sku || p.id}). Is this available?`}
                />
              </div>

              {addedToast && (
                <div role="status" className="rounded-lg bg-emerald-100 p-3 text-center text-sm font-bold text-emerald-800 border border-emerald-300 animate-fade-in">
                  ✓ Successfully added {qty} item{qty > 1 ? 's' : ''} to your Cart!
                </div>
              )}
            </div>

            {/* Description & Story */}
            <div className="rounded-2xl border border-gold/40 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-serif text-xl font-bold text-primary border-b border-gold/20 pb-2">
                Product Story & Details
              </h3>
              <p className="text-sm text-ink/80 leading-relaxed">
                {p.description ||
                  `Handcrafted heirloom ${p.collection} from Sri Kandan Family Shop. Woven using authentic mulberry silk and rich zari, reflecting centuries-old handloom weaving traditions. Ideal for grand weddings, festive celebrations, and heirloom keepsakes.`}
              </p>

              {/* Specifications Table */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-dark mb-3">
                  Specifications & Fabric Details
                </h4>
                <dl className="divide-y divide-gold/20 text-xs">
                  {specRows.map((spec) => (
                    <div key={spec.label} className="grid grid-cols-[130px_1fr] gap-3 py-2.5">
                      <dt className="font-bold text-ink/70">{spec.label}</dt>
                      <dd className="font-medium text-ink">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fullscreen Lightbox Modal ── */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
            onClick={() => setLightboxOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="High resolution image view"
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-6 top-6 z-50 grid h-12 w-12 place-items-center rounded-full bg-white/20 text-2xl font-bold text-white hover:bg-white hover:text-black transition-colors"
              aria-label="Close fullscreen view"
            >
              ✕
            </button>

            <div className="relative max-h-[90vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <img
                src={images[activeImgIndex] || images[0]}
                alt={p.name}
                className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain shadow-2xl mx-auto"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-black/50 text-2xl text-white hover:bg-gold hover:text-primary transition-colors"
                    aria-label="Previous image"
                  >
                    ❮
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-black/50 text-2xl text-white hover:bg-gold hover:text-primary transition-colors"
                    aria-label="Next image"
                  >
                    ❯
                  </button>
                  <div className="mt-3 text-center text-xs text-white/70">
                    Image {activeImgIndex + 1} of {images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Customer Reviews & Ratings Section ── */}
        <section id="reviews-section" className="mt-16 pt-8 border-t border-gold/40">
          <CustomerReviews
            productId={p.id}
            productName={p.name}
            openOnLoad={new URLSearchParams(location.search).get('review') === '1'}
          />
        </section>

        {/* ── Related Products from Same Collection ── */}
        {rel.length > 0 && (
          <section className="mt-20 border-t border-gold/40 pt-12">
            <div className="text-center mb-8">
              <span className="text-xs uppercase tracking-widest text-gold-dark font-bold">More from this collection</span>
              <h2 className="text-3xl font-serif text-primary mt-1">You May Also Cherish</h2>
              <div className="zari mx-auto mt-3 w-20" />
            </div>
            <Grid items={rel} />
          </section>
        )}
      </Wrap>
    </div>
  )
}
