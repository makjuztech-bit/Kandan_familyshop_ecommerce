import {useSyncExternalStore} from 'react'
import {IMG} from '../config/shop'
// SAMPLE catalogue. Images: /public/images/products/<id>-1.jpg (drape), -2.jpg (zari border close-up), -3.jpg (model)
export const inr=n=>'₹'+n.toLocaleString('en-IN')
export const HEX={Maroon:'#6b1523',Red:'#a3182b','Emerald Green':'#1f6b52',Mustard:'#c9962b',Ivory:'#e9dcc0',Pink:'#c8567a','Peacock Blue':'#14697a',Purple:'#5b2a76',Teal:'#1b7a78',Orange:'#d2661e',Navy:'#1e2a5a',Magenta:'#a21b66',Gold:'#b8964f',White:'#f8f4eb',Charcoal:'#3b3b3b',Khaki:'#8f8a5b'}
export const COLLECTIONS=['Soft Silk','Shirts','Tops','Pants','Bridal Collection']
const care={s:'Dry clean only. Store folded in a muslin cloth; refold every few months to protect zari.',c:'Gentle cold hand wash separately or dry clean. Do not wring. Shade dry; iron on low heat.'}
const rows=[
['Royal Red Bridal Silk','Bridal Collection','Red','Heavy silk','Rich gold-tone zari body and pallu',24999,1],
['Ivory and Gold Bridal Silk','Bridal Collection','Ivory','Silk blend','Fine zari buttas, wide gold border',22400,1],
['Pink Muhurtham Bridal Silk','Bridal Collection','Pink','Heavy silk','Zari mango motifs, contrast border',19800,1],
['Peacock Blue Soft Silk','Soft Silk','Peacock Blue','Soft silk','Slim zari border',6499,1],
['Lavender Soft Silk Butta','Soft Silk','Purple','Soft silk','Small zari buttas',5799,1],
['Rose Soft Silk Stripe','Soft Silk','Pink','Soft silk','Zari stripes on pallu',4999,1],
['Teal Soft Silk Jacquard','Soft Silk','Teal','Soft silk','Jacquard border with zari accents',7250,0],
['Classic White Linen Shirt','Shirts','White','Cotton linen','Tailored fit with subtle self-texture',3999,1],
['Navy Check Shirt','Shirts','Navy','Cotton blend','Checked weave, button placket',4299,1],
['Pearl Pink Satin Top','Tops','Pink','Satin','Soft draped neckline with clean finish',3499,1],
['Ivory Ruffle Top','Tops','Ivory','Cotton','Light ruffle sleeves and fit',2999,1],
['Charcoal Wide-Leg Pants','Pants','Charcoal','Cotton twill','Relaxed pleated waist and straight fall',4599,1],
['Khaki Straight Pants','Pants','Khaki','Cotton twill','Easy movement and clean front creases',4299,1],
['Plum Satin Evening Top','Tops','Purple','Satin','Minimal shimmer finish with elegant drape',3899,1],
['Soft Pink Printed Shirt','Shirts','Pink','Cotton','Tiny floral print and relaxed tailoring',4499,1],
['Burgundy Casual Shirt','Shirts','Maroon','Cotton','Structured collar, easy fit for daily wear',4199,1],
['Rose Gold Soft Silk Saree','Soft Silk','Gold','Soft silk','Soft sheen and subtle zari accents',7999,1],
['Emerald Flowing Soft Silk','Soft Silk','Emerald Green','Soft silk','Fine border detail and satin touch',6899,1],
['Black Slim Fit Trousers','Pants','Charcoal','Stretch twill','Tailored waist with modern straight fall',5199,1],
['Stone Beige Lounge Pants','Pants','Ivory','Cotton blend','Comfort fit with soft textured finish',3799,1]]
const seed=rows.map(([name,collection,colour,fabric,zari,price,stock],i)=>{const id='kfs-'+String(i+1).padStart(3,'0')
 return {id,name,collection,colour,fabric,zari,price,stock:!!stock,hex:HEX[colour],images:[1,2,3].map(n=>`/images/products/${id}-${n}.jpg`),
 blouse:'Unstitched blouse piece included (sample detail — confirm in store).',care:/cotton/i.test(fabric)?care.c:care.s,
 best:[0,3,6,13,4,10].includes(i),isNew:[1,7,9,12,14,15].includes(i)}})

// Live catalogue: seed data + admin edits (localStorage). Other tabs update through the "storage" event.
const KEY='kfs_catalog',IK='kfs_site_images',subs=new Set(),D=structuredClone(IMG)
const rd=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
export const products=[],byId={}
let ver=0
const emit=()=>{ver++;subs.forEach(f=>f())}
function load(){const l=rd(KEY,null)||seed;products.splice(0,products.length,...l);Object.keys(byId).forEach(k=>delete byId[k]);l.forEach(p=>byId[p.id]=p)
 const o=rd(IK,{});['hero','banner','about'].forEach(k=>IMG[k]=o[k]||D[k]);COLLECTIONS.forEach(c=>IMG.collections[c]=o['c:'+c]||D.collections[c])}
load()
if(typeof window!=='undefined')window.addEventListener('storage',()=>{load();emit()})
export const useCatalog=()=>useSyncExternalStore(f=>{subs.add(f);return()=>subs.delete(f)},()=>ver)
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
export function saveProduct(p){const i=products.findIndex(x=>x.id===p.id);const next=i<0?[...products,p]:products.map(x=>x.id===p.id?p:x)
 if(!save(KEY,next))return false;load();emit();return true}
export function deleteProduct(id){save(KEY,products.filter(p=>p.id!==id));load();emit()}
export const siteImg=k=>k.startsWith('c:')?IMG.collections[k.slice(2)]:IMG[k]
export function setSiteImage(k,v){const o=rd(IK,{});if(v)o[k]=v;else delete o[k];if(!save(IK,o))return false;load();emit();return true}
export function resetCatalog(){localStorage.removeItem(KEY);localStorage.removeItem(IK);load();emit()}
