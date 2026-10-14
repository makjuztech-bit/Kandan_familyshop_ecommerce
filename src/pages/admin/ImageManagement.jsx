import { useState, useEffect } from 'react'
import {
  subscribeToImageGallery,
  uploadImageToFirebase,
  replaceFirebaseImage,
  deleteFirebaseImage,
  setActiveWebsiteImage,
  IMAGE_CATEGORIES,
  WEBSITE_SECTIONS,
} from '../../services/imageService'
import { isFirebaseConfigured } from '../../services/firebase'

export default function ImageManagement() {
  const [images, setImages] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Upload Form State
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(IMAGE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [targetKey, setTargetKey] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState({ type: '', text: '' })

  // Replace Modal State
  const [replaceTarget, setReplaceTarget] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [replacePreview, setReplacePreview] = useState('')
  const [replacing, setReplacing] = useState(false)

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
    setTimeout(() => {
      setToast({ type: '', text: '' })
    }, 5000)
  }

  // Handle new file selection
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      showToast('error', 'Please choose a valid image file.')
      return
    }

    if (selected.size > 15 * 1024 * 1024) {
      showToast('error', 'File size exceeds 15 MB limit.')
      return
    }

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''))
    }
  }

  // Handle Upload
  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      showToast('error', 'Please choose an image to upload.')
      return
    }

    setUploading(true)
    setUploadProgress(10)

    try {
      const res = await uploadImageToFirebase({
        file,
        title: title.trim() || file.name,
        category,
        description: description.trim(),
        targetKey,
        onProgress: (p) => setUploadProgress(p),
      })

      showToast('success', `"${res.title}" successfully uploaded and saved to Firebase!`)
      // Reset form
      setFile(null)
      setPreviewUrl('')
      setTitle('')
      setDescription('')
      setTargetKey('')
      setUploadProgress(0)
    } catch (err) {
      showToast('error', err.message || 'Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  // Handle Replace
  const handleReplaceSubmit = async (e) => {
    e.preventDefault()
    if (!replaceTarget || !replaceFile) return

    setReplacing(true)
    try {
      await replaceFirebaseImage({
        docId: replaceTarget.id,
        oldStoragePath: replaceTarget.storagePath,
        newFile: replaceFile,
        title: replaceTarget.title,
        category: replaceTarget.category,
        description: replaceTarget.description,
        targetKey: replaceTarget.targetKey,
      })

      showToast('success', `"${replaceTarget.title}" replaced successfully!`)
      setReplaceTarget(null)
      setReplaceFile(null)
      setReplacePreview('')
    } catch (err) {
      showToast('error', err.message || 'Replace failed.')
    } finally {
      setReplacing(false)
    }
  }

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await deleteFirebaseImage({
        id: deleteTarget.id,
        storagePath: deleteTarget.storagePath,
        targetKey: deleteTarget.targetKey,
      })

      showToast('success', `Image "${deleteTarget.title}" deleted from Firebase.`)
      setDeleteTarget(null)
    } catch (err) {
      showToast('error', err.message || 'Deletion failed.')
    } finally {
      setDeleting(false)
    }
  }

  // Handle direct assign to website section
  const handleAssignToSection = async (img, sectionKey) => {
    try {
      await setActiveWebsiteImage(sectionKey, img.url, img.id)
      const secName = WEBSITE_SECTIONS.find((s) => s.key === sectionKey)?.name || sectionKey
      showToast('success', `Assigned "${img.title}" to ${secName}!`)
    } catch (err) {
      showToast('error', err.message || 'Failed to update website section.')
    }
  }

  // Copy URL to clipboard
  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url)
    showToast('success', 'Image URL copied to clipboard!')
  }

  // Filtered list
  const filteredImages = images.filter((img) => {
    const matchesCat = selectedCategory === 'All' || img.category === selectedCategory
    const matchesSearch =
      !searchQuery ||
      img.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast.text && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-500/50 text-emerald-200'
              : 'bg-rose-900/90 border border-rose-500/50 text-rose-200'
          }`}
        >
          <span className="text-base">{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">Image Management</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Upload, manage, replace, and configure high-resolution media stored in Firebase Storage and indexed in Cloud Firestore.
        </p>
      </div>

      {/* Upload New Image Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Upload New Image</span>
        </h2>

        <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File input & preview on left */}
          <div className="lg:col-span-5">
            <label
              htmlFor="main-file-input"
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all h-full min-h-[220px] ${
                previewUrl
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
              }`}
            >
              {previewUrl ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 relative">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <span className="absolute top-2 right-2 text-[10px] bg-slate-950/80 text-amber-400 px-2 py-0.5 rounded font-mono">
                      Preview
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-medium truncate max-w-full">
                    {file?.name} ({(file?.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <span className="text-[11px] text-amber-400 hover:underline">
                    Click to select different image
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-white">Choose Image File</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG, WebP up to 15MB</span>
                </div>
              )}
              <input
                id="main-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Metadata fields on right */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Image Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kanchipuram Pure Silk Weave"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                >
                  {IMAGE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Description / Alt Text
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description for SEO and accessibility…"
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Directly Assign to Website Section (Optional)
              </label>
              <select
                value={targetKey}
                onChange={(e) => setTargetKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="">Do not assign directly (Gallery store only)</option>
                {WEBSITE_SECTIONS.map((sec) => (
                  <option key={sec.key} value={sec.key}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Progress indicator */}
            {uploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-amber-400">Uploading to Firebase Storage…</span>
                  <span className="text-slate-300">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Processing Upload to Firebase…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload Image to Firebase</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'All'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            All ({images.length})
          </button>
          {IMAGE_CATEGORIES.map((cat) => {
            const count = images.filter((i) => i.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {cat} {count > 0 && `(${count})`}
              </button>
            )
          })}
        </div>

        <div className="relative min-w-[220px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search images…"
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Images List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            Uploaded Assets ({filteredImages.length})
          </h2>
          <span className="text-xs text-slate-400">
            Stored in Firebase Storage bucket
          </span>
        </div>

        {filteredImages.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <p>No images matching your filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-850/50 transition-colors"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 relative group">
                    <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleCopyUrl(img.url)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-amber-300 text-[10px] font-semibold transition-opacity"
                    >
                      Copy URL
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate">{img.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                        {img.category}
                      </span>
                      {img.targetKey && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          Synced: {img.targetKey}
                        </span>
                      )}
                    </div>
                    {img.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{img.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                      <span>{(img.fileSize ? img.fileSize / 1024 : 120).toFixed(0)} KB</span>
                      <span>•</span>
                      <span>
                        {img.createdAt ? new Date(img.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Assign to section dropdown */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignToSection(img, e.target.value)
                        e.target.value = ''
                      }
                    }}
                    defaultValue=""
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs hover:border-slate-700"
                  >
                    <option value="" disabled>
                      Assign to Section ▾
                    </option>
                    {WEBSITE_SECTIONS.map((sec) => (
                      <option key={sec.key} value={sec.key}>
                        {sec.name}
                      </option>
                    ))}
                  </select>

                  {/* Replace Button */}
                  <button
                    onClick={() => {
                      setReplaceTarget(img)
                      setReplaceFile(null)
                      setReplacePreview('')
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Replace</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeleteTarget(img)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Replace Image Modal */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Replace Image: {replaceTarget.title}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select a new file. The existing file in Firebase Storage will be replaced and the Firestore document updated automatically.
            </p>

            <form onSubmit={handleReplaceSubmit} className="space-y-4">
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer bg-slate-950 hover:bg-slate-900">
                {replacePreview ? (
                  <div className="w-full h-40 rounded-lg overflow-hidden">
                    <img src={replacePreview} alt="New Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-xs text-amber-400 font-semibold">Choose Replacement File</span>
                    <span className="block text-[11px] text-slate-500 mt-1">JPG, PNG, WebP</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setReplaceFile(f)
                      setReplacePreview(URL.createObjectURL(f))
                    }
                  }}
                  className="hidden"
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setReplaceTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replaceFile || replacing}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold"
                >
                  {replacing ? 'Replacing…' : 'Confirm Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Delete Image Confirmation</h3>
            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to permanently delete <strong className="text-slate-200">{deleteTarget.title}</strong>? This will remove the file from Firebase Storage and its Firestore record.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold"
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
