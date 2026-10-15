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
  { key: 'family', name: 'Founders / Family Showcase', defaultUrl: '/images/kandan-family.jpg?v=2' },
  { key: 'bridal', name: 'Bridal Collection Card', defaultUrl: IMG.collections['Bridal Collection'] },
  { key: 'soft_silk', name: 'Soft Silk Collection Card', defaultUrl: IMG.collections['Soft Silk'] },
  { key: 'shirts', name: 'Shirts Collection Card', defaultUrl: IMG.collections['Shirts'] },
  { key: 'tops', name: 'Tops Collection Card', defaultUrl: IMG.collections['Tops'] },
  { key: 'pants', name: 'Pants Collection Card', defaultUrl: IMG.collections['Pants'] },
]

/**
 * Optimizes an image file or dataURL client-side using an HTML5 Canvas.
 * Produces a high-quality compressed JPEG with max dimensions (1600px).
 */
export async function optimizeImageClient(fileOrDataUrl, maxDimension = 1600, quality = 0.86) {
  return new Promise((resolve, reject) => {
    let src = ''
    if (typeof fileOrDataUrl === 'string') {
      src = fileOrDataUrl
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader()
      reader.onload = () => processImage(reader.result)
      reader.onerror = () => reject(new Error('Could not read image file'))
      reader.readAsDataURL(fileOrDataUrl)
      return
    } else {
      return reject(new Error('Invalid image input'))
    }

    processImage(src)

    function processImage(rawUrl) {
      const img = new Image()
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width
          const height = img.naturalHeight || img.height
          const scale = Math.min(1, maxDimension / Math.max(width, height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(width * scale)
          canvas.height = Math.round(height * scale)
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          canvas.toBlob(
            (blob) => {
              resolve({
                dataUrl,
                blob,
                width: canvas.width,
                height: canvas.height,
                size: blob ? blob.size : dataUrl.length,
              })
            },
            'image/jpeg',
            quality
          )
        } catch {
          resolve({ dataUrl: rawUrl, blob: null, size: rawUrl.length })
        }
      }
      img.onerror = () => resolve({ dataUrl: rawUrl, blob: null, size: rawUrl.length })
      img.src = rawUrl
    }
  })
}

/**
 * Upload an image to Firebase Storage and record its metadata in Firestore.
 * Automatically falls back to Firestore persistent storage if Storage bucket is uninitialized.
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

  // 1. Validate file format
  const validExtensions = /\.(jpe?g|png|webp|jfif|avif|heic)$/i
  const isImageMime = file.type ? file.type.startsWith('image/') : false
  const isImageExt = file.name ? validExtensions.test(file.name) : true

  if (!isImageMime && !isImageExt && typeof file !== 'string') {
    throw new Error('Please select a valid image file (JPG, PNG, WebP).')
  }

  // 2. Validate file size (15 MB max before client-side optimization)
  if (file.size && file.size > 15 * 1024 * 1024) {
    throw new Error('Image file must be 15 MB or smaller.')
  }

  onProgress(10)

  // 3. Optimize image client-side to ensure lightweight transmission and fast delivery
  const optimized = await optimizeImageClient(file, targetKey === 'hero' ? 1920 : 1600, 0.86)
  onProgress(35)

  let downloadUrl = null
  let storagePath = null
  const sanitizedName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.jpg'
  const timestamp = Date.now()

  // 4. Attempt upload to Firebase Storage if bucket is configured
  if (isFirebaseConfigured() && storage) {
    try {
      storagePath = `website-images/${category.toLowerCase().replace(/\s+/g, '-')}/${timestamp}_${sanitizedName}`
      const storageRef = ref(storage, storagePath)
      const uploadPayload = optimized.blob || file

      const uploadTask = uploadBytesResumable(storageRef, uploadPayload, {
        contentType: 'image/jpeg',
        customMetadata: {
          title: title || file.name || 'Image',
          category,
          uploadedAt: new Date().toISOString(),
        },
      })

      await Promise.race([
        new Promise((res, rej) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 40) + 35
              onProgress(Math.min(85, progress))
            },
            (err) => rej(err),
            async () => {
              try {
                downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
                res()
              } catch (e) {
                rej(e)
              }
            }
          )
        }),
        new Promise((_, reject) =>
          setTimeout(() => {
            try { uploadTask.cancel() } catch {}
            reject(new Error('Firebase Storage timeout - using cloud database storage'))
          }, 45000)
        ),
      ])
    } catch (err) {
      console.info('[Firebase Storage Notice]: Storage upload unavailable, trying cloud database fallback:', err.message)
    }
  }

  onProgress(65)

  // 5. If Firebase Storage was unavailable, attempt Supabase Storage upload via API
  if (!downloadUrl && typeof window !== 'undefined') {
    try {
      const apiRes = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          file: optimized.dataUrl,
          filename: sanitizedName,
          folder: category.toLowerCase().replace(/\s+/g, '-'),
        }),
      })
      if (apiRes.ok) {
        const contentType = apiRes.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const apiData = await apiRes.json()
          if (apiData?.url) {
            downloadUrl = apiData.url
            storagePath = apiData.path || null
          }
        }
      }
    } catch {
      // Offline / standalone mode
    }
  }

  onProgress(85)

  // 6. Final public image URL: Cloud Storage URL or optimized Data URL
  const finalUrl = downloadUrl || optimized.dataUrl

  // 6. Record metadata in Cloud Firestore 'website_images'
  let docId = 'doc_' + timestamp
  if (isFirebaseConfigured() && db) {
    try {
      const imageData = {
        title: title || (file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Uploaded Image'),
        category,
        description: description || '',
        url: finalUrl,
        storagePath: downloadUrl ? storagePath : null,
        fileName: file.name || 'image.jpg',
        fileSize: optimized.size,
        contentType: 'image/jpeg',
        targetKey: targetKey || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'website_images'), imageData)
      docId = docRef.id
    } catch (dbErr) {
      console.warn('[Firestore Record Notice]:', dbErr.message)
    }
  }

  // 7. If linked to a primary website section, update site_settings/images document
  if (targetKey) {
    await setActiveWebsiteImage(targetKey, finalUrl, docId)
  }

  // 8. Local cache fallback update
  try {
    const current = getFallbackLocalGallery()
    current.unshift({
      id: docId,
      title: title || (file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Uploaded Image'),
      category,
      description,
      url: finalUrl,
      storagePath,
      fileName: file.name || 'image.jpg',
      fileSize: optimized.size,
      contentType: 'image/jpeg',
      targetKey: targetKey || null,
      createdAt: new Date(),
    })
    localStorage.setItem('kfs_local_gallery', JSON.stringify(current.slice(0, 30)))
    window.dispatchEvent(new Event('kfs_local_gallery_updated'))
  } catch {}

  onProgress(100)

  return {
    id: docId,
    title: title || file.name || 'Uploaded Image',
    url: finalUrl,
    storagePath,
    createdAt: new Date(),
  }
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

  // Always remove from local storage gallery
  deleteFallbackLocalImage(id)

  if (isFirebaseConfigured() && db && !id.startsWith('seed_') && !id.startsWith('local_')) {
    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'website_images', id))
    } catch (err) {
      console.warn('[Firestore delete warning]:', err.message)
    }

    // 2. Delete from Storage
    if (storagePath && storage) {
      try {
        const storageRef = ref(storage, storagePath)
        await deleteObject(storageRef)
      } catch (err) {
        console.warn('[Storage delete warning]:', err.message)
      }
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
    case 'family':
      IMG.family = imageUrl
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
      if (sectionKey.startsWith('c:')) {
        IMG.collections[sectionKey.slice(2)] = imageUrl
      } else {
        IMG[sectionKey] = imageUrl
      }
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
              if (
                typeof data[key] === 'string' &&
                data[key].length > 0 &&
                !key.endsWith('_updatedAt') &&
                !key.endsWith('_docId') &&
                key !== 'lastUpdated'
              ) {
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
      const q = query(collection(db, 'website_images'))
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
          }))
          // Sort client-side by date to avoid composite index and missing field failures
          items.sort((a, b) => {
            const timeA = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
            const timeB = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
            return timeB - timeA
          })

          if (items.length > 0) {
            callback(items)
          } else {
            callback(getFallbackLocalGallery())
          }
        },
        (error) => {
          console.warn('[Gallery Listener Notice]:', error.message)
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
