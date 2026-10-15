import {useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {SHOP,IMG} from '../config/shop'
import {Img,Wrap,Field,validate,btnP,WhatsApp} from '../components/ui'
import {createGmailDraftUrl} from '../data/email'
import {useFirebaseImages} from '../hooks/useFirebaseImages'

export const About=()=>{
  const activeImages = useFirebaseImages()
  const aboutImage = activeImages.about || IMG.about
  return <Wrap className="grid max-w-5xl items-center gap-8 py-12 md:grid-cols-2"><div><h1 className="text-4xl">About Sri Kandan Family Shop</h1><p className="mt-4 text-ink/80">We are a silk saree boutique focused on helping you choose the right silk saree for weddings, festivals and everyday wear. Our team gives personal guidance on colour, weave, zari and budget.</p><p className="mt-3 text-ink/80">We are committed to bringing you the finest silk sarees, with personal service and quality you can trust.</p><Link to="/contact" className={btnP+' mt-5'}>Talk to us</Link></div><div className="aspect-[4/5] overflow-hidden bg-ivory-dark"><Img src={aboutImage} alt="Draping a silk saree" className="h-full w-full object-cover"/></div></Wrap>
}

export function Contact() {
  const activeImages = useFirebaseImages()
  const familyImage = activeImages.family || IMG.family || '/images/kandan-family.jpg?v=2'
  const [v, setV] = useState({})
  const [err, setErr] = useState({})
  const [draftUrl, setDraftUrl] = useState(null)
  const [draftError, setDraftError] = useState('')

  const ch = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const sub = (e) => {
    e.preventDefault()
    const er = validate(v, ['name', 'email', 'message'])
    setErr(er)
    setDraftUrl(null)
    setDraftError('')
    if (Object.keys(er).length) return
    const url = createGmailDraftUrl({
      subject: `Sri Kandan Family Shop enquiry from ${v.name.trim()}`,
      body: `Name: ${v.name.trim()}\nEmail: ${v.email.trim()}\n\nMessage:\n${v.message.trim()}`,
    })
    if (!url) {
      setDraftError('Gmail draft could not be prepared. Check the shop email address in src/config/shop.js.')
      return
    }
    setDraftUrl(url)
  }

  return (
    <Wrap className="max-w-6xl py-12">
      <div className="mb-8">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-primary">Store & Contact Details</h1>
        <p className="mt-2 text-ink/70">Visit our showroom in Kanchipuram or get in touch for personal shopping assistance.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 items-start">
        {/* Left Side: Family Photo & Store Address */}
        <div className="lg:col-span-6 space-y-6">
          <div className="overflow-hidden rounded-2xl border-2 border-gold/40 bg-white shadow-md">
            <div className="aspect-[4/3] sm:aspect-[16/11] overflow-hidden bg-ivory-dark">
              <img
                src={familyImage}
                alt="Sri Kandan Family Shop Founders"
                className="h-full w-full object-cover object-top hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-4 bg-primary text-ivory border-t border-gold/30 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-gold">Sri Kandan Family Shop</h3>
                <p className="text-xs text-ivory/80 italic">Tradition Woven with Love</p>
              </div>
              <span className="text-xs rounded-full bg-gold/20 px-3 py-1 font-semibold text-gold border border-gold/40">
                Kanchipuram
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gold/40 bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-2xl font-bold text-primary border-b border-gold/20 pb-2">
              Showroom Address & Hours
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">📍</span>
                <div>
                  <p className="font-bold text-ink">Address:</p>
                  <p className="mt-0.5 text-ink/80 leading-relaxed whitespace-pre-line">{SHOP.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-gold/20 pt-3">
                <span className="text-xl">📞</span>
                <div>
                  <p className="font-bold text-ink">Call Us:</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {SHOP.phones.map((phone) => (
                      <a key={phone} href={'tel:' + phone} className="font-semibold text-primary hover:underline">
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-gold/20 pt-3">
                <span className="text-xl">✉️</span>
                <div>
                  <p className="font-bold text-ink">Email:</p>
                  <a href={'mailto:' + SHOP.email} className="mt-0.5 text-primary hover:underline break-all">
                    {SHOP.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-gold/20 pt-3">
                <span className="text-xl">🕒</span>
                <div>
                  <p className="font-bold text-ink">Business Hours:</p>
                  <p className="mt-0.5 text-ink/80">{SHOP.hours} (All 7 Days)</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <WhatsApp text="Hello Sri Kandan Family Shop, I would like help choosing a silk saree." />
            </div>
          </div>
        </div>

        {/* Right Side: Message / Enquiry Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-gold/40 bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <h2 className="font-serif text-2xl font-bold text-primary border-b border-gold/20 pb-2">
              Send Us a Message
            </h2>
            <p className="text-sm text-ink/70">
              Have questions about saree availability, orders, or custom weaves? Drop us a note below.
            </p>

            <form onSubmit={sub} noValidate className="space-y-4 pt-2">
              <Field label="Your Full Name" id="name" placeholder="Enter your full name" value={v.name || ''} onChange={ch} error={err.name} />
              <Field label="Your Email Address" id="email" type="email" placeholder="you@example.com" value={v.email || ''} onChange={ch} error={err.email} />
              <Field area label="Your Message / Enquiry" id="message" placeholder="Write your enquiry here..." value={v.message || ''} onChange={ch} error={err.message} />

              <button className={btnP + ' w-full py-3.5 text-base shadow'}>
                Prepare Gmail Message
              </button>

              {draftError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 border border-amber-200">{draftError}</p>}
              {draftUrl && (
                <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-300 p-4 text-sm text-emerald-900">
                  <p className="font-bold">Your message draft is ready!</p>
                  <p className="mt-1 text-xs text-emerald-800">Click below to open in Gmail and send:</p>
                  <a href={draftUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-primary underline">
                    Open Gmail draft →
                  </a>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </Wrap>
  )
}
const P={shipping:'We deliver across India. Shipping timelines and charges vary by location. Contact us for details on delivery to your area.',returns:'We accept returns and exchanges within 7 days of delivery for items in original condition. Contact us to initiate a return.',privacy:'We value your privacy. Cart and wishlist data is stored locally in your browser and is not shared with third parties.',terms:'By placing an order with Sri Kandan Family Shop, you agree to our terms of sale. All sales are subject to availability and confirmation.'}
export const Policy=()=>{const {slug}=useParams();return P[slug]?<Wrap className="max-w-2xl py-12"><h1 className="text-4xl capitalize">{slug}</h1><p className="mt-4">{P[slug]}</p></Wrap>:<NotFound/>}
export const NotFound=()=><Wrap className="py-20 text-center"><h1 className="text-4xl">Page not found</h1><Link to="/shop" className={btnP+' mt-5'}>Back to shop</Link></Wrap>
