import {useState,useEffect} from 'react'
import {useParams,useNavigate,useLocation} from 'react-router-dom'
import {byId,products,inr} from '../data/products'
import {useStore} from '../context/Store'
import {Img,Wrap,Grid,btnP,btnO,WhatsApp} from '../components/ui'
import {NotFound} from './Info'
import {CustomerReviews} from '../components/Reviews'
import {ReviewSummary} from '../components/Rating'
export default function Product(){const {id}=useParams(),location=useLocation(),p=byId[id],{add,toggleWish,wish}=useStore(),nv=useNavigate(),[i,setI]=useState(0),[q,setQ]=useState(1),[ok,setOk]=useState(false)
 useEffect(()=>{setI(0);setQ(1);setOk(false)},[id])
 if(!p)return <NotFound/>
 const rel=products.filter(x=>x.collection===p.collection&&x.id!==p.id).slice(0,4),on=wish.includes(p.id)
 const rows=[['Collection',p.collection],['Colour',p.colour],['Fabric',p.fabric],['Zari',p.zari],['Blouse piece',p.blouse],['Care',p.care],['Availability',p.stock?'In stock (demo)':'Out of stock (demo)']]
 return <Wrap className="py-10"><div className="grid gap-8 md:grid-cols-2">
  <div><div className="aspect-[3/4] overflow-hidden bg-ivory-dark"><Img src={p.images[i]} alt={`${p.name}, view ${i+1}`} tone={p.hex} className="h-full w-full object-cover"/></div>
   <div className="mt-3 grid grid-cols-3 gap-3">{p.images.map((s,n)=><button key={s} onClick={()=>setI(n)} aria-label={'Show image '+(n+1)} aria-current={n===i} className={'aspect-square overflow-hidden border-2 '+(n===i?'border-maroon':'border-transparent')}><Img src={s} alt="" tone={p.hex} className="h-full w-full object-cover"/></button>)}</div></div>
  <div><h1 className="text-4xl">{p.name}</h1><p className="mt-2 text-3xl font-bold text-maroon">{inr(p.price)}</p><div className="mt-1"><ReviewSummary productId={p.id}/></div><p className="mt-1 text-sm text-ink/60">Sample product. Details are placeholders and not a verified silk certification.</p>
   <div className="mt-5 flex items-center gap-3"><span className="font-bold" id="ql">Quantity</span><div role="group" aria-labelledby="ql" className="flex items-center border border-gold-dark/50 bg-white"><button className="h-11 w-11" aria-label="Decrease quantity" onClick={()=>setQ(Math.max(1,q-1))}>−</button><output className="w-10 text-center" aria-live="polite">{q}</output><button className="h-11 w-11" aria-label="Increase quantity" onClick={()=>setQ(Math.min(10,q+1))}>+</button></div></div>
   <div className="mt-5 flex flex-wrap gap-3"><button className={btnP} disabled={!p.stock} onClick={()=>{add(p.id,q);setOk(true)}}>Add to Cart</button><button className={btnO} disabled={!p.stock} onClick={()=>{add(p.id,q);nv('/checkout')}}>Buy Now</button>
    <button className={btnO} aria-pressed={on} onClick={()=>toggleWish(p.id)}>{on?'♥ In wishlist':'♡ Wishlist'}</button><WhatsApp text={'Hello, I am interested in '+p.name+' ('+p.id+').'}/></div>
   <p role="status" className="mt-2 text-sm text-emerald">{ok&&'Added to cart.'}</p>
   <dl className="mt-6 divide-y divide-gold/40 border-y border-gold/40">{rows.map(([k,v])=><div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-3 text-sm"><dt className="font-bold">{k}</dt><dd>{v}</dd></div>)}</dl></div></div>
  <CustomerReviews productId={p.id} productName={p.name} openOnLoad={new URLSearchParams(location.search).get('review')==='1'}/>
  {rel.length>0&&<section className="mt-16"><h2 className="mb-6 text-3xl">You may also like</h2><Grid items={rel}/></section>}</Wrap>}
