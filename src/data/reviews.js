import {useEffect,useState,useSyncExternalStore} from 'react'

const listeners=new Set()
let summaries={status:'idle',data:{},error:''}
const publish=next=>{summaries=next;listeners.forEach(listener=>listener())}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)}
const snapshot=()=>summaries
let summaryRequest

async function responseBody(response){
 let body
 try{body=await response.json()}catch{throw new Error(`Review service returned an invalid response (HTTP ${response.status}).`)}
 if(!response.ok)throw new Error(body.error||`Review service failed (HTTP ${response.status}).`)
 return body
}

async function loadSummaries(force=false){
 if(summaries.status==='loaded'&&!force)return summaries.data
 if(summaryRequest&&!force)return summaryRequest
 publish({...summaries,status:'loading',error:''})
 summaryRequest=fetch('/api/reviews/summary').then(responseBody).then(data=>{
  publish({status:'loaded',data,error:''})
  return data
 }).catch(error=>{
  publish({status:'error',data:summaries.data,error:error instanceof Error?error.message:'Could not load ratings.'})
  throw error
 }).finally(()=>{summaryRequest=undefined})
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
   .then(data=>{if(active)setFeed(current=>({...data,items:page>1&&current.key===key?[...current.items,...data.items]:data.items,key,loading:false,error:''}))})
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
