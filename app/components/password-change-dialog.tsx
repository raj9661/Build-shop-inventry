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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Lock, 
  Mail, 
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Shield
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PasswordStrengthIndicator } from "./password-strength-indicator"

interface PasswordChangeDialogProps {
  userEmail?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface SecuritySettings {
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
  }
}

export function PasswordChangeDialog({ userEmail, trigger, open: controlledOpen, onOpenChange }: PasswordChangeDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState(userEmail || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (typeof controlledOpen === 'boolean') {
      setOpen(controlledOpen)
    }
    if (open) {
      loadSecuritySettings()
    }
  }, [controlledOpen, open])

  const loadSecuritySettings = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSecuritySettings(data.security)
      }
    } catch (error) {
      console.error('Failed to load security settings:', error)
    }
  }

  const handleRequestOTP = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "OTP Sent",
          description: "Check your email for the OTP code",
        })
        setStep('verify')
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send OTP",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    // Validate password against security policy
    if (securitySettings) {
      const policy = securitySettings.passwordPolicy
      const errors: string[] = []

      if (newPassword.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters long`)
      }
      if (policy.requireUppercase && !/[A-Z]/.test(newPassword)) {
        errors.push('Password must contain at least one uppercase letter')
      }
      if (policy.requireLowercase && !/[a-z]/.test(newPassword)) {
        errors.push('Password must contain at least one lowercase letter')
      }
      if (policy.requireNumbers && !/\d/.test(newPassword)) {
        errors.push('Password must contain at least one number')
      }
      if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
        errors.push('Password must contain at least one special character')
      }

      if (errors.length > 0) {
        toast({
          title: "Password Policy Violation",
          description: errors.join(', '),
          variant: "destructive",
        })
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp, newPassword })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        })
        setOpen(false)
        resetForm()
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to change password",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('request')
    setEmail(userEmail || '')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (typeof controlledOpen === 'boolean' && onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setOpen(newOpen)
    }
    if (!newOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={typeof controlledOpen === 'boolean' ? controlledOpen : open} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            {step === 'request' 
              ? "Enter your email to receive an OTP for password change"
              : "Enter the OTP sent to your email and your new password"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'request' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!userEmail}
                  />
                  <Button 
                    onClick={handleRequestOTP} 
                    disabled={loading || !email}
                    size="sm"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">How it works</span>
                  </div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Enter your registered email address</li>
                    <li>• Click the email button to receive OTP</li>
                    <li>• Check your email for the 6-digit code</li>
                    <li>• Enter the OTP and your new password</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="otp">OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 6-digit code sent to {email}
                </p>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* Password Strength Indicator */}
                {newPassword && securitySettings && (
                  <div className="mt-3">
                    <PasswordStrengthIndicator 
                      password={newPassword} 
                      policy={securitySettings.passwordPolicy}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('request')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={loading || !otp || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 