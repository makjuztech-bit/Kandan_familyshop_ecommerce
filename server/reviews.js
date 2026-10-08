import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {fileURLToPath} from 'node:url'
import rateLimit from 'express-rate-limit'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const maxPhotoBytes=2*1024*1024
const fallbackVoteSalt=randomBytes(32)
const root=dirname(fileURLToPath(import.meta.url))
const databasePath=resolve(process.env.REVIEWS_DB_PATH||`${root}/data/reviews.sqlite`)
mkdirSync(dirname(databasePath),{recursive:true})
const database=new DatabaseSync(databasePath)
database.exec(`
 PRAGMA journal_mode = WAL;
 PRAGMA foreign_keys = ON;
 PRAGMA trusted_schema = OFF;
 CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  photo BLOB,
  photo_type TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  verified INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  admin_response TEXT NOT NULL DEFAULT ''
 );
 CREATE INDEX IF NOT EXISTS reviews_public_product ON reviews(status, product_id, created_at);
 CREATE TABLE IF NOT EXISTS review_votes (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  PRIMARY KEY(review_id, voter_hash)
 );
 CREATE TABLE IF NOT EXISTS review_reports (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  PRIMARY KEY(review_id, voter_hash)
 );
`)

const publicFields=`id, product_id AS productId, name, rating, title, description,
 created_at AS createdAt, verified, featured, helpful_count AS helpfulCount,
 admin_response AS adminResponse, photo IS NOT NULL AS hasPhoto`
const adminFields=`${publicFields}, email, status, report_count AS reportCount, photo_type AS photoType`
const reviewLimiter=rateLimit({windowMs:60*60*1000,limit:3,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many review submissions. Please try again later.'}})
const actionLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many review actions. Please try again later.'}})

function safeTokenMatch(provided,expected){
 if(!provided||!expected)return false
 const left=Buffer.from(provided),right=Buffer.from(expected)
 return left.length===right.length&&timingSafeEqual(left,right)
}

function requireReviewAdmin(req,res,next){
 const expected=process.env.REVIEWS_ADMIN_TOKEN
 if(!expected||expected.length<32)return res.status(503).json({error:'Review moderation is not configured. Set a random REVIEWS_ADMIN_TOKEN of at least 32 characters in the server .env file.'})
 const provided=req.get('authorization')?.replace(/^Bearer\s+/i,'')
 if(!safeTokenMatch(provided,expected))return res.status(401).json({error:'Admin review token is missing or invalid.'})
 return next()
}

function voterHash(req){
 const salt=process.env.REVIEWS_VOTE_SALT||fallbackVoteSalt
 return createHmac('sha256',salt).update(`${req.ip}|${req.get('user-agent')||''}`).digest('hex')
}

function imageFromDataUrl(value){
 if(value===undefined||value===null||value==='')return{photo:null,type:null}
 if(typeof value!=='string'||value.length>Math.ceil(maxPhotoBytes*4/3)+100)return{error:'Customer photo must be 2 MB or smaller.'}
 const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
 if(!match)return{error:'Upload a JPEG, PNG, or WebP customer photo.'}
 const photo=Buffer.from(match[2],'base64')
 if(photo.length===0||photo.length>maxPhotoBytes)return{error:'Customer photo must be 2 MB or smaller.'}
 const signatures={
  'image/jpeg':photo[0]===0xff&&photo[1]===0xd8&&photo[2]===0xff,
  'image/png':photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
  'image/webp':photo.subarray(0,4).toString()==='RIFF'&&photo.subarray(8,12).toString()==='WEBP',
 }
 if(!signatures[match[1]])return{error:'The uploaded file does not match its image type.'}
 return{photo,type:match[1]}
}

function validateReview(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return'Invalid review request.'
 if(typeof body.website==='string'&&body.website.trim())return'Invalid review request.'
 if(typeof body.productId!=='string'||!/^kfs-[a-z0-9-]{1,60}$/i.test(body.productId))return'Choose a valid product.'
 if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>80)return'Name must be between 2 and 80 characters.'
 if(typeof body.email!=='string'||body.email.trim().length>254||!emailPattern.test(body.email.trim()))return'Enter a valid email address.'
 if(!Number.isInteger(body.rating)||body.rating<1||body.rating>5)return'Choose a rating from 1 to 5 stars.'
 if(typeof body.title!=='string'||body.title.trim().length<3||body.title.trim().length>120)return'Title must be between 3 and 120 characters.'
 if(typeof body.description!=='string'||body.description.trim().length<10||body.description.trim().length>2000)return'Review must be between 10 and 2,000 characters.'
 return null
}

function getSummary(productId){
 const condition=productId?'WHERE status = ? AND product_id = ?':'WHERE status = ?'
 const args=productId?['approved',productId]:['approved']
 const grouped=database.prepare(`SELECT rating, COUNT(*) AS count FROM reviews ${condition} GROUP BY rating`).all(...args)
 const counts=Object.fromEntries([1,2,3,4,5].map(rating=>[rating,0]))
 grouped.forEach(row=>{counts[row.rating]=row.count})
 const total=Object.values(counts).reduce((sum,count)=>sum+count,0)
 const weighted=Object.entries(counts).reduce((sum,[rating,count])=>sum+Number(rating)*count,0)
 return{average:total?weighted/total:0,total,breakdown:[5,4,3,2,1].map(rating=>({rating,count:counts[rating],percent:total?Math.round(counts[rating]*100/total):0}))}
}

function withPhotoUrl(review){
 const{hasPhoto,...fields}=review
 return{...fields,photoUrl:hasPhoto?`/api/reviews/${encodeURIComponent(review.id)}/photo`:null}
}

export function registerReviewRoutes(app){
 app.get('/api/reviews/summary',(_req,res)=>{
  const rows=database.prepare(`SELECT product_id AS productId, rating, COUNT(*) AS count
   FROM reviews WHERE status = 'approved' GROUP BY product_id, rating`).all()
  const grouped=new Map()
  for(const row of rows){
   const summary=grouped.get(row.productId)||{total:0,weighted:0}
   summary.total+=row.count
   summary.weighted+=row.rating*row.count
   grouped.set(row.productId,summary)
  }
  return res.json(Object.fromEntries([...grouped].map(([productId,summary])=>[productId,{total:summary.total,average:summary.weighted/summary.total}])))
 })

 app.get('/api/reviews/:id/photo',(req,res)=>{
  const row=database.prepare('SELECT photo, photo_type AS type FROM reviews WHERE id = ? AND status = ?').get(req.params.id,'approved')
  if(!row?.photo)return res.sendStatus(404)
  res.set({'Content-Type':row.type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600','Content-Security-Policy':"default-src 'none'; sandbox"})
  return res.send(row.photo)
 })

 app.get('/api/reviews', (req,res)=>{
  const productId=typeof req.query.productId==='string'?req.query.productId:''
  if(productId&&!/^kfs-[a-z0-9-]{1,60}$/i.test(productId))return res.status(400).json({error:'Invalid product filter.'})
  const hasRating=typeof req.query.rating!=='undefined'
  const rating=hasRating?Number(req.query.rating):0
  if(hasRating&&(!Number.isInteger(rating)||rating<1||rating>5))return res.status(400).json({error:'Rating filter must be between 1 and 5.'})
  const page=Math.max(1,Math.min(1000,Number.parseInt(req.query.page,10)||1))
  const limit=Math.max(1,Math.min(24,Number.parseInt(req.query.limit,10)||6))
  const sort=['recent','helpful','highest'].includes(req.query.sort)?req.query.sort:'recent'
  const order=sort==='helpful'?'helpful_count DESC, created_at DESC':sort==='highest'?'rating DESC, created_at DESC':'featured DESC, created_at DESC'
  const filters=['status = ?'],params=['approved']
  if(productId){filters.push('product_id = ?');params.push(productId)}
  if(rating){filters.push('rating = ?');params.push(rating)}
  const where=filters.join(' AND ')
  const total=database.prepare(`SELECT COUNT(*) AS count FROM reviews WHERE ${where}`).get(...params).count
  const rows=database.prepare(`SELECT ${publicFields} FROM reviews WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params,limit,(page-1)*limit)
  return res.json({items:rows.map(withPhotoUrl),page,limit,total,pages:Math.ceil(total/limit),summary:getSummary(productId||undefined)})
 })

 app.post('/api/reviews',reviewLimiter,(req,res)=>{
  const error=validateReview(req.body)
  if(error)return res.status(400).json({error})
  const image=imageFromDataUrl(req.body.photo)
  if(image.error)return res.status(400).json({error:image.error})
  const id=randomUUID(),createdAt=new Date().toISOString()
  database.prepare(`INSERT INTO reviews(id,product_id,name,email,rating,title,description,photo,photo_type,created_at)
   VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,req.body.productId,req.body.name.trim(),req.body.email.trim().toLowerCase(),req.body.rating,req.body.title.trim(),req.body.description.trim(),image.photo,image.type,createdAt)
  return res.status(201).json({ok:true,message:'Thanks for your review. It will appear after moderation.'})
 })

 app.post('/api/reviews/:id/helpful',actionLimiter,(req,res)=>{
  const row=database.prepare('SELECT status FROM reviews WHERE id = ?').get(req.params.id)
  if(!row||row.status!=='approved')return res.status(404).json({error:'Review not found.'})
  try{database.prepare('INSERT INTO review_votes(review_id,voter_hash) VALUES(?,?)').run(req.params.id,voterHash(req))}
  catch(error){if(error.errcode===1555||error.errcode===2067)return res.status(409).json({error:'You already marked this review helpful.'});throw error}
  database.prepare('UPDATE reviews SET helpful_count=helpful_count+1 WHERE id=?').run(req.params.id)
  const count=database.prepare('SELECT helpful_count AS count FROM reviews WHERE id = ?').get(req.params.id).count
  return res.json({ok:true,helpfulCount:count})
 })

 app.post('/api/reviews/:id/report',actionLimiter,(req,res)=>{
  const row=database.prepare('SELECT status FROM reviews WHERE id = ?').get(req.params.id)
  if(!row||row.status!=='approved')return res.status(404).json({error:'Review not found.'})
  try{database.prepare('INSERT INTO review_reports(review_id,voter_hash) VALUES(?,?)').run(req.params.id,voterHash(req))}
  catch(error){if(error.errcode===1555||error.errcode===2067)return res.status(409).json({error:'You already reported this review.'});throw error}
  database.prepare('UPDATE reviews SET report_count=report_count+1 WHERE id=?').run(req.params.id)
  return res.json({ok:true,message:'Thank you. This review has been flagged for moderation.'})
 })

 app.get('/api/admin/reviews/:id/photo',requireReviewAdmin,(req,res)=>{
  const row=database.prepare('SELECT photo,photo_type AS type FROM reviews WHERE id=?').get(req.params.id)
  if(!row?.photo)return res.sendStatus(404)
  res.set({'Content-Type':row.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"})
  return res.send(row.photo)
 })

 app.get('/api/admin/reviews/stats',requireReviewAdmin,(_req,res)=>{
  const statuses=database.prepare('SELECT status,COUNT(*) AS count FROM reviews GROUP BY status').all()
  const summary=getSummary()
  return res.json({statuses:Object.fromEntries(statuses.map(row=>[row.status,row.count])),summary})
 })

 app.get('/api/admin/reviews',requireReviewAdmin,(req,res)=>{
  const status=['pending','approved','rejected'].includes(req.query.status)?req.query.status:'all'
  const page=Math.max(1,Math.min(1000,Number.parseInt(req.query.page,10)||1))
  const limit=Math.max(1,Math.min(50,Number.parseInt(req.query.limit,10)||20))
  const where=status==='all'?'':'WHERE status = ?'
  const params=status==='all'?[]:[status]
  const total=database.prepare(`SELECT COUNT(*) AS count FROM reviews ${where}`).get(...params).count
  const rows=database.prepare(`SELECT ${adminFields} FROM reviews ${where} ORDER BY report_count DESC, created_at DESC LIMIT ? OFFSET ?`).all(...params,limit,(page-1)*limit)
  return res.json({items:rows.map(review=>({...review,photoUrl:review.hasPhoto?`/api/admin/reviews/${encodeURIComponent(review.id)}/photo`:null})),page,limit,total,pages:Math.ceil(total/limit)})
 })

 app.put('/api/admin/reviews/:id',requireReviewAdmin,(req,res)=>{
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))return res.status(400).json({error:'Invalid review update.'})
  const allowed={status:'status',verified:'verified',featured:'featured',name:'name',email:'email',rating:'rating',title:'title',description:'description',adminResponse:'admin_response'}
  const sets=[],values=[]
  for(const[key,column]of Object.entries(allowed)){
   if(!(key in req.body))continue
   let value=req.body[key]
   if(key==='status'&&!['pending','approved','rejected'].includes(value))return res.status(400).json({error:'Invalid moderation status.'})
   if(key==='verified'||key==='featured'){if(typeof value!=='boolean')return res.status(400).json({error:`${key} must be true or false.`});value=value?1:0}
   if(key==='name'&&(typeof value!=='string'||value.trim().length<2||value.trim().length>80))return res.status(400).json({error:'Name must be between 2 and 80 characters.'})
   if(key==='email'&&(typeof value!=='string'||value.trim().length>254||!emailPattern.test(value.trim())))return res.status(400).json({error:'Enter a valid email address.'})
   if(key==='rating'&&(!Number.isInteger(value)||value<1||value>5))return res.status(400).json({error:'Rating must be between 1 and 5.'})
   const max=key==='title'?120:key==='description'?2000:key==='adminResponse'?1000:Infinity
   if(['title','description','adminResponse'].includes(key)&&(typeof value!=='string'||value.trim().length>(max)||(['title','description'].includes(key)&&value.trim().length<(key==='title'?3:10))))return res.status(400).json({error:`Invalid ${key}.`})
   sets.push(`${column} = ?`)
   values.push(typeof value==='string'?value.trim():value)
  }
  if('removePhoto'in req.body){if(typeof req.body.removePhoto!=='boolean')return res.status(400).json({error:'removePhoto must be true or false.'});if(req.body.removePhoto){sets.push('photo = NULL','photo_type = NULL')}}
  if(!sets.length)return res.status(400).json({error:'No review changes were provided.'})
  values.push(req.params.id)
  const result=database.prepare(`UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  if(!result.changes)return res.status(404).json({error:'Review not found.'})
  return res.json({ok:true})
 })

 app.delete('/api/admin/reviews/:id',requireReviewAdmin,(req,res)=>{
  const result=database.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id)
  if(!result.changes)return res.status(404).json({error:'Review not found.'})
  return res.json({ok:true})
 })
}
