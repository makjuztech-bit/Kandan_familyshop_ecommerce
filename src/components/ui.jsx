import {useState,useEffect} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr} from '../data/products'
import {SHOP} from '../config/shop'
import {ReviewSummary} from './Rating'
export const btn='inline-flex min-h-11 items-center justify-center px-6 text-sm font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 '
export const btnP=btn+'bg-primary text-ivory hover:bg-gold hover:text-primary-dark transition-all border border-transparent hover:border-gold-dark',btnO=btn+'border border-primary text-primary hover:bg-primary hover:text-ivory',btnG=btn+'bg-gold text-ink hover:bg-gold-dark hover:text-ivory'
export function Img({src,alt,tone='#6b1523',className=''}){
  const [bad,setBad]=useState(false)
  useEffect(()=>setBad(false),[src])
  if(bad||!src){
    return <div role="img" aria-label={alt||'Sri Kandan Silk'} className={'flex items-center justify-center p-3 text-center text-xs font-semibold text-ivory/90 relative overflow-hidden '+className} style={{backgroundColor:tone||'#6b1523',backgroundImage:'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.2) 0%, transparent 75%)'}}>
      <div className="flex flex-col items-center gap-1 opacity-90">
        <span className="text-lg">✨</span>
        <span className="font-serif tracking-widest text-[10px] uppercase text-gold">Sri Kandan Silk</span>
        <span className="text-[9px] text-ivory/80 line-clamp-1 max-w-[90%]">{alt||'Boutique Collection'}</span>
      </div>
    </div>
  }
  return <img src={src} alt={alt||'Silk product'} loading="lazy" onError={()=>setBad(true)} className={className}/>
}
export const Wrap=({children,className=''})=><div className={'mx-auto w-full max-w-7xl px-4 sm:px-6 '+className}>{children}</div>
export const Title=({children,sub})=><div className="mb-8 text-center"><h2 className="text-3xl sm:text-4xl">{children}</h2><div className="zari mx-auto mt-3 w-24"/>{sub&&<p className="mx-auto mt-3 max-w-xl text-ink/70">{sub}</p>}</div>
export function ProductCard({p}){
  const {wish,toggleWish,add}=useStore(),on=wish.includes(p.id),nv=useNavigate()
  const imgSrc = p.images?.[0] || `/images/products/${p.id}-1.jpg`
  const hasDiscount = p.originalPrice && Number(p.originalPrice) > Number(p.price)
  const discountPct = p.discount || (hasDiscount ? Math.round(((Number(p.originalPrice) - Number(p.price)) / Number(p.originalPrice)) * 100) : 0)

  return (
    <article className="group relative flex flex-col h-full rounded-2xl bg-white border border-gold/30 p-3.5 shadow-sm hover:shadow-lg hover:border-gold/70 transition-all duration-300">
      <Link to={'/product/'+p.id} className="block flex-1">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark">
          <Img src={imgSrc} alt={p.name} tone={p.hex} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
          {hasDiscount && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
              {discountPct}% OFF
            </span>
          )}
        </div>
        <div className="pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-dark">{p.collection}</p>
          <h3 className="mt-1 text-base font-serif font-bold text-ink leading-snug line-clamp-2 group-hover:text-primary transition-colors">{p.name}</h3>
          <div className="mt-1.5"><ReviewSummary productId={p.id}/></div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary font-serif">{inr(p.price)}</span>
            {hasDiscount && (
              <span className="text-xs text-ink/40 line-through">{inr(p.originalPrice)}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={`font-semibold ${p.stock ? 'text-emerald-700' : 'text-red-600'}`}>
              {p.stock ? '✓ In Stock' : 'Out of stock'}
            </span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 text-[11px]">
              💎 +{Math.floor(p.price/1000)} pts
            </span>
          </div>
        </div>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-gold/20">
        <Link to={'/product/'+p.id} className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-ivory text-xs font-bold text-primary border border-primary/50 hover:bg-primary hover:text-ivory transition-colors">
          View Details
        </Link>
        <button onClick={(e)=>{e.preventDefault();if(p.stock){add(p.id,1);nv('/checkout')}}} disabled={!p.stock} className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-primary text-xs font-bold text-ivory hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm">
          Buy Now
        </button>
      </div>
      <button onClick={()=>toggleWish(p.id)} aria-pressed={on} aria-label={(on?'Remove ':'Add ')+p.name+(on?' from':' to')+' wishlist'} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg text-primary shadow hover:scale-110 transition-transform">
        {on?'♥':'♡'}
      </button>
    </article>
  )
}
export const Grid=({items})=><div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{items.map(p=><ProductCard key={p.id} p={p}/>)}</div>
export const Field=({label,id,error,area,...r})=>{const P=area?'textarea':'input';return <div><label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
 <P id={id} name={id} aria-invalid={!!error} aria-describedby={error?id+'-e':undefined} rows={area?4:undefined} className="min-h-11 w-full border border-gold-dark/50 bg-white px-3 py-2" {...r}/>
 {error&&<p id={id+'-e'} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}</div>}
export const RULES={name:v=>v.trim().length>=2||'Enter your full name.',email:v=>/^\S+@\S+\.\S+$/.test(v)||'Enter a valid email address.',phone:v=>/^[6-9]\d{9}$/.test(v.replace(/[\s-]/g,''))||'Enter a 10-digit Indian mobile number.',address:v=>v.trim().length>=10||'Enter your full delivery address, including PIN code.',message:v=>v.trim().length>=10||'Write at least 10 characters.'}
export const validate=(vals,keys)=>Object.fromEntries(keys.map(k=>[k,RULES[k](vals[k]||'')]).filter(([,r])=>r!==true))
export const WhatsApp=({text,label='Enquire on WhatsApp'})=>{const number=String(SHOP.whatsapp||'').replace(/\D/g,'')
 return number.length>=8&&number.length<=15?<a className={btnO} target="_blank" rel="noreferrer" href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}>{label}</a>
  :<button className={btnO} disabled title="Add a WhatsApp number with country code in src/config/shop.js">{label} (not configured)</button>}
