import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {products} from '../data/products'
import {reviewAction,submitReview,useReviewFeed} from '../data/reviews'
import {Img,btnP,btnO,Field} from './ui'

const stars=rating=>'★'.repeat(rating)+'☆'.repeat(5-rating)
const monthYear=value=>new Date(value).toLocaleDateString(undefined,{month:'long',year:'numeric'})
const avatarName=name=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')

function RatingBreakdown({summary}){
 return <div className="mt-5 space-y-2">{summary.breakdown.map(row=><div key={row.rating} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
  <span className="w-12 whitespace-nowrap">{row.rating} ★</span><div className="h-2 overflow-hidden rounded-full bg-ivory-dark" role="meter" aria-label={`${row.rating} star ratings`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={row.percent}><div className="h-full rounded-full bg-gold transition-all duration-500" style={{width:`${row.percent}%`}}/></div><span className="w-10 text-right text-ink/70">{row.percent}%</span>
 </div>)}</div>
}

function ReviewForm({productId,initialName='',initialEmail='',onClose,onSubmitted}){
 const [name,setName]=useState(initialName)
 const [email,setEmail]=useState(initialEmail)
 const [selectedProduct,setSelectedProduct]=useState(productId||products[0]?.id||'')
 const [rating,setRating]=useState(0)
 const [title,setTitle]=useState('')
 const [description,setDescription]=useState('')
 const [photo,setPhoto]=useState('')
 const [photoName,setPhotoName]=useState('')
 const [website,setWebsite]=useState('')
 const [error,setError]=useState('')
 const [sending,setSending]=useState(false)
 useEffect(()=>{const closeOnEscape=event=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape)},[onClose])
 const readPhoto=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the selected photo.'));reader.readAsDataURL(file)})
 const photoChanged=async event=>{
  const file=event.target.files?.[0]
  setPhoto('');setPhotoName('')
  if(!file)return
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPEG, PNG, or WebP image.');event.target.value='';return}
  if(file.size>2*1024*1024){setError('Customer photo must be 2 MB or smaller.');event.target.value='';return}
  try{setPhoto(await readPhoto(file));setPhotoName(file.name);setError('')}
  catch(problem){setError(problem instanceof Error?problem.message:'Could not read that photo.')}
 }
 const submit=async event=>{
  event.preventDefault();setError('')
  if(name.trim().length<2||name.trim().length>80){setError('Enter a name between 2 and 80 characters.');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError('Enter a valid email address.');return}
  if(!selectedProduct){setError('Select the product you are reviewing.');return}
  if(rating<1||rating>5){setError('Choose a rating from 1 to 5 stars.');return}
  if(title.trim().length<3||title.trim().length>120){setError('Review title must be between 3 and 120 characters.');return}
  if(description.trim().length<10||description.trim().length>2000){setError('Review description must be between 10 and 2,000 characters.');return}
  setSending(true)
  try{
   const result=await submitReview({name,email,productId:selectedProduct,rating,title,description,photo,website})
   onSubmitted(result.message)
  }catch(problem){setError(problem instanceof Error?problem.message:'Could not submit your review. Please try again.')}
  finally{setSending(false)}
 }
 return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}} role="presentation">
  <section role="dialog" aria-modal="true" aria-labelledby="review-form-title" className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/40 bg-ivory p-5 shadow-2xl sm:p-8">
   <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-dark">Your feedback matters</p><h2 id="review-form-title" className="mt-1 text-3xl">Write a Review</h2><p className="mt-2 text-sm text-ink/70">Reviews are checked by the shop before they appear publicly.</p></div><button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-ivory-dark" onClick={onClose} aria-label="Close review form">✕</button></div>
   <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
    <Field label="Customer name" id="customer-review-name" autoComplete="name" maxLength={80} value={name} onChange={event=>setName(event.target.value)}/>
    <Field label="Email (not shown publicly)" id="customer-review-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/>
    <div className="sm:col-span-2"><label className="mb-1 block text-sm font-bold" htmlFor="customer-review-product">Product</label><select id="customer-review-product" className="min-h-11 w-full border border-gold-dark/50 bg-white px-3" value={selectedProduct} onChange={event=>setSelectedProduct(event.target.value)}>{products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
    <fieldset className="sm:col-span-2"><legend className="mb-1 text-sm font-bold">Star rating</legend><div className="flex gap-1" role="group" aria-label="Choose a 1 to 5 star rating">{[1,2,3,4,5].map(value=><button key={value} type="button" aria-label={`${value} ${value===1?'star':'stars'}`} aria-pressed={rating===value} onClick={()=>setRating(value)} className="min-h-11 min-w-11 text-3xl text-gold transition-transform hover:scale-110">{value<=rating?'★':'☆'}</button>)}</div></fieldset>
    <div className="sm:col-span-2"><Field label="Review title" id="customer-review-title" maxLength={120} value={title} onChange={event=>setTitle(event.target.value)}/></div>
    <div className="sm:col-span-2"><Field area label="Review description" id="customer-review-description" maxLength={2000} value={description} onChange={event=>setDescription(event.target.value)}/><p className="mt-1 text-right text-xs text-ink/60">{description.length}/2,000</p></div>
    <div className="sm:col-span-2"><label className="mb-1 block text-sm font-bold" htmlFor="customer-review-photo">Upload customer photo (optional)</label><input id="customer-review-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={photoChanged} className="block min-h-11 w-full text-sm"/><p className="mt-1 text-xs text-ink/60">{photoName?`Selected: ${photoName}`:'JPEG, PNG, or WebP; maximum 2 MB.'}</p></div>
    <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label>
    {error&&<p role="alert" className="sm:col-span-2 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button className={btnP} disabled={sending}>{sending?'Submitting…':'Submit Review'}</button><button type="button" className={btnO} onClick={onClose}>Cancel</button></div>
   </form>
  </section>
 </div>
}

function ReviewCard({review,onAction}){
 const [busy,setBusy]=useState(false)
 const [actionMessage,setActionMessage]=useState('')
 const product=products.find(item=>item.id===review.productId)
 const act=async action=>{
  if(action==='report'&&!window.confirm('Report this review to the shop for moderation?'))return
  setBusy(true);setActionMessage('')
  try{const result=await reviewAction(review.id,action);setActionMessage(result.message||'Thank you.');onAction()}
  catch(error){setActionMessage(error instanceof Error?error.message:'Could not submit this action.')}
  finally{setBusy(false)}
 }
 return <article className="group flex h-full min-w-[88%] snap-start flex-col rounded-2xl border border-gold/25 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:min-w-[70%] sm:p-6 md:min-w-0">
  <div className="flex items-start gap-3">
   {review.photoUrl?<img src={review.photoUrl} alt={`${review.name}'s customer photo`} loading="lazy" className="h-12 w-12 rounded-full object-cover ring-2 ring-gold/30"/>:<div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-maroon text-sm font-bold text-ivory ring-2 ring-gold/30">{avatarName(review.name)}</div>}
   <div className="min-w-0 flex-1"><p className="truncate font-bold">{review.name}</p>{review.verified&&<span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2 py-1 text-xs font-bold text-emerald">✓ Verified Buyer</span>}</div>
   {review.featured&&<span className="rounded-full bg-gold/15 px-2 py-1 text-xs font-bold text-gold-dark">Featured</span>}
  </div>
  <div className="mt-4 flex items-center justify-between gap-2"><p className="text-lg tracking-widest text-gold" aria-label={`${review.rating} out of 5 stars`}>{stars(review.rating)}</p><time className="text-xs text-ink/60" dateTime={review.createdAt}>{monthYear(review.createdAt)}</time></div>
  <h3 className="mt-3 text-xl font-semibold">{review.title}</h3>
  <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{review.description}</p>
  {review.adminResponse&&<div className="mt-4 rounded-lg bg-ivory p-3 text-sm"><p className="font-bold">Shop response</p><p className="mt-1">{review.adminResponse}</p></div>}
  {product&&<Link to={`/product/${product.id}`} className="mt-4 flex items-center gap-3 rounded-xl border border-gold/20 p-2 transition-colors hover:bg-ivory"><Img src={product.images[0]} alt="" tone={product.hex} className="h-12 w-10 rounded object-cover"/><span className="min-w-0"><span className="block text-[11px] uppercase tracking-wide text-ink/60">Purchased</span><span className="block truncate text-sm font-semibold">{product.name}</span></span></Link>}
  <div className="mt-4 flex items-center justify-between border-t border-gold/20 pt-3"><button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-ivory disabled:opacity-50" onClick={()=>act('helpful')} disabled={busy}>Helpful 👍 <span className="text-ink/60">({review.helpfulCount})</span></button><button type="button" className="min-h-10 rounded-lg px-2 text-xs text-ink/60 underline hover:text-maroon disabled:opacity-50" onClick={()=>act('report')} disabled={busy}>Report review</button></div>
  {actionMessage&&<p role="status" className="mt-2 text-xs text-ink/70">{actionMessage}</p>}
 </article>
}

export function CustomerReviews({productId='',productName='',initialName='',initialEmail='',openOnLoad=false}) {
 const[rating,setRating]=useState(0)
 const[sort,setSort]=useState('recent')
 const[page,setPage]=useState(1)
 const[formOpen,setFormOpen]=useState(false)
 const[notice,setNotice]=useState('')
 useEffect(()=>{if(openOnLoad)setFormOpen(true)},[openOnLoad])
 const limit=6
 const feed=useReviewFeed({productId,rating,sort,page,limit})
 const summary=feed.summary||{average:0,total:0,breakdown:[5,4,3,2,1].map(star=>({rating:star,percent:0,count:0}))}
 const changeRating=value=>{setRating(value);setPage(1)}
 const changeSort=value=>{setSort(value);setPage(1)}
 const loadNext=()=>setPage(value=>value+1)
 const submitted=message=>{setFormOpen(false);setNotice(message)}

 return <section className="mt-16 border-t border-gold/40 pt-10" aria-labelledby={productId?'product-reviews-heading':'all-reviews-heading'}>
  <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
   <div><p className="text-xs font-bold uppercase tracking-[.2em] text-gold-dark">Thoughtfully reviewed</p><h2 id={productId?'product-reviews-heading':'all-reviews-heading'} className="mt-1 text-3xl sm:text-4xl">{productId?'Customer Reviews':'What Our Customers Say'}</h2><p className="mt-2 text-ink/70">{productId?`Reviews for ${productName}.`:summary.total?'Real experiences from our happy customers.':'Approved customer feedback will appear here once reviews are submitted and moderated.'}</p></div>
   <button type="button" className={btnP+' w-full md:w-auto'} onClick={()=>setFormOpen(true)}>Write a Review</button>
  </div>

  <div className="mt-7 grid gap-6 rounded-2xl border border-gold/25 bg-white p-5 shadow-sm md:grid-cols-[minmax(230px,.8fr)_1.2fr] md:p-7">
   <div className="flex flex-col justify-center border-b border-gold/20 pb-5 text-center md:border-b-0 md:border-r md:pb-0 md:pr-7">
    <p className="font-serif text-5xl font-semibold text-maroon">{summary.total?summary.average.toFixed(1):'—'}<span className="text-2xl text-ink/50"> / 5.0</span></p>
    <p className="mt-2 text-2xl tracking-[.2em] text-gold" aria-label={summary.total?`${summary.average.toFixed(1)} out of 5`:'No approved ratings yet'}>{summary.total?stars(Math.round(summary.average)):'☆☆☆☆☆'}</p>
    <p className="mt-2 text-sm text-ink/70">{feed.loading?'Loading customer reviews…':summary.total?`Based on ${summary.total} approved customer ${summary.total===1?'review':'reviews'}`:'No approved customer reviews yet'}</p>
    <p className="mt-4 text-xs font-semibold text-emerald">✓ Moderated customer feedback</p>
   </div>
   <div className="flex flex-col justify-center"><h3 className="font-bold">Rating breakdown</h3><RatingBreakdown summary={summary}/></div>
  </div>

  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
   <div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/60" htmlFor="review-filter">Filter reviews</label><select id="review-filter" className="min-h-11 w-full rounded-lg border border-gold/40 bg-white px-3 sm:w-48" value={rating} onChange={event=>changeRating(Number(event.target.value))}><option value={0}>All Reviews</option>{[5,4,3,2,1].map(value=><option key={value} value={value}>{value} Star{value>1?'s':''}</option>)}</select></div>
   <div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/60" htmlFor="review-sort">Sort by</label><select id="review-sort" className="min-h-11 w-full rounded-lg border border-gold/40 bg-white px-3 sm:w-48" value={sort} onChange={event=>changeSort(event.target.value)}><option value="recent">Most Recent</option><option value="helpful">Most Helpful</option><option value="highest">Highest Rated</option></select></div>
   {feed.total>0&&<p className="text-sm text-ink/60 sm:ml-auto">{feed.total} approved {feed.total===1?'review':'reviews'}</p>}
  </div>

  {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald/20 bg-emerald/10 p-4 text-sm text-emerald">{notice}</p>}
  {feed.error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{feed.error}</p>}
  {feed.loading&&!feed.items.length&&<div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3" aria-label="Loading reviews">{[1,2,3].map(value=><div key={value} className="min-w-[88%] animate-pulse snap-start rounded-2xl border border-gold/20 bg-white p-6 sm:min-w-[70%] md:min-w-0"><div className="h-12 w-12 rounded-full bg-ivory-dark"/><div className="mt-5 h-4 w-1/3 rounded bg-ivory-dark"/><div className="mt-3 h-4 w-full rounded bg-ivory-dark"/><div className="mt-2 h-4 w-4/5 rounded bg-ivory-dark"/></div>)}</div>}
  {!feed.loading&&!feed.error&&!feed.items.length&&<div className="mt-5 rounded-2xl border border-dashed border-gold/40 bg-white px-5 py-12 text-center"><p className="text-3xl text-gold" aria-hidden="true">☆</p><h3 className="mt-2 text-2xl">No reviews to show yet</h3><p className="mt-2 text-sm text-ink/70">{rating?'Try another rating filter.':'Be the first to share your experience with this product.'}</p><button type="button" className={btnO+' mt-5'} onClick={()=>setFormOpen(true)}>Write a Review</button></div>}
  {feed.items.length>0&&<div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">{feed.items.map(review=><ReviewCard key={review.id} review={review} onAction={feed.reload}/>)}</div>}
  {page<feed.pages&&<div className="mt-8 text-center"><button type="button" className={btnO} onClick={loadNext} disabled={feed.loading}>{feed.loading?'Loading…':'Load more reviews'}</button></div>}
  <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-gold/20 pt-5 text-xs font-semibold text-ink/70"><span>✓ Moderated customer feedback</span><span>✓ Product-specific reviews</span><span>✓ Reportable reviews</span></div>
  {formOpen&&<ReviewForm productId={productId} initialName={initialName} initialEmail={initialEmail} onClose={()=>setFormOpen(false)} onSubmitted={submitted}/>}
 </section>
}
