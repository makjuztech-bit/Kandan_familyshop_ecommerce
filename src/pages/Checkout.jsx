import {useState} from 'react'
import {Link} from 'react-router-dom'
import {useStore} from '../context/Store'
import {inr} from '../data/products'
import {addOrder,updateOrder} from '../data/orders'
import {sendOrderNotification} from '../data/email'
import {SHOP} from '../config/shop'
import {Wrap,Field,validate,btnP} from '../components/ui'
const K=['name','email','phone','address']
export default function Checkout(){const {lines,total,clear}=useStore(),[v,setV]=useState({}),[err,setErr]=useState({}),[order,setOrder]=useState(null),[emailStatus,setEmailStatus]=useState('idle'),[emailError,setEmailError]=useState('')
 const sendNotification=async placedOrder=>{setEmailStatus('sending');setEmailError('')
  try{await sendOrderNotification({no:placedOrder.no,name:placedOrder.name,email:placedOrder.email,phone:placedOrder.phone,address:placedOrder.address,total:placedOrder.total,items:placedOrder.lines.map(l=>({name:l.name,q:l.q,price:l.price}))});setEmailStatus('sent');updateOrder(placedOrder.no,{emailStatus:'sent',emailError:''})}
  catch(error){const message=error instanceof Error?error.message:'Could not send the order email.';setEmailStatus('error');setEmailError(message);updateOrder(placedOrder.no,{emailStatus:'error',emailError:message})}
 }
 const submit=async e=>{e.preventDefault();const er=validate(v,K);setErr(er);if(Object.keys(er).length){document.getElementById(Object.keys(er)[0])?.focus();return}
  const now=new Date(),no='KFS-'+Date.now().toString(36).toUpperCase(),placedOrder={no,lines,total,...v};setOrder(placedOrder);setEmailStatus('sending')
  addOrder({no,...v,total,status:'New',paymentStatus:'unpaid',paymentMethod:'Demo checkout — no payment collected',emailStatus:'sending',emailError:'',items:lines.map(l=>({productId:l.id,sku:l.id.toUpperCase(),name:l.name,category:l.collection,image:l.images[0],price:l.price,q:l.q})),createdAt:now.toISOString(),at:now.toLocaleString('en-IN')})
  clear();await sendNotification(placedOrder)}
 const ch=e=>setV({...v,[e.target.name]:e.target.value})
 if(order){
  return <Wrap className="max-w-2xl py-12"><div className="border border-emerald/40 bg-white p-8"><h1 className="text-3xl">Demo order confirmed</h1><p className="mt-2">Order number: <b>{order.no}</b></p><p className="text-sm text-ink/70">This is a demo order. No payment was collected and nothing will be shipped.</p>
  <ul className="mt-4 divide-y divide-gold/40">{order.lines.map(l=><li key={l.id} className="flex justify-between py-2"><span>{l.name} × {l.q}</span><span>{inr(l.price*l.q)}</span></li>)}</ul><p className="mt-3 flex justify-between text-lg font-bold"><span>Total</span><span>{inr(order.total)}</span></p>
  <div className="mt-4 space-y-1 border-t border-gold/40 pt-4 text-sm"><p><b>Delivery address:</b> {order.address}</p><p><b>Customer:</b> {order.name}</p><p><b>Customer email:</b> {order.email}</p><p><b>Customer phone:</b> {order.phone}</p></div>
  {emailStatus==='sending'&&<p role="status" className="mt-4 bg-gold/20 p-3 text-sm">Sending order notification to {SHOP.email}…</p>}
  {emailStatus==='sent'&&<p role="status" className="mt-4 bg-emerald/10 p-3 text-sm text-emerald">Order notification email sent to {SHOP.email}.</p>}
  {emailStatus==='error'&&<div className="mt-4 bg-red-50 p-4 text-sm text-red-800"><p role="alert">{emailError}</p><button type="button" className={btnP+' mt-3'} onClick={()=>sendNotification(order)}>Retry sending order email</button></div>}
  <Link to="/shop" className={btnP+' mt-5'}>Continue shopping</Link></div></Wrap>}
 if(!lines.length)return <Wrap className="py-12 text-center"><h1 className="text-3xl">Nothing to check out</h1><Link to="/shop" className={btnP+' mt-4'}>Browse sarees</Link></Wrap>
 return <Wrap className="py-10"><h1 className="text-4xl">Checkout</h1><p className="mt-2 inline-block bg-gold/20 px-3 py-2 text-sm font-bold">Demo checkout — no payment will be collected.</p>
  <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]"><form onSubmit={submit} noValidate className="space-y-4"><Field label="Full name" id="name" autoComplete="name" value={v.name||''} onChange={ch} error={err.name}/><Field label="Email" id="email" type="email" autoComplete="email" value={v.email||''} onChange={ch} error={err.email}/><Field label="Phone (10-digit mobile)" id="phone" type="tel" autoComplete="tel" value={v.phone||''} onChange={ch} error={err.phone}/><Field area label="Delivery address" id="address" autoComplete="street-address" value={v.address||''} onChange={ch} error={err.address}/><button className={btnP} disabled={emailStatus==='sending'}>Place demo order</button></form>
  <aside className="h-fit border border-gold/50 bg-white p-5"><h2 className="text-2xl">Summary</h2>{lines.map(l=><p key={l.id} className="mt-2 flex justify-between text-sm"><span>{l.name} × {l.q}</span><span>{inr(l.price*l.q)}</span></p>)}<p className="mt-3 flex justify-between border-t border-gold/40 pt-3 font-bold"><span>Total</span><span>{inr(total)}</span></p></aside></div></Wrap>}
