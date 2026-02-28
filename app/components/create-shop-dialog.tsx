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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Building2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useShopLimits } from "@/app/hooks/use-shop-limits"

interface CreateShopDialogProps {
  onShopCreated?: () => void
}

export function CreateShopDialog({ onShopCreated }: CreateShopDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { canCreate, reason, currentCount, limit, loading: limitsLoading, refreshLimits } = useShopLimits()

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    gstNo: ""
  })

  const handleOpenChange = async (newOpen: boolean) => {
    if (newOpen) {
      // Refresh limits when opening dialog
      await refreshLimits()

      if (!canCreate) {
        // Show toast and don't open dialog
        toast({
          title: "Shop Creation Limit Reached",
          description: reason || "You have reached the maximum number of shops for your plan.",
          variant: "destructive",
        })
        return
      }
    }
    setOpen(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Shop Created",
          description: `Successfully created shop: ${data.data.shop.name}`,
        })
        setOpen(false)
        setFormData({ name: "", location: "", address: "", phone: "", email: "", gstNo: "" })
        onShopCreated?.()
        // Refresh limits after successful creation
        await refreshLimits()
      } else {
        // Handle different error types
        let errorMessage = 'Failed to create shop'

        if (data.code === 'SHOP_NAME_EXISTS') {
          errorMessage = 'A shop with this name already exists'
        } else if (data.code === 'TOKEN_MISSING' || data.code === 'TOKEN_INVALID') {
          errorMessage = 'Authentication error. Please login again.'
        } else if (data.code === 'USER_INACTIVE') {
          errorMessage = 'Your account is inactive. Please contact administrator.'
        } else if (data.code === 'INSUFFICIENT_PERMISSIONS') {
          errorMessage = 'You do not have permission to create shops'
        } else if (response.status === 403 && data.data) {
          // Subscription limit exceeded
          errorMessage = data.message || 'Shop creation limit exceeded'
          if (data.data.currentCount !== undefined && data.data.limit !== undefined) {
            errorMessage += ` (${data.data.currentCount}/${data.data.limit} shops used)`
          }
        } else if (data.message) {
          errorMessage = data.message
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Create shop error:', error)
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full sm:w-auto justify-center"
          variant="outline"
          size="sm"
          disabled={!canCreate || limitsLoading}
          title={!canCreate ? reason : undefined}
        >
          <Plus className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">Create New Shop</span>
          {!limitsLoading && !canCreate && (
            <span className="ml-2 text-xs text-red-500 whitespace-nowrap">(Limit Reached)</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 md:p-6 rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create New Shop
          </DialogTitle>
          <DialogDescription>
            Add a new shop to the system. Fill in the details below.
          </DialogDescription>
          {!limitsLoading && (
            <div className="mt-2 text-sm text-muted-foreground">
              Shops used: {currentCount}/{limit}
            </div>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="name" className="text-left sm:text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-1 sm:col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="location" className="text-left sm:text-right">
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="col-span-1 sm:col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="address" className="text-left sm:text-right">
                Address
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="col-span-1 sm:col-span-3"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="phone" className="text-left sm:text-right">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setFormData({ ...formData, phone: value });
                  }
                }}
                placeholder="9876543210"
                maxLength={10}
                className="col-span-1 sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="email" className="text-left sm:text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-1 sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="gstNo" className="text-left sm:text-right">
                GST Number
              </Label>
              <Input
                id="gstNo"
                value={formData.gstNo}
                onChange={(e) => setFormData({ ...formData, gstNo: e.target.value })}
                className="col-span-1 sm:col-span-3"
                placeholder="Enter GST number"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Creating..." : "Create Shop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 