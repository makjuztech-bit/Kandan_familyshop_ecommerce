import { useState } from 'react'
import { useBackgroundImage, setBackgroundImage, resetBackgroundImage, DEFAULT_BACKGROUND } from '../data/background'
import { btnP, btnO } from './ui'

const PRESETS = [
  { name: 'Kanchipuram Silk Showroom (Default)', url: DEFAULT_BACKGROUND },
  { name: 'Pure Silk & Zari Weave', url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80' },
  { name: 'Royal Gold & primary Brocade', url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1600&q=80' },
  { name: 'Traditional Bridal Loom', url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1600&q=80' },
]

export default function BackgroundModal({ isOpen, onClose }) {
  const currentBg = useBackgroundImage()
  const [inputUrl, setInputUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('')

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setStatus('Please select a JPG, JPEG, PNG, or WebP image file.')
      e.target.value = ''
      return
    }

    // Validate size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      setStatus('File size is too large. Background image must be 10 MB or smaller.')
      e.target.value = ''
      return
    }

    setLoading(true)
    setStatus('uploading')

    try {
      // Scale and compress optimal HD dimensions for fast loading
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            const scale = Math.min(1, 1920 / img.width)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.88))
          }
          img.onerror = () => reject(new Error('Could not parse image.'))
          img.src = reader.result
        }
        reader.onerror = () => reject(new Error('Could not read file.'))
        reader.readAsDataURL(file)
      })

      // Upload to server and Supabase storage
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: dataUrl,
          filename: file.name,
          folder: 'background',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed.')
      }

      setPreview(data.url)
      setStatus('upload_success')
    } catch (err) {
      setStatus(err.message || 'Could not upload background image. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    const target = preview || inputUrl.trim()
    if (!target) {
      setStatus('Please select or upload an image first.')
      return
    }

    setLoading(true)
    const success = await setBackgroundImage(target)
    setLoading(false)

    if (success) {
      setStatus('success')
      setPreview('')
      setInputUrl('')
    } else {
      setStatus('Failed to save background image. Please retry.')
    }
  }

  const handleReset = async () => {
    setLoading(true)
    await resetBackgroundImage()
    setPreview('')
    setInputUrl('')
    setLoading(false)
    setStatus('reset')
  }

  const activeImage = preview || inputUrl || currentBg

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bg-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border-2 border-gold/60 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gold/30 pb-4">
          <div>
            <h2 id="bg-modal-title" className="font-serif text-2xl font-bold text-primary">
              Website Background Image
            </h2>
            <p className="mt-1 text-xs text-ink/70">
              The selected background image remains <strong>fixed and persistent</strong> across all page reloads, navigations, and refreshes until you manually change it.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-ink/60 hover:bg-gold/20 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Current / New Preview */}
        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/60">
            {preview ? 'New Selection Preview' : 'Active Background'}
          </label>
          <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl border border-gold/40 bg-ink">
            <img
              src={activeImage}
              alt="Website background preview"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">
              {preview ? 'Preview (unsaved)' : 'Fixed & Active'}
            </div>
          </div>
        </div>

        {/* Status messages */}
        {status === 'uploading' && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
            <span className="animate-spin text-sm">⏳</span> Uploading image to permanent storage…
          </div>
        )}
        {status === 'upload_success' && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
            ✓ <strong>Image uploaded to storage!</strong> Click <strong>"Save &amp; Keep Fixed"</strong> below to apply it permanently.
          </div>
        )}
        {status === 'success' && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
            ✓ <strong>Background image successfully updated!</strong> This image is now saved permanently and will not rotate or change on page refreshes.
          </div>
        )}
        {status === 'reset' && (
          <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs text-blue-800">
            ✓ Reset to original showroom boutique background.
          </div>
        )}
        {status && !['success', 'reset', 'uploading', 'upload_success'].includes(status) && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
            {status}
          </div>
        )}

        {/* Manual upload */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-ink">
              1. Upload a New Background Image (from your device):
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="mt-1.5 block w-full text-sm text-ink/70 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-primary-dark"
            />
          </div>

          <div>
            <label htmlFor="bg-url-input" className="block text-sm font-bold text-ink">
              2. Or Enter Image URL:
            </label>
            <input
              id="bg-url-input"
              type="url"
              placeholder="https://example.com/saree-showroom.jpg"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value)
                setPreview('')
                setStatus('')
              }}
              className="mt-1.5 min-h-11 w-full rounded border border-gold-dark/50 bg-white px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Quick curated presets */}
          <div>
            <label className="block text-sm font-bold text-ink">
              3. Or Pick a Curated Silk Theme:
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setInputUrl(p.url)
                    setPreview('')
                    setStatus('')
                  }}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                    activeImage === p.url
                      ? 'border-primary bg-primary/10 font-bold text-primary'
                      : 'border-gold/40 hover:bg-ivory'
                  }`}
                >
                  <img src={p.url} alt="" className="h-8 w-10 shrink-0 rounded object-cover" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gold/30 pt-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="text-xs text-red-700 underline hover:text-red-900"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnO}>
              Close
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || (!preview && !inputUrl.trim())}
              className={btnP}
            >
              {loading ? 'Saving…' : 'Save & Keep Fixed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

