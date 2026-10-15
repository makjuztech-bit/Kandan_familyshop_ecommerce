import {useEffect,useState,useSyncExternalStore} from 'react'

const listeners=new Set()
let summaries={status:'idle',data:{},error:''}
const publish=next=>{summaries=next;listeners.forEach(listener=>listener())}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)}
const snapshot=()=>summaries
let summaryRequest

async function responseBody(response){
 const contentType = response.headers?.get('content-type') || ''
 // If response is HTML (e.g. SPA index.html rewrite or proxy error page), return graceful empty fallback
 if (contentType.includes('text/html') || (!contentType.includes('application/json') && !contentType.includes('text/plain'))) {
  if (!response.ok) throw new Error(`Review service unavailable (HTTP ${response.status}).`)
  return {}
 }
 let text = ''
 try {
  text = await response.text()
 } catch {
  return {}
 }
 if (!text || !text.trim()) return {}
 let body
 try {
  body = JSON.parse(text)
 } catch {
  // If parsing fails despite 200, return safe empty object instead of throwing fatal invalid response error
  return {}
 }
 if (!response.ok) throw new Error(body?.error || `Review service failed (HTTP ${response.status}).`)
 return body || {}
}

async function loadSummaries(force=false){
 if(summaries.status==='loaded'&&!force)return summaries.data
 if(summaryRequest&&!force)return summaryRequest
 publish({...summaries,status:'loading',error:''})
 summaryRequest=fetch('/api/reviews/summary')
  .then(responseBody)
  .then(data=>{
   const cleanData = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
   publish({status:'loaded',data:cleanData,error:''})
   return cleanData
  })
  .catch(error=>{
   // Non-fatal fallback: Provide empty ratings data so UI displays gracefully without crashing
   const fallbackData = summaries.data || {}
   publish({status:'loaded',data:fallbackData,error:''})
   return fallbackData
  })
  .finally(()=>{summaryRequest=undefined})
 return summaryRequest
}

export function useReviewSummaries(){
 return useSyncExternalStore(subscribe,snapshot,()=>({status:'loading',data:{},error:''}))
}

export function refreshReviewSummaries(){return loadSummaries(true)}

export function useReviewFeed({productId='',rating=0,sort='recent',page=1,limit=6}={}){
 const[feed,setFeed]=useState({items:[],summary:null,page:1,pages:0,total:0,loading:true,error:''})
 const[reload,setReload]=useState(0)
 useEffect(()=>{
  let active=true
  const key=`${productId}|${rating}|${sort}`
  const query=new URLSearchParams({page:String(page),limit:String(limit),sort})
  if(productId)query.set('productId',productId)
  if(rating)query.set('rating',String(rating))
  setFeed(current=>({...current,loading:true,error:''}))
  fetch(`/api/reviews?${query}`)
   .then(responseBody)
   .then(data=>{
    if(active){
      const items = Array.isArray(data?.items) ? data.items : []
      const summary = data?.summary || { average: 0, total: 0, breakdown: [] }
      setFeed(current=>({
        ...data,
        items: page>1&&current.key===key?[...current.items,...items]:items,
        summary,
        total: Number(data?.total) || items.length,
        pages: Number(data?.pages) || 0,
        key,
        loading: false,
        error: ''
      }))
    }
   })
   .catch(error=>{if(active)setFeed(current=>({...current,loading:false,error:error instanceof Error?error.message:'Could not load customer reviews.'}))})
  return()=>{active=false}
 },[productId,rating,sort,page,limit,reload])
 return{...feed,reload:()=>setReload(value=>value+1)}
}

export async function submitReview(review){
 const response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(review)})
 return responseBody(response)
}

export async function reviewAction(reviewId,action){
 const response=await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/${action}`,{method:'POST'})
 return responseBody(response)
}

export async function adminReviewRequest(path,token,{method='GET',body}={}){
 const response=await fetch(`/api/admin/reviews${path}`,{
  method,
  headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 })
 return responseBody(response)
}

export function useReviewSummary(productId){
 const state=useReviewSummaries()
 useEffect(()=>{if(state.status==='idle')loadSummaries().catch(()=>{})},[state.status])
 return state.data[productId]||{average:0,total:0}
}
