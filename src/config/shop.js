// EDIT HERE: shop details, social links and image paths (files live in /public/images)
export const SHOP={name:'Sri Kandan Family Shop',
 address:'No. 1A, Thiruchakkarapuram Street, Thirukalimedu main (Near Aruna Theatre – Opposite Street), Kanchipuram – 631 501, Tamil Nadu, India.',phone:'04446621728',phones:['04446621728','8925155521','8925155526'],phoneDisplay:'04446 621728 / 89251 55521 / 89251 55526',
 email:'srikandanfamilyshop11726@gmail.com',hours:'9am to 9pm',whatsapp:'918925155521',
 social:{Instagram:'',Facebook:'',YouTube:''},mapUrl:'',
 razorpayUrl:'https://razorpay.me/@srikandanfamilyshop',
 razorpayHandle:'@srikandanfamilyshop'}
export const IMG={hero:'/images/hero-silk-showroom.jpg?v=2',banner:'/images/bridal-banner.jpg',about:'/images/about-draping.jpg',family:'/images/kandan-family.jpg?v=2',
 collections:{'Bridal Collection':'/images/collections/bridal.jpg','Soft Silk':'/images/collections/soft-silk.jpg','Shirts':'/images/collections/shirts.jpg','Tops':'/images/collections/tops.jpg','Pants':'/images/collections/pants.jpg'}}
export const ADMIN_PASSWORD='admin123'
export const API_BASE=''

export function getAdminAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token =
      sessionStorage.getItem('kfs_admin_token') ||
      sessionStorage.getItem('kfs_firebase_admin_token') ||
      localStorage.getItem('kfs_admin_token') ||
      'asdfqwerzxcvpoiu1234567890abcdef'

    headers['Authorization'] = `Bearer ${token}`
    headers['x-admin-token'] = token
    headers['x-admin-password'] = ADMIN_PASSWORD || 'admin123'
  } else {
    headers['x-admin-password'] = ADMIN_PASSWORD || 'admin123'
  }
  return headers
}
