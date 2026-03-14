"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/hooks/use-language"
import { MobileNav } from "@/components/mobile-nav"
import { Plus, Edit, Trash2, Phone, MapPin, Truck, Search, Eye, Package, IndianRupee, X, Calendar, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useShop } from "../contexts/ShopContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAvailableUnits } from "../lib/tmtUtils";

// Real suppliers will be loaded from API

type WeeklySupply = {
  week: string
  quantity: number
  amount: number
  status?: "paid" | "unpaid"
  date?: string
  items?: { productName: string; quantity: number; dateSupplied: string }[]
}

type PaymentEntry = {
  amount: number
  paymentDate: string
  paymentMethod: string
  notes?: string
}

type Supplier = {
  id: number
  name: string
  phone: string
  address: string
  suppliedItems: string[]
  notes: string
  totalSupplied: number
  outstandingPayment: number
  openingBalance: number
  lastSupply: string
  weeklySupplies: WeeklySupply[]
  paymentHistory: PaymentEntry[]
}

export default function Suppliers() {
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShop } = useShop()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("list")
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [availableItems, setAvailableItems] = useState<string[]>([])
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    suppliedItems: [] as string[],
    notes: "",
    openingBalance: 0,
  })
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payWeek, setPayWeek] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const isProcessingPaymentRef = useRef(false);

  // Load suppliers and available items from API
  useEffect(() => {
    console.log('🔍 [Suppliers] useEffect triggered - currentShop:', currentShop?.id, currentShop?.name);
    loadSuppliers()
    loadAvailableItems()
  }, [currentShop]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debug current shop context
  useEffect(() => {
    console.log('🔍 [Suppliers] Component mounted - currentShop:', currentShop?.id, currentShop?.name);
  }, [])

  // Removed the useEffect that was overwriting detailed supplier data with summary data

  const loadAvailableItems = async () => {
    if (!currentShop) return

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      // TODO: Fetch available items from products API
      // const response = await fetch(`/api/products?shopId=${currentShop.id}`, {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // })
      // const data = await response.json()
      // if (data.success && data.data && data.data.products) {
      //   const items = data.data.products.map((product: any) => product.name)
      //   setAvailableItems(items)
      // }

      // For now, set empty array
      setAvailableItems([])
    } catch (error) {
      console.error('Error loading available items:', error)
      setAvailableItems([])
    }
  }

  const loadSuppliers = async (silent = false) => {
    if (!currentShop) {
      console.log('🔍 [Suppliers] No current shop available');
      return
    }

    try {
      if (!silent) setLoading(true)
      const token = localStorage.getItem('accessToken')
      if (!token) {
        console.log('🔍 [Suppliers] No access token found');
        toast.error('Authentication required')
        return
      }

      console.log('🔍 [Suppliers] Loading suppliers for shop:', currentShop.id, currentShop.name);

      const response = await fetch(`/api/suppliers?shopId=${currentShop.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.suppliers) {
          const convertedSuppliers: Supplier[] = data.data.suppliers.map((supplier: any) => ({
            id: Number(supplier.id),
            name: supplier.name,
            phone: supplier.phone || '',
            address: supplier.address || '',
            suppliedItems: [],
            notes: '',
            totalSupplied: Number(supplier.totalSupplied || 0),
            outstandingPayment: Number(supplier.outstandingPayment || 0),
            openingBalance: Number(supplier.openingBalance || 0),
            lastSupply: supplier.lastSupply ? new Date(supplier.lastSupply).toISOString().split('T')[0] : '',
            weeklySupplies: supplier.weeklySupplies || [],
            paymentHistory: supplier.paymentHistory || []
          }))
          setSuppliers(convertedSuppliers)
          console.log('🔍 [Frontend] Suppliers list updated. Count:', convertedSuppliers.length);
          
          // Refresh viewingSupplier if active
          if (viewingSupplier) {
            console.log('🔍 [Frontend] Refreshing active viewingSupplier:', viewingSupplier.id);
            const updated = convertedSuppliers.find(s => s.id === viewingSupplier.id);
            if (updated) {
              setViewingSupplier(prev => {
                if (!prev) return null;
                console.log('🔍 [Frontend] Merging summary data into viewingSupplier');
                return { 
                  ...prev, 
                  outstandingPayment: updated.outstandingPayment,
                  totalSupplied: updated.totalSupplied 
                };
              });
            }
          }
        } else {
          setSuppliers([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || 'Failed to load suppliers')
        setSuppliers([])
      }
    } catch (error) {
      console.error('🔍 [Suppliers] Error loading suppliers:', error)
      toast.error('Error loading suppliers')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  const loadSupplierDetails = async (id: number) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return null

      console.log(`🔍 [Frontend] Fetching details for supplier ID: ${id}`)
      const response = await fetch(`/api/suppliers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`🔍 [Frontend] API response for ID ${id}:`, data)
        if (data.success && data.data && data.data.supplier) {
          const s = data.data.supplier
          console.log(`🔍 [Frontend] Detailed weeklySupplies count:`, s.weeklySupplies?.length)
          const detailedSupplier: Supplier = {
            id: Number(s.id),
            name: s.name || 'N/A',
            phone: s.phone || '',
            address: s.address || '',
            suppliedItems: s.suppliedItems || [],
            notes: s.notes || '',
            totalSupplied: Number(s.totalSupplied || 0),
            outstandingPayment: Number(s.outstandingPayment || 0),
            openingBalance: Number(s.openingBalance || 0),
            lastSupply: s.lastSupply ? new Date(s.lastSupply).toISOString().split('T')[0] : '',
            weeklySupplies: s.weeklySupplies || [],
            paymentHistory: s.paymentHistory || []
          }
          
          setViewingSupplier(detailedSupplier)
          // Also update it in the main list so if the user goes back, it's already "half-hydrated"
          setSuppliers(prev => prev.map(item => item.id === detailedSupplier.id ? detailedSupplier : item))
          return detailedSupplier
        }
      }
    } catch (error) {
      console.error('Error loading supplier details:', error)
    }
    return null
  }

  const syncBalances = async () => {
    if (!currentShop) return
    
    setSyncLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/suppliers/sync-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shopId: currentShop.id })
      })

      if (response.ok) {
        toast.success("Balances refreshed successfully!")
        await loadSuppliers(true)
      } else {
        toast.error("Failed to refresh balances")
      }
    } catch (error) {
      console.error('Error syncing balances:', error)
      toast.error("Error syncing balances")
    } finally {
      setSyncLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone.includes(searchTerm) ||
      supplier.suppliedItems.some((item) => item.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleAddSupplier = async () => {
    if (!formData.name || !formData.phone) {
      toast.error(t("Please fill all required fields", "कृपया सभी आवश्यक फ़ील्ड भरें"))
      return
    }

    if (!currentShop) {
      console.log('🔍 [Suppliers] No current shop for adding supplier');
      toast.error('Please select a shop first')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        console.log('🔍 [Suppliers] No access token for adding supplier');
        toast.error('Authentication required')
        return
      }

      console.log('🔍 [Suppliers] Adding supplier:', formData.name, 'to shop:', currentShop.id);

      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          openingBalance: Number(formData.openingBalance || 0),
          shopId: currentShop.id
        })
      })

      console.log('🔍 [Suppliers] Add supplier response status:', response.status);

      if (response.ok) {
        const result = await response.json()
        console.log('🔍 [Suppliers] Add supplier success:', result);
        toast.success(t("Supplier added successfully!", "सप्लायर सफलतापूर्वक जोड़ा गया!"))
        resetForm()
        setActiveTab("list")
        loadSuppliers() // Reload suppliers
      } else {
        const error = await response.json()
        console.error('🔍 [Suppliers] Add supplier error:', response.status, error);
        toast.error(error.message || 'Failed to add supplier')
      }
    } catch (error) {
      console.error('🔍 [Suppliers] Add supplier exception:', error);
      toast.error('Failed to add supplier. Please try again.')
    }
  }

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      suppliedItems: supplier.suppliedItems,
      notes: supplier.notes,
      openingBalance: supplier.openingBalance || 0,
    })
    setActiveTab("add")
  }

  const handleUpdateSupplier = async () => {
    if (!editingSupplier) return

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        console.log('🔍 [Suppliers] No access token for updating supplier');
        toast.error('Authentication required')
        return
      }

      console.log('🔍 [Suppliers] Updating supplier:', editingSupplier.id, 'with data:', formData);

      const response = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          openingBalance: Number(formData.openingBalance || 0)
        })
      })

      console.log('🔍 [Suppliers] Update supplier response status:', response.status);

      if (response.ok) {
        const result = await response.json()
        console.log('🔍 [Suppliers] Update supplier success:', result);
        toast.success(t("Supplier updated successfully!", "सप्लायर सफलतापूर्वक अपडेट किया गया!"))
        setEditingSupplier(null)
        resetForm()
        setActiveTab("list")
        loadSuppliers() // Reload suppliers
      } else {
        const error = await response.json()
        console.error('🔍 [Suppliers] Update supplier error:', response.status, error);
        toast.error(error.message || 'Failed to update supplier')
      }
    } catch (error) {
      console.error('🔍 [Suppliers] Update supplier exception:', error);
      toast.error('Failed to update supplier. Please try again.')
    }
  }

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        console.log('🔍 [Suppliers] No access token for deleting supplier');
        toast.error('Authentication required')
        return
      }

      console.log('🔍 [Suppliers] Deleting supplier:', id);

      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('🔍 [Suppliers] Delete supplier response status:', response.status);

      if (response.ok) {
        const result = await response.json()
        console.log('🔍 [Suppliers] Delete supplier success:', result);
        toast.success(t("Supplier deleted successfully!", "सप्लायर सफलतापूर्वक हटाया गया!"))
        loadSuppliers() // Reload suppliers
      } else {
        const error = await response.json()
        console.error('🔍 [Suppliers] Delete supplier error:', response.status, error);
        toast.error(error.message || 'Failed to delete supplier')
      }
    } catch (error) {
      console.error('🔍 [Suppliers] Delete supplier exception:', error);
      toast.error('Failed to delete supplier. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({ name: "", phone: "", address: "", suppliedItems: [], notes: "", openingBalance: 0 })
    setEditingSupplier(null)
  }

  const addSuppliedItem = (item: string) => {
    if (!formData.suppliedItems.includes(item)) {
      setFormData({ ...formData, suppliedItems: [...formData.suppliedItems, item] })
    }
  }

  const removeSuppliedItem = (item: string) => {
    setFormData({
      ...formData,
      suppliedItems: formData.suppliedItems.filter((i) => i !== item),
    })
  }

  const getPaymentStatusBadge = (outstandingPayment: number) => {
    if (outstandingPayment <= 0) {
      return (
        <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-semibold">
           {t("Paid", "भुगतान किया गया")}
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">
        ₹{outstandingPayment.toLocaleString()} Due (बकाया)
      </span>
    );
  };

  const resetPayDialog = () => {
    setPayAmount(0);
    setPayMethod("CASH");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayWeek(null);
    setPayNotes("");
  };

  const handlePaySupplier = async () => {
    if (!viewingSupplier) return;
    if (payAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setPayLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/supplier-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          supplierId: viewingSupplier.id,
          amount: payAmount,
          paymentMethod: payMethod,
          paymentDate: payDate,
          notes: payNotes || undefined,
          shopId: currentShop?.id,
          week: payWeek || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Payment recorded successfully!');
        setPayDialogOpen(false);
        resetPayDialog();
        await loadSuppliers(true);
        if (viewingSupplier) {
          await loadSupplierDetails(viewingSupplier.id);
        }
      } else {
        toast.error(data.message || 'Failed to record payment');
      }
    } catch (e) {
      toast.error('Failed to record payment');
    } finally {
      setPayLoading(false);
      isProcessingPaymentRef.current = false;
    }
  };

  // Helper to get user-friendly unit label
  function getUnitLabel(unit: string, language: string) {
    // Try sand/chips units first
    const sandChipsUnits = getAvailableUnits("sand");
    let found = sandChipsUnits.find(u => u.value === unit);
    if (!found) {
      // Try TMT/steel units
      const tmtUnits = getAvailableUnits("tmt");
      found = tmtUnits.find(u => u.value === unit);
    }
    if (!found) {
      // Try default units
      const defaultUnits = getAvailableUnits("");
      found = defaultUnits.find(u => u.value === unit);
    }
    if (!found) return unit;
    return language === "hi" ? found.labelHi : found.label;
  }

  if (!currentShop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <MobileNav />
        <div className="p-4 pb-20 md:pb-4">
          <Card className="shadow-lg border-0 bg-white rounded-2xl">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Please select a shop to manage suppliers</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile Navigation */}
      <MobileNav />

      {/* Main Content with Bottom Padding for Mobile Nav */}
      <div className="p-4 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-20 md:pb-4">
        {/* Main Content */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex overflow-x-auto w-full bg-gray-100 p-1 rounded-t-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <TabsTrigger value="add" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4">
                📝 {t("Add", "जोड़ें")}
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4">
                📋 {t("List", "सूची")}
              </TabsTrigger>
              <TabsTrigger value="view" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4" disabled={!viewingSupplier}>
                👁️ {t("View Details", "विवरण देखें")}
              </TabsTrigger>
            </TabsList>

            {/* Add/Edit Supplier Tab */}
            <TabsContent value="add" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingSupplier ? t("Edit Supplier", "सप्लायर संपादित करें") : t("Add New Supplier", "नया सप्लायर जोड़ें")}
                </h2>
                <Button variant="outline" onClick={() => setActiveTab("list")}>
                  {t("Back to List", "सूची पर वापस जाएं")}
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-base font-medium">
                      {t("Supplier Name", "सप्लायर का नाम")} *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("Enter supplier name", "सप्लायर का नाम दर्ज करें")}
                      className="h-12 text-base rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-base font-medium">
                      {t("Phone Number", "फोन नंबर")} *
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
                      className="h-12 text-base rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address" className="text-base font-medium">
                      {t("Address", "पता")}
                    </Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder={t("Enter address", "पता दर्ज करें")}
                      className="min-h-[100px] text-base rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">
                      {t("Supplied Items", "आपूर्ति की गई वस्तुएं")}
                    </Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {availableItems.map((item) => (
                        <label key={item} className="flex items-center space-x-2">
                          <Switch
                            checked={formData.suppliedItems.includes(item)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                addSuppliedItem(item)
                              } else {
                                removeSuppliedItem(item)
                              }
                            }}
                          />
                          <span className="text-sm">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-base font-medium">
                      {t("Notes", "टिप्पणियां")}
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder={t("Enter any additional notes", "कोई अतिरिक्त टिप्पणी दर्ज करें")}
                      className="min-h-[100px] text-base rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="openingBalance" className="text-base font-medium">
                      {t("Opening Balance (Notebook)", "प्रारंभिक शेष (डायरी/नोटबुक)")}
                    </Label>
                    <Input
                      id="openingBalance"
                      type="number"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                      placeholder="0"
                      className="h-12 text-base rounded-xl font-bold text-red-600"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("Previous balance from your notebook", "आपकी नोटबुक से पिछला पुराना बकाया")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setActiveTab("list")
                  }}
                  className="flex-1 h-12 text-base font-semibold rounded-xl"
                >
                  {t("Cancel", "रद्द करें")}
                </Button>
                <Button
                  onClick={editingSupplier ? handleUpdateSupplier : handleAddSupplier}
                  className="flex-1 h-12 text-base font-semibold rounded-xl bg-green-600 hover:bg-green-700"
                >
                  {editingSupplier ? t("Update Supplier", "सप्लायर अपडेट करें") : t("Add Supplier", "सप्लायर जोड़ें")}
                </Button>
              </div>
            </TabsContent>

            {/* List Suppliers Tab */}
            <TabsContent value="list" className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={t("Search suppliers...", "सप्लायर खोजें...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-base rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={syncBalances}
                    disabled={syncLoading}
                    className="h-12 px-6 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    {syncLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Loader2 className="h-5 w-5" />}
                    <span className="ml-2 hidden sm:inline">{t("Refresh Balances", "बैलेंस रिफ्रेश करें")}</span>
                  </Button>
                  <Button
                    onClick={() => setActiveTab("add")}
                    className="bg-green-600 hover:bg-green-700 h-12 px-6 rounded-xl"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    {t("Add New Supplier", "नया सप्लायर जोड़ें")}
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
                  <p className="text-gray-500">{t("Loading suppliers...", "सप्लायर लोड हो रहे हैं...")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold text-base">{t("Name", "नाम")}</TableHead>
                        <TableHead className="font-semibold text-base">{t("Phone", "मोबाइल")}</TableHead>
                        <TableHead className="font-semibold text-base text-right">
                          {t("Total Stock Supplied", "कुल आपूर्ति")}
                        </TableHead>
                        <TableHead className="font-semibold text-base">
                          {t("Outstanding Payment", "भुगतान बकाया")}
                        </TableHead>
                        <TableHead className="font-semibold text-base">{t("Actions", "एक्शन")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((supplier) => (
                        <TableRow key={supplier.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div>
                              <p className="font-medium text-base">{supplier.name}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {supplier.suppliedItems.slice(0, 2).map((item) => (
                                  <Badge key={item} variant="outline" className="text-xs">
                                    {item}
                                  </Badge>
                                ))}
                                {supplier.suppliedItems.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{supplier.suppliedItems.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {supplier.phone}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold text-lg text-blue-600">₹{supplier.totalSupplied.toLocaleString()}</div>
                          </TableCell>
                          <TableCell>{getPaymentStatusBadge(supplier.outstandingPayment)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Set viewing supplier immediately to show basic info
                                  setViewingSupplier(supplier)
                                  setActiveTab("view")
                                  
                                  // Fetch full history in background
                                  toast.promise(loadSupplierDetails(supplier.id), {
                                    loading: 'Fetching history...',
                                    success: 'History loaded',
                                    error: 'Failed to load history'
                                  })
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSupplier(supplier)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteSupplier(supplier.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading && filteredSuppliers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{t("No suppliers found", "कोई सप्लायर नहीं मिला")}</p>
                </div>
              )}
            </TabsContent>

            {/* View Supplier Details Tab */}
            <TabsContent value="view" className="p-6 space-y-6">
              {viewingSupplier && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{t("Supplier Details", "सप्लायर विवरण")}</h2>
                    <Button variant="outline" onClick={() => setActiveTab("list")}>
                      {t("Back to List", "सूची पर वापस जाएं")}
                    </Button>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <Truck className="h-5 w-5" />
                          {t("Basic Information", "बुनियादी जानकारी")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Name", "नाम")}</Label>
                          <p className="text-lg font-semibold">{viewingSupplier.name}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Phone", "फोन")}</Label>
                          <p className="text-lg">{viewingSupplier.phone}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Address", "पता")}</Label>
                          <p className="text-lg">{viewingSupplier.address || t("Not provided", "प्रदान नहीं किया गया")}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Opening Balance", "प्रारंभिक शेष")}</Label>
                          <p className="text-lg font-semibold text-red-600">₹{(viewingSupplier.openingBalance || 0).toLocaleString()}</p>
                        </div>
                        {Array.isArray(viewingSupplier.suppliedItems) && viewingSupplier.suppliedItems.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">{t("Supplied Items", "आपूर्ति की गई वस्तुएं")}</Label>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mt-1">
                              {viewingSupplier.suppliedItems.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {viewingSupplier.notes && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">{t("Notes", "टिप्पणियाँ")}</Label>
                            <p className="text-sm text-gray-700 whitespace-pre-line mt-1">{viewingSupplier.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          {t("Supply Information", "आपूर्ति जानकारी")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Total Supplied", "कुल आपूर्ति")}</Label>
                          <p className="text-2xl font-bold text-green-600">₹{(viewingSupplier.totalSupplied || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Outstanding Payment", "बकाया भुगतान")}</Label>
                          {(viewingSupplier.outstandingPayment || 0) <= 0 ? (
                            <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-800 text-base font-semibold">
                               {t("Paid", "भुगतान किया गया")}
                            </span>
                          ) : (
                            <>
                              <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 text-base font-semibold">
                                ₹{(viewingSupplier.outstandingPayment || 0).toLocaleString()} Due (बकाया)
                              </span>
                              <Button className="mt-2 ml-2" variant="default" onClick={() => {
                                setPayAmount(Number(viewingSupplier.outstandingPayment || 0));
                                setPayWeek(null);
                                setPayDialogOpen(true);
                              }}>
                                Pay Outstanding Payment
                              </Button>
                            </>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Last Supply", "अंतिम आपूर्ति")}</Label>
                          <p className="text-lg">{viewingSupplier.lastSupply}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="shadow-lg border-0 bg-white">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {t("Weekly Supply History", "साप्ताहिक आपूर्ति इतिहास")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                    {viewingSupplier.weeklySupplies && viewingSupplier.weeklySupplies.length > 0 ? (
                      <div className="space-y-6">
                        {viewingSupplier.weeklySupplies.map((supply, index) => (
                          <Card key={`${supply.week}-${index}`} className="overflow-hidden border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{supply.week}</p>
                                  <p className="text-sm text-gray-600">Total Qty: {supply.quantity}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg">₹{(supply.amount || 0).toLocaleString()}</p>
                                  <Badge className={supply.status === "paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                    {supply.status === "paid" ? t("Paid", "भुगतान किया गया") : t("Unpaid", "अभुगतान")}
                                  </Badge>
                                  {supply.status !== "paid" && (
                                    <Button size="sm" className="ml-2 mt-2" onClick={() => {
                                      setPayAmount(supply.amount);
                                      setPayWeek(supply.week);
                                      setPayDialogOpen(true);
                                    }}>
                                      Pay
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {/* List all products supplied this week */}
                              {Array.isArray(supply.items) && supply.items.length > 0 && (
                                <div className="mt-2 ml-2 border-t pt-2">
                                  <ul className="space-y-1">
                                    {(supply.items ?? []).map((item: any, idx: number) => (
                                      <li key={idx} className="flex items-center justify-between text-sm text-gray-700">
                                        <span>
                                          <span className="font-medium">{item.productName}</span> — Qty: {item.quantity} {getUnitLabel(item.unit, language)}
                                        </span>
                                        {item.paymentStatus === 'COMPLETED' ? (
                                          <Badge variant="outline" className="text-[10px] h-4 bg-green-50 text-green-600 border-green-200">Paid</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] h-4 bg-red-50 text-red-600 border-red-200">Unpaid</Badge>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 italic">
                        {t("No supply history", "कोई आपूर्ति इतिहास नहीं")}
                      </div>
                    )}
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <IndianRupee className="h-5 w-5" />
                          {t("Payment History", "भुगतान इतिहास")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        {viewingSupplier.paymentHistory && viewingSupplier.paymentHistory.length > 0 ? (
                          <div className="space-y-4">
                             {viewingSupplier.paymentHistory.map((payment, index) => (
                               <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                 <div>
                                   <p className="font-semibold text-green-600">₹{(payment.amount || 0).toLocaleString()}</p>
                                   <p className="text-xs text-gray-500">{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'N/A'} via {payment.paymentMethod || 'CASH'}</p>
                                 </div>
                                 {payment.notes && <p className="text-xs text-gray-400 italic">{payment.notes}</p>}
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-400 text-sm">
                            {t("No payment history", "कोई भुगतान इतिहास नहीं")}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Pay Outstanding Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!payLoading) { setPayDialogOpen(open); if (!open) resetPayDialog(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              {payWeek ? `Pay for ${payWeek}` : 'Pay Outstanding Payment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {viewingSupplier && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <span className="font-medium">Supplier:</span> {viewingSupplier.name}
                {(viewingSupplier?.outstandingPayment || 0) > 0 && (
                  <span className="ml-2 text-red-600 font-semibold">· ₹{(viewingSupplier?.outstandingPayment || 0).toLocaleString()} outstanding</span>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Amount (₹) *</Label>
              <Input
                type="number"
                value={payAmount || ''}
                onChange={e => setPayAmount(Number(e.target.value))}
                min={1}
                placeholder="Enter amount"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Payment Method</Label>
              <select
                className="w-full border border-input rounded-xl h-10 px-3 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
              >
                <option value="CASH">💵 Cash</option>
                <option value="UPI">📱 UPI</option>
                <option value="CARD">💳 Card</option>
                <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                <option value="CHEQUE">🧾 Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Payment Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Notes (optional)</Label>
              <Input
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="e.g. Partial payment, bank ref #..."
                className="h-10 rounded-xl"
              />
            </div>
            {payWeek && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                <span className="font-medium">Paying for week:</span> {payWeek}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => { setPayDialogOpen(false); resetPayDialog(); }}
                disabled={payLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
                onClick={handlePaySupplier}
                disabled={payLoading || payAmount <= 0}
              >
                {payLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><IndianRupee className="h-4 w-4 mr-1" /> Pay ₹{payAmount > 0 ? payAmount.toLocaleString() : '0'}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
