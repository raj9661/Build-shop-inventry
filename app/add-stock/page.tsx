"use client"

import { useAuthGuard } from "@/app/hooks/use-auth-guard"
import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"

import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/hooks/use-language"
import { useOfflineSync } from "@/hooks/use-offline-sync"

import { toast } from "sonner"
import { Calendar, Loader2, RotateCcw, CheckCircle } from "lucide-react"
import { useShop } from "../contexts/ShopContext"
import { getAvailableTmtUnits, getAvailableChipSizes, getAvailableUnits } from "../lib/tmtUtils"
import TmtBarForm from "../components/tmt-bar-form"

// Suppliers will be loaded from API

// Units with Hindi translations
const units = [
  { value: "bag", label: "bag", labelHi: "बैग" },
  { value: "piece", label: "piece", labelHi: "पीस" },
  { value: "kg", label: "kg", labelHi: "किलो" },
  { value: "cft", label: "cft", labelHi: "घन फुट" },
  { value: "dozen", label: "dozen", labelHi: "दर्जन" },
  { value: "roll", label: "roll", labelHi: "रोल" },
  { value: "bundle", label: "bundle", labelHi: "बंडल" },
  { value: "tempo", label: "Tempo (Bajaj)", labelHi: "टेम्पो (बजाज)" },
  { value: "chota_haathi", label: "Chota Haathi (Tata)", labelHi: "छोटा हाथी (टाटा)" },
  { value: "tractor", label: "Tractor", labelHi: "ट्रैक्टर" },
  { value: "407", label: "407", labelHi: "407" },
  { value: "small_hiwa", label: "Small Hiwa", labelHi: "छोटा हीवा" },
  { value: "big_hiwa", label: "Big Hiwa", labelHi: "बड़ा हीवा" },
]

type StockEntry = {
  categoryId: string
  productType: string
  productName: string
  supplierId: string
  senderName: string
  quantity: number
  unit: string
  size: string
  purchasePrice: number
  sellingPrice: number
  sku: string
  date: string
  minStockLevel?: number
  maxStockLevel?: number
  conversionCft?: string
}

// Sync function for offline entries
const syncStockEntry = async (stock: StockEntry) => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      throw new Error('No access token')
    }

    // Create stock entry using the new API
    const response = await fetch('/api/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
              body: JSON.stringify({
          productName: stock.productName,
          categoryId: parseInt(stock.categoryId),
          typeId: 1, // Default type ID for offline sync
          supplierName: stock.senderName,
          supplierPhone: '',
          quantity: stock.quantity,
          unitPrice: stock.purchasePrice,
          unit: stock.unit,
          entryDate: stock.date,
          notes: `Synced from offline entry`,
          minStockLevel: stock.minStockLevel,
          maxStockLevel: stock.maxStockLevel,
        })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to sync stock entry')
    }

    return await response.json()
  } catch (error) {
    console.error('Error syncing stock entry:', error)
    throw error
  }
}

export default function AddStock() {
  const { authReady, isAuthenticated } = useAuthGuard()
  const { t } = useLanguage()
  const { saveData, isOnline } = useOfflineSync<StockEntry>("offline-stock-entries", syncStockEntry)
  const { currentShopId } = useShop();

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [productConversions, setProductConversions] = useState<any[]>([])

  // TMT-specific state
  const [isTmtMode, setIsTmtMode] = useState(false)
  const [tmtProducts, setTmtProducts] = useState<any[]>([])
  const [selectedTmtProduct, setSelectedTmtProduct] = useState<any>(null)
  const [tmtQuantity, setTmtQuantity] = useState('')
  const [tmtUnit, setTmtUnit] = useState('bundle')
  const [tmtPricePerUnit, setTmtPricePerUnit] = useState('')
  const [tmtSupplierName, setTmtSupplierName] = useState('')
  const [tmtInvoiceNumber, setTmtInvoiceNumber] = useState('')
  const [tmtRemarks, setTmtRemarks] = useState('')
  const [tmtBundles, setTmtBundles] = useState('')
  const [tmtPieces, setTmtPieces] = useState('')
  const [tmtBundleSize, setTmtBundleSize] = useState<number | null>(null)
  const [tmtTotalPieces, setTmtTotalPieces] = useState(0)

  // Enhanced TMT form state
  const [tmtFormData, setTmtFormData] = useState({
    invoiceNumber: '',
    supplierId: '',
    remarks: '',
    purchaseDate: new Date().toISOString().split('T')[0], // Today's date
    items: [{
      productId: '',
      quantity: '',
      unitType: 'bundle',
      pricePerUnit: '', // Price per piece
      sellingPrice: '', // Selling price per piece
      pricePerKg: '', // Price per kg
      sellingPricePerKg: '', // Selling price per kg
      rodsPerBundle: '',
      weightPerRod: '',
      minStock: '',
      maxStock: '',
      sku: '',
      sellByWeight: true,
      sellByBundle: true,
      sellByPiece: true,
      remarks: ''
    }]
  })

  // TMT calculation helpers
  const calculateTmtValues = (product: any, quantity: number, unitType: string) => {
    if (!product) return {}
    
    const weightPerRodKg = Number(product.weightPerRodKg)
    const rodsPerBundle = product.rodsPerBundle
    const weightPerBundleKg = Number(product.weightPerBundleKg)
    
    let totalBundles = 0
    let totalPieces = 0
    let equivalentKg = 0
    
    switch (unitType) {
      case 'bundle':
        totalBundles = quantity
        totalPieces = quantity * rodsPerBundle
        equivalentKg = quantity * weightPerBundleKg
        break
      case 'piece':
        totalBundles = quantity / rodsPerBundle
        totalPieces = quantity
        equivalentKg = quantity * weightPerRodKg
        break
      case 'kg':
        totalBundles = quantity / weightPerBundleKg
        totalPieces = quantity / weightPerRodKg
        equivalentKg = quantity
        break
      case 'ton':
        const kg = quantity * 1000
        totalBundles = kg / weightPerBundleKg
        totalPieces = kg / weightPerRodKg
        equivalentKg = kg
        break
    }
    
    return {
      weightPerRodKg: weightPerRodKg.toFixed(3),
      rodsPerBundle: rodsPerBundle,
      weightPerBundleKg: weightPerBundleKg.toFixed(3),
      totalBundles: totalBundles.toFixed(2),
      totalPieces: totalPieces.toFixed(0),
      equivalentKg: equivalentKg.toFixed(3)
    }
  }

  // Load TMT products
  const loadTmtProducts = async () => {
    try {
      const token = localStorage.getItem("accessToken")
      if (!token || !currentShopId) return
      
      const res = await fetch(`/api/tmt/products?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const products = data.data.products || []
          console.log('Loaded TMT products:', products)
          if (products.length > 0) {
            console.log('Sample product structure:', products[0])
          }
          setTmtProducts(products)
        } else {
          console.error('TMT products API error:', data.message)
          toast.error('Failed to load TMT products')
        }
      } else {
        console.error('TMT products API error:', res.status)
        toast.error('Failed to load TMT products')
      }
    } catch (error) {
      console.error('Error loading TMT products:', error)
      toast.error('Failed to load TMT products')
    }
  }

  // Handle TMT Bar saving
  const handleTmtBarSave = async (entries: any[]) => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      throw new Error('No access token')
    }

    // Save each entry
    for (const entry of entries) {
      const response = await fetch('/api/tmt/bars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...entry,
          shopId: currentShopId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save TMT bar entry')
      }
    }
  }

  // Handle TMT purchase
  const handleTmtPurchase = async () => {
    if (!tmtFormData.invoiceNumber || !tmtFormData.supplierId || !tmtFormData.items[0].productId || !tmtFormData.items[0].rodsPerBundle || !tmtFormData.items[0].weightPerRod) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token')
      }

      // Get supplier name from suppliers list
      const supplier = suppliers.find(s => s.id.toString() === tmtFormData.supplierId)
      const supplierName = supplier?.name || 'Unknown Supplier'

      // Add TMT stock to inventory
      const response = await fetch('/api/tmt/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: parseInt(tmtFormData.items[0].productId),
          quantity: parseFloat(tmtFormData.items[0].quantity),
          unitType: tmtFormData.items[0].unitType,
          pricePerUnit: parseFloat(tmtFormData.items[0].pricePerUnit),
          sellingPrice: parseFloat(tmtFormData.items[0].sellingPrice),
          pricePerKg: tmtFormData.items[0].pricePerKg ? parseFloat(tmtFormData.items[0].pricePerKg) : null,
          sellingPricePerKg: tmtFormData.items[0].sellingPricePerKg ? parseFloat(tmtFormData.items[0].sellingPricePerKg) : null,
          rodsPerBundle: parseInt(tmtFormData.items[0].rodsPerBundle),
          weightPerRod: parseFloat(tmtFormData.items[0].weightPerRod),
          minStock: tmtFormData.items[0].minStock ? parseInt(tmtFormData.items[0].minStock) : null,
          maxStock: tmtFormData.items[0].maxStock ? parseInt(tmtFormData.items[0].maxStock) : null,
          sku: tmtFormData.items[0].sku || '',
          remarks: tmtFormData.items[0].remarks,
          shopId: currentShopId,
          invoiceNumber: tmtFormData.invoiceNumber,
          supplierId: tmtFormData.supplierId,
          purchaseDate: tmtFormData.purchaseDate
        })
      })

      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { error: 'Unknown error occurred' };
        } catch (parseError) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.message || 'Failed to add TMT stock to inventory')
      }

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : { success: true, message: 'Stock added successfully' };
      } catch (parseError) {
        throw new Error('Failed to parse server response')
      }
      toast.success('TMT stock added to inventory successfully!')
      
      // Reset form
      setTmtFormData({
        invoiceNumber: '',
        supplierId: '',
        remarks: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        items: [{
          productId: '',
          quantity: '',
          unitType: 'bundle',
          pricePerUnit: '',
          sellingPrice: '',
          pricePerKg: '',
          sellingPricePerKg: '',
          rodsPerBundle: '',
          weightPerRod: '',
          minStock: '',
          maxStock: '',
          sku: '',
          sellByWeight: true,
          sellByBundle: true,
          sellByPiece: true,
          remarks: ''
        }]
      })
      
      // Reload TMT products to update inventory
      await loadTmtProducts()
      
    } catch (error) {
      console.error('Error adding TMT stock to inventory:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add TMT stock to inventory')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Function to create stock entry
  const createStockEntry = async (stock: StockEntry, shopId: number) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token')
      }

      // Find the type ID from the types array
      const selectedType = types.find((t: any) => t.name === stock.productType)
      if (!selectedType) {
        throw new Error('Selected product type not found')
      }

      // Create stock entry using the new API
      const response = await fetch('/api/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: stock.productName,
          categoryId: parseInt(stock.categoryId),
          typeId: selectedType.id,
          supplierName: stock.senderName, // Use sender name as supplier name
          supplierPhone: '', // Can be empty for now
          quantity: stock.quantity,
          unitPrice: stock.purchasePrice,
          unit: stock.unit,
          entryDate: stock.date,
          notes: `Added via stock entry form`,
          minStockLevel: stock.minStockLevel,
          maxStockLevel: stock.maxStockLevel,
          sku: stock.sku,
          price: stock.sellingPrice,
          costPrice: stock.purchasePrice,
          conversionCft: stock.conversionCft,
          sellingPrice: stock.sellingPrice,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create stock entry')
      }

      const result = await response.json()
      return { success: true, action: 'created', data: result.data }
    } catch (error) {
      console.error('Error creating stock entry:', error)
      throw error
    }
  }

  const [formData, setFormData] = useState({
    categoryId: "",
    productType: "",
    productName: "",
    supplierId: "",
    senderName: "",
    quantity: "",
    unit: "bag",
    size: "",
    purchasePrice: "",
    sellingPrice: "",
    sku: "",
    date: new Date().toLocaleDateString("en-CA"),
    minStockLevel: "",
    maxStockLevel: "",
    conversionCft: "",
  })

  // Batch API requests for categories, types, suppliers with sessionStorage cache for categories
  useEffect(() => {
    const loadCategoriesAndTypes = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          toast.error('Authentication required')
          return
        }
        if (!currentShopId) {
          toast.error('No shop selected')
          return
        }
        // 1. Try to load categories from sessionStorage for instant UI
        const cacheKey = `categories_${currentShopId}`;
        const cachedCategories = sessionStorage.getItem(cacheKey);
        if (cachedCategories) {
          setCategories(JSON.parse(cachedCategories));
        }
        // 2. Always fetch fresh data in the background
        const [categoriesResponse, typesResponse, suppliersResponse] = await Promise.all([
          fetch(`/api/categories?shopId=${currentShopId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/categories/types?shopId=${currentShopId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/suppliers?shopId=${currentShopId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        ])
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          // Sort categories: global first, then local, to make it clearer
          const sortedCategories = (categoriesData.data || []).sort((a: any, b: any) => {
            if (a.shopId === null && b.shopId !== null) return -1
            if (a.shopId !== null && b.shopId === null) return 1
            return 0
          })
          setCategories(sortedCategories)
          // Update sessionStorage cache
          sessionStorage.setItem(cacheKey, JSON.stringify(sortedCategories));
        }
        if (typesResponse.ok) {
          const typesData = await typesResponse.json()
          // Sort types: global first, then local, to make it clearer
          const sortedTypes = (typesData.data || []).sort((a: any, b: any) => {
            if (a.shopId === null && b.shopId !== null) return -1
            if (a.shopId !== null && b.shopId === null) return 1
            return 0
          })
          setTypes(sortedTypes)
        } else {
          console.error('Types API error:', typesResponse.status, typesResponse.statusText)
        }
        if (suppliersResponse.ok) {
          const suppliersData = await suppliersResponse.json()
          setSuppliers(suppliersData.data?.suppliers || [])
        }
      } catch (error) {
        console.error('Error loading categories, types, and suppliers:', error)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadCategoriesAndTypes()
    loadTmtProducts()
  }, [currentShopId])

  // Effect to load conversions for selected product
  useEffect(() => {
    const fetchConversions = async () => {
      if (formData.productType && currentShopId) {
        // Find the product type ID
        const selectedType = types.find((t: any) => t.name === formData.productType)
        if (selectedType) {
          try {
            const token = localStorage.getItem('accessToken')
            const res = await fetch(`/api/unit-conversion?productId=${selectedType.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
              const data = await res.json()
              setProductConversions(data.data || [])
              
              // Auto-fill conversion if unit matches
              const match = (data.data || []).find((c: any) => c.unitName === formData.unit)
              if (match) {
                setFormData(prev => ({ ...prev, conversionCft: match.cftValue.toString() }))
              }
            }
          } catch (e) {
            console.error('Error fetching conversions:', e)
          }
        }
      }
    }
    fetchConversions()
  }, [formData.productType, formData.unit, types, currentShopId])

  // Update bundleSize when TMT type is selected
  useEffect(() => {
    if (formData.categoryId && formData.productType && types.length > 0) {
      const selectedType = types.find((t: any) => t.name === formData.productType);
      if (selectedType && selectedType.bundleSize) {
        setTmtBundleSize(selectedType.bundleSize);
      } else {
        setTmtBundleSize(null);
      }
    } else {
      setTmtBundleSize(null);
    }
  }, [formData.categoryId, formData.productType, types]);

  // Auto-calculate total pieces for TMT Bars
  useEffect(() => {
    if (tmtBundleSize && (tmtBundles || tmtPieces)) {
      const bundles = parseInt(tmtBundles) || 0;
      const pieces = parseInt(tmtPieces) || 0;
      setTmtTotalPieces((bundles * tmtBundleSize) + pieces);
      setFormData((prev) => ({ ...prev, quantity: ((bundles * tmtBundleSize) + pieces).toString() }));
    }
  }, [tmtBundles, tmtPieces, tmtBundleSize]);

  // Memoize availableProducts
  const availableProducts = useMemo(() => (
    formData.categoryId 
    ? types.filter((type: any) => type.isActive && type.categoryId === parseInt(formData.categoryId))
    : []
  ), [formData.categoryId, types])

  // Memoize filtered suppliers
  const filteredSuppliers = useMemo(() => (
    suppliers.filter((supplier: any) => supplier.isActive)
  ), [suppliers])

  // Memoize getFilteredSuppliers for compatibility
  const getFilteredSuppliers = useCallback(() => filteredSuppliers, [filteredSuppliers])

  // Auto-fill product name when product type is selected
  useEffect(() => {
    if (formData.productType && types.length > 0) {
      const selectedProduct = types.find((prod: any) => prod.name === formData.productType)
      if (selectedProduct) {
        setFormData((prev) => ({
          ...prev,
          productName: selectedProduct.name,
          // Set default prices (you can customize these based on your business logic)
          purchasePrice: "0",
          sellingPrice: "0",
        }))
      }
    }
  }, [formData.productType, types])

  // Memoize validateForm
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}

    if (!formData.categoryId) newErrors.categoryId = "Category is required"
    if (!formData.productType.trim()) newErrors.productType = "Product type is required"
    if (!formData.productName.trim()) newErrors.productName = "Product name is required"
    if (!formData.senderName.trim()) newErrors.senderName = "Sender name is required"
    if (!formData.quantity || Number(formData.quantity) <= 0) newErrors.quantity = "Valid quantity is required"
    if (!formData.purchasePrice || Number(formData.purchasePrice) <= 0)
      newErrors.purchasePrice = "Valid purchase price is required"
    if (!formData.sellingPrice || Number(formData.sellingPrice) <= 0)
      newErrors.sellingPrice = "Valid selling price is required"
    if (!formData.sku.trim()) newErrors.sku = "SKU is required"
    if (formData.minStockLevel && Number(formData.minStockLevel) < 0)
      newErrors.minStockLevel = "Min stock must be 0 or more"
    if (formData.maxStockLevel && Number(formData.maxStockLevel) < 0)
      newErrors.maxStockLevel = "Max stock must be 0 or more"
    if (
      formData.minStockLevel &&
      formData.maxStockLevel &&
      Number(formData.maxStockLevel) < Number(formData.minStockLevel)
    ) {
      newErrors.maxStockLevel = "Max stock must be greater than or equal to min stock"
    }

    // Check if chip items have sizes selected
    if (formData.categoryId && categories.find((c: any) => c.id.toString() === formData.categoryId)?.name?.toLowerCase().includes("chips") && !formData.size) {
      newErrors.size = "Size is required for chips"
    }

    // Conversion factor for uncountable units (skip if it's cement bags)
    const isCement = formData.categoryId && categories.find((c: any) => c.id.toString() === formData.categoryId)?.name?.toLowerCase().includes("cement");
    if (['tempo', 'chota_haathi', 'tractor', '407', 'small_hiwa', 'big_hiwa', 'bag'].includes(formData.unit) && !isCement && (!formData.conversionCft || Number(formData.conversionCft) <= 0)) {
      newErrors.conversionCft = "Valid conversion factor is required"
    }


    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, categories])

  // Memoize handleReset
  const handleReset = useCallback(() => {
    setFormData({
      categoryId: "",
      productType: "",
      productName: "",
      supplierId: "",
      senderName: "",
      quantity: "",
      unit: "bag",
      size: "",
      purchasePrice: "",
      sellingPrice: "",
      sku: "",
      date: new Date().toLocaleDateString("en-CA"),
      minStockLevel: "",
      maxStockLevel: "",
      conversionCft: "",
    })
    setErrors({})
  }, [])

  // Memoize handleSubmit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    if (!currentShopId) {
      toast.error("No shop selected")
      return
    }

    setIsSubmitting(true)

    try {
      const stockEntry: StockEntry = {
        categoryId: formData.categoryId,
        productType: formData.productType,
        productName: formData.productName,
        supplierId: formData.supplierId,
        senderName: formData.senderName,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        size: formData.size,
        purchasePrice: Number(formData.purchasePrice),
        sellingPrice: Number(formData.sellingPrice),
        sku: formData.sku,
        date: formData.date,
        minStockLevel: formData.minStockLevel ? Number(formData.minStockLevel) : undefined,
        maxStockLevel: formData.maxStockLevel ? Number(formData.maxStockLevel) : undefined,
        conversionCft: formData.conversionCft,
      }

      if (isOnline) {
        // Create stock entry in database
        await createStockEntry(stockEntry, currentShopId)
        toast.success(`Stock entry created successfully! Added ${stockEntry.quantity} ${stockEntry.unit} of ${stockEntry.productName}`)
      } else {
        // Save offline for later sync
        await saveData(stockEntry)
        toast.success("Stock entry saved offline!")
      }
      
      handleReset()
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to save stock entry")
    } finally {
      setIsSubmitting(false)
    }
  }, [validateForm, currentShopId, formData, isOnline, createStockEntry, saveData, handleReset, toast])

  // Auth guard
  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) return <SessionExpiredScreen />

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile Navigation */}


      {/* Main Content with Mobile Padding */}
      <div className="p-4 pb-20 md:pb-4">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg border-0 bg-white rounded-3xl overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* TMT Mode Toggle */}
              <div className="flex items-center justify-center space-x-4 mb-6">
                <Button
                  type="button"
                  variant={!isTmtMode ? "default" : "outline"}
                  onClick={() => setIsTmtMode(false)}
                  className="px-6 py-2"
                >
                  Regular Stock
                </Button>
                <Button
                  type="button"
                  variant={isTmtMode ? "default" : "outline"}
                  onClick={() => setIsTmtMode(true)}
                  className="px-6 py-2"
                >
                  TMT Bars
                </Button>
              </div>

              {isTmtMode ? (
                /* Simplified TMT Purchase Form */
                <div className="space-y-6">
                  <form onSubmit={(e) => { e.preventDefault(); handleTmtPurchase(); }} className="space-y-6">
                    {/* Purchase Information */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-blue-800 mb-4">Purchase Information</h3>
                      
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                   <Label className="text-sm font-medium text-gray-700">Invoice Number *</Label>
                   <Input
                     type="text"
                     value={tmtFormData.invoiceNumber}
                     onChange={(e) => setTmtFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                     className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                     placeholder="Enter invoice number"
                     required
                   />
                 </div>
                 <div className="space-y-3">
                   <Label className="text-sm font-medium text-gray-700">सप्लायर / Supplier *</Label>
                    <Select
                     value={tmtFormData.supplierId}
                     onValueChange={(value) => setTmtFormData(prev => ({ ...prev, supplierId: value }))}
                     disabled={loading}
                   >
                     <SelectTrigger className="h-12 text-sm rounded-lg border-gray-200 bg-white">
                       <SelectValue placeholder={loading ? "Loading suppliers..." : "Select supplier"} />
                     </SelectTrigger>
                     <SelectContent>
                       {suppliers.filter((supplier: any) => supplier.isActive).map((supplier: any) => (
                         <SelectItem key={supplier.id} value={supplier.id.toString()} className="text-sm py-2">
                           {supplier.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-3">
                   <Label className="text-sm font-medium text-gray-700">दिनांक / Date *</Label>
                   <Input
                     type="date"
                     value={tmtFormData.purchaseDate}
                     onChange={(e) => setTmtFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                     className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                     required
                   />
                 </div>
               </div>
                    </div>

                    {/* TMT Product Details */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-green-800 mb-4">TMT Product Details</h3>
                      
                      {/* Product Selection */}
                      <div className="space-y-3 mb-4">
                        <Label className="text-sm font-medium text-gray-700">TMT Product *</Label>
                        <Select
                          value={tmtFormData.items[0].productId}
                      onValueChange={(value) => {
                        const product = tmtProducts.find(p => p.id.toString() === value)
                            if (product) {
                              console.log('Selected product:', product)
                              setTmtFormData(prev => ({
                                ...prev,
                                items: [{
                                  ...prev.items[0],
                                  productId: value,
                                  rodsPerBundle: (product.rodsPerBundle !== undefined && product.rodsPerBundle !== null) ? product.rodsPerBundle.toString() : '',
                                  weightPerRod: (product.weightPerRodKg !== undefined && product.weightPerRodKg !== null) ? Number(product.weightPerRodKg).toFixed(3) : ''
                                }]
                              }))
                            } else {
                              console.warn('Product not found for ID:', value)
                            }
                      }}
                      disabled={loading}
                    >
                          <SelectTrigger className="h-12 text-sm rounded-lg border-gray-200 bg-white">
                        <SelectValue placeholder="Select TMT Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {tmtProducts.map((product: any) => (
                              <SelectItem key={product.id} value={product.id.toString()} className="text-sm py-2">
                                {product.productName} - {product.company?.name} ({product.size?.sizeMm}mm)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                      {/* Quantity, Unit, Rods per Bundle, and Weight per Rod */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">Quantity *</Label>
                      <Input
                        type="number"
                            step="0.001"
                            value={tmtFormData.items[0].quantity}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], quantity: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                        placeholder="Enter quantity"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">Unit *</Label>
                      <Select
                            value={tmtFormData.items[0].unitType}
                            onValueChange={(value) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], unitType: value }]
                            }))}
                          >
                            <SelectTrigger className="h-12 text-sm rounded-lg border-gray-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableTmtUnits().map((unit) => (
                                <SelectItem key={unit.value} value={unit.value} className="text-sm py-2">
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">Rods per Bundle *</Label>
                          <Input
                            type="number"
                            value={tmtFormData.items[0].rodsPerBundle}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], rodsPerBundle: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter rods per bundle"
                            required
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">Weight per Rod (kg) *</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={tmtFormData.items[0].weightPerRod}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], weightPerRod: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter weight per rod"
                            required
                          />
                        </div>
                  </div>

                      {/* Price and Stock Management */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">खरीद मूल्य / Purchase Price per Piece (₹) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                            value={tmtFormData.items[0].pricePerUnit}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], pricePerUnit: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter purchase price per piece"
                        required
                      />
                          <div className="text-xs text-gray-500">
                            Cost price for one individual rod/piece
                          </div>
                    </div>
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">विक्रय मूल्य / Selling Price per Piece (₹) *</Label>
                      <Input
                            type="number"
                            step="0.01"
                            value={tmtFormData.items[0].sellingPrice}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], sellingPrice: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter selling price per piece"
                        required
                      />
                          <div className="text-xs text-gray-500">
                            Selling price for one individual rod/piece
                    </div>
                  </div>
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">खरीद मूल्य / Purchase Price per Kg (₹) *</Label>
                      <Input
                            type="number"
                            step="0.01"
                            value={tmtFormData.items[0].pricePerKg}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], pricePerKg: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter purchase price per kg"
                        required
                      />
                          <div className="text-xs text-gray-500">
                            Cost price per kilogram
                    </div>
                  </div>
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">विक्रय मूल्य / Selling Price per Kg (₹) *</Label>
                      <Input
                            type="number"
                            step="0.01"
                            value={tmtFormData.items[0].sellingPricePerKg}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], sellingPricePerKg: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter selling price per kg"
                        required
                      />
                          <div className="text-xs text-gray-500">
                            Selling price per kilogram
                    </div>
                  </div>
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">एसकेयू / SKU</Label>
                      <Input
                        type="text"
                            value={tmtFormData.items[0].sku}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], sku: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter SKU (e.g., TMT-8MM-RUN)"
                          />
                          <div className="text-xs text-gray-500">
                            Stock Keeping Unit identifier
                    </div>
                        </div>
                      </div>

                      {/* Stock Levels */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">न्यूनतम स्टॉक / Min Stock (pieces)</Label>
                          <Input
                            type="number"
                            value={tmtFormData.items[0].minStock}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], minStock: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter minimum stock level"
                          />
                          <div className="text-xs text-gray-500">
                            Minimum pieces to maintain in stock
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">अधिकतम स्टॉक / Max Stock (pieces)</Label>
                          <Input
                            type="number"
                            value={tmtFormData.items[0].maxStock}
                            onChange={(e) => setTmtFormData(prev => ({
                              ...prev,
                              items: [{ ...prev.items[0], maxStock: e.target.value }]
                            }))}
                            className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                            placeholder="Enter maximum stock level"
                          />
                          <div className="text-xs text-gray-500">
                            Maximum pieces to store
                          </div>
                        </div>
                      </div>

                      {/* Item Remarks */}
                      <div className="space-y-3 mb-4">
                        <Label className="text-sm font-medium text-gray-700">Item Remarks</Label>
                      <Input
                        type="text"
                          value={tmtFormData.items[0].remarks}
                          onChange={(e) => setTmtFormData(prev => ({
                            ...prev,
                            items: [{ ...prev.items[0], remarks: e.target.value }]
                          }))}
                          className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                          placeholder="Enter item remarks"
                      />
                    </div>

                      {/* Calculated Values Display */}
                      {tmtFormData.items[0].productId && tmtFormData.items[0].quantity && tmtFormData.items[0].rodsPerBundle && tmtFormData.items[0].weightPerRod && (
                        <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
                          <h4 className="text-sm font-semibold text-green-700 mb-3">Calculated Values</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500">Weight per Rod:</span>
                              <div className="font-medium">{tmtFormData.items[0].weightPerRod} kg</div>
                  </div>
                            <div>
                              <span className="text-gray-500">Rods per Bundle:</span>
                              <div className="font-medium">{tmtFormData.items[0].rodsPerBundle}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Bundle Weight:</span>
                              <div className="font-medium">
                                {(parseFloat(tmtFormData.items[0].rodsPerBundle || '0') * parseFloat(tmtFormData.items[0].weightPerRod || '0')).toFixed(3)} kg
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Pieces:</span>
                              <div className="font-medium">
                                {(() => {
                                  const quantity = parseFloat(tmtFormData.items[0].quantity || '0')
                                  const unitType = tmtFormData.items[0].unitType
                                  const rodsPerBundle = parseFloat(tmtFormData.items[0].rodsPerBundle || '0')
                                  
                                  switch (unitType) {
                                    case 'bundle':
                                      return (quantity * rodsPerBundle).toFixed(0)
                                    case 'piece':
                                      return quantity.toFixed(0)
                                    case 'kg':
                                      const weightPerRod = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                      return (quantity / weightPerRod).toFixed(0)
                                    case 'ton':
                                      const weightPerRodTon = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                      return ((quantity * 1000) / weightPerRodTon).toFixed(0)
                                    default:
                                      return '0'
                                  }
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Bundles:</span>
                              <div className="font-medium">
                                {(() => {
                                  const quantity = parseFloat(tmtFormData.items[0].quantity || '0')
                                  const unitType = tmtFormData.items[0].unitType
                                  const rodsPerBundle = parseFloat(tmtFormData.items[0].rodsPerBundle || '0')
                                  const weightPerRod = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                  const bundleWeight = rodsPerBundle * weightPerRod
                                  
                                  switch (unitType) {
                                    case 'bundle':
                                      return quantity.toFixed(2)
                                    case 'piece':
                                      return (quantity / rodsPerBundle).toFixed(2)
                                    case 'kg':
                                      return (quantity / bundleWeight).toFixed(2)
                                    case 'ton':
                                      return ((quantity * 1000) / bundleWeight).toFixed(2)
                                    default:
                                      return '0'
                                  }
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Weight:</span>
                              <div className="font-medium">
                                {(() => {
                                  const quantity = parseFloat(tmtFormData.items[0].quantity || '0')
                                  const unitType = tmtFormData.items[0].unitType
                                  const rodsPerBundle = parseFloat(tmtFormData.items[0].rodsPerBundle || '0')
                                  const weightPerRod = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                  const bundleWeight = rodsPerBundle * weightPerRod
                                  
                                  switch (unitType) {
                                    case 'bundle':
                                      return (quantity * bundleWeight).toFixed(3) + ' kg'
                                    case 'piece':
                                      return (quantity * weightPerRod).toFixed(3) + ' kg'
                                    case 'kg':
                                      return quantity.toFixed(3) + ' kg'
                                    case 'ton':
                                      return (quantity * 1000).toFixed(3) + ' kg'
                                    default:
                                      return '0 kg'
                                  }
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Value:</span>
                              <div className="font-medium">
                                ₹{(() => {
                                  const quantity = parseFloat(tmtFormData.items[0].quantity || '0')
                                  const pricePerPiece = parseFloat(tmtFormData.items[0].pricePerUnit || '0')
                                  const unitType = tmtFormData.items[0].unitType
                                  const rodsPerBundle = parseFloat(tmtFormData.items[0].rodsPerBundle || '0')
                                  const weightPerRod = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                  
                                  console.log('Debug - Values:', { quantity, pricePerPiece, unitType, rodsPerBundle, weightPerRod })
                                  
                                  // Calculate total pieces based on unit type
                                  let totalPieces = quantity
                                  if (unitType === 'bundle') {
                                    totalPieces = quantity * rodsPerBundle
                                  } else if (unitType === 'kg') {
                                    totalPieces = quantity / weightPerRod
                                  } else if (unitType === 'ton') {
                                    totalPieces = (quantity * 1000) / weightPerRod
                                  }
                                  
                                  console.log('Debug - Total pieces:', totalPieces)
                                  console.log('Debug - Total value:', totalPieces * pricePerPiece)
                                  
                                  return (totalPieces * pricePerPiece).toFixed(2)
                                })()}
                              </div>
                              <div className="text-xs text-gray-400">
                                {(() => {
                                  const quantity = parseFloat(tmtFormData.items[0].quantity || '0')
                                  const pricePerPiece = parseFloat(tmtFormData.items[0].pricePerUnit || '0')
                                  const unitType = tmtFormData.items[0].unitType
                                  const rodsPerBundle = parseFloat(tmtFormData.items[0].rodsPerBundle || '0')
                                  const weightPerRod = parseFloat(tmtFormData.items[0].weightPerRod || '0')
                                  
                                  let totalPieces = quantity
                                  if (unitType === 'bundle') {
                                    totalPieces = quantity * rodsPerBundle
                                  } else if (unitType === 'kg') {
                                    totalPieces = quantity / weightPerRod
                                  } else if (unitType === 'ton') {
                                    totalPieces = (quantity * 1000) / weightPerRod
                                  }
                                  
                                  return `${totalPieces.toFixed(0)} pieces × ₹${pricePerPiece} per piece`
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Selling Unit Options */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-700">Sell in:</Label>
                        <div className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="sellByWeight"
                              checked={tmtFormData.items[0].sellByWeight}
                              onChange={(e) => setTmtFormData(prev => ({
                                ...prev,
                                items: [{ ...prev.items[0], sellByWeight: e.target.checked }]
                              }))}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="sellByWeight" className="text-sm text-gray-700">Weight (kg/ton)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="sellByBundle"
                              checked={tmtFormData.items[0].sellByBundle}
                              onChange={(e) => setTmtFormData(prev => ({
                                ...prev,
                                items: [{ ...prev.items[0], sellByBundle: e.target.checked }]
                              }))}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="sellByBundle" className="text-sm text-gray-700">Bundles</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="sellByPiece"
                              checked={tmtFormData.items[0].sellByPiece}
                              onChange={(e) => setTmtFormData(prev => ({
                                ...prev,
                                items: [{ ...prev.items[0], sellByPiece: e.target.checked }]
                              }))}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="sellByPiece" className="text-sm text-gray-700">Pieces</Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* General Remarks */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">Purchase Remarks</Label>
                      <Input
                        type="text"
                        value={tmtFormData.remarks}
                        onChange={(e) => setTmtFormData(prev => ({ ...prev, remarks: e.target.value }))}
                        className="h-12 text-sm rounded-lg border-gray-200 bg-white"
                        placeholder="Enter purchase remarks"
                      />
                    </div>

                    {/* Submit and Reset Buttons */}
                    <div className="flex gap-4 pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTmtFormData({
                            invoiceNumber: '',
                            supplierId: '',
                            remarks: '',
                            purchaseDate: new Date().toISOString().split('T')[0],
                            items: [{
                              productId: '',
                              quantity: '',
                              unitType: 'bundle',
                              pricePerUnit: '',
                              sellingPrice: '',
                              pricePerKg: '',
                              sellingPricePerKg: '',
                              rodsPerBundle: '',
                              weightPerRod: '',
                              minStock: '',
                              maxStock: '',
                              sku: '',
                              sellByWeight: true,
                              sellByBundle: true,
                              sellByPiece: true,
                              remarks: ''
                            }]
                          })
                        }}
                        className="flex-1 h-12 text-sm font-semibold rounded-lg border-red-200 text-red-600 hover:bg-red-50 bg-transparent"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 h-12 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding to Inventory...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Add to Inventory
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Regular Stock Form */
                <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category Selection */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">श्रेणी / Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, categoryId: value, productType: "", productName: "" }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger
                      className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                        errors.categoryId ? "border-red-500" : ""
                      }`}
                    >
                      <SelectValue placeholder={loading ? "Loading categories..." : "Select category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter((category: any) => category.isActive).map((category: any) => {
                        // Show both global and local categories separately with labels
                        const isGlobal = category.shopId === null
                        const displayName = isGlobal ? `${category.name} (Global)` : category.name
                        return (
                        <SelectItem key={category.id} value={category.id.toString()} className="text-base py-3">
                            {displayName}
                        </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Type/Brand */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">ब्रांड / उपप्रकार / Type</Label>
                  <Select
                    value={formData.productType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, productType: value }))}
                    disabled={!formData.categoryId || loading}
                  >
                    <SelectTrigger
                      className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                        errors.productType ? "border-red-500" : ""
                      }`}
                    >
                      <SelectValue placeholder={loading ? "Loading types..." : "Select brand/type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((product: any) => {
                        // Show both global and local types separately with labels
                        const isGlobal = product.shopId === null
                        const displayName = isGlobal ? `${product.name} (Global)` : product.name
                        return (
                        <SelectItem key={product.id} value={product.name} className="text-base py-3">
                            {displayName}
                        </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Name */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">उत्पाद नाम / Product Name</Label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
                    placeholder="Product name"
                    className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                      errors.productName ? "border-red-500" : ""
                    }`}
                  />
                </div>

                {/* Supplier Selection */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">सप्लायर / Supplier</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => {
                      const supplier = suppliers.find((s: any) => s.id.toString() === value)
                      setFormData((prev) => ({
                        ...prev,
                        supplierId: value,
                        senderName: supplier?.name || "",
                      }))
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger
                      className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                        errors.supplierId ? "border-red-500" : ""
                      }`}
                    >
                      <SelectValue placeholder={loading ? "Loading suppliers..." : "Select supplier"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredSuppliers().map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()} className="text-base py-3">
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sender Name */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">किसने भेजा? / Sent By</Label>
                  <Input
                    value={formData.senderName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, senderName: e.target.value }))}
                    placeholder="Kuda Singh"
                    className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                      errors.senderName ? "border-red-500" : ""
                    }`}
                  />
                </div>

                {/* Quantity and Unit for TMT Bars */}
                {formData.categoryId && categories.find((c: any) => c.id.toString() === formData.categoryId)?.name?.toLowerCase().includes('steel') && formData.productType.startsWith('TMT Bar') && tmtBundleSize ? (
                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-gray-800">TMT Bundles & Pieces</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Input
                          type="number"
                          min="0"
                          value={tmtBundles}
                          onChange={e => setTmtBundles(e.target.value)}
                          placeholder="Bundles"
                          className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
                        />
                        <div className="text-xs text-gray-500 text-center">Bundles</div>
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          value={tmtPieces}
                          onChange={e => setTmtPieces(e.target.value)}
                          placeholder="Pieces"
                          className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
                        />
                        <div className="text-xs text-gray-500 text-center">Pieces</div>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <div className="font-bold text-lg">{tmtTotalPieces}</div>
                        <div className="text-xs text-gray-500">Total Pieces</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">1 bundle = {tmtBundleSize} pieces</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">मात्रा / Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                        placeholder="100"
                        className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                          errors.quantity ? "border-red-500" : ""
                        }`}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">इकाई / Unit</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                      >
                        <SelectTrigger className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.categoryId ? getAvailableUnits(categories.find((c: any) => c.id.toString() === formData.categoryId)?.name || '').map((unit: any) => (
                            <SelectItem key={unit.value} value={unit.value} className="text-base py-3">
                              {unit.label}
                            </SelectItem>
                          )) : (
                            <SelectItem value="placeholder" disabled>Select category first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Conversion Factor (Visible for uncountable units or if manual adjustment needed) */}
                {(() => {
                  const isCement = formData.categoryId && categories.find((c: any) => c.id.toString() === formData.categoryId)?.name?.toLowerCase().includes("cement");
                  const showConversion = ['tempo', 'chota_haathi', 'tractor', '407', 'small_hiwa', 'big_hiwa', 'cft', 'bag'].includes(formData.unit) && !isCement;
                  
                  return showConversion && (
                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-blue-800">कन्वर्जन (CFT per Unit) / Conversion Factor</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.conversionCft}
                      onChange={(e) => setFormData((prev) => ({ ...prev, conversionCft: e.target.value }))}
                      placeholder="e.g. 100 for Small Hiwa"
                      className={`h-14 text-base rounded-2xl border-blue-200 bg-blue-50 ${errors.conversionCft ? "border-red-500" : ""}`}
                    />
                    <div className="text-xs text-blue-600">
                      Amount of Cubic Feet (CFT) per single {formData.unit}. 
                      {formData.quantity && formData.conversionCft && (
                        <span className="font-bold ml-1">Total: {(Number(formData.quantity) * Number(formData.conversionCft)).toFixed(2)} CFT</span>
                      )}
                    </div>
                  </div>
                )
              })()}


                {/* Size selection for chips */}
                {formData.categoryId && categories.find((c: any) => c.id.toString() === formData.categoryId)?.name?.toLowerCase().includes("chips") && (
                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-gray-800">
                      साइज़ / Size
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Select
                      value={formData.size}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, size: value }))}
                    >
                      <SelectTrigger className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${!formData.size ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableChipSizes().map((size) => (
                          <SelectItem key={size.value} value={size.value} className="text-base py-3">
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.size && (
                      <div className="text-red-500 text-xs">Size is required for chips</div>
                    )}
                  </div>
                )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">न्यूनतम स्टॉक / Min Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.minStockLevel}
                        onChange={(e) => setFormData((prev) => ({ ...prev, minStockLevel: e.target.value }))}
                        placeholder="10"
                        className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${errors.minStockLevel ? "border-red-500" : ""}`}
                      />
                      {errors.minStockLevel && <div className="text-red-500 text-xs">{errors.minStockLevel}</div>}
                    </div>
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">अधिकतम स्टॉक / Max Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.maxStockLevel}
                        onChange={(e) => setFormData((prev) => ({ ...prev, maxStockLevel: e.target.value }))}
                        placeholder="100"
                        className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${errors.maxStockLevel ? "border-red-500" : ""}`}
                      />
                      {errors.maxStockLevel && <div className="text-red-500 text-xs">{errors.maxStockLevel}</div>}
                    </div>
                  </div>

                {/* Purchase Price */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">खरीद मूल्य / Purchase Price (per unit)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                    placeholder="325"
                    className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${
                      errors.purchasePrice ? "border-red-500" : ""
                    }`}
                  />
                </div>

                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-gray-800">एसकेयू / SKU</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                      placeholder="CEM-ACC-50KG"
                      className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${errors.sku ? "border-red-500" : ""}`}
                    />
                    {errors.sku && <div className="text-red-500 text-xs">{errors.sku}</div>}
                  </div>

                {/* Selling Price */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">विक्रय मूल्य / Selling Price (per unit)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sellingPrice: e.target.value }))}
                    placeholder="350"
                    className={`h-14 text-base rounded-2xl border-gray-200 bg-gray-50 ${errors.sellingPrice ? "border-red-500" : ""}`}
                  />
                  {errors.sellingPrice && <div className="text-red-500 text-xs">{errors.sellingPrice}</div>}
                </div>

                {/* Date */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">दिनांक / Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                      className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50 pl-12"
                    />
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Submit and Reset Buttons */}
                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1 h-14 text-base font-semibold rounded-2xl border-red-200 text-red-600 hover:bg-red-50 bg-transparent"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Reset
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-14 text-base font-semibold rounded-2xl bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Submit
                      </>
                    )}
                  </Button>
                </div>
                </form>
                </div>
              )}
            </CardContent>
          </Card>

          {!isOnline && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <span className="text-red-600 font-medium">Offline Mode - Data will sync when connected</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
