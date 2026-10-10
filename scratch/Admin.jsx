import {useState} from 'react'
import {Link} from 'react-router-dom'
import {products,COLLECTIONS,HEX,inr,saveProduct,deleteProduct,resetCatalog,useCatalog,setSiteImage,siteImg} from '../data/products'
import {useOrders,updateOrder,deleteOrder} from '../data/orders'
import {ADMIN_PASSWORD,SHOP} from '../config/shop'
import {isSupabaseConfigured} from '../lib/supabase'
import {resetBackgroundImage, DEFAULT_BACKGROUND} from '../data/background'
import {Img,Field,WhatsApp,btnP,btnO} from '../components/ui'
import {sendOrderNotification} from '../data/email'
import AdminReviews from './AdminReviews'
import AdminOrderSearch from '../components/AdminOrderSearch'
import AdminSales from './AdminSales'
import AdminLoyalty from './AdminLoyalty'
import {salesMetrics} from '../data/sales'
const sel='min-h-11 w-full border border-gold-dark/50 bg-white px-3'
const toData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const s=Math.min(1,1600/i.width),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.82))};i.onerror=rej;i.src=r.result};r.onerror=rej;r.readAsDataURL(f)})
function ImgIn({label,value,onChange}){const [m,setM]=useState(''),up=value?.startsWith('data:'),id='i'+label.replace(/\W/g,'')
 const pick=async e=>{const f=e.target.files?.[0];setM('');if(!f)return;try{onChange(await toData(f));setM('')}catch{setM('Could not read that image.')}}
 return <div className="flex gap-3"><div className="h-28 w-20 shrink-0 overflow-hidden bg-ivory-dark"><Img src={value} alt={label+' preview'} className="h-full w-full object-cover"/></div>
  <div className="flex-1 space-y-1"><Field label={label+' — image URL'} id={id} value={up?'(uploaded photo)':value||''} readOnly={up} onChange={e=>onChange(e.target.value)}/>
   <label className="block text-sm">Or upload: <input type="file" accept="image/*" onChange={pick}/></label>{value&&<button type="button" className="text-sm underline" onClick={()=>{onChange('');setM('')}}>Remove image</button>}{m&&<p role="alert" className="text-sm text-red-700">{m}</p>}</div></div>}
const blank = () => ({
  id: 'kfs-' + Date.now().toString(36),
  sku: 'KFS-NEW-' + Math.floor(100 + Math.random() * 900),
  name: '',
  collection: COLLECTIONS[0],
  colour: 'primary',
  fabric: '',
  zari: '',
  price: 5000,
  originalPrice: 6500,
  stockCount: 10,
  length: 'Saree: 5.5 m | Blouse: 0.8 m',
  description: '',
  blouse: 'Unstitched blouse piece included.',
  care: 'Dry clean only.',
  stock: true,
  best: false,
  isNew: true,
  images: ['', '', '', ''],
})

function Form({ init, onDone }) {
  const [p, setP] = useState(() => ({
    ...init,
    sku: init.sku || `KFS-${init.id.replace('kfs-', '').toUpperCase()}`,
    originalPrice: init.originalPrice || Math.round(init.price * 1.25),
    stockCount: init.stockCount ?? (init.stock ? 10 : 0),
    length: init.length || 'Saree: 5.5 m | Blouse: 0.8 m',
    description: init.description || '',
    images: Array.isArray(init.images) && init.images.length ? [...init.images] : ['', '', '', ''],
  }))
  const [err, setErr] = useState('')
  const set = (k, v) => setP({ ...p, [k]: v })

  const priceNum = +p.price || 0
  const origPriceNum = +p.originalPrice || priceNum
  const discountCalc = origPriceNum > priceNum ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100) : 0

  const submit = (e) => {
    e.preventDefault()
    if (p.name.trim().length < 2) return setErr('Enter a product name.')
    if (!(+p.price > 0)) return setErr('Enter a price above 0.')
    const validImages = p.images.filter((x) => typeof x === 'string' && x.trim())
    if (!validImages.length) return setErr('Provide at least one product image.')

    if (
      !saveProduct({
        ...p,
        price: +p.price,
        originalPrice: +p.originalPrice || +p.price,
        discount: discountCalc,
        stockCount: +p.stockCount || 0,
        hex: HEX[p.colour] || '#888888',
        images: validImages,
      })
    ) {
      return setErr('Browser storage is full. Use smaller photos or paste image URLs.')
    }
    onDone()
  }

  const S = ({ k, l, o }) => (
    <div>
      <label htmlFor={k} className="mb-1 block text-sm font-bold">
        {l}
      </label>
      <select id={k} className={sel} value={p[k]} onChange={(e) => set(k, e.target.value)}>
        {o.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-5 border border-gold/50 bg-white p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between border-b border-gold/30 pb-3">
        <h2 className="text-2xl font-serif font-bold text-primary">
          {products.some((x) => x.id === p.id) ? 'Edit Product' : 'Add New Product'}
        </h2>
        <span className="text-xs font-mono text-ink/50">ID: {p.id}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product Name" id="name" value={p.name} onChange={(e) => set('name', e.target.value)} />
        <Field label="SKU Code" id="sku" value={p.sku} onChange={(e) => set('sku', e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <S k="collection" l="Collection / Category" o={COLLECTIONS} />
        <S k="colour" l="Colour" o={Object.keys(HEX)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fabric Details" id="fabric" value={p.fabric} onChange={(e) => set('fabric', e.target.value)} />
        <Field label="Zari / Weave Details" id="zari" value={p.zari} onChange={(e) => set('zari', e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Selling Price (₹)" id="price" type="number" min="1" value={p.price} onChange={(e) => set('price', e.target.value)} />
        <Field label="Original Price (₹ MSRP)" id="originalPrice" type="number" min="1" value={p.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} />
        <div>
          <label className="mb-1 block text-sm font-bold">Discount Preview</label>
          <div className="min-h-11 flex items-center px-3 border border-gold/30 bg-ivory rounded font-bold text-emerald-800 text-sm">
            {discountCalc > 0 ? `${discountCalc}% OFF` : 'No Discount'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Length / Dimensions / Sizes" id="length" value={p.length} onChange={(e) => set('length', e.target.value)} />
        <Field label="Stock Quantity (units)" id="stockCount" type="number" min="0" value={p.stockCount} onChange={(e) => set('stockCount', e.target.value)} />
      </div>

      <Field area label="Product Description" id="description" value={p.description} onChange={(e) => set('description', e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Blouse Details" id="blouse" value={p.blouse} onChange={(e) => set('blouse', e.target.value)} />
        <Field label="Care Instructions" id="care" value={p.care} onChange={(e) => set('care', e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-6 rounded-xl border border-gold/30 p-3 bg-ivory/40">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={p.stock} onChange={(e) => set('stock', e.target.checked)} />
          In Stock
        </label>
        <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={p.best} onChange={(e) => set('best', e.target.checked)} />
          ★ Featured / Bestseller
        </label>
        <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={p.isNew} onChange={(e) => set('isNew', e.target.checked)} />
          ✦ New Arrival
        </label>
      </div>

      {/* Gallery Image Manager */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-serif font-bold text-primary">Product Gallery Images (3–4 recommended)</h3>
          <span className="text-xs text-ink/60">{p.images.length} image slots</span>
        </div>
        <div className="space-y-3">
          {p.images.map((imgUrl, i) => (
            <div key={i} className="rounded-xl border border-gold/30 p-3.5 bg-ivory/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">
                  {i === 0 ? '★ Main Product Image (Primary Display)' : `Gallery View ${i + 1}`}
                </span>
                <div className="flex gap-3">
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-xs font-bold text-primary underline hover:text-primary-dark"
                      onClick={() => {
                        const next = [...p.images]
                        const temp = next[0]
                        next[0] = next[i]
                        next[i] = temp
                        set('images', next)
                      }}
                    >
                      ★ Set as Main
                    </button>
                  )}
                  {p.images.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={() => set('images', p.images.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <ImgIn
                label={i === 0 ? 'Main Photo' : `Gallery Image ${i + 1}`}
                value={imgUrl}
                onChange={(v) => set('images', p.images.map((x, j) => (j === i ? v : x)))}
              />
            </div>
          ))}
        </div>
        {p.images.length < 6 && (
          <button
            type="button"
            className={btnO + ' w-full text-xs py-2'}
            onClick={() => set('images', [...p.images, ''])}
          >
            + Add Another Gallery Image
          </button>
        )}
      </div>

      {err && <p role="alert" className="text-red-700 font-bold text-sm">{err}</p>}

      <div className="flex gap-3 border-t border-gold/30 pt-4">
        <button className={btnP}>Save Product</button>
        <button type="button" className={btnO} onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
const NAV=[['dash','Dashboard'],['products','Products'],['orders','Orders'],['delivery','Delivery'],['loyalty','⭐ Loyalty Rewards'],['sales','Sales analytics'],['reviews','Reviews'],['site','Site images']]
const STATUS=['Confirmed','New','Processing','Packed','Delivered','Cancelled','Refunded'],PAYMENTS=['Pending','Paid','Failed','COD','unpaid','paid'],BADGE={Confirmed:'bg-emerald-100 text-emerald-800',New:'bg-gold/30 text-gold-dark',Processing:'bg-blue-100 text-blue-800',Packed:'bg-blue-100 text-blue-800',Delivered:'bg-emerald/15 text-emerald',Cancelled:'bg-red-100 text-red-800',Refunded:'bg-red-100 text-red-800'}
const DELIVERY_STATUS_COLOR={Confirmed:'bg-emerald-100 text-emerald-800',New:'bg-amber-100 text-amber-800',Processing:'bg-blue-100 text-blue-800',Packed:'bg-blue-100 text-blue-800',Delivered:'bg-emerald-100 text-emerald-800',Cancelled:'bg-red-100 text-red-700',Refunded:'bg-red-100 text-red-700'}
const lines=o=>(o.items||[]).map(i=>typeof i==='string'?i:`${i.name} × ${i.q}`)
const Stat=({t,v,onClick,icon})=><div onClick={onClick} className={'border border-gold/40 bg-white p-4 shadow-sm'+(onClick?' cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group':'')}><p className="text-sm text-ink/60 flex items-center gap-2">{icon&&<span>{icon}</span>}{t}</p><p className="mt-1 font-serif text-3xl font-semibold text-primary">{v}</p>{onClick&&<p className="mt-2 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">Click to view →</p>}</div>
const Badge=({s})=><span className={'rounded-full px-2.5 py-0.5 text-xs font-bold '+(BADGE[s||'New'])}>{s||'New'}</span>
function Orders({orders,limit}){const list=limit?orders.slice(0,limit):orders
 if(!list.length)return <p className="border border-gold/40 bg-white p-8 text-center text-ink/70">No orders yet. Orders placed through the shop checkout appear here instantly.</p>
 const resendEmail=async o=>{updateOrder(o.no,{emailStatus:'sending',emailError:''});try{await sendOrderNotification(o);updateOrder(o.no,{emailStatus:'sent',emailError:''})}catch(error){updateOrder(o.no,{emailStatus:'error',emailError:error instanceof Error?error.message:'Could not send the order email.'})}}
 return <ul className="space-y-4">{list.map(o=><li key={o.no} className="border border-gold/40 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/30 pb-3"><div><p className="font-bold">{o.no} <Badge s={o.status}/></p><p className="mt-1 text-xs text-ink/60">{o.at}</p></div><p className="font-serif text-xl font-semibold text-primary">{inr(o.total)}</p></div>
  <div className="mt-4 grid gap-5 text-sm sm:grid-cols-2"><section><h3 className="font-bold">Customer &amp; delivery</h3><dl className="mt-2 space-y-1"><div><dt className="inline font-semibold">Name: </dt><dd className="inline">{o.name}</dd></div><div><dt className="inline font-semibold">Phone: </dt><dd className="inline"><a href={'tel:'+o.phone} className="underline">{o.phone}</a></dd></div><div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a href={'mailto:'+o.email} className="break-all underline">{o.email}</a></dd></div><div><dt className="inline font-semibold">Address: </dt><dd className="inline text-ink/70">{o.address}</dd></div></dl></section><section><h3 className="font-bold">Items</h3><ul className="mt-2 list-inside list-disc">{lines(o).map((l,i)=><li key={i}>{l}</li>)}</ul></section></div>
  {!limit&&<div className="mt-4 space-y-3 border-t border-gold/30 pt-3"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-bold">Email notification to {SHOP.email}:</span><span role={o.emailStatus==='error'?'alert':'status'}>{o.emailStatus==='sent'?'Sent':o.emailStatus==='sending'?'Sending…':o.emailStatus==='error'?'Failed':'No send record'}</span>{o.emailError&&<span className="text-red-700">{o.emailError}</span>}</div><div className="flex flex-wrap items-center gap-3"><button type="button" className={btnO} disabled={o.emailStatus==='sending'||o.emailStatus==='sent'} onClick={()=>resendEmail(o)}>{o.emailStatus==='sending'?'Sending…':o.emailStatus==='sent'?'Email sent':'Send / retry email'}</button><WhatsApp label="WhatsApp order enquiry" text={`Hello Sri Kandan Family Shop, I am enquiring about order ${o.no}.\nItems: ${lines(o).join(', ')}\nTotal: ${inr(o.total)}`}/><label className="text-sm font-bold" htmlFor={'st'+o.no}>Order status</label><select id={'st'+o.no} className="min-h-11 border border-gold-dark/50 bg-white px-2" value={o.status||'New'} onChange={e=>updateOrder(o.no,{status:e.target.value})}>{STATUS.map(x=><option key={x}>{x}</option>)}</select><label className="text-sm font-bold" htmlFor={'pay'+o.no}>Payment</label><select id={'pay'+o.no} className="min-h-11 border border-gold-dark/50 bg-white px-2" value={o.paymentStatus||'unpaid'} onChange={e=>updateOrder(o.no,{paymentStatus:e.target.value})}>{PAYMENTS.map(x=><option key={x} value={x}>{x}</option>)}</select><button className="ml-auto min-h-11 px-3 text-sm text-red-700 underline" onClick={()=>confirm('Delete order '+o.no+'?')&&deleteOrder(o.no)}>Delete</button></div></div>}
 </li>)}</ul>}

function DeliveryTracker({orders}){
 const [search, setSearch] = useState('')
 
 const filteredOrders = orders.filter(o => {
  if(!search.trim()) return true;
  const q = search.toLowerCase();
  return (
   (o.no && o.no.toLowerCase().includes(q)) ||
   (o.name && o.name.toLowerCase().includes(q)) ||
   (o.phone && o.phone.toLowerCase().includes(q)) ||
   (o.status && o.status.toLowerCase().includes(q)) ||
   (o.trackingId && o.trackingId.toLowerCase().includes(q))
  );
 });

 if(!orders.length)return <p className="border border-gold/40 bg-white p-8 text-center text-ink/70">No orders to track yet.</p>
 const steps=['New','Packed','Delivered']
 return (
  <div>
   <div className="mb-6 flex gap-2 w-full max-w-2xl">
    <div className="relative flex-1">
     <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-ink/50" aria-hidden="true">🔍</span>
     <input 
      type="search" 
      placeholder="Search by Order ID, Customer Name, or Phone Number" 
      value={search} 
      onChange={e=>setSearch(e.target.value)} 
      className="w-full min-h-11 rounded border border-gold-dark/50 bg-white pl-9 pr-3 text-sm"
     />
    </div>
    {search && <button type="button" onClick={()=>setSearch('')} className={btnO}>Clear</button>}
   </div>
   
   {filteredOrders.length === 0 ? (
    <p className="border border-gold/40 bg-white p-8 text-center text-ink/70">No delivery records found</p>
   ) : (
    <ul className="space-y-4">
     {filteredOrders.map(o=>{
      const status=o.status||'New'
    const stepIndex=steps.indexOf(status)
    const isCancelled=status==='Cancelled'||status==='Refunded'
    return (
     <li key={o.no} className="border border-gold/40 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/30 pb-3">
       <div>
        <p className="font-bold">{o.no}</p>
        <p className="mt-1 text-sm text-ink/70">{o.name} · {o.phone}</p>
        <p className="mt-0.5 text-xs text-ink/50 italic">{o.at}</p>
       </div>
       <span className={'rounded-full px-3 py-1 text-xs font-bold '+(DELIVERY_STATUS_COLOR[status]||'bg-gold/20 text-ink')}>{status}</span>
      </div>
      <div className="mt-4 text-sm text-ink/70 mb-4">
       <span className="font-semibold text-ink">📦 Delivery address:</span> {o.address}
      </div>
      {isCancelled
       ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{status}</p>
       : <div className="mt-2">
          <div className="flex items-center gap-0">
           {steps.map((step,index)=>(
            <div key={step} className="flex flex-1 items-center">
             <div className="flex flex-col items-center">
              <span className={'grid h-9 w-9 place-items-center rounded-full text-xs font-bold transition-all '+(index<=stepIndex?'bg-primary text-ivory shadow-md':'bg-gold/20 text-primary')}>
               {index<=stepIndex?'✓':index+1}
              </span>
              <span className={'mt-1 text-xs font-semibold '+(index<=stepIndex?'text-primary':'text-ink/40')}>{step}</span>
             </div>
             {index<steps.length-1&&<div className={'flex-1 h-1 mx-1 rounded-full transition-all '+(index<stepIndex?'bg-primary':'bg-gold/20')}/>}
            </div>
           ))}
          </div>
         </div>
      }
      <div className="mt-4 flex items-center gap-3">
       <label className="text-xs font-bold text-ink/60" htmlFor={'ds'+o.no}>Update status:</label>
       <select id={'ds'+o.no} className="min-h-9 rounded border border-gold-dark/50 bg-white px-2 text-sm" value={status} onChange={e=>updateOrder(o.no,{status:e.target.value})}>
        {STATUS.map(x=><option key={x}>{x}</option>)}
       </select>
      </div>
     </li>
    )
   })}
  </ul>
  )}
 </div>
 )
}

export default function Admin(){useCatalog();const orders=useOrders(),[ok,setOk]=useState(()=>sessionStorage.getItem('kfs_admin')==='1'),[pw,setPw]=useState(''),[bad,setBad]=useState(false),[tab,setTab]=useState('dash'),[edit,setEdit]=useState(null),[m,setM]=useState(''),[q,setQ]=useState(''),[catFilter,setCatFilter]=useState('')
 const handleLogin=async e=>{
   e.preventDefault();
   setBad(false);
   try {
     const res=await fetch('/api/admin/login',{
       method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({password:pw}),
     });
     const data=await res.json();
     if(data.ok && data.token){
       sessionStorage.setItem('kfs_admin_token',data.token);
       sessionStorage.setItem('kfs_admin','1');
       setOk(true);
       return;
     }
   } catch {}
   if(pw===ADMIN_PASSWORD){
     sessionStorage.setItem('kfs_admin','1');
     setOk(true);
   } else {
     setBad(true);
   }
 }
 if(!ok)return <main className="weave grid min-h-screen place-items-center bg-primary-dark p-4"><div className="w-full max-w-sm border-t-4 border-gold bg-ivory p-8 shadow-xl text-center"><div className="mx-auto mb-5 overflow-hidden rounded-full border-2 border-gold/60 bg-white shadow-sm flex items-center justify-center h-24 w-24"><img src="/images/logo.jpg" alt="Sri Kandan Family Shop Logo" className="h-full w-full object-cover" /></div><h1 className="text-3xl">Admin login</h1><p className="mt-1 text-sm text-ink/70">Sri Kandan Family Shop · Secure Management Panel</p>
  <form className="mt-5 space-y-4" onSubmit={handleLogin}><Field label="Password" id="pw" type="password" value={pw} onChange={e=>setPw(e.target.value)} error={bad&&'Incorrect password.'}/><button className={btnP+' w-full'}>Log in</button></form></div></main>
 const keys=['hero','banner','about',...COLLECTIONS.map(c=>'c:'+c)],newN=orders.filter(o=>(o.status||'New')==='New').length,rev=salesMetrics(orders).revenue
 const shown=products.filter(p=>{
   if(catFilter && p.collection!==catFilter) return false
   if(!q) return true
   const s=q.toLowerCase()
   return p.name.toLowerCase().includes(s) || (p.sku && p.sku.toLowerCase().includes(s)) || p.colour.toLowerCase().includes(s)
 }),go=k=>{setTab(k);setEdit(null)}
 const nb=k=>`flex min-h-11 items-center justify-between gap-2 whitespace-nowrap px-3 text-left text-sm font-bold ${tab===k?'bg-ivory text-primary':'text-ivory/90 hover:bg-white/10'}`
 return <div className="min-h-screen bg-ivory-dark/60 md:flex"><aside className="weave bg-primary-dark text-ivory md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col"><div className="p-4 md:p-6"><div className="mb-3 overflow-hidden rounded-full border border-gold/50 bg-white shadow-sm flex items-center justify-center h-14 w-14"><img src="/images/logo.jpg" alt="Sri Kandan Family Shop Logo" className="h-full w-full object-cover" /></div><p className="font-serif text-xl">Sri Kandan Family Shop</p><p className="text-xs text-gold">Admin panel · verified</p></div>
  <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-1 md:flex-col md:overflow-visible md:px-3">{NAV.map(([k,l])=><button key={k} onClick={()=>go(k)} aria-current={tab===k} className={nb(k)}>{l}{k==='orders'&&newN>0&&<span className="rounded-full bg-gold px-2 text-xs text-ink">{newN}</span>}</button>)}
   <Link to="/" className={nb('')+' md:mt-auto'}>View shop</Link><button className={nb('')} onClick={()=>{sessionStorage.removeItem('kfs_admin');sessionStorage.removeItem('kfs_admin_token');setOk(false)}}>Log out</button></nav></aside>
  <main className="min-w-0 flex-1 p-4 sm:p-8">{isSupabaseConfigured ? (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 shadow-sm">
      <span>⚡ <strong>Supabase Connected:</strong> Products and orders sync live with your cloud Supabase database.</span>
      <span className="rounded bg-emerald-200 px-2.5 py-0.5 font-bold text-emerald-900">Cloud DB Active</span>
    </div>
   ) : (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-sm">
      <span>📦 <strong>Local Storage Mode:</strong> Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to connect Supabase.</span>
      <span className="rounded bg-amber-200 px-2.5 py-0.5 font-bold text-amber-900">Local Fallback</span>
    </div>
   )}
  {tab==='dash'&&<><h1 className="text-3xl">Dashboard</h1><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><Stat t="Products" v={products.length}/><Stat t="In stock" v={products.filter(p=>p.stock).length}/><Stat t="Out of stock" v={products.filter(p=>!p.stock).length}/><Stat t="Orders" v={orders.length} icon="🛒" onClick={()=>go('orders')}/><Stat t="Paid revenue" v={inr(rev)}/></div>
   <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div onClick={()=>go('orders')} className="group cursor-pointer rounded-xl border-2 border-gold/40 bg-white p-6 shadow-sm hover:border-primary/60 hover:shadow-lg transition-all flex items-center gap-5">
     <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl group-hover:bg-primary/20 transition-colors">🛒</div>
     <div><p className="text-lg font-bold text-primary">Customer Orders</p><p className="mt-1 text-sm text-ink/60">View all orders, update status, resend email notifications</p><p className="mt-2 text-xs font-bold text-primary">{orders.length} total · {newN} new →</p></div>
    </div>
    <div onClick={()=>go('delivery')} className="group cursor-pointer rounded-xl border-2 border-gold/40 bg-white p-6 shadow-sm hover:border-primary/60 hover:shadow-lg transition-all flex items-center gap-5">
     <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl group-hover:bg-primary/20 transition-colors">🚚</div>
     <div><p className="text-lg font-bold text-primary">Delivery Status</p><p className="mt-1 text-sm text-ink/60">Track delivery progress for all orders, update statuses</p><p className="mt-2 text-xs font-bold text-primary">{orders.filter(o=>o.status==='Delivered').length} delivered · {orders.filter(o=>o.status==='Packed').length} packed →</p></div>
    </div>
   </div>
   <h2 className="mb-3 mt-8 text-2xl">Recent orders</h2><Orders orders={orders} limit={5}/>
   <h2 className="mb-3 mt-8 text-2xl">Products by collection</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{COLLECTIONS.map(c=><Stat key={c} t={c} v={products.filter(p=>p.collection===c).length}/>)}</div></>}
  {tab==='products'&&(edit?<Form key={edit.id} init={edit} onDone={()=>setEdit(null)}/>:<><div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-serif font-bold text-ink">Products <span className="ml-2 rounded-full bg-gold/20 px-3 py-1 text-sm text-primary font-sans font-bold">{products.length}</span></h1><div className="flex flex-wrap gap-3"><button className={btnP} onClick={()=>setEdit(blank())}>Add product</button><button className={btnO} onClick={()=>confirm('Reset products and site images to the sample data?')&&resetCatalog()}>Reset sample data</button></div></div>
   <div className="mt-4 flex flex-wrap items-center gap-3">
     <input id="pq" type="search" placeholder="Search by name, SKU, or color..." value={q} onChange={e=>setQ(e.target.value)} className={sel+' max-w-sm rounded-lg'}/>
     <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className={sel+' max-w-xs rounded-lg'}>
       <option value="">All Categories ({products.length})</option>
       {COLLECTIONS.map(c=><option key={c} value={c}>{c} ({products.filter(p=>p.collection===c).length})</option>)}
     </select>
     {(q || catFilter) && <button type="button" onClick={()=>{setQ('');setCatFilter('')}} className="text-xs text-primary underline font-bold">Clear filters</button>}
   </div>
   <div className="mt-4 overflow-x-auto border border-gold/40 bg-white shadow-sm rounded-xl"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-ivory-dark"><tr><th className="p-3">Product / SKU</th><th className="p-3">Category</th><th className="p-3">Price &amp; Discount</th><th className="p-3">Stock &amp; Units</th><th className="p-3">Badges</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{shown.map(p=><tr key={p.id} className="border-t border-gold/30 hover:bg-gold/5 transition-colors"><td className="p-3"><div className="flex items-center gap-3"><div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-ivory-dark border border-gold/30"><Img src={p.images[0]} alt="" tone={p.hex} className="h-full w-full object-cover"/></div><div><p className="font-bold text-ink leading-tight">{p.name}</p><p className="font-mono text-xs text-ink/50 mt-0.5">SKU: {p.sku || p.id}</p></div></div></td><td className="p-3 text-xs font-semibold text-ink/80">{p.collection}</td><td className="p-3"><div><span className="font-bold text-primary">{inr(p.price)}</span>{p.originalPrice > p.price && <span className="block text-xs text-ink/40 line-through">{inr(p.originalPrice)}</span>}{p.discount > 0 && <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">{p.discount}% OFF</span>}</div></td>
    <td className="p-3"><div><button className={'rounded-full px-2.5 py-0.5 text-xs font-bold '+(p.stock?'bg-emerald/15 text-emerald':'bg-red-100 text-red-800')} aria-pressed={p.stock} onClick={()=>saveProduct({...p,stock:!p.stock})}>{p.stock?'In stock':'Out of stock'}</button><span className="block text-xs text-ink/50 mt-1">{p.stockCount ?? 10} units</span></div></td>
    <td className="p-3"><div className="flex flex-col gap-1">{p.best && <span className="w-fit rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">★ Best</span>}{p.isNew && <span className="w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">✦ New</span>}</div></td>
    <td className="whitespace-nowrap p-3 text-right"><button className="min-h-11 px-2.5 font-bold text-primary underline" onClick={()=>setEdit(p)}>Edit</button><button className="min-h-11 px-2.5 text-red-700 underline" onClick={()=>confirm('Delete '+p.name+'?')&&deleteProduct(p.id)}>Delete</button></td></tr>)}</tbody></table>{!shown.length&&<p className="p-8 text-center text-ink/60">No products match your search or filter.</p>}</div></>)}
  {tab==='orders'&&<>
    <h1 className="mb-4 text-3xl">Orders</h1>
    <div className="mb-8 rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-primary flex items-center gap-2">🔍 Customer Search</h2>
      <AdminOrderSearch orders={orders}/>
    </div>
    <h2 className="mb-4 text-xl font-bold">All Orders <span className="ml-2 rounded-full bg-gold/30 px-3 py-0.5 text-sm text-gold-dark">{orders.length}</span></h2>
    <Orders orders={orders}/>
  </>}
  {tab==='delivery'&&<><h1 className="mb-2 text-3xl">Delivery Status</h1><p className="mb-5 text-sm text-ink/60">Track and update the delivery status of all customer orders.</p><DeliveryTracker orders={orders}/></>}
  {tab==='loyalty'&&<AdminLoyalty/>}
  {tab==='sales'&&<AdminSales/>}
  {tab==='reviews'&&<AdminReviews/>}
  {tab==='site'&&<><h1 className="mb-2 text-3xl">Site Images &amp; Background</h1>
  <p className="mb-5 text-sm text-ink/70">
    The website background and showroom images remain <strong>fixed and persistent</strong> across all page reloads, navigations, and browser refreshes. They change only when you intentionally update them.
  </p>
  <div className="grid gap-4 lg:grid-cols-2">{keys.map(k=><div key={k} className="border border-gold/40 bg-white p-4 shadow-sm">
    <ImgIn label={k.startsWith('c:')?k.slice(2)+' card':k==='hero'?'Website Background & Hero':k==='banner'?'Bridal banner':'About photo'} value={siteImg(k)} onChange={v=>setSiteImage(k,v)||setM('Could not save photo. Please use a smaller file or URL.')}/>
    {k==='hero'&&<div className="mt-2 flex items-center justify-between border-t border-gold/20 pt-2 text-xs">
      <span className="text-emerald font-bold">✓ Fixed &amp; Persistent</span>
      <button type="button" onClick={()=>{resetBackgroundImage();setSiteImage('hero',DEFAULT_BACKGROUND)}} className="text-red-700 underline">Reset to Showroom Default</button>
    </div>}
  </div>)}</div>{m&&<p role="alert" className="mt-3 text-red-700">{m}</p>}</>}</main></div>}


