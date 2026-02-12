"use client"

import { useEffect } from 'react'

export default function HydrationFix() {
  useEffect(() => {
    // Handle browser extension attributes that cause hydration mismatches
    const handleExtensionAttributes = () => {
      const body = document.body
      if (body) {
        // Remove Grammarly and other extension attributes that cause hydration issues
        const extensionAttributes = [
          'data-new-gr-c-s-check-loaded',
          'data-gr-ext-installed',
          'data-grammarly-shadow-root',
          'data-grammarly-ignore'
        ]
        
        extensionAttributes.forEach(attr => {
          if (body.hasAttribute(attr)) {
            body.removeAttribute(attr)
          }
        })
      }
    }

    // Run immediately and after a short delay to catch late-loading extensions
    handleExtensionAttributes()
    const timeoutId = setTimeout(handleExtensionAttributes, 100)
    
    return () => clearTimeout(timeoutId)
  }, [])

  return null
}
