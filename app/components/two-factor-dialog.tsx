"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Shield, Mail, Loader2, RefreshCw, Smartphone, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { maskEmail } from "@/lib/utils"
import { clientDeviceFingerprint } from "@/app/lib/client-device-fingerprint"

interface TwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onVerify: (otp: string, deviceInfo?: any) => Promise<boolean>
  onResend: () => Promise<void>
}

export function TwoFactorDialog({ 
  open, 
  onOpenChange, 
  email, 
  onVerify, 
  onResend 
}: TwoFactorDialogProps) {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<any>(null)

  // Collect device info when dialog opens
  useEffect(() => {
    if (open && !deviceInfo) {
      console.log('🔍 [TwoFactorDialog] Collecting device info...');
      clientDeviceFingerprint.getDeviceInfo().then(info => {
        console.log('🔍 [TwoFactorDialog] Device info collected:', {
          deviceName: info.deviceName,
          browser: info.browser,
          os: info.os
        });
        setDeviceInfo(info)
      })
    }
  }, [open, deviceInfo])

  const handleVerify = async () => {
    console.log('🔍 [TwoFactorDialog] handleVerify called!', { otp: otp.substring(0, 2) + '****', rememberDevice });
    
    if (!otp.trim()) {
      toast.error("Please enter the 6-digit code")
      return
    }

    setLoading(true)
    try {
      // Include rememberDevice flag in deviceInfo if checkbox is checked
      const deviceInfoWithRemember = rememberDevice && deviceInfo ? {
        ...deviceInfo,
        rememberDevice: true
      } : undefined;
      
      console.log('🔍 [TwoFactorDialog] Sending device info:', {
        rememberDevice,
        hasDeviceInfo: !!deviceInfo,
        deviceInfoWithRemember: deviceInfoWithRemember ? {
          deviceName: deviceInfoWithRemember.deviceName,
          rememberDevice: deviceInfoWithRemember.rememberDevice
        } : null
      });
      
      const success = await onVerify(otp, deviceInfoWithRemember)
      if (success) {
        toast.success("2FA verification successful!")
        onOpenChange(false)
        setOtp("")
        setRememberDevice(false)
      }
    } catch (error) {
      console.error('2FA verification error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await onResend()
      toast.success("New code sent to your email")
    } catch (error) {
      console.error('Resend error:', error)
      toast.error("Failed to resend code")
    } finally {
      setResending(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setOtp("")
    setRememberDevice(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code sent to your email to complete login.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Code sent to:</strong> {maskEmail(email)}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="otp">Enter 6-digit code</Label>
            <Input
              id="otp"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-widest"
            />
          </div>

          {/* Trusted Device Option */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="remember-device"
                checked={rememberDevice}
                onCheckedChange={(checked) => {
                  console.log('🔍 [TwoFactorDialog] Checkbox changed:', checked);
                  setRememberDevice(checked as boolean);
                }}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="remember-device" 
                  className="text-sm font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-green-600" />
                    Never ask for 2FA on this device
                  </div>
                </Label>
                <p className="text-xs text-gray-600">
                  This device will be remembered and trusted for future logins. 
                  You can manage trusted devices in your security settings.
                </p>
                {deviceInfo && (
                  <p className="text-xs text-gray-500">
                    Device: {deviceInfo.deviceName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              <p className="font-medium">Security Notice:</p>
              <p>
                Trusted devices are identified by device fingerprinting including browser, 
                OS, screen resolution, and other unique characteristics. Only enable this 
                on your personal, secure devices.
              </p>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            The code expires in 10 minutes. Check your email for the verification code.
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <Button 
            onClick={handleVerify} 
            disabled={loading || !otp.trim() || otp.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Login"
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleResend}
            disabled={resending}
            className="w-full"
          >
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend Code
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 