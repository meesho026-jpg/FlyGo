import React, { useEffect, useMemo, useState } from 'react'
import { Plane, ShieldCheck, Clock3, Luggage, ArrowRight, Search, Ticket, User, LogIn, LogOut, Upload, RefreshCw } from 'lucide-react'
import { API, api, money, supabase } from './lib'

const demoFlights = [
  {id:'demo-1',airline:'Sky Sample Air',number:'DEMO 101',from:'Indore',fromCode:'IDR',to:'Delhi',toCode:'DEL',depart:'08:10',arrive:'09:45',duration:'1h 35m',stops:'Non-stop',baggage:'15 kg',meal:'Not included',referenceFare:6200,sellingFare:4800,bookable:false},
  {id:'demo-2',airline:'Sample Wings',number:'DEMO 208',from:'Indore',fromCode:'IDR',to:'Mumbai',toCode:'BOM',depart:'12:20',arrive:'13:55',duration:'1h 35m',stops:'Non-stop',baggage:'15 kg',meal:'Included',referenceFare:5700,sellingFare:4500,bookable:false},
  {id:'demo-3',airline:'Demo Connect',number:'DEMO 315',from:'Delhi',fromCode:'DEL',to:'Bengaluru',toCode:'BLR',depart:'17:30',arrive:'20:15',duration:'2h 45m',stops:'Non-stop',baggage:'15 kg',meal:'Not included',referenceFare:8900,sellingFare:6900,bookable:false}
]

function App() {
  const [page,setPage] = useState('home')
  const [flights,setFlights] = useState(demoFlights)
  const [search,setSearch] = useState({from:'Indore',to:'Delhi',date:new Date().toISOString().slice(0,10),trip:'one-way',passengers:1,cabin:'Economy'})
  const [selected,setSelected] = useState(null)
  const [coupon,setCoupon] = useState('')
  const [couponInfo,setCouponInfo] = useState(null)
  const [passengers,setPassengers] = useState([{name:'',age:'',gender:'',email:'',phone:''}])
  const [seat,setSeat] = useState('Window preference')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [bookingRef,setBookingRef] = useState('')
  const [statusRef,setStatusRef] = useState('')
  const [statusEmail,setStatusEmail] = useState('')
  const [statusResult,setStatusResult] = useState(null)
  const [adminBookings,setAdminBookings] = useState([])
  const [adminFile,setAdminFile] = useState(null)
  const [adminId,setAdminId] = useState('')
  const [adminStatus,setAdminStatus] = useState('UNDER_REVIEW')
  const [session,setSession] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { api('/api/flights').then(d=>{if(d.flights?.length) setFlights(d.flights)}).catch(()=>{}) }, [])
  const discount = useMemo(()=> selected ? Math.max(0,Math.round((selected.referenceFare-selected.sellingFare)/selected.referenceFare*100)) : 0,[selected])
  const estimated = selected ? Math.max(0,selected.sellingFare*(passengers.length||1)-(couponInfo?.discount||0)) : 0

  async function applyCoupon() {
    if (!selected) return
    try {
      const result = await api('/api/coupons/quote',{method:'POST',body:JSON.stringify({code:coupon,flightId:selected.id,quantity:passengers.length||1})})
      setCouponInfo(result); setMessage(result.message || 'Coupon applied')
    } catch(e) { setCouponInfo(null); setMessage(e.message) }
  }

  async function submitBooking(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await api('/api/bookings',{method:'POST',body:JSON.stringify({
        flightId:selected.id,flightSnapshot:selected,travelDate:search.date,tripType:search.trip,
        passengers,seatPreference:seat,couponCode:couponInfo?.code || null
      })})
      setBookingRef(result.booking.reference)
      setMessage('Booking request created. Demo flights cannot be paid for. Admin will review verified listings before ticketing.')
      setPage('confirmation')
    } catch(e) { setMessage(e.message) } finally { setBusy(false) }
  }

  async function checkStatus(e) {
    e.preventDefault(); setBusy(true); setStatusResult(null)
    try { setStatusResult(await api(`/api/bookings/status?reference=${encodeURIComponent(statusRef)}&email=${encodeURIComponent(statusEmail)}`)) }
    catch(e) { setMessage(e.message) } finally { setBusy(false) }
  }

  async function adminLogin(e) {
    e.preventDefault()
    if (!supabase) return setMessage('Set Supabase URL and anon key in client environment first.')
    const form = new FormData(e.currentTarget)
    const {error} = await supabase.auth.signInWithPassword({email:form.get('email'),password:form.get('password')})
    if (error) setMessage(error.message)
    else { setMessage('Signed in.'); loadAdmin() }
  }
  async function loadAdmin() {
    try { const d=await api('/api/admin/bookings'); setAdminBookings(d.bookings||[]) }
    catch(e) { setMessage(e.message) }
  }
  async function updateAdmin(e) {
    e.preventDefault(); setBusy(true)
    try { await api(`/api/admin/bookings/${adminId}/status`,{method:'PATCH',body:JSON.stringify({status:adminStatus})}); await loadAdmin(); setMessage('Booking updated.') }
    catch(e) { setMessage(e.message) } finally { setBusy(false) }
  }
  async function uploadTicket(e) {
    e.preventDefault(); if(!adminFile || !adminId) return setMessage('Choose booking and ticket PDF.')
    setBusy(true)
    try { const fd=new FormData(); fd.append('ticket',adminFile); fd.append('pnr',e.currentTarget.pnr.value); fd.append('ticketNumber',e.currentTarget.ticketNumber.value)
      await api(`/api/admin/bookings/${adminId}/ticket`,{method:'POST',body:fd}); await loadAdmin(); setMessage('Ticket uploaded and booking marked ticket issued.') }
    catch(err) { setMessage(err.message) } finally { setBusy(false) }
  }

  const nav = <header className="topbar"><div className="wrap nav"><button className="brand" onClick={()=>setPage('home')}><span className="brandmark"><Plane size={23}/></span><span>Flyways<span>Go</span><small>FLY MORE. PAY LESS.</small></span></button><nav><button onClick={()=>setPage('home')}>Flights</button><button onClick={()=>setPage('status')}>My Booking</button><button onClick={()=>setPage('admin')}>Admin</button></nav></div></header>
  return <><div className="announcement">Your journey starts here · Manual ticket assistance · Secure payment flow</div>{nav}
    <main className="wrap">
      {message && <div className="notice" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
      {page==='home' && <>
        <section className="hero"><div><div className="eyebrow"><span/> SMARTER TRAVEL STARTS HERE</div><h1>Fly more.<br/><em>Pay less.</em></h1><p>Find your preferred flight. Share passenger details. Our team reviews your request and arranges ticket issuance manually.</p><div className="hero-points"><span><ShieldCheck/> Secure booking request</span><span><Clock3/> Human assistance</span></div></div><div className="hero-art"><div className="orbit"></div><div className="plane-card"><Plane size={78}/><strong>YOUR NEXT<br/>ADVENTURE</strong><small>TAKE OFF WITH FLYWAYSGO</small></div><div className="floating">✦ Explore more</div></div></section>
        <section className="search-panel"><div className="section-head"><div><span className="eyebrow">PLAN YOUR TRIP</span><h2>Where would you like to go?</h2></div><div className="trip-switch"><button className={search.trip==='one-way'?'active':''} onClick={()=>setSearch({...search,trip:'one-way'})}>One way</button><button className={search.trip==='round-trip'?'active':''} onClick={()=>setSearch({...search,trip:'round-trip'})}>Round trip</button></div></div>
          <div className="search-grid"><label>FROM<input value={search.from} onChange={e=>setSearch({...search,from:e.target.value})}/></label><label>TO<input value={search.to} onChange={e=>setSearch({...search,to:e.target.value})}/></label><label>DEPARTURE<input type="date" value={search.date} onChange={e=>setSearch({...search,date:e.target.value})}/></label><label>TRAVELLERS<select value={search.passengers} onChange={e=>setSearch({...search,passengers:+e.target.value})}>{[1,2,3,4,5,6,7,8,9].map(n=><option key={n}>{n}</option>)}</select></label><label>CLASS<select value={search.cabin} onChange={e=>setSearch({...search,cabin:e.target.value})}><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></label><button className="primary search-btn" onClick={()=>{setFlights(flights.filter(f=>f.from.toLowerCase().includes(search.from.toLowerCase())&&f.to.toLowerCase().includes(search.to.toLowerCase())));setMessage('Showing matching listed flights. Demo listings are not bookable.')}}><Search size={18}/> Search flights</button></div>
        </section>
        <section className="flight-section"><div className="section-head"><div><span className="eyebrow">HANDPICKED OPTIONS</span><h2>Available flight listings</h2><p className="muted">Only authorized, verified inventory should be offered for real booking.</p></div><button className="text-btn" onClick={()=>api('/api/flights').then(d=>setFlights(d.flights||[])).catch(e=>setMessage(e.message))}><RefreshCw size={15}/> Reset list</button></div>
          {flights.length===0?<div className="empty">No listed flights match this search. Try another route.</div>:<div className="flight-list">{flights.map(f=><article className="flight-card" key={f.id}><div className="airline"><div className="airline-icon"><Plane/></div><div><b>{f.airline}</b><small>{f.number}</small></div></div><div className="route-time"><b>{f.depart}</b><span>{f.fromCode}</span></div><div className="duration"><small>{f.duration}</small><i></i><small>{f.stops}</small></div><div className="route-time"><b>{f.arrive}</b><span>{f.toCode}</span></div><div className="fare"><b>{money(f.sellingFare)}</b><small>Ref. {money(f.referenceFare)}</small><span className="discount">{Math.max(0,Math.round((f.referenceFare-f.sellingFare)/f.referenceFare*100))}% off*</span></div><button className="primary book-btn" disabled={!f.bookable} onClick={()=>{setSelected(f);setPassengers(Array.from({length:search.passengers},()=>({name:'',age:'',gender:'',email:'',phone:''})));setCouponInfo(null);setPage('booking')}}>{f.bookable?'Book now':'Demo only'}</button><div className="flight-meta"><span><Luggage size={14}/> {f.baggage}</span><span>Meal: {f.meal}</span><span className="demo-tag">{f.bookable?'Verified listing':'DEMO — NOT BOOKABLE'}</span></div></article>)}</div>}
          <p className="fineprint">*Displayed savings are calculated from configured reference and selling fares. Demo listings are examples only and cannot be booked.</p>
        </section>
      </>}
      {page==='booking' && selected && <section className="form-page"><button className="back" onClick={()=>setPage('home')}>← Back to flights</button><div className="section-head"><div><span className="eyebrow">BOOKING REQUEST</span><h2>Passenger details</h2><p className="muted">Seat choice is a preference only, not a confirmed airline seat.</p></div></div><div className="booking-layout"><form className="panel" onSubmit={submitBooking}>{passengers.map((p,i)=><div className="passenger" key={i}><h3>Passenger {i+1}</h3><div className="form-grid"><label>Full name<input required value={p.name} onChange={e=>setPassengers(passengers.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label><label>Age<input required type="number" min="1" max="110" value={p.age} onChange={e=>setPassengers(passengers.map((x,j)=>j===i?{...x,age:e.target.value}:x))}/></label><label>Gender<select required value={p.gender} onChange={e=>setPassengers(passengers.map((x,j)=>j===i?{...x,gender:e.target.value}:x))}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label><label>Email<input required type="email" value={p.email} onChange={e=>setPassengers(passengers.map((x,j)=>j===i?{...x,email:e.target.value}:x))}/></label><label>Phone<input required inputMode="tel" pattern="[0-9+ -]{8,16}" value={p.phone} onChange={e=>setPassengers(passengers.map((x,j)=>j===i?{...x,phone:e.target.value}:x))}/></label></div></div>)}<label>Seat preference<select value={seat} onChange={e=>setSeat(e.target.value)}><option>Window preference</option><option>Aisle preference</option><option>Middle preference</option><option>No preference</option></select></label><div className="coupon-row"><input placeholder="Coupon code" value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}/><button type="button" className="secondary" onClick={applyCoupon}>Apply coupon</button></div><p className="fineprint">A seat preference is not a seat reservation. Final availability and fare are subject to manual confirmation.</p><button className="primary wide" disabled={busy||!selected.bookable}>{busy?'Submitting…':'Submit booking request'} <ArrowRight size={17}/></button></form><aside className="panel summary"><h3>Fare summary</h3><b>{selected.from} → {selected.to}</b><p>{selected.airline} · {selected.number}</p><div className="summary-line"><span>Fare × {passengers.length}</span><b>{money(selected.sellingFare*passengers.length)}</b></div><div className="summary-line"><span>Coupon discount</span><b>−{money(couponInfo?.discount||0)}</b></div><div className="summary-total"><span>Estimated total</span><b>{money(estimated)}</b></div><span className="demo-tag">Payment disabled for demo flights</span></aside></div></section>}
      {page==='confirmation' && <section className="panel confirmation"><div className="success-icon">✓</div><h2>Booking request received</h2><p>Your reference is <b>{bookingRef}</b>. Keep it safe to check your booking status. Ticket issuance is a separate manual step.</p><button className="primary" onClick={()=>{setStatusRef(bookingRef);setPage('status')}}>Track booking</button></section>}
      {page==='status' && <section className="narrow"><span className="eyebrow">BOOKING SUPPORT</span><h2>Track your booking</h2><form className="panel stack" onSubmit={checkStatus}><label>Booking reference<input required value={statusRef} onChange={e=>setStatusRef(e.target.value)}/></label><label>Passenger email<input required type="email" value={statusEmail} onChange={e=>setStatusEmail(e.target.value)}/></label><button className="primary" disabled={busy}>Check status</button></form>{statusResult&&<div className="panel status-card"><h3>{statusResult.booking.status.replaceAll('_',' ')}</h3><p>Reference: {statusResult.booking.reference}</p>{statusResult.booking.pnr&&<p>PNR: <b>{statusResult.booking.pnr}</b></p>}{statusResult.ticketUrl&&<a href={statusResult.ticketUrl} target="_blank" rel="noreferrer">Open issued ticket PDF</a>}</div>}</section>}
      {page==='admin' && <section className="admin-page"><span className="eyebrow">SECURE MANAGEMENT</span><h2>Admin dashboard</h2>{!session?<form className="panel narrow stack" onSubmit={adminLogin}><p className="muted">Sign in with an admin account created in Supabase Auth and added to the admin_users table.</p><label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" required/></label><button className="primary"><LogIn size={16}/> Admin sign in</button></form>:<><div className="admin-toolbar"><span>Signed in: {session.user.email}</span><button className="secondary" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button><button className="secondary" onClick={loadAdmin}>Refresh</button></div><div className="panel"><h3>Booking requests</h3><button className="secondary" onClick={loadAdmin}>Load bookings</button><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Route</th><th>Status</th><th>Amount</th></tr></thead><tbody>{adminBookings.map(b=><tr key={b.id} onClick={()=>setAdminId(b.id)}><td>{b.reference}</td><td>{b.contact_email}</td><td>{b.route_label}</td><td>{b.status}</td><td>{money(b.amount_inr)}</td></tr>)}</tbody></table></div><small>Select a row to copy its booking ID into the forms below.</small></div><div className="admin-grid"><form className="panel stack" onSubmit={updateAdmin}><h3>Update status</h3><label>Booking UUID<input required value={adminId} onChange={e=>setAdminId(e.target.value)}/></label><label>Status<select value={adminStatus} onChange={e=>setAdminStatus(e.target.value)}>{['UNDER_REVIEW','PAYMENT_PENDING','PAID','TICKET_ISSUED','CANCELLED','REFUND_PENDING','REFUNDED'].map(s=><option>{s}</option>)}</select></label><button className="primary">Save status</button></form><form className="panel stack" onSubmit={uploadTicket}><h3>Issue confirmed ticket</h3><label>Booking UUID<input required value={adminId} onChange={e=>setAdminId(e.target.value)}/></label><label>PNR<input name="pnr" required/></label><label>Ticket number<input name="ticketNumber" required/></label><label>Confirmed ticket PDF<input type="file" accept="application/pdf" required onChange={e=>setAdminFile(e.target.files?.[0]||null)}/></label><button className="primary"><Upload size={16}/> Upload and issue</button></form></div></>}</section>}
    </main>
    <footer><div className="wrap footer-inner"><div className="brand footer-brand"><span className="brandmark"><Plane/></span><span>Flyways<span>Go</span><small>FLY MORE. PAY LESS.</small></span></div><p>Independent manual ticket assistance. Not an airline or live GDS inventory provider.</p><span>© {new Date().getFullYear()} FlywaysGo</span></div></footer>
  </>
}
export default App
