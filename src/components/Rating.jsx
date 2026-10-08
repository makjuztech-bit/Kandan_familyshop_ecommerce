import {useReviewSummary} from '../data/reviews'
import {useOrders} from '../data/orders'
import {unitsSold} from '../data/sales'

export function ReviewSummary({productId}){
 const summary=useReviewSummary(productId)
 if(!summary.total)return <p className="text-sm text-ink/60">No ratings yet</p>
 const stars=Math.round(summary.average)
 return <p className="text-sm" aria-label={`${summary.average.toFixed(1)} out of 5 stars from ${summary.total} ${summary.total===1?'review':'reviews'}`}>
  <span aria-hidden="true" className="text-gold">{'★'.repeat(stars)}{'☆'.repeat(5-stars)}</span>
  <span className="ml-1 text-ink/70">{summary.average.toFixed(1)} ({summary.total})</span>
 </p>
}

export function ProductSalesSummary({productId}){
 const orders=useOrders(),count=unitsSold(orders,productId)
 const badge=count>=10000?'Bestseller':count>=1000?'Popular choice':count>=500?'Bestseller':''
 return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/70">
  {count>0?<span aria-label={`${count} units sold`}>▣ {count.toLocaleString('en-IN')} sold</span>:<span>No confirmed sales yet</span>}
  {badge&&<span className="rounded-full bg-gold/20 px-2 py-1 font-bold text-gold-dark">✦ {badge}</span>}
 </span>
}
