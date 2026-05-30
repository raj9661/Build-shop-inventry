"use client"

import { Loader2 } from "lucide-react"

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">Verifying session...</h3>
          <p className="text-sm text-gray-500">Please wait while we securely authenticate you.</p>
        </div>
      </div>
    </div>
  )
}
