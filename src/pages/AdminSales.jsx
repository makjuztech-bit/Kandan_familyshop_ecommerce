import {useEffect,useMemo,useState} from 'react'
import {products,inr} from '../data/products'
import {useOrders} from '../data/orders'
import {productSales,salesChart,salesMetrics} from '../data/sales'
import {refreshReviewSummaries,useReviewSummaries} from '../data/reviews'

const periods=[['today','Today'],['7d','Last 7 days'],['30d','Last 30 days'],['year','This year']]
const dateStart=(days=0)=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate()-days)}
const Stat=({label,value})=><article className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm"><p className="text-sm text-ink/60">{label}</p><p className="mt-2 font-serif text-3xl font-semibold text-maroon">{value}</p></article>

export default function AdminSales(){
 const orders=useOrders(),[period,setPeriod]=useState('7d'),[reviewError,setReviewError]=useState('')
 const summaries=useReviewSummaries()
 useEffect(()=>{refreshReviewSummaries().catch(error=>setReviewError(error instanceof Error?error.message:'Could not load review statistics.'))},[])
 const now=new Date(),from=period==='today'?dateStart():period==='7d'?dateStart(6):period==='30d'?dateStart(29):new Date(now.getFullYear(),0,1)
 const range=salesMetrics(orders,from,new Date(now.getFullYear(),now.getMonth(),now.getDate()+1))
 const all=salesMetrics(orders),today=salesMetrics(orders,dateStart(),new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)),month=salesMetrics(orders,new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,1))
 const chart=salesChart(range.orders,period),max=Math.max(1,...chart.map(item=>item.value))
 const rows=useMemo(()=>products.map(product=>({product,sales:productSales(orders,product.id),rating:summaries.data[product.id]||{average:0,total:0}})).sort((a,b)=>b.sales.units-a.sales.units||a.product.name.localeCompare(b.product.name)),[orders,summaries.data])
 return <section>
  <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl">Sales analytics</h1><p className="mt-2 text-sm text-ink/70">Only explicitly paid orders count. Cancelled, failed, refunded, and legacy orders without payment confirmation are excluded.</p></div><div className="flex flex-wrap gap-2" aria-label="Sales chart period">{periods.map(([key,label])=><button key={key} type="button" aria-pressed={period===key} onClick={()=>setPeriod(key)} className={'min-h-10 rounded-full px-4 text-sm font-bold '+(period===key?'bg-maroon text-ivory':'border border-gold/40 bg-white text-maroon')}>{label}</button>)}</div></div>
  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total units sold" value={all.units.toLocaleString('en-IN')}/><Stat label="Total revenue" value={inr(all.revenue)}/><Stat label="Today's sales" value={`${today.units.toLocaleString('en-IN')} units · ${inr(today.revenue)}`}/><Stat label="This month's sales" value={`${month.units.toLocaleString('en-IN')} units · ${inr(month.revenue)}`}/></div>
  <section className="mt-7 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl">Revenue trend</h2><p className="mt-1 text-sm text-ink/60">Paid order revenue · {periods.find(([key])=>key===period)?.[1]}</p></div><p className="font-bold text-maroon">{inr(range.revenue)} in selected period</p></div>
   <div className="mt-6 flex h-48 items-end gap-1 border-b border-gold/30 px-1 sm:gap-2">{chart.map((item,index)=><div key={`${item.label}-${index}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span className="mb-1 truncate text-[10px] text-ink/60 opacity-0 group-hover:opacity-100">{inr(item.value)}</span><div className="mx-auto w-full max-w-10 rounded-t-md bg-gold transition-all duration-300 group-hover:bg-maroon" style={{height:`${Math.max(item.value?4:0,item.value/max*78)}%`}} title={`${item.label}: ${inr(item.value)}`}/><span className="mt-2 truncate text-[10px] text-ink/60">{item.label}</span></div>)}</div>
  </section>
  <section className="mt-7 rounded-2xl border border-gold/30 bg-white shadow-sm"><div className="p-5"><h2 className="text-2xl">Product performance</h2><p className="mt-1 text-sm text-ink/60">All-time units and revenue from paid orders, with current approved-review ratings.</p></div>
   {reviewError&&<p role="alert" className="mx-5 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Sales are available, but ratings could not be refreshed: {reviewError}</p>}
   <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-ivory-dark text-ink/70"><tr><th className="p-3">Product</th><th className="p-3">Units sold</th><th className="p-3">Revenue</th><th className="p-3">Rating</th><th className="p-3">Reviews</th></tr></thead><tbody>{rows.map(({product,sales,rating})=><tr key={product.id} className="border-t border-gold/20"><td className="p-3"><span className="font-bold">{product.name}</span><span className="block text-xs text-ink/60">{product.collection} · SKU {product.id.toUpperCase()}</span></td><td className="p-3">{sales.units.toLocaleString('en-IN')}</td><td className="p-3">{inr(sales.revenue)}</td><td className="p-3">{rating.total?`${rating.average.toFixed(1)} ★`:'—'}</td><td className="p-3">{rating.total.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
   {!rows.length&&<p className="p-6 text-center text-ink/60">No products to report.</p>}
  </section>
 </section>
}
