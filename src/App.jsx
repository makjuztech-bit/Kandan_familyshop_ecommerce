import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Shop, { CategoryPage } from './pages/Shop'
import Product from './pages/Product'
import { Cart, Wishlist } from './pages/Cart'
import Checkout from './pages/Checkout'
import { About, Contact, Policy, NotFound } from './pages/Info'
import { Account, ForgotPassword, Login, OrderDetails, Register } from './pages/Auth'
import { CustomerOrders, CustomerDelivery } from './pages/OrdersDelivery'
import Reviews from './pages/Reviews'

// Admin Portal Components
import { AdminAuthProvider, ProtectedAdminRoute } from './context/AdminAuthContext'
import AdminLayout from './components/admin/AdminLayout'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import ImageManagement from './pages/admin/ImageManagement'
import AdminGallery from './pages/admin/AdminGallery'
import WebContent from './pages/admin/WebContent'
import AdminStore from './pages/admin/AdminStore'
import AdminSettings from './pages/admin/AdminSettings'

export default function App() {
  return (
    <AdminAuthProvider>
      <Routes>
        {/* Dedicated Admin Portal Routes */}
        <Route path="admin/login" element={<AdminLogin />} />
        <Route
          path="admin"
          element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="images" element={<ImageManagement />} />
          <Route path="gallery" element={<AdminGallery />} />
          <Route path="content" element={<WebContent />} />
          <Route path="store" element={<AdminStore />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* Public Storefront Routes */}
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
          <Route path="orders" element={<CustomerOrders />} />
          <Route path="delivery" element={<CustomerDelivery />} />
          <Route path="order/:orderId" element={<OrderDetails />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="address" element={<Contact />} />
          <Route path="policy/:slug" element={<Policy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
