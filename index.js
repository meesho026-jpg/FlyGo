import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'

const app = express()
const port = process.env.PORT || 4000
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}) : null
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024},fileFilter:(_req,file,cb)=>cb(null,file.mimetype==='application/pdf')})
const demoFlights = [
  {id:'demo-1',airline:'Sky Sample Air',number:'DEMO 101',from:'Indore',fromCode:'IDR',to:'Delhi',toCode:'DEL',depart:'08:10',arrive:'09:45',duration:'1h 35m',stops:'Non-stop',baggage:'15 kg',meal:'Not included',referenceFare:6200,sellingFare:4800,bookable:false},
  {id:'demo-2',airline:'Sample Wings',number:'DEMO 208',from:'Indore',fromCode:'IDR',to:'Mumbai',toCode:'BOM',depart:'12:20',arrive:'13:55',duration:'1h 35m',stops:'Non-stop',baggage:'15 kg',meal:'Included',referenceFare:5700,sellingFare:4500,bookable:false},
  {id:'demo-3',airline:'Demo Connect',number:'DEMO 315',from:'Delhi',fromCode:'DEL',to:'Bengaluru',toCode:'BLR',depart:'17:30',arrive:'20:15',duration:'2h 45m',stops:'Non-stop',baggage:'15 kg',meal:'Not included',referenceFare:8900,sellingFare:6900,bookable:false}
]
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}))
app.use(cors({origin:(process.env.FRONTEND_URL||'http://localhost:5173').split(','),credentials:true}))
app.use('/api/payments/webhook',express.raw({type:'application/json'}))
app.use(express.json({limit:'1mb'}))
app.use('/api',rateLimit({windowMs:60_000,max:100,standardHeaders:true,legacyHeaders:false}))
const fail=(res,status,error)=>res.status(status).json({error})
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
async function getUser(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer /,'')
  if(!token) return fail(res,401,'Sign in required')
  const {data,error}=await supabase.auth.getUser(token)
  if(error||!data.user) return fail(res,401,'Invalid session')
  req.user=data.user; next()
}
async function adminOnly(req,res,next){
  const {data,error}=await supabase.from('admin_users').select('user_id').eq('user_id',req.user.id).maybeSingle()
  if(error||!data) return fail(res,403,'Admin access required')
  next()
}
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'FlywaysGo API'}))
app.get('/api/flights',(_req,res)=>res.json({flights:demoFlights,notice:'Sample data only. Not live airline inventory.'}))
app.post('/api/coupons/quote',async(req,res)=>{
  const {code,flightId,quantity=1}=req.body||{}
  const flight=demoFlights.find(f=>f.id===flightId)
  if(!flight) return fail(res,400,'Unknown flight')
  const {data,error}=await supabase.from('coupons').select('*').eq('code',String(code||'').toUpperCase()).eq('active',true).maybeSingle()
  if(error||!data) return fail(res,400,'Coupon is invalid or inactive')
  const base=flight.sellingFare*Math.min(9,Math.max(1,Number(quantity)||1))
  if(base<data.min_order_inr) return fail(res,400,'Minimum order value not met')
  const discount=data.discount_type==='percent'?Math.floor(base*data.discount_value/100):Math.floor(data.discount_value)
  const capped=data.max_discount_inr?Math.min(discount,data.max_discount_inr):discount
  return res.json({code:data.code,discount:Math.min(base,capped),message:'Coupon validated against server rules'})
})
app.post('/api/bookings',async(req,res)=>{
  const {flightId,flightSnapshot,travelDate,tripType,passengers,seatPreference,couponCode}=req.body||{}
  const flight=demoFlights.find(f=>f.id===flightId)
  if(!flight||!flight.bookable) return fail(res,400,'This listing is demo-only and cannot be booked. Add a verified, authorized flight listing first.')
  if(!Array.isArray(passengers)||passengers.length<1||passengers.length>9) return fail(res,400,'Passenger count is invalid')
  if(!travelDate||new Date(travelDate)<new Date(new Date().toDateString())) return fail(res,400,'Travel date must be today or later')
  if(passengers.some(p=>!p.name||!p.email||!p.phone||!p.age||!p.gender)) return fail(res,400,'Complete all passenger details')
  const quantity=passengers.length
  let discount=0, validCoupon=null
  if(couponCode){
    const {data}=await supabase.from('coupons').select('*').eq('code',String(couponCode).toUpperCase()).eq('active',true).maybeSingle()
    if(!data) return fail(res,400,'Coupon is invalid')
    const base=flight.sellingFare*quantity
    if(base<data.min_order_inr) return fail(res,400,'Minimum order value not met')
    discount=data.discount_type==='percent'?Math.floor(base*data.discount_value/100):Math.floor(data.discount_value)
    discount=Math.min(base,data.max_discount_inr?Math.min(discount,data.max_discount_inr):discount); validCoupon=data.code
  }
  const amount=Math.max(0,flight.sellingFare*quantity-discount)
  const ref='FWG'+Date.now().toString().slice(-8)+crypto.randomBytes(2).toString('hex').toUpperCase()
  const row={reference:ref,flight_id:flight.id,route_label:`${flight.from} → ${flight.to}`,travel_date:travelDate,trip_type:tripType||'one-way',flight_snapshot:flightSnapshot||flight,passengers,seat_preference:seatPreference||'No preference',coupon_code:validCoupon,reference_fare_inr:flight.referenceFare*quantity,amount_inr:amount,contact_email:passengers[0].email,status:'UNDER_REVIEW'}
  const {data,error}=await supabase.from('bookings').insert(row).select('id,reference,status,amount_inr').single()
  if(error) return fail(res,500,'Could not save booking request')
  res.status(201).json({booking:data})
})
app.get('/api/bookings/status',async(req,res)=>{
  const {reference,email}=req.query
  if(!reference||!email) return fail(res,400,'Reference and email are required')
  const {data,error}=await supabase.from('bookings').select('id,reference,status,pnr,ticket_number,ticket_path,contact_email').eq('reference',reference).eq('contact_email',String(email).toLowerCase()).maybeSingle()
  if(error||!data) return fail(res,404,'Booking not found')
  let ticketUrl=null
  if(data.ticket_path){const {data:link}=await supabase.storage.from('tickets').createSignedUrl(data.ticket_path,300);ticketUrl=link?.signedUrl||null}
  res.json({booking:data,ticketUrl})
})
app.post('/api/payments/order',async(req,res)=>{
  if(!razorpay) return fail(res,503,'Payment gateway is not configured')
  const {bookingId}=req.body||{}
  const {data:b,error}=await supabase.from('bookings').select('id,amount_inr,status').eq('id',bookingId).maybeSingle()
  if(error||!b) return fail(res,404,'Booking not found')
  if(b.status!=='PAYMENT_PENDING') return fail(res,400,'Booking is not ready for payment')
  const order=await razorpay.orders.create({amount:Math.round(b.amount_inr*100),currency:'INR',receipt:String(bookingId).slice(0,40),notes:{booking_id:bookingId}})
  await supabase.from('payments').insert({booking_id:bookingId,provider:'razorpay',provider_order_id:order.id,amount_inr:b.amount_inr,status:'created'})
  res.json({order,keyId:process.env.RAZORPAY_KEY_ID})
})
app.post('/api/payments/verify',async(req,res)=>{
  const {bookingId,razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body||{}
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET||'').update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
  if(!safeEqual(expected,razorpay_signature)) return fail(res,400,'Payment signature verification failed')
  const {data:p}=await supabase.from('payments').select('id,booking_id,provider_order_id').eq('booking_id',bookingId).eq('provider_order_id',razorpay_order_id).maybeSingle()
  if(!p) return fail(res,404,'Payment order not found')
  await supabase.from('payments').update({provider_payment_id:razorpay_payment_id,status:'signature_verified'}).eq('id',p.id)
  await supabase.from('bookings').update({status:'PAID'}).eq('id',bookingId)
  res.json({ok:true,message:'Payment signature verified. Ticket still requires manual admin issuance.'})
})
app.post('/api/payments/webhook',async(req,res)=>{
  const signature=req.headers['x-razorpay-signature']
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET||'').update(req.body).digest('hex')
  if(!safeEqual(expected,signature)) return fail(res,400,'Invalid webhook signature')
  const event=JSON.parse(req.body.toString('utf8'))
  const entity=event.payload?.payment?.entity
  if(entity?.order_id){
    const status=event.event==='payment.captured'?'captured':event.event==='payment.failed'?'failed':null
    if(status){
      const {data:p}=await supabase.from('payments').select('id,booking_id').eq('provider_order_id',entity.order_id).maybeSingle()
      if(p){
        await supabase.from('payments').update({provider_payment_id:entity.id,status}).eq('id',p.id)
        await supabase.from('bookings').update({status:status==='captured'?'PAID':'PAYMENT_FAILED'}).eq('id',p.booking_id)
      }
    }
  }
  res.json({received:true})
})
app.get('/api/admin/bookings',getUser,adminOnly,async(_req,res)=>{
  const {data,error}=await supabase.from('bookings').select('*').order('created_at',{ascending:false}).limit(200)
  if(error) return fail(res,500,'Could not load bookings')
  res.json({bookings:data})
})
app.patch('/api/admin/bookings/:id/status',getUser,adminOnly,async(req,res)=>{
  const allowed=['UNDER_REVIEW','PAYMENT_PENDING','PAID','CANCELLED','REFUND_PENDING','REFUNDED']
  if(!allowed.includes(req.body.status)) return fail(res,400,'Invalid status. Use ticket upload to issue a ticket.')
  const {data,error}=await supabase.from('bookings').update({status:req.body.status}).eq('id',req.params.id).select('id,status').single()
  if(error) return fail(res,400,'Could not update booking')
  await supabase.from('audit_logs').insert({actor_user_id:req.user.id,action:'booking_status_updated',entity_id:data.id,details:{status:data.status}})
  res.json({booking:data})
})
app.post('/api/admin/bookings/:id/ticket',getUser,adminOnly,upload.single('ticket'),async(req,res)=>{
  if(!req.file||req.file.mimetype!=='application/pdf') return fail(res,400,'Upload a PDF ticket')
  const {pnr,ticketNumber}=req.body
  if(!pnr||!ticketNumber) return fail(res,400,'PNR and ticket number are required')
  const path=`${req.params.id}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`
  const {error:uploadError}=await supabase.storage.from('tickets').upload(path,req.file.buffer,{contentType:'application/pdf',upsert:false})
  if(uploadError) return fail(res,500,'Ticket upload failed')
  const {data,error}=await supabase.from('bookings').update({pnr,ticket_number:ticketNumber,ticket_path:path,status:'TICKET_ISSUED',issued_at:new Date().toISOString()}).eq('id',req.params.id).select('id,reference,status').single()
  if(error) return fail(res,500,'Ticket uploaded but booking update failed. Contact support before retrying.')
  await supabase.from('audit_logs').insert({actor_user_id:req.user.id,action:'ticket_issued',entity_id:data.id,details:{pnr,ticketNumber}})
  res.json({booking:data})
})
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'})})
app.listen(port,()=>console.log(`FlywaysGo API listening on ${port}`))
