import {Link} from 'react-router-dom'
import {products,COLLECTIONS} from '../data/products'
import {IMG,SHOP} from '../config/shop'
import {Img,Wrap,Title,Grid,btn,btnG,btnO,WhatsApp} from '../components/ui'
export default function Home(){return <>
 <section className="relative isolate flex min-h-[80vh] items-center overflow-hidden bg-maroon-dark">
  <Img src={IMG.hero} alt="Silk sarees in a showroom" className="absolute inset-0 -z-20 h-full w-full object-cover"/>
  <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/25"/>
  <Wrap className="py-20 text-ivory"><p className="mb-3 text-gold">Tradition, Beautifully Woven</p>
   <h1 className="max-w-2xl text-5xl leading-tight text-ivory sm:text-6xl">Celebrate Every Occasion in Silk</h1>
   <p className="mt-4 max-w-xl text-lg text-ivory/90">Explore timeless sarees, rich colours, and intricate zari details at Kandan Family Shop.</p>
   <div className="mt-8 flex flex-wrap gap-3"><Link to="/shop" className={btnG}>Explore Collection</Link><Link to="/shop?collection=Bridal%20Collection" className={btn+'border border-ivory text-ivory hover:bg-ivory hover:text-maroon'}>Shop Bridal Sarees</Link></div></Wrap></section>
 <Wrap className="pt-16"><section id="collections" className="scroll-mt-24"><Title>Our Collections</Title>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{COLLECTIONS.map(c=><Link key={c} to={'/shop?collection='+encodeURIComponent(c)} className="group relative block aspect-[4/5] overflow-hidden bg-maroon-dark">
   <Img src={IMG.collections[c]} alt={c} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><span className="absolute bottom-3 left-3 right-3 font-serif text-xl text-ivory">{c}</span></Link>)}</div></section></Wrap>
 <Wrap className="pt-16"><Title sub="Sample catalogue for demonstration.">Bestsellers</Title><Grid items={products.filter(p=>p.best).slice(0,4)}/></Wrap>
 <section className="relative isolate mt-16 overflow-hidden bg-maroon-dark py-24 text-center"><Img src={IMG.banner} alt="Bridal saree with rich zari border" className="absolute inset-0 -z-20 h-full w-full object-cover"/><div className="absolute inset-0 -z-10 bg-black/55"/>
  <Wrap><h2 className="mx-auto max-w-2xl text-4xl text-ivory sm:text-5xl">For Moments That Become Memories</h2><Link to="/shop?collection=Bridal%20Collection" className={btnG+' mt-6'}>Shop Bridal Sarees</Link></Wrap></section>
 <Wrap className="pt-16"><Title>New Arrivals</Title><Grid items={products.filter(p=>p.isNew).slice(0,4)}/></Wrap>
 <Wrap className="grid items-center gap-8 pt-16 md:grid-cols-2"><div className="aspect-[4/3] overflow-hidden bg-ivory-dark"><Img src={IMG.about} alt="Draping a silk saree" className="h-full w-full object-cover"/></div>
  <div><h2 className="text-3xl">Sarees, chosen with you</h2><p className="mt-3 text-ink/80">At Kandan Family Shop, we help you find a saree for the occasion: colour, weave, border and budget. Visit us or message us, and we will gladly guide you.</p><Link to="/about" className={btnO+' mt-5'}>About the shop</Link></div></Wrap>
 <Wrap className="pt-16"><section className="border border-gold/50 bg-white p-6 sm:p-10"><h2 className="text-3xl">Visit the shop</h2>
  <dl className="mt-4 grid gap-3 sm:grid-cols-3"><div><dt className="font-bold">Address</dt><dd>{SHOP.address}</dd></div><div><dt className="font-bold">Phone</dt><dd className="flex flex-col">{SHOP.phones.map(phone=><a key={phone} href={'tel:'+phone}>{phone}</a>)}</dd></div><div><dt className="font-bold">Email</dt><dd><a href={'mailto:'+SHOP.email}>{SHOP.email}</a></dd></div><div><dt className="font-bold">Hours</dt><dd>{SHOP.hours}</dd></div></dl>
  <div className="mt-5 flex flex-wrap gap-3"><Link to="/contact" className={btn+'bg-maroon text-ivory hover:bg-maroon-dark'}>Contact us</Link><WhatsApp text="Hello Kandan Family Shop, I would like help choosing a saree."/></div></section></Wrap><Wrap className="pt-16"><section className="rounded-2xl border border-gold/30 bg-white p-6 text-center shadow-sm sm:p-8"><h2 className="text-3xl">What Our Customers Say</h2><p className="mt-2 text-ink/70">Read genuine, moderated product feedback from our customers.</p><Link to="/reviews" className={btnO+' mt-5'}>Read Customer Reviews</Link></section></Wrap></>}
