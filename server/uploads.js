import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseServer, isServerSupabaseConfigured } from './supabase.js'

const root = dirname(fileURLToPath(import.meta.url))
const uploadsLocalDir = resolve(root, '../public/images/uploads')
mkdirSync(uploadsLocalDir, { recursive: true })

export const STORAGE_BUCKET = 'shop-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Validates image buffer using magic bytes signatures
 */
export function validateImageBuffer(buffer, mimeType) {
  if (!buffer || buffer.length === 0) {
    return { error: 'Empty file provided.' }
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { error: 'Image must be 10 MB or smaller.' }
  }

  const normalizedMime = mimeType?.toLowerCase()
  if (!ALLOWED_MIME_TYPES[normalizedMime]) {
    return { error: 'Only JPG, JPEG, PNG, and WebP images are supported.' }
  }

  // Validate magic bytes
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isWebp = buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'

  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
    if (!isJpeg) return { error: 'File content does not match JPEG format.' }
  } else if (normalizedMime === 'image/png') {
    if (!isPng) return { error: 'File content does not match PNG format.' }
  } else if (normalizedMime === 'image/webp') {
    if (!isWebp) return { error: 'File content does not match WebP format.' }
  }

  return { ok: true, ext: ALLOWED_MIME_TYPES[normalizedMime] }
}

/**
 * Parses base64 data URL into buffer and mimeType
 */
export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return { error: 'Invalid image data URL format.' }
  }

  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    return { error: 'Malformed base64 image data URL.' }
  }

  const mimeType = matches[1].toLowerCase()
  try {
    const buffer = Buffer.from(matches[2], 'base64')
    return { buffer, mimeType }
  } catch {
    return { error: 'Could not decode base64 image data.' }
  }
}

/**
 * Uploads an image to Supabase Storage with local persistent storage fallback
 */
export async function uploadImage({ buffer, mimeType, folder = 'general', originalName = 'image' }) {
  const validation = validateImageBuffer(buffer, mimeType)
  if (validation.error) {
    return { error: validation.error }
  }

  const ext = validation.ext
  const safeBaseName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 40)
  const filename = `${safeBaseName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  const folderClean = folder.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase() || 'general'
  const storagePath = `${folderClean}/${filename}`

  // 1. Always save a permanent local copy in public/images/uploads/<folder>/<filename>
  const localTargetFolder = resolve(uploadsLocalDir, folderClean)
  mkdirSync(localTargetFolder, { recursive: true })
  const localFilePath = resolve(localTargetFolder, filename)
  let localUrl = `/images/uploads/${folderClean}/${filename}`

  try {
    writeFileSync(localFilePath, buffer)
  } catch (err) {
    console.warn('[Upload] Local save warning:', err.message)
  }

  // 2. Upload to Supabase Storage if configured
  if (isServerSupabaseConfigured && supabaseServer) {
    try {
      const { data: uploadData, error: uploadErr } = await supabaseServer.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadErr) {
        console.warn('[Supabase Storage Upload Warning]:', uploadErr.message)
        // Return permanent local fallback URL
        return {
          ok: true,
          url: localUrl,
          storage: 'local',
          filename,
          path: storagePath,
          message: 'Saved to persistent local storage (Supabase fallback)',
        }
      }

      const { data: publicUrlData } = supabaseServer.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath)

      if (publicUrlData?.publicUrl) {
        return {
          ok: true,
          url: publicUrlData.publicUrl,
          storage: 'supabase',
          filename,
          path: storagePath,
          localUrl,
        }
      }
    } catch (err) {
      console.warn('[Supabase Storage Upload Exception]:', err.message)
    }
  }

  // If Supabase not configured or failed, local URL is the permanent source
  return {
    ok: true,
    url: localUrl,
    storage: 'local',
    filename,
    path: storagePath,
  }
}

/**
 * Delete image from Supabase Storage and local disk
 */
export async function deleteImage(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return { ok: false }

  // Check if it's a Supabase storage URL
  const bucketPrefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  if (urlOrPath.includes(bucketPrefix) && isServerSupabaseConfigured && supabaseServer) {
    const relativePath = urlOrPath.split(bucketPrefix)[1]
    if (relativePath) {
      try {
        await supabaseServer.storage.from(STORAGE_BUCKET).remove([relativePath])
      } catch (err) {
        console.warn('[Supabase Storage Delete Warning]:', err.message)
      }
    }
  }

  // Check if local file
  if (urlOrPath.startsWith('/images/uploads/')) {
    const rel = urlOrPath.replace('/images/uploads/', '')
    const fullPath = resolve(uploadsLocalDir, rel)
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath)
      } catch {}
    }
  }

  return { ok: true }
}
