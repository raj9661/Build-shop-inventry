"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authUtils } from '../lib/utils'
import { Loader2 } from 'lucide-react'

interface AuthCheckProps {
  children: React.ReactNode
  requiredRole?: string
  fallback?: React.ReactNode
}

export function AuthCheck({ children, requiredRole, fallback }: AuthCheckProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authUtils.isAuthenticated() && authUtils.isTokenValid()
      setIsAuthenticated(authenticated)

      if (authenticated) {
        if (requiredRole) {
          const userRole = authUtils.getUserRole()
          setHasPermission(userRole === requiredRole)
        } else {
          setHasPermission(true)
        }
      } else {
        setHasPermission(false)
        // Clear any invalid auth data
        authUtils.clearAuth()
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [requiredRole])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>
    }
    
    // Redirect to login
    router.push('/login')
    return null
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
} 