/**
 * useAuthGuard — Central session guard hook
 *
 * Usage in any protected page:
 *   const { authReady, isAuthenticated } = useAuthGuard()
 *   if (!authReady) return <LoadingSpinner />
 *   if (!isAuthenticated) return <SessionExpiredScreen />
 *
 * What it checks (in order):
 *   1. NextAuth session status  — most reliable for NextAuth-based logins
 *   2. JWT token presence       — for custom auth flow (JWT in localStorage)
 *   3. JWT token expiry (exp)   — client-side check, zero network calls
 *
 * On expiry/missing token: clears localStorage auth keys automatically.
 */
"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"

export type AuthGuardResult = {
  /** True once the auth check has completed (show spinner until this is true) */
  authReady: boolean
  /** True if the user has a valid, non-expired session */
  isAuthenticated: boolean
}

const AUTH_KEYS = ["accessToken", "refreshToken", "userRole", "selectedShopId"] as const

function clearAuthKeys() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key))
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const nowSecs = Math.floor(Date.now() / 1000)
    return !!payload.exp && payload.exp < nowSecs
  } catch {
    return true // treat malformed token as expired
  }
}

export function useAuthGuard(): AuthGuardResult {
  const { data: session, status } = useSession()
  const [authReady, setAuthReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // While NextAuth is resolving, wait
    if (status === "loading") return

    // Check token expiration dynamically
    const token = (session as any)?.apiToken || localStorage.getItem("accessToken")
    
    // If token exists but is expired, force logout (overrides NextAuth 30-day cookie)
    if (token && isTokenExpired(token)) {
      clearAuthKeys()
      setIsAuthenticated(false)
      setAuthReady(true)
      
      // If NextAuth thought we were logged in, actually clear the session
      if (status === "authenticated") {
        signOut({ redirect: false })
      }
      return
    }

    // NextAuth says the session is active and token isn't expired
    if (status === "authenticated" && session?.user) {
      const mfaStatus = (session as any).mfaStatus
      console.log('🛡️ [useAuthGuard] Authenticated. MFA Status:', mfaStatus);
      
      if (mfaStatus === 'SETUP_REQUIRED' || mfaStatus === 'VERIFICATION_REQUIRED') {
        console.log('🛡️ [useAuthGuard] Redirecting to /mfa...');
        // Prevent infinite redirect loop if already on the MFA page
        if (!window.location.pathname.startsWith('/mfa')) {
          window.location.href = '/mfa'
          return
        }
        // If they are on the /mfa page, they are authenticated but not "ready" for the dashboard
        setIsAuthenticated(false)
        setAuthReady(true)
        return
      }

      setIsAuthenticated(true)
      setAuthReady(true)
      return
    }

    // Fallback: custom JWT auth flow (valid token)
    if (token && token !== "undefined" && token !== "null") {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        console.log('🛡️ [useAuthGuard] Fallback JWT MFA Status:', payload.mfaStatus);
        if (payload.mfaStatus === 'SETUP_REQUIRED' || payload.mfaStatus === 'VERIFICATION_REQUIRED') {
          if (!window.location.pathname.startsWith('/mfa')) {
            window.location.href = '/mfa'
            return
          }
          setIsAuthenticated(false)
          setAuthReady(true)
          return
        }
      } catch (e) {
        console.error('Error parsing token payload:', e);
      }

      setIsAuthenticated(true)
      setAuthReady(true)
      return
    }

    // No token and not authenticated
    setIsAuthenticated(false)
    setAuthReady(true)
  }, [session, status])

  return { authReady, isAuthenticated }
}
