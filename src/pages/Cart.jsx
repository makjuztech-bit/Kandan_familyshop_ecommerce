import {Link} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr,byId} from '../data/products'
import {Img,Wrap,Grid,btnP,btnO} from '../components/ui'
const Empty=({t,s})=><div className="border border-gold/50 bg-white p-10 text-center"><h2 className="text-2xl">{t}</h2><p className="mt-2 text-ink/70">{s}</p><Link to="/shop" className={btnP+' mt-4'}>Browse sarees</Link></div>
export function Cart(){const {lines,total,setQty,remove}=useStore()
 return <Wrap className="py-10"><h1 className="mb-6 text-4xl">Your Cart</h1>{!lines.length?<Empty t="Your cart is empty" s="Add a saree to begin."/>:
 <div className="grid gap-8 lg:grid-cols-[1fr_320px]"><ul className="divide-y divide-gold/40">{lines.map(l=><li key={l.id} className="flex gap-4 py-4"><Link to={'/product/'+l.id} className="h-28 w-20 shrink-0 overflow-hidden bg-ivory-dark"><Img src={l.images[0]} alt={l.name} tone={l.hex} className="h-full w-full object-cover"/></Link>
  <div className="flex-1"><Link to={'/product/'+l.id} className="font-serif text-lg">{l.name}</Link><p className="text-sm">{inr(l.price)} each</p>
   <div className="mt-2 flex flex-wrap items-center gap-3"><div className="flex items-center border border-gold-dark/50 bg-white"><button className="h-11 w-11" aria-label={'Decrease quantity of '+l.name} onClick={()=>setQty(l.id,l.q-1)}>−</button><span className="w-8 text-center">{l.q}</span><button className="h-11 w-11" aria-label={'Increase quantity of '+l.name} onClick={()=>setQty(l.id,l.q+1)}>+</button></div><button className="min-h-11 text-sm underline" onClick={()=>remove(l.id)}>Remove</button></div></div><p className="font-bold">{inr(l.price*l.q)}</p></li>)}</ul>
  <aside className="h-fit border border-gold/50 bg-white p-5"><h2 className="text-2xl">Order summary</h2><p className="mt-3 flex justify-between"><span>Subtotal</span><b>{inr(total)}</b></p><p className="flex justify-between text-sm"><span>Delivery</span><span>Free (demo)</span></p><p className="mt-3 flex justify-between border-t border-gold/40 pt-3 text-lg"><span>Total</span><b>{inr(total)}</b></p><Link to="/checkout" className={btnP+' mt-4 w-full'}>Proceed to demo checkout</Link></aside></div>}</Wrap>}
export function Wishlist(){const {wish,add,toggleWish}=useStore(),items=wish.map(id=>byId[id])
 return <Wrap className="py-10"><h1 className="mb-6 text-4xl">Your Wishlist</h1>{!items.length?<Empty t="Your wishlist is empty" s="Tap the heart on any saree to save it here."/>:
 <div className="grid grid-cols-2 gap-x-3 gap-y-8 lg:grid-cols-4">{items.map(p=><div key={p.id}><Grid items={[p]}/><button className={btnO+' mt-2 w-full'} disabled={!p.stock} onClick={()=>{add(p.id);toggleWish(p.id)}}>{p.stock?'Move to cart':'Out of stock'}</button></div>)}</div>}</Wrap>}
