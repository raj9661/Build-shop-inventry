"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Shield, Smartphone, Loader2, LogOut, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { signOut } from 'next-auth/react'

export default function MFAPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [success, setSuccess] = useState(false)

  const mfaStatus = (session as any)?.mfaStatus

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (mfaStatus === 'VERIFIED') {
      router.push('/dashboard')
      return
    }

    if (mfaStatus === 'SETUP_REQUIRED' && !qrCodeUrl) {
      // Fetch QR Code
      fetch('/api/auth/mfa')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setQrCodeUrl(data.qrCodeUrl)
            setSecret(data.secret)
          } else {
            toast.error(data.message || 'Failed to initialize MFA setup')
          }
          setLoading(false)
        })
        .catch(() => {
          toast.error('Network error during MFA setup')
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [status, mfaStatus, router, qrCodeUrl])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpToken.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }

    setVerifying(true)
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: otpToken })
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
        toast.success('MFA verified successfully!')
        
        // Update NextAuth session to trigger the 'update' event in jwt callback
        await update({ mfaStatus: 'VERIFIED' })
        
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        toast.error(data.message || 'Invalid code. Please try again.')
        setOtpToken('')
      }
    } catch (error) {
      toast.error('Network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <CardDescription>
            {mfaStatus === 'SETUP_REQUIRED' 
              ? 'Secure your account by linking an authenticator app.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-gray-900">Verification Complete</h3>
              <p className="text-sm text-gray-500 mt-2">Redirecting you to the dashboard...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {mfaStatus === 'SETUP_REQUIRED' && qrCodeUrl && (
                <div className="bg-white p-4 border rounded-xl shadow-sm text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    1. Scan this QR code with Google Authenticator, Authy, or similar apps.
                  </p>
                  <img src={qrCodeUrl} alt="MFA QR Code" className="mx-auto w-48 h-48 rounded" />
                  <p className="text-xs text-gray-400 mt-4 font-mono">
                    Secret Key: <span className="font-semibold text-gray-700">{secret}</span>
                  </p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium text-gray-700">
                    {mfaStatus === 'SETUP_REQUIRED' ? '2. Enter the 6-digit code generated by your app' : 'Authenticator Code'}
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest h-14"
                    disabled={verifying}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                  disabled={verifying || otpToken.length !== 6}
                >
                  {verifying ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </form>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center border-t pt-6 pb-2">
          <Button 
            variant="ghost" 
            className="text-gray-500 hover:text-gray-900"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
