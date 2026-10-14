import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db, storage, isFirebaseConfigured } from './firebase'
import { IMG, API_BASE, getAdminAuthHeaders } from '../config/shop'
import { setBackgroundImage } from '../data/background'

export const IMAGE_CATEGORIES = [
  'Hero Banners',
  'Bridal Collection',
  'Soft Silk Sarees',
  'Showroom & About',
  'Promotional Banners',
  'Catalogue Products',
  'General',
]

export const WEBSITE_SECTIONS = [
  { key: 'hero', name: 'Hero Main Showroom Banner', defaultUrl: IMG.hero },
  { key: 'banner', name: 'Promotional Mid Banner', defaultUrl: IMG.banner },
  { key: 'about', name: 'About Us Showroom Feature', defaultUrl: IMG.about },
  { key: 'family', name: 'Founders / Family Showcase', defaultUrl: '/images/kandan-family.jpg' },
  { key: 'bridal', name: 'Bridal Collection Card', defaultUrl: IMG.collections['Bridal Collection'] },
  { key: 'soft_silk', name: 'Soft Silk Collection Card', defaultUrl: IMG.collections['Soft Silk'] },
  { key: 'shirts', name: 'Shirts Collection Card', defaultUrl: IMG.collections['Shirts'] },
  { key: 'tops', name: 'Tops Collection Card', defaultUrl: IMG.collections['Tops'] },
  { key: 'pants', name: 'Pants Collection Card', defaultUrl: IMG.collections['Pants'] },
]

/**
 * Upload an image to Firebase Storage and record its metadata in Firestore.
 */
export async function uploadImageToFirebase({
  file,
  title,
  category = 'General',
  description = '',
  targetKey = '',
  onProgress = () => {},
}) {
  if (!file) throw new Error('No file provided for upload.')

  // Check if Firebase is available
  if (!isFirebaseConfigured() || !storage || !db) {
    return uploadFallbackLocalImage({ file, title, category, description, targetKey, onProgress })
  }

  // Generate unique filename with timestamp to prevent stale browser caching
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const timestamp = Date.now()
  const storagePath = `website-images/${category.toLowerCase().replace(/\s+/g, '-')}/${timestamp}_${sanitizedName}`
  const storageRef = ref(storage, storagePath)

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        title: title || file.name,
        category,
        uploadedAt: new Date().toISOString(),
      },
    })

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        onProgress(progress)
      },
      (error) => {
        console.error('[Firebase Storage Upload Error]:', error)
        reject(new Error(`Upload failed: ${error.message}`))
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)

          // Store record in Firestore 'website_images' collection
          const imageData = {
            title: title || file.name.replace(/\.[^/.]+$/, ''),
            category,
            description: description || '',
            url: downloadUrl,
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
            targetKey: targetKey || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }

          const docRef = await addDoc(collection(db, 'website_images'), imageData)

          // If linked to a primary website section, update site_settings/images document
          if (targetKey) {
            await setActiveWebsiteImage(targetKey, downloadUrl, docRef.id)
          }

          resolve({
            id: docRef.id,
            ...imageData,
            createdAt: new Date(),
          })
        } catch (err) {
          console.error('[Firestore Record Error]:', err)
          reject(err)
        }
      }
    )
  })
}

/**
 * Replace an existing Firebase image with a new file.
 */
export async function replaceFirebaseImage({
  docId,
  oldStoragePath,
  newFile,
  title,
  category,
  description,
  targetKey,
  onProgress = () => {},
}) {
  if (!newFile) throw new Error('No new file provided.')

  // Upload new image first
  const newUpload = await uploadImageToFirebase({
    file: newFile,
    title,
    category,
    description,
    targetKey,
    onProgress,
  })

  // Delete old image from Storage if applicable
  if (oldStoragePath && storage && isFirebaseConfigured()) {
    try {
      const oldRef = ref(storage, oldStoragePath)
      await deleteObject(oldRef)
    } catch (err) {
      console.warn('[Old Image Storage Deletion Notice]:', err.message)
    }
  }

  // Delete the old firestore doc if replaced with new one
  if (docId && docId !== newUpload.id && db && isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'website_images', docId))
    } catch (err) {
      console.warn('[Old Firestore Doc Cleanup Notice]:', err.message)
    }
  }

  return newUpload
}

/**
 * Delete an image from Firebase Storage and Cloud Firestore.
 */
export async function deleteFirebaseImage({ id, storagePath, targetKey }) {
  if (!id) throw new Error('No document ID specified for deletion.')

  if (isFirebaseConfigured() && db) {
    // 1. Delete from Firestore
    await deleteDoc(doc(db, 'website_images', id))

    // 2. Delete from Storage
    if (storagePath && storage) {
      try {
        const storageRef = ref(storage, storagePath)
        await deleteObject(storageRef)
      } catch (err) {
        console.warn('[Storage delete warning]:', err.message)
      }
    }

    // 3. If it was active on the website, clear or reset that section
    if (targetKey) {
      try {
        const defaultMatch = WEBSITE_SECTIONS.find((s) => s.key === targetKey)
        const fallbackUrl = defaultMatch ? defaultMatch.defaultUrl : ''
        await setActiveWebsiteImage(targetKey, fallbackUrl, null)
      } catch (err) {
        console.warn('[Active section reset warning]:', err.message)
      }
    }
  } else {
    // Fallback local deletion
    deleteFallbackLocalImage(id)
  }

  return true
}

/**
 * Set an active image URL for a website section in Firestore `site_settings/images`.
 * This notifies all connected public website instances in real-time.
 */
export async function setActiveWebsiteImage(sectionKey, imageUrl, docId = null) {
  if (!sectionKey || !imageUrl) return false

  // Instantly update in-memory config for immediate local feedback
  applyImageToStore(sectionKey, imageUrl)

  if (isFirebaseConfigured() && db) {
    try {
      const settingsRef = doc(db, 'site_settings', 'images')
      await setDoc(
        settingsRef,
        {
          [sectionKey]: imageUrl,
          [`${sectionKey}_docId`]: docId || null,
          [`${sectionKey}_updatedAt`]: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      )
      return true
    } catch (err) {
      console.error('[setActiveWebsiteImage Firestore Error]:', err)
    }
  }

  // Fallback persistence
  try {
    const raw = localStorage.getItem('kfs_active_website_images') || '{}'
    const current = JSON.parse(raw)
    current[sectionKey] = imageUrl
    localStorage.setItem('kfs_active_website_images', JSON.stringify(current))
    window.dispatchEvent(new CustomEvent('kfs_website_images_updated', { detail: current }))
  } catch {}

  return true
}

/**
 * Apply the given image to the client store runtime immediately.
 */
export function applyImageToStore(sectionKey, imageUrl) {
  if (!sectionKey || !imageUrl) return

  switch (sectionKey) {
    case 'hero':
      setBackgroundImage(imageUrl)
      IMG.hero = imageUrl
      break
    case 'banner':
      IMG.banner = imageUrl
      break
    case 'about':
      IMG.about = imageUrl
      break
    case 'bridal':
      IMG.collections['Bridal Collection'] = imageUrl
      break
    case 'soft_silk':
      IMG.collections['Soft Silk'] = imageUrl
      break
    case 'shirts':
      IMG.collections['Shirts'] = imageUrl
      break
    case 'tops':
      IMG.collections['Tops'] = imageUrl
      break
    case 'pants':
      IMG.collections['Pants'] = imageUrl
      break
    default:
      break
  }
}

/**
 * Real-time listener for the active site images doc (`site_settings/images`).
 * This is what powers instant multi-device synchronization on the public store!
 */
export function subscribeToSiteImages(callback) {
  if (isFirebaseConfigured() && db) {
    try {
      const settingsRef = doc(db, 'site_settings', 'images')
      const unsubscribe = onSnapshot(
        settingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            // Apply all active keys to the running store
            Object.keys(data).forEach((key) => {
              if (typeof data[key] === 'string' && data[key].startsWith('http')) {
                applyImageToStore(key, data[key])
              }
            })
            callback(data)
          } else {
            callback({})
          }
        },
        (error) => {
          console.warn('[Site Images Listener Warning]:', error.message)
        }
      )
      return unsubscribe
    } catch (err) {
      console.warn('[Site Images Subscription Error]:', err)
    }
  }

  // Fallback listener for local events
  const handleLocalUpdate = (e) => {
    callback(e.detail || {})
  }
  window.addEventListener('kfs_website_images_updated', handleLocalUpdate)

  try {
    const raw = localStorage.getItem('kfs_active_website_images')
    if (raw) callback(JSON.parse(raw))
  } catch {}

  return () => {
    window.removeEventListener('kfs_website_images_updated', handleLocalUpdate)
  }
}

/**
 * Real-time listener for all uploaded gallery images in Firestore.
 */
export function subscribeToImageGallery(callback) {
  if (isFirebaseConfigured() && db) {
    try {
      const q = query(collection(db, 'website_images'), orderBy('createdAt', 'desc'))
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
          }))
          callback(items)
        },
        (error) => {
          console.error('[Gallery Listener Error]:', error)
          // Fallback to local gallery if permissions error or offline
          callback(getFallbackLocalGallery())
        }
      )
      return unsubscribe
    } catch (err) {
      console.warn('[Gallery Subscribe Error]:', err)
    }
  }

  // Fallback local subscription
  callback(getFallbackLocalGallery())
  const handleUpdate = () => callback(getFallbackLocalGallery())
  window.addEventListener('kfs_local_gallery_updated', handleUpdate)
  return () => window.removeEventListener('kfs_local_gallery_updated', handleUpdate)
}

/**
 * Fallback local image management when Firebase credentials are not yet entered.
 * Allows the admin panel to be fully interactive and testable immediately.
 */
function uploadFallbackLocalImage({ file, title, category, description, targetKey, onProgress }) {
  return new Promise((resolve) => {
    let p = 10
    onProgress(p)
    const interval = setInterval(() => {
      p += 30
      if (p >= 100) {
        clearInterval(interval)
        onProgress(100)

        const reader = new FileReader()
        reader.onload = (e) => {
          const url = e.target.result
          const id = 'local_' + Date.now()
          const item = {
            id,
            title: title || file.name,
            category,
            description,
            url,
            storagePath: null,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
            targetKey: targetKey || null,
            createdAt: new Date(),
          }

          const current = getFallbackLocalGallery()
          current.unshift(item)
          try {
            localStorage.setItem('kfs_local_gallery', JSON.stringify(current.slice(0, 30)))
            window.dispatchEvent(new Event('kfs_local_gallery_updated'))
          } catch {}

          if (targetKey) {
            setActiveWebsiteImage(targetKey, url, id)
          }

          resolve(item)
        }
        reader.readAsDataURL(file)
      } else {
        onProgress(p)
      }
    }, 80)
  })
}

function getFallbackLocalGallery() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('kfs_local_gallery')
    if (raw) return JSON.parse(raw)
  } catch {}

  // Initial starter images from website config
  return WEBSITE_SECTIONS.map((sec, idx) => ({
    id: `seed_${idx}`,
    title: sec.name,
    category: 'Showroom & About',
    description: `Default image for website ${sec.key}`,
    url: sec.defaultUrl,
    storagePath: null,
    fileName: `${sec.key}.jpg`,
    fileSize: 1024 * 250,
    contentType: 'image/jpeg',
    targetKey: sec.key,
    createdAt: new Date(Date.now() - idx * 86400000),
  }))
}

function deleteFallbackLocalImage(id) {
  if (typeof window === 'undefined') return
  try {
    const current = getFallbackLocalGallery()
    const filtered = current.filter((item) => item.id !== id)
    localStorage.setItem('kfs_local_gallery', JSON.stringify(filtered))
    window.dispatchEvent(new Event('kfs_local_gallery_updated'))
  } catch {}
}
