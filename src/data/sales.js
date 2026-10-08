const excludedStatuses=new Set(['cancelled','refunded'])
const parseDate=order=>{
 const value=order.createdAt||order.at
 const date=value?new Date(value):null
 return date&&!Number.isNaN(date.getTime())?date:null
}

export function isCompletedSale(order){
 const orderStatus=String(order.status||'').toLowerCase()
 const paymentStatus=String(order.paymentStatus||'').toLowerCase()
 return paymentStatus==='paid'&&!excludedStatuses.has(orderStatus)&&paymentStatus!=='refunded'
}

export function unitsSold(orders,productId){
 return orders.filter(isCompletedSale).reduce((total,order)=>total+(order.items||[]).reduce((quantity,item)=>{
  const id=item.productId||item.sku?.toLowerCase()
  return id===productId?quantity+(Number.isFinite(Number(item.q))?Math.max(0,Number(item.q)):0):quantity
 },0),0)
}

export function salesMetrics(orders,from,to){
 const completed=orders.filter(order=>{
  if(!isCompletedSale(order))return false
  const date=parseDate(order)
  return (!date&&!from&&!to)||(date&&(!from||date>=from)&&(!to||date<to))
 })
 return{
  orders:completed,
  units:completed.reduce((total,order)=>total+(order.items||[]).reduce((sum,item)=>sum+(Number.isFinite(Number(item.q))?Math.max(0,Number(item.q)):0),0),0),
  revenue:completed.reduce((total,order)=>total+(Number.isFinite(Number(order.total))?Math.max(0,Number(order.total)):0),0)
 }
}

export function productSales(orders,productId){
 return orders.filter(isCompletedSale).reduce((sales,order)=>{
  for(const item of order.items||[]){
   const id=item.productId||item.sku?.toLowerCase()
   if(id!==productId)continue
   const quantity=Number.isFinite(Number(item.q))?Math.max(0,Number(item.q)):0
   sales.units+=quantity
   sales.revenue+=quantity*(Number.isFinite(Number(item.price))?Math.max(0,Number(item.price)):0)
  }
  return sales
 },{units:0,revenue:0})
}

export function salesChart(orders,period){
 const now=new Date(),buckets=[]
 if(period==='today'){
  for(let hour=8;hour<=21;hour++){
   const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour)
   const end=new Date(start.getTime()+60*60*1000)
   buckets.push({label:start.toLocaleTimeString(undefined,{hour:'numeric'}),start,end})
  }
 }else if(period==='year'){
  for(let month=0;month<12;month++){
   const start=new Date(now.getFullYear(),month,1),end=new Date(now.getFullYear(),month+1,1)
   buckets.push({label:start.toLocaleDateString(undefined,{month:'short'}),start,end})
  }
 }else{
  const days=period==='7d'?7:30
  for(let index=days-1;index>=0;index--){
   const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-index)
   const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+1)
   buckets.push({label:period==='30d'?`${start.getDate()}`:start.toLocaleDateString(undefined,{weekday:'short'}),start,end})
  }
 }
 const values=buckets.map(bucket=>orders.filter(order=>{
  if(!isCompletedSale(order))return false
  const date=parseDate(order)
  return date&&date>=bucket.start&&date<bucket.end
 }).reduce((sum,order)=>sum+(Number.isFinite(Number(order.total))?Math.max(0,Number(order.total)):0),0))
 return buckets.map((bucket,index)=>({...bucket,value:values[index]}))
}
