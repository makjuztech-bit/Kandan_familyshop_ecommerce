/**
 * Safe API response parser to prevent:
 * "Unexpected token '<', "<!doctype "... is not valid JSON"
 * when unhandled routes or static hosting (e.g. Firebase Hosting rewrites) return HTML index.html
 */
export async function parseJsonSafe(response) {
  if (!response) return { isHtml: true, ok: false, error: 'NO_RESPONSE' }
  
  const contentType = response.headers?.get('content-type') || ''
  if (contentType.includes('text/html')) {
    return { isHtml: true, ok: false, status: response.status }
  }

  let text = ''
  try {
    text = await response.text()
  } catch {
    return { isHtml: false, ok: false, error: 'READ_ERROR' }
  }

  if (!text || !text.trim() || text.trim().startsWith('<')) {
    return { isHtml: true, ok: false, status: response.status }
  }

  try {
    const data = JSON.parse(text)
    return { ...data, isHtml: false, _status: response.status }
  } catch {
    return { isHtml: true, ok: false, status: response.status }
  }
}

export async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options)
    const data = await parseJsonSafe(res)
    if (data.isHtml) {
      return { ok: false, isHtml: true, error: 'HTML_RESPONSE' }
    }
    return data
  } catch (err) {
    return { ok: false, error: err.message || 'NETWORK_ERROR' }
  }
}
