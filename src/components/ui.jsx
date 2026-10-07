import {useState,useEffect} from 'react'
import {Link} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr} from '../data/products'
import {SHOP} from '../config/shop'
export const btn='inline-flex min-h-11 items-center justify-center px-6 text-sm font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 '
export const btnP=btn+'bg-maroon text-ivory hover:bg-maroon-dark',btnO=btn+'border border-maroon text-maroon hover:bg-maroon hover:text-ivory',btnG=btn+'bg-gold text-ink hover:bg-gold-dark hover:text-ivory'
export function Img({src,alt,tone='#6b1523',className=''}){const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[src])
 return (bad||!src)?<div role="img" aria-label={alt} className={'weave flex items-end break-all p-2 text-[10px] text-ivory/70 '+className} style={{backgroundColor:tone}}>Add image: {src}</div>
 :<img src={src} alt={alt} loading="lazy" onError={()=>setBad(true)} className={className}/>}
export const Wrap=({children,className=''})=><div className={'mx-auto w-full max-w-7xl px-4 sm:px-6 '+className}>{children}</div>
export const Title=({children,sub})=><div className="mb-8 text-center"><h2 className="text-3xl sm:text-4xl">{children}</h2><div className="zari mx-auto mt-3 w-24"/>{sub&&<p className="mx-auto mt-3 max-w-xl text-ink/70">{sub}</p>}</div>
export function ProductCard({p}){const {wish,toggleWish}=useStore(),on=wish.includes(p.id)
 return <article className="group relative"><Link to={'/product/'+p.id} className="block">
  <div className="aspect-[3/4] overflow-hidden bg-ivory-dark"><Img src={p.images[0]} alt={p.name} tone={p.hex} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/></div>
  <h3 className="mt-3 text-lg leading-snug">{p.name}</h3><p className="text-sm text-ink/60">{p.collection}</p>
  <p className="font-bold text-maroon">{inr(p.price)}{!p.stock&&<span className="ml-2 text-xs font-normal text-ink/60">Out of stock</span>}</p></Link>
  <button onClick={()=>toggleWish(p.id)} aria-pressed={on} aria-label={(on?'Remove ':'Add ')+p.name+(on?' from':' to')+' wishlist'} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-ivory/90 text-xl text-maroon shadow">{on?'♥':'♡'}</button></article>}
export const Grid=({items})=><div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{items.map(p=><ProductCard key={p.id} p={p}/>)}</div>
export const Field=({label,id,error,area,...r})=>{const P=area?'textarea':'input';return <div><label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
 <P id={id} name={id} aria-invalid={!!error} aria-describedby={error?id+'-e':undefined} rows={area?4:undefined} className="min-h-11 w-full border border-gold-dark/50 bg-white px-3 py-2" {...r}/>
 {error&&<p id={id+'-e'} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}</div>}
export const RULES={name:v=>v.trim().length>=2||'Enter your full name.',email:v=>/^\S+@\S+\.\S+$/.test(v)||'Enter a valid email address.',phone:v=>/^[6-9]\d{9}$/.test(v.replace(/[\s-]/g,''))||'Enter a 10-digit Indian mobile number.',address:v=>v.trim().length>=10||'Enter your full delivery address, including PIN code.',message:v=>v.trim().length>=10||'Write at least 10 characters.'}
export const validate=(vals,keys)=>Object.fromEntries(keys.map(k=>[k,RULES[k](vals[k]||'')]).filter(([,r])=>r!==true))
export const WhatsApp=({text,label='Enquire on WhatsApp'})=>{const number=String(SHOP.whatsapp||'').replace(/\D/g,'')
 return number.length>=8&&number.length<=15?<a className={btnO} target="_blank" rel="noreferrer" href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}>{label}</a>
  :<button className={btnO} disabled title="Add a WhatsApp number with country code in src/config/shop.js">{label} (not configured)</button>}
