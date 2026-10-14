import { useState, useEffect } from 'react'
import {
  WEBSITE_SECTIONS,
  subscribeToSiteImages,
  subscribeToImageGallery,
  setActiveWebsiteImage,
  uploadImageToFirebase,
} from '../../services/imageService'
import { isFirebaseConfigured } from '../../services/firebase'

export default function WebContent() {
  const [activeImages, setActiveImages] = useState({})
  const [gallery, setGallery] = useState([])
  const [uploadingSection, setUploadingSection] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState({ type: '', text: '' })

  useEffect(() => {
    const unsubSite = subscribeToSiteImages((data) => {
      setActiveImages(data || {})
    })
    const unsubGal = subscribeToImageGallery((items) => {
      setGallery(items || [])
    })

    return () => {
      if (typeof unsubSite === 'function') unsubSite()
      if (typeof unsubGal === 'function') unsubGal()
    }
  }, [])

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast({ type: '', text: '' }), 4500)
  }

  // Handle direct file upload for a specific section
  const handleDirectUpload = async (sectionKey, file) => {
    if (!file) return

    setUploadingSection(sectionKey)
    setUploadProgress(15)

    try {
      const secMeta = WEBSITE_SECTIONS.find((s) => s.key === sectionKey)
      const res = await uploadImageToFirebase({
        file,
        title: `${secMeta?.name || sectionKey} Live Update`,
        category: 'Hero Banners',
        targetKey: sectionKey,
        onProgress: (p) => setUploadProgress(p),
      })

      showToast(
        'success',
        `Live image for "${secMeta?.name || sectionKey}" uploaded to Firebase and synchronized across all visitors!`
      )
    } catch (err) {
      showToast('error', err.message || 'Upload failed.')
    } finally {
      setUploadingSection(null)
      setUploadProgress(0)
    }
  }

  // Select an existing image from gallery
  const handleSelectFromGallery = async (sectionKey, url, docId) => {
    try {
      await setActiveWebsiteImage(sectionKey, url, docId)
      const secMeta = WEBSITE_SECTIONS.find((s) => s.key === sectionKey)
      showToast('success', `Updated "${secMeta?.name || sectionKey}" to selected gallery asset!`)
    } catch (err) {
      showToast('error', err.message || 'Failed to update section.')
    }
  }

  // Reset to default
  const handleResetToDefault = async (sec) => {
    if (!window.confirm(`Reset "${sec.name}" back to original boutique default?`)) return
    try {
      await setActiveWebsiteImage(sec.key, sec.defaultUrl, null)
      showToast('success', `Reset "${sec.name}" to default.`)
    } catch (err) {
      showToast('error', err.message || 'Reset failed.')
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast.text && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-500/50 text-emerald-200'
              : 'bg-rose-900/90 border border-rose-500/50 text-rose-200'
          }`}
        >
          <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
            Website Content Synchronization
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage live images shown on the public store. Updates are published instantly to Cloud Firestore and cached with unique asset identifiers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time Firestore Sync Active</span>
          </span>
        </div>
      </div>

      {/* Explanatory banner */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <span className="text-lg">📡</span>
        <div className="leading-relaxed">
          <strong className="text-amber-400 font-semibold block">How synchronization works:</strong>
          When an administrator changes an image here, the URL is recorded in the Firestore{' '}
          <code className="text-amber-300 font-mono">site_settings/images</code> document. The public website's{' '}
          <code className="text-amber-300 font-mono">onSnapshot</code> listener immediately pushes the updated URL to all open devices and browsers without requiring localStorage or code rebuilds.
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {WEBSITE_SECTIONS.map((sec) => {
          const currentUrl = activeImages[sec.key] || sec.defaultUrl
          const isUploading = uploadingSection === sec.key
          const isCustom = activeImages[sec.key] && activeImages[sec.key] !== sec.defaultUrl

          return (
            <div
              key={sec.key}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between"
            >
              <div>
                {/* Header label */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                  <div>
                    <h3 className="text-sm font-bold text-white">{sec.name}</h3>
                    <span className="text-[10px] text-slate-500 font-mono">key: {sec.key}</span>
                  </div>
                  {isCustom ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                      Custom Synced
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                      Default
                    </span>
                  )}
                </div>

                {/* Image preview */}
                <div className="aspect-[16/10] bg-slate-950 relative overflow-hidden group">
                  <img src={currentUrl} alt={sec.name} className="w-full h-full object-cover" />
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-amber-300 text-xs font-semibold transition-opacity gap-1"
                  >
                    <span>View Full Size</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {/* Current URL preview */}
                <div className="p-4 border-b border-slate-800/80">
                  <p className="text-[11px] text-slate-400 font-mono truncate" title={currentUrl}>
                    {currentUrl}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 bg-slate-950/60 space-y-3">
                {/* Upload progress */}
                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-amber-400 font-medium">
                      <span>Uploading to Firebase…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Direct Upload button */}
                <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/20 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload & Set Live</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleDirectUpload(sec.key, f)
                    }}
                    className="hidden"
                  />
                </label>

                {/* Pick from gallery */}
                {gallery.length > 0 && (
                  <div>
                    <select
                      onChange={(e) => {
                        const selectedId = e.target.value
                        const match = gallery.find((g) => g.id === selectedId)
                        if (match) {
                          handleSelectFromGallery(sec.key, match.url, match.id)
                          e.target.value = ''
                        }
                      }}
                      defaultValue=""
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-amber-400"
                    >
                      <option value="" disabled>
                        Pick from Uploaded Gallery ▾
                      </option>
                      {gallery.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} ({g.category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Reset button */}
                {isCustom && (
                  <button
                    onClick={() => handleResetToDefault(sec)}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-rose-400 py-1 transition-colors"
                  >
                    Reset to Default Original Image
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
