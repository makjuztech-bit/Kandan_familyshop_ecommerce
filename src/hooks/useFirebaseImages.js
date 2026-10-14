import { useState, useEffect } from 'react'
import { subscribeToSiteImages, applyImageToStore, WEBSITE_SECTIONS } from '../services/imageService'
import { IMG } from '../config/shop'

export function useFirebaseImages() {
  const [activeImages, setActiveImages] = useState(() => {
    const initial = {}
    WEBSITE_SECTIONS.forEach((s) => {
      initial[s.key] = s.defaultUrl
    })
    return initial
  })

  useEffect(() => {
    const unsubscribe = subscribeToSiteImages((remoteData) => {
      if (!remoteData) return

      setActiveImages((prev) => {
        const next = { ...prev }
        Object.keys(remoteData).forEach((key) => {
          if (typeof remoteData[key] === 'string' && remoteData[key].startsWith('http')) {
            next[key] = remoteData[key]
            applyImageToStore(key, remoteData[key])
          }
        })
        return next
      })
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  return activeImages
}
