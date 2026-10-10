import {CustomerReviews} from '../components/Reviews'
import {Wrap} from '../components/ui'
import {useAuthStatus} from '../data/auth'

export default function Reviews(){
 const session=useAuthStatus()
 return <Wrap className="py-10 sm:py-14">
  <header className="mb-8 rounded-2xl border border-gold/30 bg-white p-6 text-center shadow-sm sm:p-10">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-dark">Real customer experiences</p>
   <h1 className="mt-2 text-4xl sm:text-5xl">Customer Reviews</h1>
   <p className="mx-auto mt-3 max-w-2xl text-ink/70">Browse feedback by product and rating, or share your experience with the Sri Kandan Family Shop community.</p>
  </header>
  <CustomerReviews initialName={session?.loggedIn?session.name:''} initialEmail={session?.loggedIn?session.email:''}/>
 </Wrap>
}
