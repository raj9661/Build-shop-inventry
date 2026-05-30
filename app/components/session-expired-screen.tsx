"use client"

import { LogIn, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SessionExpiredScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-md shadow-lg border-red-100">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-semibold text-gray-900">Session Expired</CardTitle>
          <CardDescription className="text-base text-gray-500">
            Your secure session has timed out due to inactivity or authorization changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-2 pb-6">
          <Button 
            className="w-full sm:w-auto min-w-[200px]" 
            size="lg"
            onClick={() => window.location.href = '/login'}
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign In Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
