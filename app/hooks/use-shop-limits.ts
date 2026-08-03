import { useState, useEffect } from 'react'

interface ShopLimits {
  canCreate: boolean
  reason?: string
  currentCount: number
  limit: number
  loading: boolean
}

export function useShopLimits() {
  const [limits, setLimits] = useState<ShopLimits>({
    canCreate: true,
    currentCount: 0,
    limit: 1,
    loading: true
  })

  const checkLimits = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLimits(prev => ({ ...prev, loading: true }))
      }
      
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setLimits({
          canCreate: false,
          reason: 'Authentication required',
          currentCount: 0,
          limit: 0,
          loading: false
        })
        return
      }

      // Check current shop count
      const response = await fetch('/api/shops', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const currentCount = data.data?.shops?.length || 0
        
        // Get subscription limits from the API
        const subscriptionResponse = await fetch('/api/subscription/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        let limit = 1 // Default to trial limit
        let planName = 'Trial Plan'
        
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json()
          if (subscriptionData.success && subscriptionData.data) {
            const subscription = subscriptionData.data
            limit = subscription.planLimits?.shops || 1
            planName = subscription.plan || 'Trial Plan'
          }
        }
        
        setLimits({
          canCreate: currentCount < limit,
          reason: currentCount >= limit ? `${planName} allows maximum ${limit} shop(s). You have ${currentCount} shop(s).` : undefined,
          currentCount,
          limit,
          loading: false
        })
      } else {
        setLimits({
          canCreate: false,
          reason: 'Failed to check limits',
          currentCount: 0,
          limit: 0,
          loading: false
        })
      }
    } catch (error) {
      console.error('Error checking shop limits:', error)
      setLimits({
        canCreate: false,
        reason: 'Error checking limits',
        currentCount: 0,
        limit: 0,
        loading: false
      })
    }
  }

  useEffect(() => {
    checkLimits(false)
    
    // Set up automatic refresh every 30 seconds to catch subscription changes
    const interval = setInterval(() => {
      checkLimits(true)
    }, 30000) // 30 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [])

  return {
    ...limits,
    refreshLimits: checkLimits
  }
}
