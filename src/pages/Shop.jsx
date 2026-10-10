import {useState} from 'react'
import {Link, useParams, useSearchParams} from 'react-router-dom'
import {products,COLLECTIONS,HEX,inr} from '../data/products'
import {Wrap,Grid,btnP,btnO} from '../components/ui'
import {ReviewSummary} from '../components/Rating'
const sel='min-h-11 w-full border border-gold-dark/50 bg-white px-3',lab='mb-1 block text-sm font-bold'

export function CategoryPage(){
 const {category}=useParams(),label=decodeURIComponent(category||'').replace(/-/g,' '),list=products.filter(product=>product.collection===label)
 return <Wrap className="py-10"><div className="mb-8 flex items-end justify-between gap-3"><div><p className="text-sm uppercase tracking-[0.2em] text-primary">Collection</p><h1 className="text-4xl">{label}</h1></div><Link to="/shop" className={btnO}>Browse all</Link></div>{list.length===0?<div className="rounded-2xl border border-gold/40 bg-white p-10 text-center text-ink/70">No products found in this collection.</div>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{list.map(product=><div key={product.id} className="rounded-2xl border border-gold/40 bg-white p-3"><Link to={'/product/'+product.id}><div className="aspect-[3/4] overflow-hidden rounded-xl bg-ivory-dark"><img src={product.images[0]} alt={product.name} className="h-full w-full object-cover"/></div><h2 className="mt-3 text-lg">{product.name}</h2></Link><ReviewSummary productId={product.id}/><div className="mt-2 flex items-center justify-between gap-3"><span className="font-bold text-primary">{inr(product.price)}</span><Link to={'/product/'+product.id} className={btnP}>View</Link></div></div>)}</div>}</Wrap>
}

export default function Shop(){const [sp,setSp]=useSearchParams(),[drawer,setDrawer]=useState(false),g=k=>sp.get(k)||''
 const f={q:g('q'),collection:g('collection'),colour:g('colour'),max:+g('max')||50000,stock:g('stock')==='1',sort:g('sort')||'name'}
 const set=(k,v)=>{const n=new URLSearchParams(sp);(v===''||v===false||(k==='max'&&+v>=50000))?n.delete(k):n.set(k,v===true?'1':v);setSp(n,{replace:true})}
 const list=products.filter(p=>(!f.q||p.name.toLowerCase().includes(f.q.toLowerCase()))&&(!f.collection||p.collection===f.collection)&&(!f.colour||p.colour===f.colour)&&p.price<=f.max&&(!f.stock||p.stock))
  .sort((a,b)=>f.sort==='low'?a.price-b.price:f.sort==='high'?b.price-a.price:a.name.localeCompare(b.name))
 const colours=Object.keys(HEX).filter(c=>products.some(p=>p.colour===c))
 const Filters=({x})=><div className="space-y-4"><div><label className={lab} htmlFor={x+'q'}>Search by name</label><input id={x+'q'} type="search" className={sel} value={f.q} onChange={e=>set('q',e.target.value)}/></div>
  <div><label className={lab} htmlFor={x+'c'}>Collection</label><select id={x+'c'} className={sel} value={f.collection} onChange={e=>set('collection',e.target.value)}><option value="">All</option>{COLLECTIONS.map(c=><option key={c}>{c}</option>)}</select></div>
  <div><label className={lab} htmlFor={x+'k'}>Colour</label><select id={x+'k'} className={sel} value={f.colour} onChange={e=>set('colour',e.target.value)}><option value="">All</option>{colours.map(c=><option key={c}>{c}</option>)}</select></div>
  <div><label className={lab} htmlFor={x+'p'}>Maximum price: ₹{f.max.toLocaleString('en-IN')}</label><input id={x+'p'} type="range" min="1500" max="50000" step="500" value={f.max} onChange={e=>set('max',e.target.value)} className="h-11 w-full accent-primary"/></div>
  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-primary" checked={f.stock} onChange={e=>set('stock',e.target.checked)}/>In stock only</label>
  <button className={btnO+' w-full'} onClick={()=>setSp({})}>Clear filters</button></div>
 return <Wrap className="py-10"><h1 className="text-4xl">Shop Sarees</h1><p className="mt-1 text-sm text-ink/60">Sample catalogue for demonstration. Products are not real stock.</p>
  <div className="mt-6 flex items-end justify-between gap-3"><button className={btnO+' lg:hidden'} onClick={()=>setDrawer(true)}>Filters</button><p aria-live="polite" className="hidden text-sm sm:block">{list.length} saree{list.length!==1&&'s'}</p>
   <div className="ml-auto"><label className="mr-2 text-sm font-bold" htmlFor="sort">Sort</label><select id="sort" className="min-h-11 border border-gold-dark/50 bg-white px-2" value={f.sort} onChange={e=>set('sort',e.target.value==='name'?'':e.target.value)}><option value="name">Name A–Z</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div></div>
  <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]"><aside className="hidden lg:block" aria-label="Filters"><Filters x="s"/></aside>
   <div>{list.length?<Grid items={list}/>:<div className="border border-gold/50 bg-white p-10 text-center"><h2 className="text-2xl">No sarees match your search</h2><p className="mt-2 text-ink/70">Try a different name, colour or price.</p><button className={btnP+' mt-4'} onClick={()=>setSp({})}>Clear filters</button></div>}</div></div>
  {drawer&&<div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters"><div className="absolute inset-0 bg-black/50" onClick={()=>setDrawer(false)}/><div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-ivory p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl">Filters</h2><button className="h-11 w-11 text-xl" aria-label="Close filters" onClick={()=>setDrawer(false)}>✕</button></div><Filters x="d"/><button className={btnP+' mt-4 w-full'} onClick={()=>setDrawer(false)}>Show {list.length} sarees</button></div></div>}</Wrap>}
