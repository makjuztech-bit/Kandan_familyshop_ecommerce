import {useState,useEffect} from 'react'
import {Link} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr} from '../data/products'
import {SHOP} from '../config/shop'
import {ReviewSummary} from './Rating'
export const btn='inline-flex min-h-11 items-center justify-center px-6 text-sm font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 '
export const btnP=btn+'bg-primary text-ivory hover:bg-gold hover:text-primary border border-transparent hover:border-gold-dark',btnO=btn+'border-2 border-primary text-primary hover:border-gold hover:bg-gold hover:text-primary',btnG=btn+'bg-gold text-primary hover:bg-gold-dark hover:text-ivory'
export function Img({src,alt,tone='#6b1523',className=''}){
  const [currentSrc,setCurrentSrc]=useState(src)
  const [bad,setBad]=useState(false)
  useEffect(()=>{setCurrentSrc(src);setBad(false)},[src])

  const handleErr=()=>{
    if(currentSrc&&currentSrc.startsWith('/images/products/')){
      const match=currentSrc.match(/kfs-\d+-\d+/)
      const seedName=match?match[0]:'saree'
      setCurrentSrc(`https://picsum.photos/seed/${seedName}/400/533`)
    }else{
      setBad(true)
    }
  }

  return (bad||!currentSrc)?<div role="img" aria-label={alt} className={'weave flex items-end break-all p-2 text-[10px] text-ivory/70 '+className} style={{backgroundColor:tone}}>{alt||'Kandan Silk'}</div>
  :<img src={currentSrc} alt={alt} loading="lazy" onError={handleErr} className={className}/>
}
export const Wrap=({children,className=''})=><div className={'mx-auto w-full max-w-7xl px-4 sm:px-6 '+className}>{children}</div>
export const Title=({children,sub})=><div className="mb-8 text-center"><h2 className="text-3xl sm:text-4xl">{children}</h2><div className="zari mx-auto mt-3 w-24"/>{sub&&<p className="mx-auto mt-3 max-w-xl text-ink/70">{sub}</p>}</div>
import QuickViewModal from './QuickViewModal'

export function ProductCard({ p }) {
  const { wish, toggleWish, add } = useStore()
  const [quickView, setQuickView] = useState(false)
  const [added, setAdded] = useState(false)
  const on = wish.includes(p.id)

  const hasDiscount = p.originalPrice && p.originalPrice > p.price
  const discountPct = p.discount || (hasDiscount ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0)

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!p.stock) return
    add(p.id, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <>
      <article className="group relative flex flex-col rounded-2xl border border-gold/30 bg-white p-3 shadow-sm hover:border-primary/60 hover:shadow-lg transition-all duration-300">
        {/* Product Image & Badges */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark">
          <Link to={'/product/' + p.id} className="block h-full w-full">
            <Img
              src={p.images[0]}
              alt={p.name}
              tone={p.hex}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </Link>

          {/* Badges container */}
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5 pointer-events-none">
            {hasDiscount && (
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-ivory shadow-sm">
                {discountPct}% OFF
              </span>
            )}
            {p.best && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-ink shadow-sm">
                Bestseller
              </span>
            )}
            {p.isNew && !p.best && (
              <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                New
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={() => toggleWish(p.id)}
            aria-pressed={on}
            aria-label={(on ? 'Remove ' : 'Add ') + p.name + (on ? ' from' : ' to') + ' wishlist'}
            className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg text-primary shadow-md hover:bg-white hover:scale-110 transition-all z-10"
          >
            {on ? '♥' : '♡'}
          </button>

          {/* Quick View Button overlay */}
          <div className="absolute inset-x-2 bottom-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <button
              type="button"
              onClick={() => setQuickView(true)}
              className="w-full rounded-lg bg-ivory/95 py-2 text-xs font-bold text-primary backdrop-blur shadow-md hover:bg-primary hover:text-ivory transition-colors flex items-center justify-center gap-1.5"
            >
              <span>👁</span> Quick View
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-3 flex flex-1 flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{p.collection}</p>
            <Link to={'/product/' + p.id} className="mt-1 block hover:text-primary transition-colors">
              <h3 className="text-base font-serif font-bold leading-snug line-clamp-2 text-ink">{p.name}</h3>
            </Link>
            <div className="mt-1.5">
              <ReviewSummary productId={p.id} />
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gold/20">
            {/* Price row */}
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-serif font-bold text-gold-dark">{inr(p.price)}</span>
              {hasDiscount && (
                <span className="text-xs text-ink/50 line-through">{inr(p.originalPrice)}</span>
              )}
            </div>

            {/* Stock status */}
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={`font-semibold ${p.stock ? 'text-emerald-700' : 'text-red-600'}`}>
                {p.stock ? '● In stock' : '○ Out of stock'}
              </span>
              {p.colour && (
                <span className="flex items-center gap-1 text-ink/60">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: p.hex }} />
                  {p.colour}
                </span>
              )}
            </div>

            {/* Add to Cart button */}
            <button
              type="button"
              disabled={!p.stock}
              onClick={handleQuickAdd}
              className={`mt-3 w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-transparent ${
                added
                  ? 'bg-emerald-700 text-white'
                  : 'bg-primary text-ivory hover:bg-gold hover:text-primary hover:border-gold-dark disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed'
              }`}
            >
              {added ? (
                <>✓ Added to Cart</>
              ) : p.stock ? (
                <><span>🛒</span> Add to Cart</>
              ) : (
                'Out of Stock'
              )}
            </button>
          </div>
        </div>
      </article>

      {/* Quick View Modal */}
      {quickView && <QuickViewModal product={p} onClose={() => setQuickView(false)} />}
    </>
  )
}

export const Grid = ({ items }) => (
  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
    {items.map((p) => (
      <ProductCard key={p.id} p={p} />
    ))}
  </div>
)
export const Field=({label,id,error,area,...r})=>{const P=area?'textarea':'input';return <div><label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
 <P id={id} name={id} aria-invalid={!!error} aria-describedby={error?id+'-e':undefined} rows={area?4:undefined} className="min-h-11 w-full border border-gold-dark/50 bg-white px-3 py-2" {...r}/>
 {error&&<p id={id+'-e'} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}</div>}
export const RULES={name:v=>v.trim().length>=2||'Enter your full name.',email:v=>/^\S+@\S+\.\S+$/.test(v)||'Enter a valid email address.',phone:v=>/^[6-9]\d{9}$/.test(v.replace(/[\s-]/g,''))||'Enter a 10-digit Indian mobile number.',address:v=>v.trim().length>=10||'Enter your full delivery address, including PIN code.',message:v=>v.trim().length>=10||'Write at least 10 characters.'}
export const validate=(vals,keys)=>Object.fromEntries(keys.map(k=>[k,RULES[k](vals[k]||'')]).filter(([,r])=>r!==true))
export const WhatsApp=({text,label='Enquire on WhatsApp'})=>{const number=String(SHOP.whatsapp||'').replace(/\D/g,'')
 return number.length>=8&&number.length<=15?<a className={btnO} target="_blank" rel="noreferrer" href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}>{label}</a>
  :<button className={btnO} disabled title="Add a WhatsApp number with country code in src/config/shop.js">{label} (not configured)</button>}

