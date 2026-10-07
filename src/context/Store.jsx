import {createContext,useContext,useEffect,useState} from 'react'
import {byId} from '../data/products'
const C=createContext(),load=k=>{try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]}}
export const useStore=()=>useContext(C)
export function StoreProvider({children}){
 const [cart,setCart]=useState(()=>load('kfs_cart').filter(i=>byId[i.id])),[wish,setWish]=useState(()=>load('kfs_wish').filter(id=>byId[id]))
 useEffect(()=>{try{localStorage.setItem('kfs_cart',JSON.stringify(cart))}catch{}},[cart])
 useEffect(()=>{try{localStorage.setItem('kfs_wish',JSON.stringify(wish))}catch{}},[wish])
 const add=(id,q=1)=>byId[id].stock&&setCart(c=>c.some(i=>i.id===id)?c.map(i=>i.id===id?{...i,q:Math.min(10,i.q+q)}:i):[...c,{id,q}])
 const setQty=(id,q)=>setCart(c=>q<1?c.filter(i=>i.id!==id):c.map(i=>i.id===id?{...i,q:Math.min(10,q)}:i))
 const remove=id=>setCart(c=>c.filter(i=>i.id!==id)),clear=()=>setCart([])
 const toggleWish=id=>setWish(w=>w.includes(id)?w.filter(x=>x!==id):[...w,id])
 const lines=cart.map(i=>({...byId[i.id],q:i.q})),count=lines.reduce((s,l)=>s+l.q,0),total=lines.reduce((s,l)=>s+l.q*l.price,0)
 return <C.Provider value={{cart,lines,count,total,add,setQty,remove,clear,wish,toggleWish}}>{children}</C.Provider>}
