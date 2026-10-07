import {useSyncExternalStore} from 'react'
const K='kfs_orders',subs=new Set()
const read=()=>{try{return JSON.parse(localStorage.getItem(K))||[]}catch{return[]}}
let list=read()
const write=l=>{list=l;try{localStorage.setItem(K,JSON.stringify(l))}catch{}subs.forEach(f=>f())}
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===K||e.key===null){list=read();subs.forEach(f=>f())}})
export const addOrder=o=>write([o,...read()])
export const updateOrder=(no,patch)=>write(read().map(o=>o.no===no?{...o,...patch}:o))
export const deleteOrder=no=>write(read().filter(o=>o.no!==no))
export const useOrders=()=>useSyncExternalStore(f=>{subs.add(f);return()=>subs.delete(f)},()=>list)
