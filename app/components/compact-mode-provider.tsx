"use client"

import { createContext, useContext, useEffect, useState } from "react"

interface CompactModeContextType {
  isCompactMode: boolean
  toggleCompactMode: () => void
  compactClass: string
}

const CompactModeContext = createContext<CompactModeContextType | undefined>(undefined)

export function CompactModeProvider({ children }: { children: React.ReactNode }) {
  const [isCompactMode, setIsCompactMode] = useState(false)

  // Load compact mode setting on mount
  useEffect(() => {
    loadCompactModeSetting()
  }, [])

  const loadCompactModeSetting = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsCompactMode(data.appearance?.compactMode || false)
      }
    } catch (error) {
      console.error('Failed to load compact mode setting:', error)
    }
  }

  const toggleCompactMode = async () => {
    const newCompactMode = !isCompactMode
    setIsCompactMode(newCompactMode)
    
    // Update settings in database
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const currentSettings = await response.json()
        const updatedSettings = {
          ...currentSettings,
          appearance: {
            ...currentSettings.appearance,
            compactMode: newCompactMode
          }
        }

        await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedSettings)
        })
      }
    } catch (error) {
      console.error('Failed to save compact mode setting:', error)
    }
  }

  // CSS classes for compact mode
  const compactClass = isCompactMode ? 'compact-mode' : ''

  return (
    <CompactModeContext.Provider value={{ isCompactMode, toggleCompactMode, compactClass }}>
      <div className={compactClass}>
        {children}
      </div>
    </CompactModeContext.Provider>
  )
}

export function useCompactMode() {
  const context = useContext(CompactModeContext)
  if (context === undefined) {
    throw new Error('useCompactMode must be used within a CompactModeProvider')
  }
  return context
} 