import {useEffect,useState} from 'react'
import {adminReviewRequest,refreshReviewSummaries} from '../data/reviews'
import {btnP,btnO,Field} from '../components/ui'

const card='rounded-xl border border-gold/30 bg-white p-5 shadow-sm'

function ReviewEditor({review,onSave,onDelete,onRefresh}){
 const[draft,setDraft]=useState(review)
 const[busy,setBusy]=useState(false)
 const[message,setMessage]=useState('')
 useEffect(()=>setDraft(review),[review])
 const change=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const save=async event=>{
  event.preventDefault();setBusy(true);setMessage('')
  try{await onSave(review.id,{name:draft.name,email:draft.email,rating:Number(draft.rating),title:draft.title,description:draft.description,status:draft.status,verified:draft.verified===1||draft.verified===true,featured:draft.featured===1||draft.featured===true,adminResponse:draft.adminResponse});setMessage('Review changes saved.');onRefresh()}
  catch(error){setMessage(error instanceof Error?error.message:'Could not save review.')}
  finally{setBusy(false)}
 }
 const removePhoto=async()=>{
  if(!window.confirm('Remove the customer photo from this review?'))return
  setBusy(true);setMessage('')
  try{await onSave(review.id,{removePhoto:true});setMessage('Customer photo removed.');onRefresh()}
  catch(error){setMessage(error instanceof Error?error.message:'Could not remove photo.')}
  finally{setBusy(false)}
 }
 const remove=async()=>{
  if(!window.confirm('Permanently delete this review and its customer photo?'))return
  setBusy(true);setMessage('')
  try{await onDelete(review.id)}
  catch(error){setMessage(error instanceof Error?error.message:'Could not delete review.');setBusy(false)}
 }
 return <article className={card}>
  <form onSubmit={save} className="space-y-4">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-ink/60">{review.id}</p><p className="mt-1 text-xs text-ink/60">{new Date(review.createdAt).toLocaleString()} · Product {review.productId}</p></div><div className="flex gap-2"><span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold capitalize">{draft.status}</span>{review.reportCount>0&&<span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">{review.reportCount} report{review.reportCount===1?'':'s'}</span>}</div></div>
   {review.photoUrl&&<div className="flex items-center gap-3"><img src={review.photoUrl} alt="Customer-submitted review photo" loading="lazy" className="h-20 w-20 rounded-lg object-cover"/><button type="button" className="text-sm text-red-700 underline" onClick={removePhoto} disabled={busy}>Remove photo</button></div>}
   <div className="grid gap-3 sm:grid-cols-2">
    <Field label="Customer name" id={`admin-review-name-${review.id}`} value={draft.name} onChange={event=>change('name',event.target.value)} maxLength={80}/>
    <Field label="Customer email (private)" id={`admin-review-email-${review.id}`} value={draft.email} onChange={event=>change('email',event.target.value)} maxLength={254}/>
    <div><label className="mb-1 block text-sm font-bold" htmlFor={`admin-review-rating-${review.id}`}>Rating</label><select id={`admin-review-rating-${review.id}`} className="min-h-11 w-full border border-gold-dark/50 bg-white px-3" value={draft.rating} onChange={event=>change('rating',event.target.value)}>{[5,4,3,2,1].map(rating=><option key={rating} value={rating}>{rating} stars</option>)}</select></div>
    <div><label className="mb-1 block text-sm font-bold" htmlFor={`admin-review-status-${review.id}`}>Moderation</label><select id={`admin-review-status-${review.id}`} className="min-h-11 w-full border border-gold-dark/50 bg-white px-3" value={draft.status} onChange={event=>change('status',event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
    <div className="sm:col-span-2"><Field label="Review title" id={`admin-review-title-${review.id}`} value={draft.title} onChange={event=>change('title',event.target.value)} maxLength={120}/></div>
    <div className="sm:col-span-2"><Field area label="Review description" id={`admin-review-description-${review.id}`} value={draft.description} onChange={event=>change('description',event.target.value)} maxLength={2000}/></div>
    <div className="flex flex-wrap gap-5 sm:col-span-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!draft.verified} onChange={event=>change('verified',event.target.checked)}/>Mark as verified buyer</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!draft.featured} onChange={event=>change('featured',event.target.checked)}/>Feature review</label></div>
    <div className="sm:col-span-2"><Field area label="Shop response (optional)" id={`admin-review-response-${review.id}`} value={draft.adminResponse||''} onChange={event=>change('adminResponse',event.target.value)} maxLength={1000}/></div>
   </div>
   {message&&<p role="status" className="text-sm text-ink/70">{message}</p>}
   <div className="flex flex-wrap gap-2"><button className={btnP} disabled={busy}>{busy?'Saving…':'Save review'}</button><button type="button" className={btnO} disabled={busy} onClick={()=>onSave(review.id,{status:'approved'}).then(onRefresh).catch(error=>setMessage(error.message))}>Approve</button><button type="button" className={btnO} disabled={busy} onClick={()=>onSave(review.id,{status:'rejected'}).then(onRefresh).catch(error=>setMessage(error.message))}>Reject</button><button type="button" className="min-h-11 px-3 text-sm text-red-700 underline" disabled={busy} onClick={remove}>Delete</button></div>
  </form>
 </article>
}

export default function AdminReviews(){
 const[token,setToken]=useState('')
 const[tokenInput,setTokenInput]=useState('')
 const[status,setStatus]=useState('pending')
 const[stats,setStats]=useState(null)
 const[items,setItems]=useState([])
 const[page,setPage]=useState(1)
 const[pages,setPages]=useState(0)
 const[loading,setLoading]=useState(false)
 const[error,setError]=useState('')
 const[connected,setConnected]=useState(false)
 const load=async(currentToken=token,currentStatus=status,currentPage=page)=>{
  if(!currentToken)return
  setLoading(true);setError('')
  try{
   const[list,summary]=await Promise.all([adminReviewRequest(`?status=${currentStatus}&page=${currentPage}`,currentToken),adminReviewRequest('/stats',currentToken)])
   setItems(list.items);setPages(list.pages);setStats(summary);setConnected(true)
  }catch(problem){setError(problem instanceof Error?problem.message:'Could not load review moderation data.');setConnected(false)}
  finally{setLoading(false)}
 }
 useEffect(()=>{if(connected)load(token,status,page)},[status,page])
 const connect=event=>{event.preventDefault();setPage(1);setToken(tokenInput.trim());load(tokenInput.trim(),status,1)}
 const save=async(id,body)=>{const result=await adminReviewRequest(`/${encodeURIComponent(id)}`,token,{method:'PUT',body});refreshReviewSummaries().catch(problem=>setError(`Review saved, but public ratings could not be refreshed: ${problem.message}`));return result}
 const remove=async id=>{await adminReviewRequest(`/${encodeURIComponent(id)}`,token,{method:'DELETE'});refreshReviewSummaries().catch(problem=>setError(`Review deleted, but public ratings could not be refreshed: ${problem.message}`));await load(token,status,page)}
 return <section>
  <h1 className="text-3xl">Review management</h1>
  <p className="mt-2 max-w-3xl text-sm text-ink/70">Only approved reviews appear on the storefront. Customer email addresses and photos are private moderation data. Connect with the review admin token configured in the server environment.</p>
  {!connected&&<form onSubmit={connect} className={`${card} mt-5 max-w-xl space-y-4`}><Field label="Review admin token" id="review-admin-token" type="password" autoComplete="current-password" value={tokenInput} onChange={event=>setTokenInput(event.target.value)}/><button className={btnP} disabled={loading}>{loading?'Connecting…':'Connect securely'}</button></form>}
  {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {connected&&<div className="mt-5 space-y-5">
   {stats&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{['pending','approved','rejected'].map(key=><div key={key} className={card}><p className="text-sm capitalize text-ink/60">{key} reviews</p><p className="mt-1 font-serif text-3xl text-maroon">{stats.statuses[key]||0}</p></div>)}<div className={card}><p className="text-sm text-ink/60">Approved average</p><p className="mt-1 font-serif text-3xl text-maroon">{stats.summary.total?stats.summary.average.toFixed(1):'—'} / 5</p></div><div className={card}><p className="text-sm text-ink/60">Approved ratings</p><p className="mt-1 font-serif text-3xl text-maroon">{stats.summary.total}</p></div></div>}
   <div className="flex flex-wrap items-end justify-between gap-3"><div><label className="mb-1 block text-sm font-bold" htmlFor="admin-review-filter">Show reviews</label><select id="admin-review-filter" value={status} onChange={event=>{setStatus(event.target.value);setPage(1)}} className="min-h-11 border border-gold-dark/50 bg-white px-3"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All reviews</option></select></div><button type="button" className={btnO} onClick={()=>load()} disabled={loading}>{loading?'Refreshing…':'Refresh reviews'}</button></div>
   {loading&&!items.length&&<div className="grid gap-4" aria-label="Loading moderation queue">{[1,2,3].map(item=><div key={item} className="h-44 animate-pulse rounded-xl bg-white shadow-sm"/>)}</div>}
   {!loading&&!items.length&&<p className={`${card} text-center text-ink/70`}>No {status==='all'?'':`${status} `}reviews found.</p>}
   <div className="space-y-4">{items.map(review=><ReviewEditor key={review.id} review={review} onSave={save} onDelete={remove} onRefresh={()=>load()}/>)}</div>
   {page<pages&&<div className="text-center"><button type="button" className={btnO} disabled={loading} onClick={()=>setPage(current=>current+1)}>Load next page</button></div>}
  </div>}
 </section>
}
