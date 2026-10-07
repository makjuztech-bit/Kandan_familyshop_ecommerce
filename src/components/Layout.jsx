import {useState,useEffect} from 'react'
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom'
import {useStore} from '../context/Store'
import {SHOP} from '../config/shop'
import {Wrap} from './ui'
import {useCatalog} from '../data/products'
import { useAuthStatus } from '../data/auth'
import {useTheme} from '../context/Theme'

const nav=[['/','Home'],['/shop','Shop'],['/category/Soft%20Silk','Collections'],['/about','About'],['/contact','Contact'],['/account','Account']]

export default function Layout(){const cv=useCatalog(),{count,wish}=useStore(),auth=useAuthStatus(),{theme,toggleTheme}=useTheme(),[open,setOpen]=useState(false),[q,setQ]=useState(''),nv=useNavigate(),{pathname,hash}=useLocation()
 useEffect(()=>{setOpen(false);if(hash){setTimeout(()=>document.querySelector(hash)?.scrollIntoView(),50)}else window.scrollTo(0,0)},[pathname,hash])
 const go=e=>{e.preventDefault();nv('/shop?q='+encodeURIComponent(q.trim()))}
 const ic='relative grid h-11 min-w-11 place-items-center px-2 text-sm font-bold text-maroon'
 return <>
 <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
 <p className="bg-maroon-dark px-4 py-2 text-center text-xs text-ivory sm:text-sm">Discover silk sarees for weddings, festivals, and everyday celebrations.</p>
 <header className="sticky top-0 z-30 border-b border-gold/40 bg-ivory/95 backdrop-blur"><Wrap className="flex items-center justify-between gap-2 py-2">
  <Link to="/" className="font-serif text-xl font-bold text-maroon sm:text-2xl">Kandan Family Shop</Link>
  <nav aria-label="Main" className="hidden gap-6 md:flex">{nav.map(([t,l])=><NavLink key={l} to={t} end={t==='/' ? true : undefined} className="py-2 text-sm font-bold hover:text-maroon">{l}</NavLink>)}</nav>
  <div className="flex items-center"><form onSubmit={go} role="search" className="hidden lg:block"><label className="sr-only" htmlFor="hs">Search sarees</label><input id="hs" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sarees" className="h-10 w-44 border border-gold-dark/50 bg-white px-3 text-sm"/></form>
   <button type="button" className={ic} onClick={toggleTheme} aria-label={`Switch to ${theme==='light'?'dark':'light'} theme`} title={`Switch to ${theme==='light'?'dark':'light'} theme`}>{theme==='light'?'Dark':'Light'}</button>
   <Link to="/wishlist" className={ic} aria-label={`Wishlist, ${wish.length} items`}>♡ {wish.length>0&&<span>{wish.length}</span>}</Link>
   <Link to="/cart" className={ic} aria-label={`Cart, ${count} items`}>Cart <span className="ml-1 rounded-full bg-maroon px-1.5 text-xs text-ivory">{count}</span></Link>
   <Link to={auth?.loggedIn ? '/account' : '/login'} className={ic}>{auth?.loggedIn ? 'Account' : 'Login'}</Link>
   <button className={ic+' md:hidden'} aria-expanded={open} aria-label="Menu" onClick={()=>setOpen(!open)}>{open?'✕':'☰'}</button></div></Wrap>
  {open&&<div className="border-t border-gold/40 bg-ivory p-4 md:hidden"><form onSubmit={go} role="search" className="mb-3 flex"><label className="sr-only" htmlFor="ms">Search sarees</label><input id="ms" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sarees" className="min-h-11 flex-1 border border-gold-dark/50 bg-white px-3"/><button className="min-h-11 bg-maroon px-4 text-ivory">Search</button></form>
   {nav.map(([t,l])=><Link key={l} to={t} className="block min-h-11 py-3 font-bold">{l}</Link>)}</div>}
 </header>
 <main id="main"><Outlet key={cv}/></main>
 <footer className="weave mt-20 bg-maroon-dark text-ivory/90"><div className="zari"/><Wrap className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
  <div><p className="font-serif text-2xl text-ivory">{SHOP.name}</p><p className="mt-2 text-sm">Silk sarees with personal shopping assistance. This site is a frontend demo with sample products.</p></div>
  <div><p className="font-bold text-gold">Explore</p>{nav.map(([t,l])=><Link key={l} to={t} className="block py-1.5 text-sm hover:text-gold">{l}</Link>)}</div>
  <div><p className="font-bold text-gold">Visit</p><p className="mt-1 text-sm">{SHOP.address}</p>{SHOP.phones.map(phone=><p key={phone} className="text-sm"><a href={'tel:'+phone}>{phone}</a></p>)}<p className="text-sm"><a href={'mailto:'+SHOP.email}>{SHOP.email}</a></p>
   {Object.entries(SHOP.social).filter(([,u])=>u).map(([n,u])=><a key={n} href={u} target="_blank" rel="noreferrer" className="mr-3 text-sm underline">{n}</a>)}</div>
  <div><p className="font-bold text-gold">Demo policies</p>{['shipping','returns','privacy','terms'].map(s=><Link key={s} to={'/policy/'+s} className="block py-1.5 text-sm capitalize hover:text-gold">{s}</Link>)}</div>
 </Wrap><p className="border-t border-ivory/20 py-4 text-center text-xs">© {new Date().getFullYear()} {SHOP.name} · Demo website · Sample catalogue, no real orders or payments</p></footer></>}
