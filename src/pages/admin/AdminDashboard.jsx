import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { isFirebaseConfigured, firebaseConfig } from '../../services/firebase'
import {
  subscribeToImageGallery,
  subscribeToSiteImages,
  uploadImageToFirebase,
  IMAGE_CATEGORIES,
  WEBSITE_SECTIONS,
} from '../../services/imageService'

export default function AdminDashboard() {
  const { adminUser } = useAdminAuth()
  const [images, setImages] = useState([])
  const [activeSiteImages, setActiveSiteImages] = useState({})
  const [quickFile, setQuickFile] = useState(null)
  const [quickPreview, setQuickPreview] = useState('')
  const [quickCategory, setQuickCategory] = useState('Hero Banners')
  const [quickTarget, setQuickTarget] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' })

  const isConfigured = isFirebaseConfigured()

  useEffect(() => {
    const unsubGallery = subscribeToImageGallery((items) => {
      setImages(items)
    })
    const unsubSite = subscribeToSiteImages((data) => {
      setActiveSiteImages(data)
    })

    return () => {
      if (typeof unsubGallery === 'function') unsubGallery()
      if (typeof unsubSite === 'function') unsubSite()
    }
  }, [])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    setUploadMsg({ type: '', text: '' })
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadMsg({ type: 'error', text: 'Please choose an image file (JPG, PNG, WebP).' })
      return
    }

    setQuickFile(file)
    const previewUrl = URL.createObjectURL(file)
    setQuickPreview(previewUrl)
  }

  const handleQuickUpload = async (e) => {
    e.preventDefault()
    if (!quickFile) return

    setUploading(true)
    setUploadProgress(10)
    setUploadMsg({ type: '', text: '' })

    try {
      await uploadImageToFirebase({
        file: quickFile,
        title: quickFile.name.replace(/\.[^/.]+$/, ''),
        category: quickCategory,
        targetKey: quickTarget,
        onProgress: (p) => setUploadProgress(p),
      })

      setUploadMsg({
        type: 'success',
        text: `Image successfully uploaded to Firebase Storage and recorded in Firestore!${
          quickTarget ? ' Live website section updated!' : ''
        }`,
      })
      setQuickFile(null)
      setQuickPreview('')
      setQuickTarget('')
      setUploadProgress(0)
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.message || 'Upload failed.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>✨</span>
            <span>Firebase Cloud Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
            Welcome, {adminUser?.displayName || 'Administrator'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
            Real-time management for website images, banners, and digital assets. Changes made here sync directly with Cloud Firestore and reflect across all visitor devices instantly.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Link
            to="/admin/images"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Upload Images</span>
          </Link>
          <Link
            to="/admin/content"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs tracking-wider transition-all"
          >
            <span>Sync Content</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <span>Total Uploaded Images</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-sans font-extrabold text-white tabular-nums lining-nums">{images.length}</span>
            <span className="text-xs text-slate-400">files in storage</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Stored in Cloud Storage</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <span>Website Synced Sections</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-sans font-extrabold text-white tabular-nums lining-nums">
              {WEBSITE_SECTIONS.length}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Active & Live</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Firestore onSnapshot Real-time</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <span>Firebase Storage</span>
            <div className={`p-2 rounded-lg ${isConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-bold text-white block truncate">
              {isConfigured ? 'Connected' : 'Local Fallback'}
            </span>
            <span className="text-xs text-slate-400 truncate block mt-0.5">
              {firebaseConfig.projectId || 'Ready for config'}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{isConfigured ? 'Active Project' : 'Click Settings to configure'}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <span>Security & Access</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-bold text-white block">Protected</span>
            <span className="text-xs text-slate-400 block mt-0.5">Auth Required for Writes</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Rules Enforced</span>
          </div>
        </div>
      </div>

      {/* Main Row: Quick Upload & Live Sync Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Quick Upload Widget */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Quick Image Upload to Firebase</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload image to Firebase Storage, save to Firestore, and optionally update website section in 1 step.
              </p>
            </div>
            <Link to="/admin/images" className="text-xs text-amber-400 hover:text-amber-300 font-semibold">
              Advanced →
            </Link>
          </div>

          {uploadMsg.text && (
            <div
              className={`mb-5 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                uploadMsg.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-800/80 text-rose-200'
              }`}
            >
              <span>{uploadMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleQuickUpload} className="space-y-4">
            {/* File Dropzone */}
            <div className="relative">
              <label
                htmlFor="quick-file-input"
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  quickPreview
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950'
                }`}
              >
                {quickPreview ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="h-40 w-full max-w-sm rounded-xl overflow-hidden border border-slate-700 bg-slate-900 relative">
                      <img
                        src={quickPreview}
                        alt="Upload Preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 text-[10px] bg-slate-950/80 text-amber-400 px-2 py-0.5 rounded font-mono">
                        Preview
                      </span>
                    </div>
                    <span className="text-xs text-slate-300 font-medium">
                      {quickFile?.name} ({(quickFile?.size / 1024).toFixed(1)} KB)
                    </span>
                    <span className="text-[11px] text-amber-400 hover:underline">
                      Click to choose a different photo
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      Click to select or drag and drop an image
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Supports JPG, PNG, WebP up to 15MB
                    </span>
                  </div>
                )}
                <input
                  id="quick-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  {IMAGE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Assign to Website Section (Optional)
                </label>
                <select
                  value={quickTarget}
                  onChange={(e) => setQuickTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">Do not assign directly (Gallery only)</option>
                  {WEBSITE_SECTIONS.map((sec) => (
                    <option key={sec.key} value={sec.key}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-amber-400">Uploading to Firebase Storage…</span>
                  <span className="text-slate-300">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!quickFile || uploading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Processing Upload…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload & Sync with Firebase</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Website Synced Sections Overview */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">Live Website Sync</h2>
              <p className="text-xs text-slate-400">Current active images synced via Firestore</p>
            </div>
            <Link to="/admin/content" className="text-xs text-amber-400 hover:text-amber-300 font-semibold">
              Manage All →
            </Link>
          </div>

          <div className="space-y-3">
            {WEBSITE_SECTIONS.slice(0, 4).map((sec) => {
              const activeUrl = activeSiteImages[sec.key] || sec.defaultUrl
              return (
                <div
                  key={sec.key}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0">
                    <img src={activeUrl} alt={sec.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white truncate">{sec.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      {activeUrl}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-emerald-400 font-semibold">
                      ● Active Live
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div>
              <span className="font-semibold block text-amber-300">Multi-Device Synchronization:</span>
              <span>
                Any image change made in the admin panel propagates automatically to all connected users and browsers in real-time without requiring a page rebuild.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Uploads Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div>
            <h2 className="text-base font-bold text-white">Recent Media Uploads</h2>
            <p className="text-xs text-slate-400">Recently uploaded items stored in Firebase Storage</p>
          </div>
          <Link to="/admin/gallery" className="text-xs text-amber-400 hover:text-amber-300 font-semibold">
            View Full Gallery ({images.length}) →
          </Link>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <p>No images uploaded yet. Use the Quick Upload form above to add your first photo!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.slice(0, 6).map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition-all shadow-md flex flex-col"
              >
                <div className="aspect-square overflow-hidden bg-slate-900 relative">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[9px] bg-slate-950/80 text-amber-400 font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {img.category}
                  </span>
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <p className="text-xs font-semibold text-slate-200 truncate" title={img.title}>
                    {img.title}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    {img.createdAt ? new Date(img.createdAt).toLocaleDateString() : 'Active'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
