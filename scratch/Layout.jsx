import {useState,useEffect} from 'react'
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom'
import {useStore} from '../context/Store'
import {SHOP} from '../config/shop'
import {Wrap} from './ui'
import {useCatalog} from '../data/products'
import { useAuthStatus } from '../data/auth'
import BackgroundModal from './BackgroundModal'
import { LoyaltyHeaderBadge } from './LoyaltyWidget'

const nav=[
  ['/','Home'],
  ['/shop','Shop'],
  ['/category/Soft%20Silk','Collections'],
  ['/reviews','Reviews'],
  ['/about','About'],
  ['/contact','Contact'],
  ['/account','Account'],
]

export default function Layout(){
  const cv=useCatalog(),{count,wish}=useStore(),auth=useAuthStatus()
  const [open,setOpen]=useState(false),[q,setQ]=useState(''),[showBgModal,setShowBgModal]=useState(false)
  const nv=useNavigate(),{pathname,hash}=useLocation()

  useEffect(()=>{setOpen(false);if(hash){setTimeout(()=>document.querySelector(hash)?.scrollIntoView(),50)}else window.scrollTo(0,0)},[pathname,hash])
  const go=e=>{e.preventDefault();nv('/shop?q='+encodeURIComponent(q.trim()))}
  const ic='relative grid h-11 min-w-11 place-items-center px-2 text-sm font-bold text-ivory hover:text-gold transition-colors'

  return <>
  <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
  <p className="bg-primary-dark px-4 py-2 text-center text-xs text-ivory sm:text-sm border-b border-gold/40">Discover silk sarees for weddings, festivals, and everyday celebrations.</p>
  <header className="sticky top-0 z-30 border-b border-gold/50 bg-primary/95 backdrop-blur text-ivory">
    <Wrap className="flex items-center justify-between gap-2 py-2">
      <Link to="/" className="flex items-center gap-4">
        <div className="overflow-hidden rounded-full border-2 border-gold/60 bg-white shadow-sm flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20">
          <img src="/images/logo.jpg" alt="Sri Kandan Family Shop" className="h-full w-full object-cover" />
        </div>
        <span className="font-serif text-xl font-bold uppercase text-ivory sm:text-2xl hidden lg:block tracking-wide">Sri Kandan Family Shop</span>
      </Link>
      <nav aria-label="Main" className="hidden gap-5 md:flex ml-auto mr-4">
        {nav.map(([t,l])=><NavLink key={l} to={t} end={t==='/' ? true : undefined} className="py-2 text-sm font-bold hover:text-gold transition-colors">{l}</NavLink>)}
        {auth?.loggedIn && <>
          <NavLink to="/orders" className="py-2 text-sm font-bold hover:text-gold transition-colors">Orders</NavLink>
          <NavLink to="/delivery" className="flex items-center gap-1 py-2 text-sm font-bold hover:text-gold transition-colors">
            <span>🚚</span> Delivery
          </NavLink>
        </>}
      </nav>
      <div className="flex items-center">
        <form onSubmit={go} role="search" className="hidden lg:block mr-2">
          <label className="sr-only" htmlFor="hs">Search sarees</label>
          <input id="hs" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sarees" className="h-10 w-44 rounded-full border border-gold/60 bg-white px-4 text-sm text-ink placeholder:text-ink/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"/>
        </form>
        <Link to="/wishlist" className={ic} aria-label={`Wishlist, ${wish.length} items`}>♡ {wish.length>0&&<span>{wish.length}</span>}</Link>
        <LoyaltyHeaderBadge email={auth?.email || 'hello@kandanfamilyshop.com'} />
        <Link to="/cart" className={ic} aria-label={`Cart, ${count} items`}>Cart <span className="ml-1 rounded-full bg-gold px-1.5 text-xs text-primary">{count}</span></Link>
        <Link to={auth?.loggedIn ? '/account' : '/login'} className={ic}>{auth?.loggedIn ? 'Account' : 'Login'}</Link>
        <button className={ic+' md:hidden text-gold'} aria-expanded={open} aria-label="Menu" onClick={()=>setOpen(!open)}>{open?'✕':'☰'}</button>
      </div>
    </Wrap>
    {open&&<div className="border-t border-gold/40 bg-primary-dark p-4 md:hidden text-ivory">
      <form onSubmit={go} role="search" className="mb-3 flex">
        <label className="sr-only" htmlFor="ms">Search sarees</label>
        <input id="ms" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sarees" className="min-h-11 flex-1 border border-gold-dark/50 bg-white px-3 text-ink"/>
        <button className="min-h-11 bg-gold px-4 text-primary font-bold">Search</button>
      </form>
      {nav.map(([t,l])=><Link key={l} to={t} className="block min-h-11 py-3 font-bold text-ivory hover:text-gold">{l}</Link>)}
      {auth?.loggedIn && <>
        <Link to="/orders" className="block min-h-11 py-3 font-bold text-ivory hover:text-gold">🛒 Orders</Link>
        <Link to="/delivery" className="block min-h-11 py-3 font-bold text-ivory hover:text-gold">🚚 Delivery</Link>
      </>}
    </div>}
  </header>
  <main id="main"><Outlet key={cv}/></main>
  <footer className="weave mt-20 bg-primary-dark text-ivory/90">
    <div className="zari"/>
    <Wrap className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="font-serif text-2xl text-ivory">{SHOP.name}</p>
        <p className="mt-2 text-sm">Silk sarees with personal shopping assistance. This site is a frontend demo with sample products.</p>
      </div>
      <div>
        <p className="font-bold text-gold">Explore</p>
        {nav.map(([t,l])=><Link key={l} to={t} className="block py-1.5 text-sm hover:text-gold">{l}</Link>)}
        <p className="mt-3 font-bold text-gold">My Account</p>
        <Link to="/orders" className="block py-1.5 text-sm hover:text-gold">🛒 My Orders</Link>
        <Link to="/delivery" className="block py-1.5 text-sm hover:text-gold">🚚 Delivery Tracking</Link>
        <button
          type="button"
          onClick={() => setShowBgModal(true)}
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/25 hover:text-ivory transition-colors"
        >
          <span>🎨</span> Website Background
        </button>
      </div>
      <div>
        <p className="font-bold text-gold">Visit us</p>
        <div className="mt-2 flex items-start gap-2 text-sm"><span aria-hidden="true">📍</span><p className="whitespace-pre-line leading-relaxed">{SHOP.address}</p></div>
        {SHOP.phones.map(phone=><div key={phone} className="mt-1 flex items-center gap-2 text-sm"><span aria-hidden="true">📞</span><a href={'tel:'+phone} className="hover:text-gold">{phone}</a></div>)}
        <div className="mt-1 flex items-center gap-2 text-sm"><span aria-hidden="true">✉️</span><a href={'mailto:'+SHOP.email} className="break-all hover:text-gold">{SHOP.email}</a></div>
        {Object.entries(SHOP.social).filter(([,u])=>u).map(([n,u])=><a key={n} href={u} target="_blank" rel="noreferrer" className="mr-3 text-sm underline">{n}</a>)}
      </div>
      <div>
        <p className="font-bold text-gold">Policies</p>
        {['shipping','returns','privacy','terms'].map(s=><Link key={s} to={'/policy/'+s} className="block py-1.5 text-sm capitalize hover:text-gold">{s}</Link>)}
      </div>
    </Wrap>
    <p className="border-t border-ivory/20 py-4 text-center text-xs">© {new Date().getFullYear()} {SHOP.name} · Demo website · Sample catalogue, no real orders or payments</p>
  </footer>
  <BackgroundModal isOpen={showBgModal} onClose={() => setShowBgModal(false)} />
  </>
}


