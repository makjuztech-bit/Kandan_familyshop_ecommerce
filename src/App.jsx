import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Shop, { CategoryPage } from './pages/Shop'
import Product from './pages/Product'
import { Cart, Wishlist } from './pages/Cart'
import Admin from './pages/Admin'
import Checkout from './pages/Checkout'
import { About, Contact, Policy, NotFound } from './pages/Info'
import { Account, ForgotPassword, Login, OrderDetails, Register } from './pages/Auth'
import Reviews from './pages/Reviews'

export default function App() {
  return (
    <Routes>
      <Route path="admin" element={<Admin />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="category/:category" element={<CategoryPage />} />
        <Route path="product/:id" element={<Product />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="cart" element={<Cart />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="account" element={<Account />} />
        <Route path="order/:orderId" element={<OrderDetails />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="policy/:slug" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
