import {useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {SHOP,IMG} from '../config/shop'
import {Img,Wrap,Field,validate,btnP,WhatsApp} from '../components/ui'
import {createGmailDraftUrl} from '../data/email'
export const About=()=><Wrap className="grid max-w-5xl items-center gap-8 py-12 md:grid-cols-2"><div><h1 className="text-4xl">About Sri Kandan Family Shop</h1><p className="mt-4 text-ink/80">We are a silk saree boutique focused on helping you choose the right silk saree for weddings, festivals and everyday wear. Our team gives personal guidance on colour, weave, zari and budget.</p><p className="mt-3 text-ink/80">This website is a demo with a sample catalogue. Replace this text with your own story.</p><Link to="/contact" className={btnP+' mt-5'}>Talk to us</Link></div><div className="aspect-[4/5] overflow-hidden bg-ivory-dark"><Img src={IMG.about} alt="Draping a silk saree" className="h-full w-full object-cover"/></div></Wrap>
export function Contact(){const [v,setV]=useState({}),[err,setErr]=useState({}),[draftUrl,setDraftUrl]=useState(null),[draftError,setDraftError]=useState('')
 const ch=e=>setV({...v,[e.target.name]:e.target.value}),sub=e=>{e.preventDefault();const er=validate(v,['name','email','message']);setErr(er);setDraftUrl(null);setDraftError('')
  if(Object.keys(er).length)return
  const url=createGmailDraftUrl({subject:`Sri Kandan Family Shop enquiry from ${v.name.trim()}`,body:`Name: ${v.name.trim()}\nEmail: ${v.email.trim()}\n\nMessage:\n${v.message.trim()}`})
  if(!url){setDraftError('Gmail draft could not be prepared. Check the shop email address in src/config/shop.js.');return}
  setDraftUrl(url)}
 return <Wrap className="grid max-w-5xl gap-10 py-12 md:grid-cols-2"><div><h1 className="text-4xl">Contact</h1><p className="mt-3">{SHOP.address}</p><p className="mt-2 font-bold">Call us</p>{SHOP.phones.map(phone=><p key={phone}><a href={'tel:'+phone} className="underline">{phone}</a></p>)}<p className="mt-2"><a href={'mailto:'+SHOP.email} className="underline">{SHOP.email}</a></p><p>{SHOP.hours}</p><div className="mt-4"><WhatsApp text="Hello Sri Kandan Family Shop,"/></div></div>
  <form onSubmit={sub} noValidate className="space-y-4"><Field label="Name" id="name" value={v.name||''} onChange={ch} error={err.name}/><Field label="Email" id="email" type="email" value={v.email||''} onChange={ch} error={err.email}/><Field area label="Message" id="message" value={v.message||''} onChange={ch} error={err.message}/><button className={btnP}>Prepare Gmail message</button>
   {draftError&&<p role="alert" className="bg-amber-50 p-3 text-sm text-amber-900">{draftError}</p>}
   {draftUrl&&<p role="status" className="bg-gold/20 p-3 text-sm">Your message draft is ready. Review it in Gmail, then press Send. <a href={draftUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-primary underline">Open Gmail draft</a></p>}</form></Wrap>}
const P={shipping:'Demo shipping policy. Replace with your delivery areas, timelines and charges.',returns:'Demo returns policy. Replace with your exchange and return terms.',privacy:'Demo privacy policy. This demo stores cart and wishlist only in your browser.',terms:'Demo terms. Replace with your terms of sale.'}
export const Policy=()=>{const {slug}=useParams();return P[slug]?<Wrap className="max-w-2xl py-12"><h1 className="text-4xl capitalize">{slug}</h1><p className="mt-4">{P[slug]}</p></Wrap>:<NotFound/>}
export const NotFound=()=><Wrap className="py-20 text-center"><h1 className="text-4xl">Page not found</h1><Link to="/shop" className={btnP+' mt-5'}>Back to shop</Link></Wrap>
