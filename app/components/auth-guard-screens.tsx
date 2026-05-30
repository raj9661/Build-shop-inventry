/**
 * AuthGuardScreens — Shared UI for auth loading / session expired states.
 *
 * Usage:
 *   import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"
 *   const { authReady, isAuthenticated } = useAuthGuard()
 *   if (!authReady) return <AuthLoadingScreen />
 *   if (!isAuthenticated) return <SessionExpiredScreen />
 */
"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AuthLoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-500 animate-pulse">Verifying session…</p>
      </div>
    </div>
  )
}

export function SessionExpiredScreen() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
            <span className="text-3xl">⏰</span>
          </div>
          <CardTitle className="text-xl font-bold text-gray-800">Session Expired</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-5 pb-8 px-8">
          <p className="text-gray-500 text-sm leading-relaxed">
            Your session has timed out for security. Please sign in again to continue.
          </p>
          <Button
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-md hover:shadow-lg"
            onClick={() => router.push("/login")}
          >
            Sign In Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
