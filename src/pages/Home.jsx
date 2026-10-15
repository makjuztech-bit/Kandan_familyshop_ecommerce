import { Link } from 'react-router-dom'
import { products, useCatalog } from '../data/products'
import { IMG, SHOP } from '../config/shop'
import { useBackgroundImage } from '../data/background'
import { useFirebaseImages } from '../hooks/useFirebaseImages'
import { Img, Wrap, Title, Grid, btnP, btnG, btnO, WhatsApp } from '../components/ui'

export default function Home() {
  useCatalog()
  const activeImages = useFirebaseImages()
  const backgroundImage = useBackgroundImage()

  const heroImage = activeImages.hero || backgroundImage || IMG.hero
  const bannerImage = activeImages.banner || IMG.banner
  const aboutImage = activeImages.about || IMG.about
  const familyImage = activeImages.family || IMG.family || '/images/kandan-family.jpg?v=2'

  return (
    <>
      <section className="relative isolate flex min-h-[75vh] items-center overflow-hidden bg-primary-dark">
        <Img src={heroImage} alt="Textiles in a showroom" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        <Wrap className="py-20 text-ivory">
          <p className="mb-3 text-gold tracking-widest uppercase text-xs sm:text-sm font-semibold">Tradition, Beautifully Woven</p>
          <h1 className="max-w-2xl text-4xl leading-tight font-serif text-ivory sm:text-6xl">
            Celebrate Every Occasion in Pure Elegance
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-ivory/90 leading-relaxed">
            Explore authentic handloom textiles, rich weaves, and exquisite fabrics at Sri Kandan Family Shop.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/shop" className={btnG + ' shadow-lg'}>
              Explore Full Catalogue
            </Link>
            <Link to="/contact" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ivory/80 px-6 text-sm font-bold tracking-wide text-ivory hover:bg-ivory hover:text-primary transition-all">
              Contact Us
            </Link>
          </div>
        </Wrap>
      </section>

      {/* Featured Products */}
      <Wrap className="pt-16">
        <Title sub="Handpicked authentic handloom weaves from our 27-product collection.">
          Featured Products
        </Title>
        <Grid items={products.slice(0, 8)} />
        <div className="mt-10 text-center">
          <Link to="/shop" className={btnO + ' px-8'}>
            View All {products.length} Products →
          </Link>
        </div>
      </Wrap>

      {/* Mid Banner */}
      <section className="relative isolate mt-20 overflow-hidden bg-primary-dark py-24 text-center">
        <Img src={bannerImage} alt="Traditional weave with rich border" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/60" />
        <Wrap>
          <h2 className="mx-auto max-w-2xl font-serif text-3xl text-ivory sm:text-5xl">
            For Moments That Become Memories
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ivory/80 text-sm sm:text-base">
            Exceptional quality textiles directly from master weavers.
          </p>
          <Link to="/shop" className={btnG + ' mt-6'}>
            Browse Complete Catalogue
          </Link>
        </Wrap>
      </section>

      {/* New Arrivals & Handloom Catalogue */}
      <Wrap className="pt-16">
        <Title sub="Latest handloom arrivals and specialty weaves freshly curated.">
          Handloom & Textile Collection
        </Title>
        <Grid items={products.slice(8, 20)} />
        <div className="mt-10 text-center">
          <Link to="/shop" className={btnP + ' px-8'}>
            Browse All {products.length} Products
          </Link>
        </div>
      </Wrap>

      {/* About the Shop */}
      <Wrap className="grid items-center gap-8 pt-20 md:grid-cols-2">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-ivory-dark border border-gold/40 shadow-md">
          <Img src={aboutImage} alt="Draping a traditional textile saree" className="h-full w-full object-cover" />
        </div>
        <div>
          <h2 className="text-3xl font-serif text-primary">Textiles chosen with personal care</h2>
          <p className="mt-3 text-ink/80 leading-relaxed">
            At Sri Kandan Family Shop, we help you find the perfect textile piece for every occasion: weave, fabric, and budget. Visit us or message us, and we will gladly guide you.
          </p>
          <Link to="/about" className={btnO + ' mt-5'}>
            About the Shop
          </Link>
        </div>
      </Wrap>

      {/* Visit the shop */}
      <Wrap className="pt-16">
        <section className="rounded-2xl border border-gold/50 bg-white p-6 sm:p-10 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5 overflow-hidden rounded-xl border-2 border-gold/40 shadow-md">
              <div className="aspect-[4/3] overflow-hidden bg-ivory-dark">
                <img
                  src={familyImage}
                  alt="Sri Kandan Family Shop Founders"
                  className="h-full w-full object-cover object-top hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-3 bg-primary text-ivory text-center border-t border-gold/30">
                <p className="font-serif text-sm font-bold text-gold">Sri Kandan Family Shop</p>
                <p className="text-[11px] text-ivory/80 italic">Tradition Woven with Love · Kanchipuram</p>
              </div>
            </div>
            <div className="lg:col-span-7">
              <h2 className="text-3xl font-serif text-primary">Visit Our Store</h2>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2 text-sm">
                <div className="sm:col-span-2">
                  <dt className="font-bold text-ink">Address</dt>
                  <dd className="mt-1 text-ink/80 leading-relaxed whitespace-pre-line">{SHOP.address}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">Phone</dt>
                  <dd className="mt-1 flex flex-col text-ink/80">
                    {SHOP.phones.map((phone) => (
                      <a key={phone} href={'tel:' + phone} className="hover:text-primary">{phone}</a>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">Email</dt>
                  <dd className="mt-1 text-ink/80">
                    <a href={'mailto:' + SHOP.email} className="hover:text-primary">{SHOP.email}</a>
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/contact" className={btnP}>Contact Us</Link>
                <WhatsApp text="Hello Sri Kandan Family Shop, I would like help with choosing products from your catalogue." />
              </div>
            </div>
          </div>
        </section>
      </Wrap>

      {/* Customer Reviews Section Preview */}
      <Wrap className="pt-16 pb-8">
        <section className="rounded-2xl border border-gold/30 bg-white p-6 text-center shadow-sm sm:p-8">
          <h2 className="text-3xl font-serif text-primary">What Our Customers Say</h2>
          <p className="mt-2 text-ink/70">Read genuine feedback from our verified customers.</p>
          <Link to="/reviews" className={btnO + ' mt-5'}>
            Read Customer Reviews
          </Link>
        </section>
      </Wrap>
    </>
  )
}


