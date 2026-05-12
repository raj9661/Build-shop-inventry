"use client"

import { useState } from "react"
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
import { AlertTriangle, Mail, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { shopService } from "../lib/services/shopService"
import { maskEmail } from "@/lib/utils"

interface ShopDeletionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopId: number
  shopName: string
  onShopDeleted?: () => void
}

export function ShopDeletionDialog({ 
  open, 
  onOpenChange, 
  shopId, 
  shopName, 
  onShopDeleted 
}: ShopDeletionDialogProps) {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [userEmail, setUserEmail] = useState("")

  const handleRequestOTP = async () => {
    setLoading(true)
    try {
      // First get user info to show masked email
      const userResponse = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.data.user) {
          setUserEmail(userData.data.user.email);
        }
      }

      const success = await shopService.deleteShop(shopId)
      if (!success) {
        setOtpRequested(true)
      }
    } catch (error) {
      console.error('Error requesting OTP:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShop = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP")
      return
    }

    setLoading(true)
    try {
      const success = await shopService.deleteShop(shopId, otp)
      if (success) {
        toast.success("Shop deleted successfully!")
        onOpenChange(false)
        setOtp("")
        setOtpRequested(false)
        onShopDeleted?.()
      }
    } catch (error) {
      console.error('Error deleting shop:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setOtp("")
    setOtpRequested(false)
    setUserEmail("")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Shop
          </DialogTitle>
          <DialogDescription>
            {otpRequested 
              ? "Please enter the OTP sent to your email to confirm shop deletion."
              : "This action will permanently delete the shop and all associated data. This cannot be undone."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">Shop to be deleted:</h4>
            <p className="text-red-700">{shopName}</p>
          </div>

          {!otpRequested ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-4">
                Click the button below to receive an OTP on your email for verification.
              </p>
              <Button 
                onClick={handleRequestOTP} 
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send OTP to Email
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {userEmail && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>OTP sent to:</strong> {maskEmail(userEmail)}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              
              <div className="text-xs text-gray-500 text-center">
                Check your email for the 6-digit OTP. It expires in 10 minutes.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {otpRequested && (
            <Button 
              onClick={handleDeleteShop} 
              disabled={loading || !otp.trim()}
              variant="destructive"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Shop"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 