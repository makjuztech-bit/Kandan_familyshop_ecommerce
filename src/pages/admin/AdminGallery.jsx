import { useState, useEffect } from 'react'
import {
  subscribeToImageGallery,
  setActiveWebsiteImage,
  deleteFirebaseImage,
  IMAGE_CATEGORIES,
  WEBSITE_SECTIONS,
} from '../../services/imageService'

export default function AdminGallery() {
  const [images, setImages] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [activeLightbox, setActiveLightbox] = useState(null)
  const [toast, setToast] = useState({ type: '', text: '' })

  useEffect(() => {
    const unsub = subscribeToImageGallery((items) => {
      setImages(items)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast({ type: '', text: '' }), 4000)
  }

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url)
    showToast('success', 'URL copied to clipboard!')
  }

  const handleSetSection = async (img, key) => {
    try {
      await setActiveWebsiteImage(key, img.url, img.id)
      const secName = WEBSITE_SECTIONS.find((s) => s.key === key)?.name || key
      showToast('success', `Assigned "${img.title}" to ${secName}!`)
    } catch (err) {
      showToast('error', err.message || 'Failed to update section.')
    }
  }

  const handleDelete = async (img) => {
    if (!window.confirm(`Permanently delete "${img.title}"?`)) return
    try {
      await deleteFirebaseImage({ id: img.id, storagePath: img.storagePath, targetKey: img.targetKey })
      showToast('success', `Deleted "${img.title}".`)
      if (activeLightbox?.id === img.id) setActiveLightbox(null)
    } catch (err) {
      showToast('error', err.message || 'Deletion failed.')
    }
  }

  const filtered = images.filter((img) =>
    categoryFilter === 'All' ? true : img.category === categoryFilter
  )

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">Media Gallery</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse all visual assets hosted in Firebase Storage and indexed in Cloud Firestore.
          </p>
        </div>
        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {images.length} Assets Stored
        </span>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => setCategoryFilter('All')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            categoryFilter === 'All'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          All Assets ({images.length})
        </button>
        {IMAGE_CATEGORIES.map((cat) => {
          const count = images.filter((i) => i.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Gallery Grid */}
      {filtered.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-500 text-xs">
          <p>No media files found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="group bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-xl transition-all flex flex-col"
            >
              <div
                className="aspect-square bg-slate-950 relative overflow-hidden cursor-pointer"
                onClick={() => setActiveLightbox(img)}
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Click to Inspect
                  </span>
                </div>
                <span className="absolute top-2 left-2 text-[10px] bg-slate-950/80 text-amber-400 px-2 py-0.5 rounded backdrop-blur-sm font-semibold">
                  {img.category}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white truncate" title={img.title}>
                    {img.title}
                  </h3>
                  {img.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{img.description}</p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleCopy(img.url)}
                    className="text-[11px] text-slate-400 hover:text-amber-400 font-medium"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => setActiveLightbox(img)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Options →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative my-8">
            <button
              onClick={() => setActiveLightbox(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700"
            >
              ✕
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12 max-h-[85vh] overflow-y-auto">
              {/* Media viewer */}
              <div className="md:col-span-7 bg-slate-950 flex items-center justify-center p-4 min-h-[300px]">
                <img
                  src={activeLightbox.url}
                  alt={activeLightbox.title}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>

              {/* Details & Operations */}
              <div className="md:col-span-5 p-6 flex flex-col justify-between space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    {activeLightbox.category}
                  </span>
                  <h3 className="text-lg font-serif font-bold text-white mt-2">
                    {activeLightbox.title}
                  </h3>
                  {activeLightbox.description && (
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {activeLightbox.description}
                    </p>
                  )}

                  <dl className="mt-4 space-y-2 text-xs border-t border-slate-800 pt-4">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">File Name</dt>
                      <dd className="text-slate-200 font-mono truncate max-w-[150px]">
                        {activeLightbox.fileName || 'asset.jpg'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Size</dt>
                      <dd className="text-slate-200 font-mono">
                        {(activeLightbox.fileSize ? activeLightbox.fileSize / 1024 : 120).toFixed(0)} KB
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Storage Target</dt>
                      <dd className="text-slate-200 font-mono truncate max-w-[150px]">
                        {activeLightbox.storagePath || 'Cloud Storage'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Assign to Website Section:
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleSetSection(activeLightbox, e.target.value)
                      }}
                      defaultValue=""
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="" disabled>
                        Choose website section…
                      </option>
                      {WEBSITE_SECTIONS.map((sec) => (
                        <option key={sec.key} value={sec.key}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(activeLightbox.url)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      Copy URL
                    </button>
                    <button
                      onClick={() => handleDelete(activeLightbox)}
                      className="py-2.5 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
