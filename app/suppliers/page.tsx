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

type Supplier = {
  id: number
  name: string
  phone: string
  address: string
  suppliedItems: string[]
  notes: string
  totalSupplied: number
  outstandingPayment: number
  lastSupply: string
  weeklySupplies: WeeklySupply[]
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
  })
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payLoading, setPayLoading] = useState(false);
  // Add state for per-week payment
  const [payWeek, setPayWeek] = useState<string | null>(null);
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

  // Update viewingSupplier when suppliers list changes
  useEffect(() => {
    if (viewingSupplier && suppliers.length > 0) {
      const updatedSupplier = suppliers.find(s => s.id === viewingSupplier.id);
      if (updatedSupplier) {
        setViewingSupplier(updatedSupplier);
      }
    }
  }, [suppliers]) // eslint-disable-line react-hooks/exhaustive-deps

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

      console.log('🔍 [Suppliers] API response status:', response.status);

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 [Suppliers] API response data:', data);

        if (data.success && data.data && data.data.suppliers) {
          // Use backend-calculated fields directly
          const convertedSuppliers = data.data.suppliers.map((supplier: any) => ({
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone || '',
            address: supplier.address || '',
            suppliedItems: [], // Optionally populate if needed
            notes: '',
            totalSupplied: supplier.totalSupplied ?? 0,
            outstandingPayment: supplier.outstandingPayment ?? 0,
            lastSupply: supplier.lastSupply ? new Date(supplier.lastSupply).toISOString().split('T')[0] : '',
            weeklySupplies: supplier.weeklySupplies ?? []
          }))
          console.log('🔍 [Suppliers] Converted suppliers:', convertedSuppliers.length);
          setSuppliers(convertedSuppliers)
        } else {
          console.log('🔍 [Suppliers] No suppliers data in response');
          setSuppliers([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 [Suppliers] Failed to load suppliers:', response.status, errorData);
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
          address: formData.address
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
    setFormData({ name: "", phone: "", address: "", suppliedItems: [], notes: "" })
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
          ₹0 Paid (भुगतान किया गया)
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">
        ₹{outstandingPayment.toLocaleString()} Due (बकाया)
      </span>
    );
  };

  const handlePaySupplier = async () => {
    if (!viewingSupplier) return;

    // Prevent duplicate submissions
    if (isProcessingPaymentRef.current) {
      toast.error('Payment is already being processed');
      return;
    }

    isProcessingPaymentRef.current = true;
    setPayLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Authentication required');
      if (payWeek) {
        // Pay for a specific week
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
            shopId: currentShop?.id,
            week: payWeek
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Payment recorded!');
          setPayDialogOpen(false);
          setPayAmount(0);
          setPayMethod("CASH");
          setPayDate(new Date().toISOString().split("T")[0]);
          setPayWeek(null);
          await loadSuppliers(true); // Silent refresh to avoid blocking UI
        } else {
          toast.error(data.message || 'Failed to record payment');
        }
      } else {
        // Pay off weeks in order (oldest first)
        let remaining = payAmount;
        for (const supply of viewingSupplier.weeklySupplies) {
          if (remaining <= 0) break;
          if (supply.status === "paid") continue;
          const amountToPay = Math.min(remaining, supply.amount);
          const res = await fetch('/api/supplier-payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              supplierId: viewingSupplier.id,
              amount: amountToPay,
              paymentMethod: payMethod,
              paymentDate: payDate,
              shopId: currentShop?.id,
              week: supply.week
            })
          });
          const data = await res.json();
          if (!data.success) {
            toast.error(data.message || 'Failed to record payment');
            break;
          }
          remaining -= amountToPay;
        }
        setPayDialogOpen(false);
        setPayAmount(0);
        setPayMethod("CASH");
        setPayDate(new Date().toISOString().split("T")[0]);
        setPayWeek(null);
        await loadSuppliers(true); // Silent refresh to avoid blocking UI
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
                <Button
                  onClick={() => setActiveTab("add")}
                  className="bg-green-600 hover:bg-green-700 h-12 px-6 rounded-xl"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {t("Add New Supplier", "नया सप्लायर जोड़ें")}
                </Button>
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
                                  setViewingSupplier(supplier)
                                  setActiveTab("view")
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
                          <p className="text-2xl font-bold text-green-600">₹{viewingSupplier.totalSupplied.toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">{t("Outstanding Payment", "बकाया भुगतान")}</Label>
                          {viewingSupplier.outstandingPayment <= 0 ? (
                            <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-800 text-base font-semibold">
                              ₹0 Paid (भुगतान किया गया)
                            </span>
                          ) : (
                            <>
                              <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 text-base font-semibold">
                                ₹{viewingSupplier.outstandingPayment.toLocaleString()} Due (बकाया)
                              </span>
                              <Button className="mt-2 ml-2" variant="default" onClick={() => {
                                setPayAmount(viewingSupplier.outstandingPayment);
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
                      {viewingSupplier.weeklySupplies.length > 0 ? (
                        <div className="space-y-4">
                          {viewingSupplier.weeklySupplies.map((supply, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{supply.week}</p>
                                  <p className="text-sm text-gray-600">Total Qty: {supply.quantity}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg">₹{supply.amount.toLocaleString()}</p>
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
                                <div className="mt-2 ml-2">
                                  <ul className="list-disc text-sm text-gray-700">
                                    {(supply.items ?? []).map((item: any, idx: number) => (
                                      <li key={idx} className="flex items-center gap-2">
                                        <span className="font-medium">{item.productName}</span> — Qty: {item.quantity} {getUnitLabel(item.unit, language)}, Date: {new Date(item.dateSupplied).toLocaleDateString()}
                                        {item.paymentStatus === 'COMPLETED' ? (
                                          <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold ml-2">Paid</span>
                                        ) : (
                                          <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold ml-2">Unpaid</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>{t("No supply history available", "कोई आपूर्ति इतिहास उपलब्ध नहीं है")}</p>
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
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Outstanding Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Amount</Label>
            <Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} min={1} />
            <Label>Payment Method</Label>
            <select className="w-full border rounded p-2" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
            <Label>Date</Label>
            <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            {payWeek && (
              <div>
                <Label>Week</Label>
                <Input value={payWeek} disabled />
              </div>
            )}
            <Button className="w-full" onClick={handlePaySupplier} disabled={payLoading}>
              {payLoading ? 'Paying...' : 'Pay Now'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
