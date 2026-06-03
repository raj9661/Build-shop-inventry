"use client"

import { useAuthGuard } from "@/app/hooks/use-auth-guard"
import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"


import React, { useState, useEffect, FormEvent, Fragment } from "react"

// Force React into scope to prevent Turbopack from stripping the import
// which causes 'React is not defined' during JSX transpilation
if (typeof window !== 'undefined') {
  (window as any).React = React;
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/hooks/use-language"
import { useOfflineSync } from "@/hooks/use-offline-sync"

import { ShopSelector } from "../components/shop-selector"
import { PlusCircle, Trash2, Search, User, Plus, Phone, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { salesService, type CreateSaleData } from "../lib/services/salesService"
import { useShop } from "../contexts/ShopContext"
import ProperBillPrint from "./ProperBillPrint"
import NormalBillPrint from "./NormalBillPrint"
import { TmtSaleForm } from "./components/TmtSaleForm"
import { getAvailableTmtUnits, formatTmtQuantity, getWeightPerPiece, getBundleConfig, convertToKg, getAvailableChipSizes, getAvailableUnits } from "../lib/tmtUtils"

// Add fraction parsing utility
const parseQuantity = (value: string): number => {
  if (!value) return 0;
  // Replace "and", "-", etc with spaces to handle "1 and 1/2" or "1-1/2"
  const cleanValue = value.toString().toLowerCase().replace(/and/g, ' ').replace(/-/g, ' ').trim();

  // Handle space-separated mixed fraction: "1 1/2"
  if (cleanValue.includes(' ') && cleanValue.includes('/')) {
    const parts = cleanValue.split(/\s+/);
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, den] = part.split('/').map(Number);
        if (!isNaN(num) && !isNaN(den) && den !== 0) total += num / den;
      } else {
        const num = parseFloat(part);
        if (!isNaN(num)) total += num;
      }
    }
    return total;
  }

  if (cleanValue.includes('/')) {
    const [num, den] = cleanValue.split('/').map(Number);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

type SaleItem = { categoryId: number; categoryName: string; typeId: number; typeName: string; productId: number; name: string; quantity: number | string; price: number; purchasePrice?: number; unit: string; size: string; stockType?: 'normal' | 'damaged'; conversionCft?: number; isDirectSale?: boolean; supplierId?: number; supplierInfo?: any; }

type Supplier = {
  id: number
  name: string
  phone: string
  address: string
  isActive?: boolean
}

type Customer = {
  id: number
  name: string
  phone: string
  address: string
  isActive?: boolean
}

function AddSalePage() {
  const { t } = useLanguage()
  const { currentShopId, currentShop, userRole, selectShopWithProducts } = useShop()

  // Debug initial state
  console.log('🔍 [AddSale] Component mounted - currentShopId:', currentShopId, 'currentShop:', currentShop?.name, 'userRole:', userRole);
  console.log('🔍 [AddSale] currentShop details:', currentShop);
  console.log('🔍 [AddSale] currentShopId type:', typeof currentShopId, 'value:', currentShopId);

  // Additional debugging for shop context
  useEffect(() => {
    console.log('🔍 [AddSale] Shop context updated:', {
      currentShopId,
      currentShop: currentShop?.name,
      userRole,
      timestamp: new Date().toISOString()
    });
  }, [currentShopId, currentShop, userRole]);

  // Auto-select shop with products if current shop has no products
  useEffect(() => {
    const autoSelectShop = async () => {
      if (currentShopId && currentShopId !== 0 && currentShop?.name) {
        // Check if current shop has products
        try {
          const token = localStorage.getItem("accessToken");
          if (token) {
            const response = await fetch(`/api/products?shopId=${currentShopId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
              const data = await response.json();
              const products = data.data?.products || [];

              if (products.length === 0) {
                console.log(`🏪 [AddSale] Current shop "${currentShop.name}" has no products, auto-selecting shop with products...`);
                await selectShopWithProducts();
              }
            }
          }
        } catch (error) {
          console.error('Error checking products for current shop:', error);
        }
      }
    };

    // Only run this if we have a shop selected and it's not the default
    if (currentShopId && currentShopId !== 0) {
      autoSelectShop();
    }
  }, [currentShopId, currentShop, selectShopWithProducts]);

  // State for customer management
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false)

  // State for new customer
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    address: ""
  })

  // State for categories and types
  const [categories, setCategories] = useState<any[]>([])
  const [allTypes, setAllTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // State for sale
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])

  // State for the product type toggle (Shopping Cart mode)
  const [productType, setProductType] = useState<'regular' | 'tmt'>('regular')

  // State for the currently built regular item
  const [currentRegularItem, setCurrentRegularItem] = useState<SaleItem>({
    categoryId: 0,
    categoryName: "",
    typeId: 0,
    typeName: "",
    productId: 0,
    name: "",
    quantity: 1,
    price: 0,
    purchasePrice: 0,
    unit: "",
    size: "",
    stockType: undefined,
    conversionCft: 0
  })
  // TMT-specific state
  const [isTmtMode, setIsTmtMode] = useState(false)
  const [tmtProducts, setTmtProducts] = useState<any[]>([])
  const [selectedTmtProduct, setSelectedTmtProduct] = useState<any>(null)
  const [tmtQuantity, setTmtQuantity] = useState('')
  const [tmtUnit, setTmtUnit] = useState('bundle')
  const [tmtPricePerUnit, setTmtPricePerUnit] = useState('')
  const [tmtSaleItems, setTmtSaleItems] = useState<any[]>([])

  // Auto-populate price based on selected product and unit
  const updateTmtPriceForUnit = (product: any, unit: string) => {
    if (!product) return

    let price = 0

    if (unit === 'piece') {
      // Use selling price per piece if available
      price = product.sellingPricePerPiece || 0
      // If not available, calculate from per kg price
      if (price === 0 && product.sellingPricePerKg && product.weightPerRodKg) {
        price = product.sellingPricePerKg * product.weightPerRodKg
      }
    } else if (unit === 'bundle') {
      // Calculate from per piece price
      const piecesPerBundle = product.rodsPerBundle || 0
      const pricePerPiece = product.sellingPricePerPiece || 0
      if (pricePerPiece > 0 && piecesPerBundle > 0) {
        price = pricePerPiece * piecesPerBundle
      } else if (product.sellingPricePerKg && product.weightPerBundleKg) {
        // Fallback: calculate from per kg price
        price = product.sellingPricePerKg * product.weightPerBundleKg
      }
    } else if (unit === 'kg') {
      // Use selling price per kg
      price = product.sellingPricePerKg || 0
    } else if (unit === 'ton') {
      // Calculate from per kg price (1 ton = 1000 kg)
      price = (product.sellingPricePerKg || 0) * 1000
    }

    setTmtPricePerUnit(price > 0 ? price.toFixed(2) : '')
  }
  const [partialAmount, setPartialAmount] = useState(0)
  const [partialPaymentMethod, setPartialPaymentMethod] = useState("cash")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [isDirectSale, setIsDirectSale] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("")
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false)
  const [isNewSupplierDialogOpen, setIsNewSupplierDialogOpen] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    address: ""
  })

  // Custom Date
  const [customSaleDate, setCustomSaleDate] = useState(() => {
    const d = new Date();
    // local YYYY-MM-DD
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });

  // Transport-related state
  const [transportFare, setTransportFare] = useState<number>(0)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [driverName, setDriverName] = useState("")

  // Load TMT products from inventory (only products with stock)
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
          // Filter only products with available stock (availableQtyKg > 0)
          const productsWithStock = (data.data.products || []).filter(
            (p: any) => p.availableQtyKg && p.availableQtyKg > 0
          )
          setTmtProducts(productsWithStock)
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

  // Add TMT item to sale
  const addTmtItemToSale = async () => {
    if (!selectedTmtProduct || !tmtQuantity || !tmtPricePerUnit) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate price is set
    if (parseFloat(tmtPricePerUnit) <= 0) {
      toast.error('Please enter a valid selling price')
      return
    }

    try {
      // Validate inventory availability
      const requiredKg = convertToKg(parseFloat(tmtQuantity), tmtUnit as any, selectedTmtProduct)

      const token = localStorage.getItem("accessToken")
      if (!token) {
        toast.error('No access token found')
        return
      }

      const res = await fetch('/api/tmt/inventory/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedTmtProduct.id,
          shopId: currentShopId,
          requiredKg: requiredKg
        })
      })

      if (!res.ok) {
        toast.error('Failed to validate inventory')
        return
      }

      const data = await res.json()
      if (!data.success || !data.data.available) {
        toast.error('Insufficient inventory for this TMT product')
        return
      }

      // Add to TMT sale items
      const newTmtItem = {
        productId: selectedTmtProduct.id,
        productName: selectedTmtProduct.name,
        company: selectedTmtProduct.company?.name,
        size: selectedTmtProduct.size?.sizeMm,
        quantity: parseFloat(tmtQuantity),
        unitType: tmtUnit,
        pricePerUnit: parseFloat(tmtPricePerUnit),
        totalAmount: parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit),
        costPricePerKg: selectedTmtProduct.costPricePerKg || 0,
        requiredKg: requiredKg
      }

      setTmtSaleItems(prev => [...prev, newTmtItem])

      // Reset form
      setSelectedTmtProduct(null)
      setTmtQuantity('')
      setTmtPricePerUnit('')
      setTmtUnit('bundle')

      toast.success('TMT item added to sale')
    } catch (error) {
      console.error('Error adding TMT item:', error)
      toast.error('Failed to add TMT item')
    }
  }

  // Remove TMT item from sale
  const removeTmtItem = (index: number) => {
    setTmtSaleItems(prev => prev.filter((_, i) => i !== index))
  }

  // Handle TMT sale submission
  const handleTmtSaleSubmit = async () => {
    // Build all items: tmtSaleItems (added via Add Item) + current form (if filled)
    const currentFormItem = (selectedTmtProduct && tmtQuantity && tmtPricePerUnit && parseFloat(tmtPricePerUnit) > 0)
      ? [{
        productId: selectedTmtProduct.id,
        productName: selectedTmtProduct.productName,
        company: selectedTmtProduct.company?.name,
        size: selectedTmtProduct.size?.sizeMm,
        quantity: parseFloat(tmtQuantity),
        unitType: tmtUnit,
        pricePerUnit: parseFloat(tmtPricePerUnit),
        totalAmount: parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit)
      }]
      : [];

    const allItems = [...tmtSaleItems, ...currentFormItem];

    if (allItems.length === 0) {
      toast.error('Please add at least one TMT product to the sale');
      return;
    }

    if (!selectedCustomer && customerType === 'existing') {
      toast.error('Please select a customer')
      return
    }

    if (customerType === 'new' && !newCustomer.name) {
      toast.error('Please enter a customer name')
      return
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token')
      }

      // Calculate total amount from all items (respecting discount/tax)
      const totalAmount = finalAmount

      // Determine the sale date string
      const saleDateStr = customSaleDate ? `${customSaleDate}T00:00:00.000Z` : new Date().toISOString();

      // Resolve customer info
      const resolvedCustomerName = customerType === 'new' ? newCustomer.name : selectedCustomer?.name;
      const resolvedCustomerId = customerType === 'existing' && selectedCustomer?.id ? selectedCustomer.id : undefined;

      // Create TMT sale
      const response = await fetch('/api/tmt/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: allItems.map(item => ({
            productId: item.productId,
            soldQuantity: item.quantity,
            unitType: item.unitType,
            pricePerUnit: item.pricePerUnit
          })),
          saleDate: saleDateStr,
          // Pass both customerId (for existing) and customerName (for display / new customer fallback)
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
          customerPhone: customerType === 'new' ? newCustomer.phone : selectedCustomer?.phone,
          customerAddress: customerType === 'new' ? newCustomer.address : selectedCustomer?.address,
          shopId: currentShopId,
          paymentMethod: paymentMethod,
          paidAmount: paymentMethod === 'partial' ? partialAmount : (paymentMethod === 'loan' ? 0 : totalAmount),
          partialPaymentMethod: paymentMethod === 'partial' ? partialPaymentMethod : null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to create TMT sale')
      }

      const result = await response.json()

      // Show payment status in success message
      const paymentStatusMsg = result.data?.paymentStatus === 'PARTIAL'
        ? ` | Paid: ₹${result.data?.paidAmount || 0}, Due: ₹${result.data?.dueAmount || 0}`
        : result.data?.paymentStatus === 'UNPAID' ? ' | Loan/Credit (full amount due)' : ''
      toast.success(`TMT sale completed successfully!${paymentStatusMsg}`)

      // Compute bill amounts (with discount/tax applied)
      const billSubtotal = allItems.reduce((s, i) => s + i.totalAmount, 0);
      const billDiscountAmt = discountType === 'percent' ? (billSubtotal * discount) / 100 : discount;
      const billCgst = ((billSubtotal - billDiscountAmt) * (tax / 2)) / 100;
      const billSgst = ((billSubtotal - billDiscountAmt) * (tax / 2)) / 100;
      const billFinal = billSubtotal - billDiscountAmt + billCgst + billSgst;
      const billPaid = paymentMethod === 'partial' ? partialAmount : (paymentMethod === 'loan' ? 0 : billFinal);

      // Prepare sale data for print bill — use the actual sale date for the bill header
      const tmtSaleData = {
        billNo: result.data?.saleId,
        saleDate: saleDateStr,
        date: saleDateStr,
        shop: currentShop,
        customerName: resolvedCustomerName,
        customerPhone: customerType === 'new' ? newCustomer.phone : selectedCustomer?.phone,
        totalAmount: billSubtotal,
        discount: billDiscountAmt,
        cgst: billCgst,
        sgst: billSgst,
        finalAmount: billFinal,
        payment_type: paymentMethod,
        paid_amount: billPaid,
        dueAmount: result.data?.dueAmount || (billFinal - billPaid),
        paymentStatus: result.data?.paymentStatus || 'PAID',
        items: allItems.map(item => ({
          ...item,
          // Ensure 'name' field is always set for bill components
          name: item.productName || item.name || 'TMT Product',
          // Ensure standard price fields exist for bill components
          price_per_unit: item.pricePerUnit,
          pricePerUnit: item.pricePerUnit
        }))
      }

      setLastSaleData(tmtSaleData)
      setShowPrintPrompt(true)

      // Notify dashboard components to refresh active/completed lists
      try {
        // Method 1: Custom event on window
        const event = new CustomEvent('sale:created', {
          detail: { shopId: currentShopId, saleId: result.data?.saleId },
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);
        document.dispatchEvent(event);
        console.log('📢 [TMT Sale] Dispatched sale:created event:', { shopId: currentShopId, saleId: result.data?.saleId });

        // Method 2: Store in localStorage as fallback
        localStorage.setItem('sale:created', JSON.stringify({
          shopId: currentShopId,
          saleId: result.data?.saleId,
          timestamp: Date.now()
        }));
        console.log('💾 [TMT Sale] Stored sale creation in localStorage');

        // Method 3: Clear session storage cache
        sessionStorage.removeItem('prefetchedDashboardData');
      } catch (error) {
        console.error('❌ [TMT Sale] Error notifying sale creation:', error);
      }

      // Reset form
      setSelectedTmtProduct(null)
      setTmtQuantity('')
      setTmtPricePerUnit('')
      setTmtUnit('bundle')
      setSelectedCustomer(null)
      setNewCustomer({ name: '', phone: '', address: '' })
      setPaymentMethod('cash')
      setPartialAmount(0)
      setPartialPaymentMethod('cash')
      setTmtSaleItems([])

      // Clear dashboard cache
      sessionStorage.removeItem('prefetchedDashboardData')

      // Reload TMT products to update inventory
      await loadTmtProducts()

    } catch (error) {
      console.error('Error creating TMT sale:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create TMT sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  // State for inventory products
  const [products, setProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  // Add state for discount and tax
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat')
  const [tax, setTax] = useState(0)

  // Add state for bill printing
  const [showBillModal, setShowBillModal] = useState(false)
  const [billType, setBillType] = useState<"proper" | "normal" | null>(null)
  const [lastSaleData, setLastSaleData] = useState<any>(null)

  // Add state for customers
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)

  // Add state for print prompt
  const [showPrintPrompt, setShowPrintPrompt] = useState(false)

  // Add state for TMT bundles and pieces per sale item
  const [tmtBundleInputs, setTmtBundleInputs] = useState<{ [index: number]: { bundles: string, pieces: string, totalPieces: number, bundleSize: number | null } }>({});

  // Fetch products from inventory (Product table)
  const fetchProducts = async () => {
    setProductsLoading(true)
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) {
        console.log('🔍 [AddSale] fetchProducts - No token');
        return
      }
      if (!currentShopId || currentShopId === 0) {
        console.log('🔍 [AddSale] fetchProducts - Invalid currentShopId:', currentShopId, 'currentShop:', currentShop);
        toast.error('Please select a shop first. Current shop ID is invalid or not set.', {
          duration: 5000
        });
        return
      }
      console.log('🔍 [AddSale] fetchProducts - Using shopId:', currentShopId, 'type:', typeof currentShopId);
      console.log('🔍 [AddSale] fetchProducts - currentShop:', currentShop);
      console.log('🔍 [AddSale] fetchProducts - userRole:', userRole);
      const res = await fetch(`/api/products?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log('🔍 [AddSale] fetchProducts - Response status:', res.status);
      console.log('🔍 [AddSale] fetchProducts - Response URL:', res.url);
      if (res.ok) {
        const data = await res.json()
        const filteredProducts = data.data.products || []
        console.log('🔍 [AddSale] fetchProducts - Success, products:', filteredProducts.length);
        console.log('🔍 [AddSale] fetchProducts - Raw products data:', data.data.products);
        console.log('🔍 [AddSale] fetchProducts - Categories from products:', filteredProducts.map((p: any) => p.category?.name).filter(Boolean));
        console.log('🔍 [AddSale] fetchProducts - Sample product:', filteredProducts[0]);
        setProducts(filteredProducts)

        if (filteredProducts.length === 0) {
          toast.info(`No products found for shop "${currentShop?.name || 'Unknown'}" (ID: ${currentShopId}). Please add products to the inventory first.`, {
            duration: 5000
          });
        }
      } else {
        let errorMsg = `Status ${res.status}`;
        let errorData: any = {};
        let responseText = '';

        try {
          responseText = await res.text();
          console.error("Products API raw response text:", responseText);

          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
              console.error("Products API parsed error response:", errorData);
            } catch (parseError) {
              console.error("Failed to parse JSON response:", parseError);
              errorMsg = `HTTP ${res.status}: ${res.statusText} - ${responseText}`;
            }
          }

          if (errorData && typeof errorData === 'object') {
            if ('message' in errorData && errorData.message) {
              errorMsg = errorData.message;
            } else if ('error' in errorData && errorData.error) {
              errorMsg = errorData.error;
            } else if (Object.keys(errorData).length === 0) {
              errorMsg = `HTTP ${res.status}: ${res.statusText} - Empty response`;
            }
          }
        } catch (e) {
          console.error("Failed to read response:", e);
          errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        }

        console.error("Products API error details:", {
          status: res.status,
          statusText: res.statusText,
          responseText: responseText,
          errorData: errorData,
          finalErrorMsg: errorMsg,
          url: res.url
        });
        toast.error("Failed to load inventory products: " + errorMsg)
      }
    } catch (e) {
      toast.error("Failed to load inventory products: " + (typeof e === "object" && e && "message" in e ? (e as any).message : String(e)))
      console.error("Products fetch error:", e)
    } finally {
      setProductsLoading(false)
    }
  }

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          console.log('No token found in localStorage')
          setLoading(false)
          return
        }

        console.log('Fetching categories with token:', token.substring(0, 20) + '...')
        console.log('🔍 [AddSale] Categories API - currentShopId:', currentShopId, 'type:', typeof currentShopId)

        // Build URL with shopId parameter
        const url = currentShopId && currentShopId !== 0
          ? `/api/categories/public?shopId=${currentShopId}`
          : '/api/categories/public'

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        console.log('Categories API response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Categories API response data:', data)
          if (data.success) {
            // API now filters by shopId and createdBy, so use data directly
            setCategories(data.data)
            console.log('Categories set:', data.data.length, 'categories')
            console.log('🔍 [AddSale] Categories details:', data.data.map((c: any) => ({
              id: c.id,
              name: c.name,
              shopId: c.shopId,
              createdBy: c.createdBy
            })));
          } else {
            console.error('Categories API returned success: false:', data.message)
          }
        } else {
          const errorText = await response.text()
          console.error('Categories API error:', response.status, errorText)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      } finally {
        setLoading(false)
      }
    }

    const fetchAllTypes = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (!token || !currentShopId) return

        const response = await fetch(`/api/categories/types?shopId=${currentShopId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setAllTypes(data.data || [])
            console.log('🔍 [AddSale] All types fetched:', data.data?.length)
          }
        }
      } catch (error) {
        console.error('Error fetching all types:', error)
      }
    }

    fetchCategories()
    fetchAllTypes()
    loadTmtProducts()
  }, [currentShopId])



  useEffect(() => {
    console.log('🔍 [AddSale] useEffect triggered - currentShopId:', currentShopId);
    fetchProducts()
  }, [currentShopId])

  // Build categories/types from inventory products
  const categoriesFromProducts = Array.from(
    new Map(
      products
        .filter((p: any) => p.category && p.category.id)
        .map((p: any) => [p.category.id, p.category])
    ).values()
  );

  // Helper to get types for a given category ID
  const getTypesForCategory = (categoryId: number) => {
    if (!categoryId || allTypes.length === 0) return []
    const types = allTypes.filter((t: any) => Number(t.categoryId) === Number(categoryId))
    console.log('🔍 [AddSale] getTypesForCategory (from allTypes) - returning types:', types.length, types.map(t => t.name));
    return types
  }

  // Debug categories
  console.log('🔍 [AddSale] Categories from products:', categoriesFromProducts.length, categoriesFromProducts.map(c => c.name));
  console.log('🔍 [AddSale] Products loaded:', products.length, 'products');
  console.log('🔍 [AddSale] Sample product with category/type:', products.slice(0, 2).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    type: p.type
  })));
  console.log('🔍 [AddSale] All products with categories:', products.map(p => ({
    id: p.id,
    name: p.name,
    categoryId: p.category?.id,
    categoryName: p.category?.name,
    typeId: p.type?.id,
    typeName: p.type?.name
  })));

  const handleAddRegularItemToCart = () => {
    // Validate the current item
    if (!isDirectSale && (!currentRegularItem.categoryId || !currentRegularItem.productId)) {
      toast.error(t("Please select product details", "कृपया उत्पाद विवरण चुनें"))
      return
    }

    if (!currentRegularItem.quantity || parseQuantity(currentRegularItem.quantity.toString()) <= 0) {
      toast.error(t("Please enter a valid quantity", "कृपया एक मान्य मात्रा दर्ज करें"))
      return
    }

    if (!currentRegularItem.price || currentRegularItem.price <= 0) {
      toast.error(t("Please enter a valid price", "कृपया एक मान्य मूल्य दर्ज करें"))
      return
    }

    const needsConversion = !isDirectSale && currentRegularItem.categoryName &&
      (currentRegularItem.categoryName.toLowerCase().includes("sand") ||
        currentRegularItem.categoryName.toLowerCase().includes("chips")) &&
      currentRegularItem.unit &&
      currentRegularItem.unit !== "cft";

    if (needsConversion && (!currentRegularItem.conversionCft || currentRegularItem.conversionCft <= 0)) {
      toast.error(t("Please enter a valid conversion CFT", "कृपया एक मान्य रूपांतरण सीएफटी दर्ज करें"))
      return
    }

    // Add to cart array
    setSaleItems(prev => [...prev, {
      ...currentRegularItem,
      isDirectSale,
      supplierId: isDirectSale && selectedSupplier?.id !== 0 ? selectedSupplier?.id : undefined,
      supplierInfo: isDirectSale && selectedSupplier?.id === 0 ? newSupplier : undefined
    }])
    toast.success(t("Added to cart", "कार्ट में जोड़ा गया"))

    // Reset form
    setCurrentRegularItem({
      categoryId: 0,
      categoryName: "",
      typeId: 0,
      typeName: "",
      productId: 0,
      name: "",
      quantity: 1,
      price: 0,
      purchasePrice: 0,
      unit: "",
      size: "",
      stockType: undefined,
      conversionCft: 0
    })
    setCurrentBundleInput({ bundles: '', pieces: '', totalPieces: 0 })
  }

  const [currentBundleInput, setCurrentBundleInput] = useState({ bundles: '', pieces: '', totalPieces: 0 })

  const handleCurrentItemChange = (field: keyof SaleItem, value: any) => {
    let newItem = { ...currentRegularItem }

    if (field === "unit") {
      newItem.unit = value
      const isTmtProduct = (newItem.categoryName?.toLowerCase()?.includes('tmt') || newItem.categoryName?.toLowerCase()?.includes('steel')) && !newItem.categoryName?.toLowerCase()?.includes('ring');
      const isRingProduct = newItem.categoryName?.toLowerCase()?.includes('ring');
      const bundleSize = getTmtBundleSize(newItem) || 1;

      if (isRingProduct) {
        if (value === "piece") {
          newItem.price = 9;
        } else if (value === "bundle") {
          newItem.price = 9 * bundleSize;
        }
      } else if (isTmtProduct) {
        const product = products.find((p: any) => p.id === newItem.productId)
        const bundlePrice = product?.price || 0
        if (bundlePrice > 0) {
          if (value === "piece") {
            newItem.price = Number((bundlePrice / bundleSize).toFixed(2))
          } else if (value === "bundle") {
            newItem.price = Number(bundlePrice)
          }
        }
      }
      // Cement logic (existing)
      if (newItem.name && newItem.name.toLowerCase().includes("cement")) {
        if (value === "kg") {
          newItem.stockType = "damaged";
        } else if (value === "bag" || value === "bags") {
          newItem.stockType = "normal";
        }
      }
    } else if (field === "categoryId") {
      const category = categories.find((c: any) => Number(c.id) === parseInt(value))
      if (category) {
        newItem = {
          ...newItem,
          categoryId: Number(category.id),
          categoryName: category.name,
          typeId: 0,
          typeName: "",
          productId: 0,
          name: "",
          price: 0,
          unit: ""
        }
      }
    } else if (field === "typeId") {
      const typeIdToFind = parseInt(value);
      const availableTypes = getTypesForCategory(newItem.categoryId);
      const type = availableTypes.find((t: any) => Number(t.id) === typeIdToFind);

      if (type) {
        newItem = {
          ...newItem,
          typeId: Number(type.id),
          typeName: type.name,
          productId: 0,
          name: "",
          price: 0,
          unit: ""
        };
      }
    } else if (field === "productId") {
          const product = products.find((p: any) => Number(p.id) === parseInt(value))
          if (product) {
            const isSandChipsCategory = product.category?.name?.toLowerCase()?.includes("sand") ||
              product.category?.name?.toLowerCase()?.includes("chips") ||
              product.category?.name?.toLowerCase()?.includes("bricks") ||
              product.category?.name?.toLowerCase()?.includes("aggregates")
            const isTMTBarCategory = product.category?.name?.toLowerCase()?.includes("tmt") ||
              product.category?.name?.toLowerCase()?.includes("steel")
            const isRingProduct = product.category?.name?.toLowerCase()?.includes("ring")

            let defaultPrice = product.dailyRate !== null && product.dailyRate !== undefined ? Number(product.dailyRate) : Number(product.price);

            if (isRingProduct) {
              const bundleSize = getTmtBundleSize(newItem) || 25;
              const currentUnit = newItem.unit || "bundle";
              defaultPrice = currentUnit === "piece" ? 9 : 9 * bundleSize;
            }

            newItem = {
              ...newItem,
              productId: Number(product.id),
              name: product.name,
              price: defaultPrice,
              purchasePrice: Number(product.costPrice || 0),
              unit: (isSandChipsCategory || isTMTBarCategory || isRingProduct) ? newItem.unit || "" : (product.unit || newItem.unit || ""),
              categoryId: Number(product.category?.id),
              categoryName: product.category?.name,
              typeId: Number(product.type?.id),
              typeName: product.type?.name
            }
          }
        } else if (field === "quantity") {
          const quantityValue = parseQuantity(value.toString());
          // Sand/Chips: stock stored in CFT — cannot compare to piece/tempo quantity at input time
          // Ring: inventory managed via TMT inventory system separately
          // Bricks: piece-count — DO check stock
          const isBypassStockCheck = newItem.categoryName?.toLowerCase()?.includes('sand') ||
            newItem.categoryName?.toLowerCase()?.includes('chips') ||
            newItem.categoryName?.toLowerCase()?.includes('ring');

          if (!isDirectSale && newItem.productId && !isBypassStockCheck) {
            const product = products.find((p: any) => Number(p.id) === Number(newItem.productId))
            if (product && product.stockQuantity !== null && product.stockQuantity !== undefined) {
              const availableStock = Number(product.stockQuantity) || 0
              // Only block if the unit being sold matches the product's base unit
              // (e.g. selling 'piece' vs stock in 'piece'; don't block if units differ)
              if (newItem.unit === product.unit && quantityValue > availableStock) {
                toast.error(`Insufficient stock! Available: ${availableStock} ${product.unit || ''}. You entered: ${quantityValue}`)
                return // Don't update quantity if it exceeds stock
              }
            }
          }
          newItem.quantity = value
        } else if (field === "price") {
          newItem.price = value === "" ? 0 : Number.parseFloat(value) || 0
        } else if (field === "purchasePrice") {
          newItem.purchasePrice = value === "" ? 0 : Number.parseFloat(value) || 0
        } else if (field === "stockType") {
          newItem.stockType = value as 'normal' | 'damaged'
        } else {
          (newItem as any)[field] = value
        }
        setCurrentRegularItem(newItem)
      }

      const getUnitForProduct = (productName: string): string => {
        if (productName.includes("Bag")) return "bags"
        if (productName.includes("kg")) return "kg"
        if (productName.includes("Bricks")) return "bricks"
        if (productName.includes("CFT")) return "CFT"
        if (productName.includes("Bucket")) return "bucket"
        return "units"
      }

      // Helper to get bundleSize for a TMT Bar product/type
      const getTmtBundleSize = (item: SaleItem) => {
        if (!item || !item.typeId) return null;
        // Find the product for this item
        const product = products.find((p: any) => p.id === item.productId);
        if (product && product.type && typeof product.type.bundleSize !== 'undefined') {
          console.log('TMT DEBUG: getTmtBundleSize using product.type', product.type);
          return product.type.bundleSize;
        }
        // Fallback: search types from all products in this category
        const types = getTypesForCategory(item.categoryId);
        const type = types.find((t: any) => t.id === item.typeId);
        console.log('TMT DEBUG: getTmtBundleSize fallback types', types, 'searching for typeId', item.typeId);
        return type && typeof type.bundleSize !== 'undefined' ? type.bundleSize : null;
      };

      // Update TMT bundle/piece input and total pieces for the current item
      const handleTmtInputChange = (field: 'bundles' | 'pieces', value: string) => {
        setCurrentBundleInput(prev => {
          const bundleSize = getTmtBundleSize(currentRegularItem);
          const bundles = field === 'bundles' ? value : prev.bundles;
          const pieces = field === 'pieces' ? value : prev.pieces;
          const totalPieces = bundleSize ? (parseInt(bundles) || 0) * bundleSize + (parseInt(pieces) || 0) : 0;

          // Update the current item's quantity as well
          handleCurrentItemChange('quantity', totalPieces.toString());

          return { ...prev, bundles, pieces, totalPieces };
        });
      };


      const handleRemoveItem = (index: number) => {
        const newItems = saleItems.filter((_, i) => i !== index)
        setSaleItems(newItems)
      }

      const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
          toast.error(t("Please fill in customer name and phone", "कृपया ग्राहक का नाम और फोन भरें"))
          return
        }
        try {
          const token = localStorage.getItem('accessToken')
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ...newCustomer, shopId: currentShopId })
          })
          const data = await res.json()
          if (res.ok && data.success) {
            const createdCustomer = data.data
            setSelectedCustomer(createdCustomer)
            setNewCustomer({ name: "", phone: "", address: "" })
            setIsNewCustomerDialogOpen(false)
            // Switch to existing customer mode since the customer now exists
            setCustomerType("existing")
            toast.success(t("Customer created successfully!", "ग्राहक सफलतापूर्वक बनाया गया!"))
          } else {
            toast.error(data.message || t("Failed to create customer", "ग्राहक बनाने में विफल"))
          }
        } catch (error) {
          toast.error(t("Failed to create customer", "ग्राहक बनाने में विफल"))
        }
      }

      // Function to reset all form data after successful sale creation
      const resetForm = () => {
        // Reset customer selection
        setSelectedCustomer(null)
        setCustomerType("existing")
        setSearchTerm("")
        setCustomers([])

        // Reset new customer form
        setNewCustomer({ name: "", phone: "", address: "" })
        setIsNewCustomerDialogOpen(false)

        // Reset sale items
        setSaleItems([])

        // Reset TMT mode
        setIsTmtMode(false)
        setSelectedTmtProduct(null)
        setTmtQuantity("")
        setTmtPricePerUnit("")
        setTmtSaleItems([])

        // Reset payment details
        setPaymentMethod("cash")
        setPartialAmount(0)
        setPartialPaymentMethod("cash")

        // Reset discount and tax
        setDiscount(0)
        setDiscountType("flat")
        setTax(0)

        // Reset TMT bundle inputs
        setTmtBundleInputs({})

        // Reset bill printing
        setShowBillModal(false)
        setBillType(null)
        setShowPrintPrompt(false)
        setLastSaleData(null)

        // Reset form validation
        setIsSubmitting(false)

        // Reset transport fields
        setTransportFare(0)
        setVehicleNumber("")
        setDriverName("")

        console.log('🔄 [AddSale] Form reset completed')
      }

      // Calculate totals
      const regularSubtotal = saleItems.reduce((sum, item) => sum + (parseQuantity(item.quantity.toString()) * (item.price || 0)), 0);

      // For TMT, we only include the items already added to the cart (tmtSaleItems)
      const tmtSubtotal = tmtSaleItems.reduce((sum, item) => sum + item.totalAmount, 0);

      const subtotal = regularSubtotal + tmtSubtotal;

      const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
      const cgstPercent = tax / 2;
      const sgstPercent = tax / 2;
      const cgstAmount = ((subtotal - discountAmount) * cgstPercent) / 100;
      const sgstAmount = ((subtotal - discountAmount) * sgstPercent) / 100;
      const finalAmount = subtotal - discountAmount + cgstAmount + sgstAmount + Number(transportFare || 0);

      const totalCost = (() => {
        let cost = 0;
        tmtSaleItems.forEach(item => { cost += (item.costPricePerKg || 0) * (item.requiredKg || 0); });
        return cost;
      })() + saleItems.reduce((sum, item) => {
        const product = products.find((p: any) => Number(p.id) === Number(item.productId));
        const itemQty = parseQuantity(item.quantity.toString());
        const rawCost = Number(item.purchasePrice ?? product?.costPrice ?? 0);
        const convFactor = (item.conversionCft && Number(item.conversionCft) > 0) ? Number(item.conversionCft) : null;
        const isRing = item.categoryName?.toLowerCase()?.includes('ring');
        // True bulk CFT materials: Sand and Chips only
        const isBulkCft = item.categoryName?.toLowerCase()?.includes('sand') || item.categoryName?.toLowerCase()?.includes('chips');
        // Cement: always sold per bag (stockQuantity = bags)
        const isCementItem = item.categoryName?.toLowerCase()?.includes('cement');
        // Bricks: always sold per piece (stockQuantity = pieces)
        const isBricksItem = item.categoryName?.toLowerCase()?.includes('brick');

        let itemCost = rawCost; // default: cost per unit × quantity

        // Compute cost per CFT for bulk items (rawCost may be per-truck, per-tempo, or per-CFT)
        let costPerBaseUnit = rawCost;
        const buyConvFactor = product?.latestConversionCft; // CFT per purchase unit (null = unknown)
        if (!isCementItem && !isBricksItem) {
          if (buyConvFactor && buyConvFactor > 1 && buyConvFactor !== convFactor) {
            // Purchase unit differs from sale unit — normalize to per-CFT
            costPerBaseUnit = rawCost / buyConvFactor;
          } else if (!buyConvFactor && rawCost > 5000) {
            // Unknown purchase unit but cost looks like a full-truck price — divide by typical truck CFT
            costPerBaseUnit = rawCost / 400;
          } else if (!buyConvFactor) {
            // rawCost is already per-CFT (or per sale unit) — use as-is
            costPerBaseUnit = rawCost;
          }
          // If buyConvFactor === convFactor: rawCost IS the per-unit cost already (no conversion needed)
        }

        if (isRing && item.unit === 'piece') {
          // Ring: cost per bundle ÷ bundle size
          const bundleSize = getBundleConfig(item.name || "") || 25;
          itemCost = rawCost / bundleSize;
        } else if (isCementItem) {
          // Cement: cost per bag — no CFT conversion
          itemCost = rawCost;
        } else if (isBricksItem) {
          // Bricks: cost per piece — no CFT conversion
          itemCost = rawCost;
        } else if (isBulkCft && item.unit === 'cft') {
          // Sand/Chips sold directly in CFT
          itemCost = costPerBaseUnit;
        } else if (isBulkCft && convFactor) {
          // Sand/Chips sold in tempo/truck — convert via CFT factor
          itemCost = convFactor * costPerBaseUnit;
        } else if (convFactor) {
          // Any other product with a conversion factor
          itemCost = convFactor * costPerBaseUnit;
        }
        return sum + (itemQty * itemCost);
      }, 0);

      const profit = (subtotal + Number(transportFare || 0) - discountAmount) - totalCost;
      const amountPaid = paymentMethod === "partial" ? partialAmount : paymentMethod === "loan" ? 0 : finalAmount;
      const dueAmount = finalAmount - amountPaid;

      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (subtotal <= 0 && Number(transportFare || 0) <= 0) {
          toast.error(t("Please add at least one item or transport fare", "कृपया कम से कम एक आइटम या परिवहन शुल्क जोड़ें"))
          return
        }

        if (!selectedCustomer && customerType === 'existing') {
          toast.error(t("Please select a customer", "कृपया ग्राहक चुनें"))
          return
        }

        if (customerType === 'new' && !newCustomer.name) {
          toast.error(t("Please enter a customer name", "कृपया ग्राहक का नाम दर्ज करें"))
          return
        }

        const validItems = saleItems.filter(item => {
          if (item.isDirectSale) {
            return item.categoryId && item.typeId && item.name;
          }
          return item.categoryId && item.typeId && item.productId;
        });

        const hasIncompleteItems = saleItems.length > validItems.length;
        if (hasIncompleteItems && validItems.length > 0) { // Only block if they started filling a row
          toast.error(t("Please complete all added regular items before creating the sale. Ensure Product Name/Brand is selected.", "कृपया बिक्री बनाने से पहले सभी जोड़े गए आइटम पूरे करें। सुनिश्चित करें कि उत्पाद का नाम/ब्रांड चुना गया है।"));
          return;
        }

        const hasRegularItems = validItems.length > 0;
        const hasTmtItems = tmtSaleItems.length > 0;
        const hasTransport = Number(transportFare || 0) > 0

        if (!hasRegularItems && !hasTmtItems && !hasTransport) {
          toast.error(t("Please add at least one item or transport fare", "कृपया कम से कम एक आइटम या परिवहन शुल्क जोड़ें"))
          return
        }

        // Check if sand and chips items have units selected
        const sandChipsItemsWithoutUnit = saleItems.filter(item =>
          item.categoryId && item.typeId && item.productId &&
          item.categoryName && (item.categoryName.toLowerCase().includes("sand") || item.categoryName.toLowerCase().includes("chips")) &&
          !item.unit
        )

        if (sandChipsItemsWithoutUnit.length > 0) {
          toast.error(t("Please select units for sand and chips items", "कृपया रेत और चिप्स के लिए इकाई चुनें"))
          return
        }

        // Check if Ring items have units selected
        const tmtItemsWithoutUnit = saleItems.filter(item =>
          item.categoryId && item.typeId && item.productId &&
          item.categoryName && (item.categoryName.toLowerCase().includes("tmt") || item.categoryName.toLowerCase().includes("steel") || item.categoryName.toLowerCase().includes("ring")) &&
          !item.unit
        )

        if (tmtItemsWithoutUnit.length > 0) {
          toast.error(t("Please select units for Ring/Steel items", "कृपया रिंग/स्टील के लिए इकाई चुनें"))
          return
        }

        // Check if chip items have sizes selected
        const chipItemsWithoutSize = saleItems.filter(item =>
          item.categoryId && item.typeId && item.productId &&
          item.categoryName && item.categoryName.toLowerCase().includes("chips") &&
          !item.size
        )

        if (chipItemsWithoutSize.length > 0) {
          toast.error(t("Please select sizes for chip items", "चिप्स के लिए साइज़ चुनें"))
          return
        }

        if (isDirectSale && !selectedSupplier && hasRegularItems) {
          toast.error(t("Please select or create a supplier for direct sale", "कृपया डायरेक्ट सेल के लिए सप्लायर चुनें या बनाएं"))
          return
        }

        if (paymentMethod === "partial" && partialAmount >= finalAmount) {
          toast.error(t("Partial amount should be less than total amount", "आंशिक राशि कुल राशि से कम होनी चाहिए"))
          return
        }

        if (!isDirectSale && hasRegularItems) {
          for (const item of validItems) {
            // Sand and Chips: stock is in CFT — bypass piece-count stock check (CFT cannot be compared to pieces)
            // Rings: oversell is allowed (managed via TMT inventory separately)
            const isBypassStockCheck =
              item.categoryName?.toLowerCase()?.includes('sand') ||
              item.categoryName?.toLowerCase()?.includes('chips') ||
              item.categoryName?.toLowerCase()?.includes('ring');
            if (isBypassStockCheck) continue;

            const product = products.find((p: any) => Number(p.id) === Number(item.productId))
            if (product && Number(product.stockQuantity) !== null && Number(product.stockQuantity) !== undefined) {
              const availableStockInBaseUnit = Number(product.stockQuantity) || 0
              const requestedQty = parseQuantity(item.quantity.toString()) // use parseQuantity for fraction support

              if (availableStockInBaseUnit <= 0) {
                toast.error(`${product.name} is out of stock! Cannot create sale without Direct Truck Sale.`)
                return
              }

              // Only block if unit matches product base unit (piece-count products)
              if (item.unit === product.unit && requestedQty > availableStockInBaseUnit) {
                toast.error(`Insufficient stock for ${product.name}! Available: ${availableStockInBaseUnit} ${product.unit}, Requested: ${requestedQty} ${item.unit}`)
                return
              }
            }
          }
        }

        setIsSubmitting(true)
        try {
          const token = localStorage.getItem("accessToken")
          const saleDate = customSaleDate ? `${customSaleDate}T00:00:00.000Z` : new Date().toISOString();
          const resolvedCustomerName = customerType === 'new' ? newCustomer.name : selectedCustomer?.name;
          const resolvedCustomerId = customerType === 'existing' && selectedCustomer?.id ? selectedCustomer.id : undefined;

          // Determine proportional splits for shared monetary values
          const totalSubtotal = regularSubtotal + tmtSubtotal;
          const regularRatio = totalSubtotal > 0 ? (regularSubtotal / totalSubtotal) : (hasRegularItems ? 1 : 0);
          const tmtRatio = totalSubtotal > 0 ? (tmtSubtotal / totalSubtotal) : (hasTmtItems ? 1 : 0);

          // Customer Info Object for new customers
          const customerInfo = customerType === 'new' ? {
            name: newCustomer.name,
            phone: newCustomer.phone,
            address: newCustomer.address
          } : undefined;

          let regularResult = null;
          let tmtResult = null;

          // --- SUBMIT REGULAR SALE ---
          if (hasRegularItems || (!hasTmtItems && hasTransport)) {
            const regularSaleData: any = {
              customerId: resolvedCustomerId,
              shopId: currentShopId,
              saleDate,
              totalAmount: regularSubtotal + (Number(transportFare || 0) * regularRatio),
              finalAmount: finalAmount * regularRatio,
              discount: discountAmount * regularRatio,
              cgst: cgstAmount * regularRatio,
              sgst: sgstAmount * regularRatio,
              transportFare: Number(transportFare || 0) * regularRatio,
              vehicleNumber: vehicleNumber || null,
              driverName: driverName || null,
              items: validItems.map(item => {
                if (item.name && item.name.toLowerCase().includes("cement") && item.unit === "kg") {
                  return {
                    ...item, stockType: "damaged", quantity: parseQuantity(item.quantity.toString()), unit: "kg",
                    unitPrice: item.price, price_per_unit: item.price, isDirectSale: item.isDirectSale, supplierId: item.supplierId, supplierInfo: item.supplierInfo
                  };
                }
                return {
                  ...item, quantity: parseQuantity(item.quantity.toString()), unitPrice: item.price, price_per_unit: item.price, isDirectSale: item.isDirectSale, supplierId: item.supplierId, supplierInfo: item.supplierInfo
                };
              }),
              payment_type: paymentMethod as "cash" | "online" | "loan" | "partial",
              paid_amount: amountPaid * regularRatio,
              partial_payment_method: paymentMethod === "partial" ? partialPaymentMethod : null,
              isDirectSale,
              supplierId: selectedSupplier?.id !== 0 ? selectedSupplier?.id : undefined,
              supplierInfo: selectedSupplier?.id === 0 ? {
                name: selectedSupplier.name, phone: selectedSupplier.phone, address: selectedSupplier.address
              } : undefined,
              ...(customerInfo ? { customerInfo } : {})
            };

            regularResult = await salesService.createSale(regularSaleData);
          }

          // --- SUBMIT TMT SALE ---
          if (hasTmtItems) {
            const tmtSaleData: any = {
              customerId: resolvedCustomerId,
              shopId: currentShopId,
              saleDate,
              totalAmount: tmtSubtotal + (Number(transportFare || 0) * tmtRatio),
              finalAmount: finalAmount * tmtRatio,
              discount: discountAmount * tmtRatio,
              cgst: cgstAmount * tmtRatio,
              sgst: sgstAmount * tmtRatio,
              transportFare: Number(transportFare || 0) * tmtRatio,
              vehicleNumber: vehicleNumber || null,
              driverName: driverName || null,
              items: tmtSaleItems.map(item => ({
                productId: item.productId,
                soldQuantity: item.quantity,
                unitType: item.unitType,
                pricePerUnit: item.pricePerUnit
              })),
              paymentMethod: paymentMethod,
              paidAmount: amountPaid * tmtRatio,
              partialPaymentMethod: paymentMethod === "partial" ? partialPaymentMethod : null,
              ...(customerInfo && !regularResult ? { customerInfo } : {}) // Only create new customer once
            };

            const res = await fetch('/api/tmt/sales', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(tmtSaleData)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || 'Failed to create TMT sale');
            }
            tmtResult = data.data;
          }

          // Merge results for UI Print
          if (regularResult || tmtResult) {
            toast.success(t("Sale created successfully!", "बिक्री सफलतापूर्वक बनाई गई!"))

            // Use primary result for bill ID
            const primaryResult = regularResult || tmtResult;

            // Notify dashboard
            try {
              const event = new CustomEvent('sale:created', {
                detail: { shopId: currentShopId, saleId: primaryResult.id },
                bubbles: true, cancelable: true
              });
              window.dispatchEvent(event);
              localStorage.setItem('sale:created', JSON.stringify({ shopId: currentShopId, saleId: primaryResult.id, timestamp: Date.now() }));
              sessionStorage.removeItem('prefetchedDashboardData');
            } catch (e) { }

            await fetchProducts();

            // Build merged items list for bill with normalized field names
            const regularBillItems = validItems.map(item => ({
              name: item.name || '-',
              quantity: parseQuantity(item.quantity.toString()),
              unit: item.unit || '',
              price_per_unit: item.price || 0,
              pricePerUnit: item.price || 0,
              totalAmount: parseQuantity(item.quantity.toString()) * (item.price || 0),
            }));
            const tmtBillItems = tmtSaleItems.map(item => ({
              name: item.productName || '-',
              productName: item.productName || '-',
              company: item.company || '',
              size: item.size || '',
              quantity: item.quantity,
              unit: item.unitType || '',
              unitType: item.unitType || '',
              price_per_unit: item.pricePerUnit || 0,
              pricePerUnit: item.pricePerUnit || 0,
              totalAmount: item.totalAmount || 0,
            }));

            setLastSaleData({
              id: primaryResult.id,
              billNo: primaryResult.id,
              saleDate: saleDate,
              date: saleDate,
              shop: currentShop,
              shopName: currentShop?.name || '',
              shopLocation: currentShop?.location || '',
              shopPhone: currentShop?.phone || '',
              customerName: resolvedCustomerName || '',
              customerPhone: customerType === 'existing' ? (selectedCustomer?.phone || '') : (newCustomer.phone || ''),
              customerAddress: customerType === 'existing' ? (selectedCustomer?.address || '') : (newCustomer.address || ''),
              totalAmount: subtotal,
              discount: discountAmount,
              cgst: cgstAmount,
              sgst: sgstAmount,
              transportFare: Number(transportFare || 0),
              vehicleNumber: vehicleNumber || '',
              driverName: driverName || '',
              finalAmount: finalAmount,
              payment_type: paymentMethod,
              paid_amount: amountPaid,
              dueAmount: dueAmount,
              paymentStatus: paymentMethod === 'loan' ? 'UNPAID' : paymentMethod === 'partial' ? 'PARTIAL' : 'PAID',
              items: [...regularBillItems, ...tmtBillItems]
            })
            setShowPrintPrompt(true)
          }

        } catch (error) {
          console.error('Error creating sale:', error)
          toast.error("Failed to create sale: " + (typeof error === "object" && error && "message" in error ? (error as any).message : String(error)))
        } finally {
          setIsSubmitting(false)
        }
      }

      const fetchCustomers = async (search = "") => {
        // Only fetch customers if we have a valid shopId (not 0)
        if (!currentShopId || currentShopId === 0) {
          console.log('🔍 [AddSale] fetchCustomers - No valid shopId, skipping API call');
          setCustomers([]);
          return;
        }

        setCustomerSearchLoading(true);
        try {
          const token = localStorage.getItem("accessToken");
          const params = new URLSearchParams();
          params.append("shopId", String(currentShopId));
          params.append("status", "active");
          if (search) params.append("search", search);
          console.log('🔍 [AddSale] fetchCustomers - Using shopId:', currentShopId, 'search:', search);
          const res = await fetch(`/api/customers?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          });
          console.log('🔍 [AddSale] fetchCustomers - Response status:', res.status);
          const data = await res.json();
          if (res.ok && data.success) {
            console.log('🔍 [AddSale] fetchCustomers - Success, customers:', data.data.customers?.length || 0);
            // Ensure strictly active customers are set
            const activeCustomers = (data.data.customers || []).filter((c: any) => c.isActive !== false);
            setCustomers(activeCustomers);
          } else {
            console.log('🔍 [AddSale] fetchCustomers - Error:', data);
            setCustomers([]);
          }
        } catch (error) {
          console.log('🔍 [AddSale] fetchCustomers - Exception:', error);
          setCustomers([]);
        } finally {
          setCustomerSearchLoading(false);
        }
      }

      useEffect(() => {
        // Only fetch customers when shop context is loaded and we have a valid shopId
        if (currentShopId && currentShopId !== 0) {
          fetchCustomers(searchTerm);
        }
      }, [searchTerm, currentShopId]);

      useEffect(() => {
        const fetchSuppliers = async () => {
          if (!currentShopId) return
          setSupplierSearchLoading(true)
          try {
            const token = localStorage.getItem("accessToken")
            const response = await fetch(`/api/suppliers?shopId=${currentShopId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (response.ok) {
              const data = await response.json()
              setSuppliers(data.data?.suppliers || [])
            }
          } catch (error) {
            console.error("Error fetching suppliers:", error)
          } finally {
            setSupplierSearchLoading(false)
          }
        }
        fetchSuppliers()
      }, [currentShopId])

      const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(supplierSearchTerm))
      )

      const handleCreateSupplier = async () => {
        if (!newSupplier.name) {
          toast.error("Please enter a supplier name")
          return
        }
        // For now, we'll just set it locally and the backend will handle creation if needed
        // or we can explicitly call an API. The implementation plan says "supplierInfo" will be passed.
        setSelectedSupplier({
          id: 0, // 0 indicates a new supplier
          name: newSupplier.name,
          phone: newSupplier.phone,
          address: newSupplier.address
        } as Supplier)
        setIsNewSupplierDialogOpen(false)
        toast.success("New supplier info added")
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
          {/* Mobile Navigation */}


          {/* Main Content with Mobile Padding */}
          <div className="p-4 pb-32 md:pb-4">
            <Card className="shadow-lg border-0 bg-white rounded-2xl max-w-4xl mx-auto overflow-visible md:overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl p-4 md:p-6">
                <CardTitle className="flex justify-between items-center text-lg md:text-xl">
                  <span>{t("Add Sale", "बिक्री जोड़ें")}</span>
                  <div className="text-sm">
                    <ShopSelector className="text-white" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Customer Selection */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{t("Customer Information", "ग्राहक की जानकारी")}</h3>

                    <RadioGroup value={customerType} onValueChange={(value) => setCustomerType(value as "existing" | "new")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="existing" id="existing" />
                        <Label htmlFor="existing" className="cursor-pointer flex-1 py-2 text-base">{t("Existing Customer", "मौजूदा ग्राहक")}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new" id="new" />
                        <Label htmlFor="new" className="cursor-pointer flex-1 py-2 text-base">{t("New Customer", "नया ग्राहक")}</Label>
                      </div>
                    </RadioGroup>

                    {customerType === "existing" ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={t("Search customers...", "ग्राहक खोजें...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {customerSearchLoading ? (
                            <div className="text-center text-gray-500 py-2">{t("Loading customers...", "ग्राहक लोड हो रहे हैं...")}</div>
                          ) : customers.length === 0 ? (
                            <div className="text-center text-gray-500 py-2">{t("No customers found", "कोई ग्राहक नहीं मिला")}</div>
                          ) : (
                            customers.map((customer) => (
                              <div
                                key={customer.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedCustomer?.id === customer.id
                                  ? "border-green-500 bg-green-50"
                                  : "border-gray-200 hover:border-gray-300"
                                  }`}
                                onClick={() => setSelectedCustomer(customer)}
                              >
                                <div className="flex items-center gap-3">
                                  <User className="h-5 w-5 text-gray-500" />
                                  <div>
                                    <p className="font-medium">{customer.name}</p>
                                    <p className="text-sm text-gray-600">{customer.phone}</p>
                                    <p className="text-sm text-gray-500">{customer.address}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            {t("Create New Customer", "नया ग्राहक बनाएं")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("Create New Customer", "नया ग्राहक बनाएं")}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="name">{t("Name", "नाम")}</Label>
                              <Input
                                id="name"
                                value={newCustomer.name}
                                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                placeholder={t("Customer name", "ग्राहक का नाम")}
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone">{t("Phone", "फोन")}</Label>
                              <Input
                                id="phone"
                                type="tel"
                                value={newCustomer.phone}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 10) {
                                    setNewCustomer({ ...newCustomer, phone: value });
                                  }
                                }}
                                placeholder="9876543210"
                                maxLength={10}
                              />
                            </div>
                            <div>
                              <Label htmlFor="address">{t("Address", "पता")}</Label>
                              <Textarea
                                id="address"
                                value={newCustomer.address}
                                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                placeholder={t("Customer address", "ग्राहक का पता")}
                              />
                            </div>

                            <Button type="button" onClick={handleCreateCustomer} className="w-full">
                              {t("Create Customer", "ग्राहक बनाएं")}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {selectedCustomer && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800">{selectedCustomer?.name}</p>
                            <p className="text-sm text-green-600">{selectedCustomer?.phone}</p>
                            <p className="text-sm text-green-600">{selectedCustomer?.address}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Direct Sale Toggle */}
                  <div className="flex items-center space-x-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <input
                      type="checkbox"
                      id="isDirectSale"
                      checked={isDirectSale}
                      onChange={(e) => setIsDirectSale(e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <Label htmlFor="isDirectSale" className="text-lg font-semibold text-emerald-800 cursor-pointer">
                      {t("Direct Truck Sale (Skip Inventory)", "डायरेक्ट ट्रक सेल (इन्वेंटरी छोड़ें)")}
                    </Label>
                  </div>

                  {/* Supplier Selection (Only if Direct Sale) */}
                  {isDirectSale && (
                    <div className="space-y-4 p-4 border-2 border-dashed border-emerald-200 rounded-2xl bg-white">
                      <h3 className="text-lg font-semibold text-emerald-700">{t("Supplier Information (For Purchase)", "सप्लायर की जानकारी (खरीद के लिए)")}</h3>

                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={t("Search suppliers...", "सप्लायर खोजें...")}
                            value={supplierSearchTerm}
                            onChange={(e) => setSupplierSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {supplierSearchLoading ? (
                            <div className="text-center text-gray-500 py-2">{t("Loading suppliers...", "सप्लायर लोड हो रहे हैं...")}</div>
                          ) : suppliers.length === 0 ? (
                            <div className="text-center text-gray-500 py-2">{t("No suppliers found", "कोई सप्लायर नहीं मिला")}</div>
                          ) : (
                            filteredSuppliers.map((supplier) => (
                              <div
                                key={supplier.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedSupplier?.id === supplier.id
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-gray-200 hover:border-gray-300"
                                  }`}
                                onClick={() => setSelectedSupplier(supplier)}
                              >
                                <div className="flex items-center gap-3">
                                  <User className="h-5 w-5 text-gray-500" />
                                  <div className="flex-1">
                                    <p className="font-medium">{supplier.name}</p>
                                    <p className="text-sm text-gray-600">{supplier.phone}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <Dialog open={isNewSupplierDialogOpen} onOpenChange={setIsNewSupplierDialogOpen}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline" className="w-full border-dashed">
                              <Plus className="h-4 w-4 mr-2" />
                              {t("Add New Supplier Info", "नई सप्लायर जानकारी जोड़ें")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t("Add New Supplier Info", "नई सप्लायर जानकारी जोड़ें")}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="s-name">{t("Supplier Name", "सप्लायर का नाम")}</Label>
                                <Input
                                  id="s-name"
                                  value={newSupplier.name}
                                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="s-phone">{t("Phone", "फोन")}</Label>
                                <Input
                                  id="s-phone"
                                  value={newSupplier.phone}
                                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="s-address">{t("Address", "पता")}</Label>
                                <Textarea
                                  id="s-address"
                                  value={newSupplier.address}
                                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                                />
                              </div>
                              <Button type="button" onClick={handleCreateSupplier} className="w-full">
                                {t("Save Supplier Info", "सप्लायर की जानकारी सहेजें")}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {selectedSupplier && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-emerald-600" />
                            <div>
                              <p className="font-medium text-emerald-800">{selectedSupplier?.name}</p>
                              <p className="text-sm text-emerald-600">{selectedSupplier?.phone}</p>
                              <p className="text-sm text-emerald-600">{selectedSupplier?.address}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-8">
                    {/* Shopping Cart Header & Toggle */}
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                        <h3 className="text-xl font-bold text-gray-800">{t("Add Product to Cart", "कार्ट में उत्पाद जोड़ें")}</h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setProductType('regular')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${productType === 'regular' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}
                          >
                            {t("Regular Material", "सामान्य सामग्री")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductType('tmt')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${productType === 'tmt' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}
                          >
                            {t("TMT Bars", "TMT बार")}
                          </button>
                        </div>
                      </div>

                      {/* REGULAR PRODUCT FORM */}
                      {productType === 'regular' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {loading ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                              <p className="mt-2 text-gray-600">{t("Loading categories...", "श्रेणियां लोड हो रही हैं...")}</p>
                            </div>
                          ) : categories.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-gray-600">{t("No categories found", "कोई श्रेणियां नहीं मिलीं")}</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                              <div>
                                <Label>{t("Category", "श्रेणी")}</Label>
                                <Select value={currentRegularItem.categoryId.toString()} onValueChange={(v) => handleCurrentItemChange("categoryId", v)} disabled={loading}>
                                  <SelectTrigger><SelectValue placeholder={t("Select category", "श्रेणी चुनें")} /></SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>{t("Type", "प्रकार")}</Label>
                                <Select value={currentRegularItem.typeId > 0 ? currentRegularItem.typeId.toString() : ""} onValueChange={(v) => handleCurrentItemChange("typeId", v)} disabled={!currentRegularItem.categoryId || loading}>
                                  <SelectTrigger><SelectValue placeholder={t("Select type", "प्रकार चुनें")} /></SelectTrigger>
                                  <SelectContent>
                                    {getTypesForCategory(currentRegularItem.categoryId).map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>{isDirectSale ? t("Product Name / Brand", "आइटम का नाम / ब्रांड") : t("Name", "नाम")}</Label>
                                {isDirectSale ? (
                                  <Input value={currentRegularItem.name} onChange={(e) => handleCurrentItemChange("name", e.target.value)} placeholder={t("Enter name", "नाम दर्ज करें")} />
                                ) : (
                                  <Select value={currentRegularItem.productId > 0 ? currentRegularItem.productId.toString() : ""} onValueChange={(v) => handleCurrentItemChange("productId", v)} disabled={!currentRegularItem.categoryId || !currentRegularItem.typeId || productsLoading}>
                                    <SelectTrigger><SelectValue placeholder={t("Select product", "आइटम चुनें")} /></SelectTrigger>
                                    <SelectContent>
                                      {(currentRegularItem.categoryId > 0 && currentRegularItem.typeId > 0 ? products.filter((p: any) => Number(p.category?.id) === Number(currentRegularItem.categoryId) && Number(p.type?.id) === Number(currentRegularItem.typeId)) : []).map((p: any) => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>

                              {/* Quantity / TMT Specific Formats */}
                              {currentRegularItem.categoryName && (currentRegularItem.categoryName.toLowerCase().includes('tmt') || currentRegularItem.categoryName.toLowerCase().includes('steel')) && !currentRegularItem.categoryName.toLowerCase().includes('ring') && getTmtBundleSize(currentRegularItem) ? (
                                <div className="md:col-span-2 flex gap-2">
                                  <div className="flex-1">
                                    <Label>Bundles</Label>
                                    <Input type="number" min="0" value={currentBundleInput.bundles} onChange={e => handleTmtInputChange('bundles', e.target.value)} />
                                  </div>
                                  <div className="flex-1">
                                    <Label>Pieces</Label>
                                    <Input type="number" min="0" value={currentBundleInput.pieces} onChange={e => handleTmtInputChange('pieces', e.target.value)} />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <Label>{t("Quantity", "मात्रा")}</Label>
                                  <div className="flex items-center gap-2">
                                    <Input type="text" value={currentRegularItem.quantity === 0 ? "" : currentRegularItem.quantity} onChange={(e) => { const v = e.target.value; if (/^[0-9./ ]*$/.test(v)) handleCurrentItemChange("quantity", v); }} min="0" />
                                  </div>
                                </div>
                              )}

                              <div>
                                <Label>
                                  {t("Unit", "इकाई")}
                                  <span className="text-red-500 ml-1">*</span>
                                </Label>
                                {!(currentRegularItem.name && currentRegularItem.name.toLowerCase().includes("cement")) && (
                                  <Select value={currentRegularItem.unit} onValueChange={(v) => handleCurrentItemChange("unit", v)} disabled={productsLoading}>
                                    <SelectTrigger><SelectValue placeholder={t("Select unit", "इकाई चुनें")} /></SelectTrigger>
                                    <SelectContent>
                                      {currentRegularItem.categoryName ? getAvailableUnits(currentRegularItem.categoryName).map((u) => (
                                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                      )) : <SelectItem value="placeholder" disabled>{t("Select category first", "पहले श्रेणी चुनें")}</SelectItem>}
                                    </SelectContent>
                                  </Select>
                                )}
                                {!isDirectSale && currentRegularItem.categoryName && (currentRegularItem.categoryName.toLowerCase().includes("sand") || currentRegularItem.categoryName.toLowerCase().includes("chips") || currentRegularItem.categoryName.toLowerCase().includes("stone") || currentRegularItem.categoryName.toLowerCase().includes("soil")) && currentRegularItem.unit && currentRegularItem.unit !== "cft" && (
                                  <div className="mt-3">
                                    <Label className="text-xs text-blue-600">{t("Conversion (CFT/Unit)", "रूपांतरण")}</Label>
                                    <Input type="number" value={currentRegularItem.conversionCft || ""} onChange={(e) => handleCurrentItemChange("conversionCft", e.target.value)} min="0" step="0.01" className="h-8 mt-1 text-sm bg-blue-50/30 border-blue-200" placeholder="Ex: 100" />
                                    {Number(currentRegularItem.conversionCft) > 0 && parseQuantity(currentRegularItem.quantity.toString()) > 0 && (
                                      <div className="text-[10px] font-bold text-blue-700 mt-1">
                                        {t("Total:", "कुल:")} {(parseQuantity(currentRegularItem.quantity.toString()) * Number(currentRegularItem.conversionCft)).toFixed(2)} CFT
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {currentRegularItem.categoryName?.toLowerCase()?.includes("chips") && (
                                <div>
                                  <Label>{t("Size", "साइज़")}<span className="text-red-500 ml-1">*</span></Label>
                                  <Select value={currentRegularItem.size} onValueChange={(v) => handleCurrentItemChange("size", v)} disabled={productsLoading}>
                                    <SelectTrigger><SelectValue placeholder={t("Select size", "साइज़ चुनें")} /></SelectTrigger>
                                    <SelectContent>
                                      {getAvailableChipSizes().map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <div className={isDirectSale ? "block" : "hidden"}>
                                <Label>{t("Purchase Rate", "खरीद दर")}<span className="text-red-500 ml-1">*</span></Label>
                                <Input type="number" value={currentRegularItem.purchasePrice || ""} onChange={(e) => handleCurrentItemChange("purchasePrice", e.target.value)} min="0" step="0.01" />
                              </div>

                              <div>
                                <Label>{isDirectSale ? t("Sell Rate", "बिक्री दर") : t("Price", "कीमत")}</Label>
                                <Input type="number" value={currentRegularItem.price} onChange={(e) => handleCurrentItemChange("price", e.target.value)} min="0" step="0.01" />
                              </div>

                              {/* Add to Cart Button */}
                              <div className="md:col-span-full mt-4 flex flex-col sm:flex-row justify-between sm:justify-end items-center border-t pt-4 gap-4 w-full overflow-hidden">
                                <div className="flex flex-col items-center sm:items-end w-full sm:w-auto text-center sm:text-right">
                                  <div className="flex justify-center sm:justify-end items-center">
                                    <span className="text-gray-500 mr-2">{t("Item Total:", "आइटम कुल:")}</span>
                                    <span className="text-xl font-bold text-gray-800">₹{(parseQuantity(currentRegularItem.quantity.toString()) * (currentRegularItem.price || 0)).toFixed(2)}</span>
                                  </div>
                                  {(() => {
                                    const itemQty = parseQuantity(currentRegularItem.quantity.toString());
                                    const sellTotal = itemQty * (currentRegularItem.price || 0);
                                    const product = products.find((p: any) => Number(p.id) === Number(currentRegularItem.productId));
                                    const rawCost = Number(currentRegularItem.purchasePrice ?? product?.costPrice ?? 0);
                                    let itemCost = rawCost;
                                    const convFactor = (currentRegularItem.conversionCft && Number(currentRegularItem.conversionCft) > 0) ? Number(currentRegularItem.conversionCft) : null;
                                    const isRing = currentRegularItem.categoryName?.toLowerCase()?.includes('ring');
                                    // True bulk CFT materials only — Sand and Chips (stock stored in CFT)
                                    const isBulkCftPreview = currentRegularItem.categoryName?.toLowerCase()?.includes('sand') || currentRegularItem.categoryName?.toLowerCase()?.includes('chips');
                                    // Cement: sold per bag — cost per bag regardless of conversionCft
                                    const isCementPreview = currentRegularItem.categoryName?.toLowerCase()?.includes('cement');
                                    // Bricks: sold per piece — cost per piece regardless of conversionCft
                                    const isBricksPreview = currentRegularItem.categoryName?.toLowerCase()?.includes('brick');

                                    let costPerBaseUnit = rawCost;
                                    const buyConvFactor = product?.latestConversionCft; // null = unknown
                                    // Only compute CFT-based cost for true bulk items (not Cement, not Bricks)
                                    if (!isCementPreview && !isBricksPreview) {
                                      if (buyConvFactor && buyConvFactor > 1 && buyConvFactor !== convFactor) {
                                        // Purchase unit differs from sale unit — normalize to per-CFT
                                        costPerBaseUnit = rawCost / buyConvFactor;
                                      } else if (!buyConvFactor && rawCost > 5000) {
                                        // Unknown purchase unit, cost looks like full-truck price
                                        costPerBaseUnit = rawCost / 400;
                                      } else if (!buyConvFactor) {
                                        costPerBaseUnit = rawCost; // already per-CFT or per-unit
                                      }
                                      // If buyConvFactor === convFactor: rawCost IS the per-unit cost already
                                    }

                                    if (isRing && currentRegularItem.unit === 'piece') {
                                      const bundleSize = getBundleConfig(currentRegularItem.name || "") || 25;
                                      itemCost = rawCost / bundleSize;
                                    } else if (isCementPreview) {
                                      // Cement: cost per bag × quantity (no CFT factor)
                                      itemCost = rawCost;
                                    } else if (isBricksPreview) {
                                      // Bricks: cost per piece × quantity (no CFT factor)
                                      itemCost = rawCost;
                                    } else if (isBulkCftPreview && currentRegularItem.unit === 'cft') {
                                      itemCost = costPerBaseUnit;
                                    } else if (isBulkCftPreview && convFactor) {
                                      // Sand/Chips via tempo/truck — multiply by CFT conversion
                                      itemCost = convFactor * costPerBaseUnit;
                                    } else if (convFactor) {
                                      itemCost = convFactor * costPerBaseUnit;
                                    }

                                    const costTotal = itemQty * itemCost;
                                    const estProfit = sellTotal - costTotal;

                                    return costTotal > 0 ? (
                                      <div className={`text-sm font-medium mt-1 ${estProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {estProfit >= 0 ? 'Est. Profit:' : 'Est. Loss:'} ₹{Math.abs(estProfit).toFixed(2)}
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                                <Button type="button" onClick={handleAddRegularItemToCart} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                                  <PlusCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">{t("Add to Cart", "कार्ट में जोड़ें")}</span>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TMT PRODUCT FORM */}
                      {productType === 'tmt' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <TmtSaleForm
                            t={t}
                            userRole={userRole !== null ? userRole : undefined}
                            loading={loading}
                            isSubmitting={isSubmitting}
                            tmtProducts={tmtProducts}
                            selectedTmtProduct={selectedTmtProduct}
                            setSelectedTmtProduct={setSelectedTmtProduct}
                            tmtQuantity={tmtQuantity}
                            setTmtQuantity={setTmtQuantity}
                            tmtUnit={tmtUnit}
                            setTmtUnit={setTmtUnit}
                            tmtPricePerUnit={tmtPricePerUnit}
                            setTmtPricePerUnit={setTmtPricePerUnit}
                            updateTmtPriceForUnit={updateTmtPriceForUnit}
                            tmtSaleItems={tmtSaleItems}
                            addTmtItemToSale={addTmtItemToSale}
                            removeTmtItem={removeTmtItem}
                          />
                        </div>
                      )}
                    </div>

                    {/* UNIFIED CART TABLE */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800">{t("Current Cart", "वर्तमान कार्ट")}</h3>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                          {saleItems.length + tmtSaleItems.length} {t("Items", "आइटम")}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white border-b">
                            <tr>
                              <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider text-xs">{t("Product", "उत्पाद")}</th>
                              <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider text-xs">{t("Type", "प्रकार")}</th>
                              <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider text-xs">{t("Qty", "मात्रा")}</th>
                              <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider text-xs">{t("Rate", "दर")}</th>
                              <th className="px-6 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider text-xs">{t("Total", "कुल")}</th>
                              <th className="px-6 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {saleItems.length === 0 && tmtSaleItems.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                                  {t("Your cart is empty. Add products above.", "आपका कार्ट खाली है। ऊपर से उत्पाद जोड़ें।")}
                                </td>
                              </tr>
                            )}

                            {/* Regular Items */}
                            {saleItems.map((item, idx) => (
                              <tr key={`reg-${idx}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-800">{item.name}</div>
                                  {item.size && <div className="text-xs text-gray-500">{item.size}</div>}
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                  {item.isDirectSale ? (
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs border border-emerald-100 font-bold">DTC</span>
                                  ) : (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100">Regular</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-medium">{item.quantity}</span> <span className="text-gray-500">{item.unit}</span>
                                  {Number(item.conversionCft) > 0 &&
                                    (item.categoryName?.toLowerCase()?.includes('sand') || item.categoryName?.toLowerCase()?.includes('chips')) && (
                                    <div className="text-[10px] text-blue-600 font-bold mt-1">
                                      {t("Total:", "कुल:")} {(parseQuantity(item.quantity.toString()) * Number(item.conversionCft)).toFixed(2)} CFT
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">₹{Number(item.price).toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-800">
                                  ₹{(parseQuantity(item.quantity.toString()) * (item.price || 0)).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-600 transition">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* TMT Items */}
                            {tmtSaleItems.map((item, idx) => (
                              <tr key={`tmt-${idx}`} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-800">{item.productName}</div>
                                  {item.company && <div className="text-xs text-gray-500">{item.company} {item.size}mm</div>}
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs border border-indigo-100">TMT</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-medium">{item.quantity}</span> <span className="text-gray-500">{item.unitType}</span>
                                </td>
                                <td className="px-6 py-4 text-right">₹{item.pricePerUnit}</td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-800">
                                  ₹{item.totalAmount.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button type="button" onClick={() => removeTmtItem(idx)} className="text-gray-400 hover:text-red-600 transition">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>


                  {/* Global Unified Checkout Section */}
                  <div className="space-y-8 bg-gray-50 p-6 rounded-xl border">

                    {/* Payment Method */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t("Payment Information", "भुगतान की जानकारी")}</h3>

                      {/* Payment method descriptions */}
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Cash:</strong> {t("Full payment in cash", "नकद में पूर्ण भुगतान")}</p>
                        <p><strong>Online/Card:</strong> {t("Payment via card, UPI, or online", "कार्ड, UPI, या ऑनलाइन के माध्यम से भुगतान")}</p>
                        <p><strong>Loan/Credit:</strong> {t("No payment now, full amount due", "अभी कोई भुगतान नहीं, पूरी राशि बकाया")}</p>
                        <p><strong>Partial:</strong> {t("Partial payment now, remaining due", "अभी आंशिक भुगतान, शेष बकाया")}</p>
                      </div>

                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cash" id="cash" />
                            <Label htmlFor="cash" className="cursor-pointer flex-1 py-2">{t("Cash", "कैश")}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="online" id="online" />
                            <Label htmlFor="online" className="cursor-pointer flex-1 py-2">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="loan" id="loan" />
                            <Label htmlFor="loan" className="cursor-pointer flex-1 py-2">{t("Loan/Credit", "उधार/क्रेडिट")}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="partial" id="partial" />
                            <Label htmlFor="partial" className="cursor-pointer flex-1 py-2">{t("Partial", "आंशिक")}</Label>
                          </div>
                        </div>
                      </RadioGroup>

                      {paymentMethod === "partial" && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="partialAmount">{t("Partial Amount", "आंशिक राशि")}</Label>
                            <Input
                              id="partialAmount"
                              type="number"
                              value={partialAmount}
                              onChange={(e) => setPartialAmount(Number(e.target.value) || 0)}
                              min="0"
                              max={finalAmount}
                              step="0.01"
                            />
                            <p className="text-sm text-gray-600 mt-1">
                              {t("Due Amount", "बकाया राशि")}: ₹{(finalAmount - partialAmount).toFixed(2)}
                            </p>
                          </div>

                          <div>
                            <Label>{t("How did you receive this partial payment?", "आपने यह आंशिक भुगतान कैसे प्राप्त किया?")}</Label>
                            <RadioGroup value={partialPaymentMethod} onValueChange={setPartialPaymentMethod}>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="cash" id="partial-cash" />
                                  <Label htmlFor="partial-cash" className="cursor-pointer flex-1 py-2">{t("Cash", "कैश")}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="online" id="partial-online" />
                                  <Label htmlFor="partial-online" className="cursor-pointer flex-1 py-2">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="upi" id="partial-upi" />
                                  <Label htmlFor="partial-upi" className="cursor-pointer flex-1 py-2">{t("UPI", "यूपीआई")}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="cheque" id="partial-cheque" />
                                  <Label htmlFor="partial-cheque" className="cursor-pointer flex-1 py-2">{t("Cheque", "चेक")}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="bank_transfer" id="partial-bank" />
                                  <Label htmlFor="partial-bank" className="cursor-pointer flex-1 py-2">{t("Bank Transfer", "बैंक ट्रांसफर")}</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Discount and Tax */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t("Discount and Tax", "छूट और कर")}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label>{t("Discount", "छूट")}</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              value={discount}
                              onChange={e => setDiscount(Number(e.target.value))}
                              min="0"
                              step="0.01"
                              className="w-24"
                            />
                            <Select value={discountType} onValueChange={v => setDiscountType(v as 'flat' | 'percent')}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat">₹</SelectItem>
                                <SelectItem value="percent">%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>{t("Tax (%)", "कर (%)")}</Label>
                          <Input
                            type="number"
                            value={tax}
                            onChange={e => setTax(Number(e.target.value))}
                            min="0"
                            step="0.01"
                            className="w-24"
                          />
                        </div>
                        <div>
                          <Label>{t("Profit/Loss", "लाभ/हानि")}</Label>
                          <div className={profit < 0 ? "text-red-600 font-bold" : "text-green-700 font-bold"}>
                            {profit < 0 ? t("Loss:", "हानि:") : t("Profit:", "लाभ:")} ₹{profit.toFixed(2)}
                            <span className="ml-2 text-xs text-gray-500" title={t("Profit is calculated before tax. Tax is not included in profit.", "लाभ कर से पहले की गणना है। कर लाभ में शामिल नहीं है।")}>ⓘ</span>
                          </div>
                          {profit < 0 && (
                            <div className="text-xs text-red-600">{t("Warning: This sale is at a loss!", "चेतावनी: यह बिक्री हानि में है!")}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transport Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t("Transport Details", "परिवहन विवरण")}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border p-4 rounded-lg bg-gray-50/50">
                        <div>
                          <Label htmlFor="transportFare">{t("Transport Fare", "परिवहन शुल्क")}</Label>
                          <Input
                            id="transportFare"
                            type="number"
                            value={transportFare}
                            onChange={e => setTransportFare(Number(e.target.value))}
                            min="0"
                            step="0.01"
                            placeholder="₹ 0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vehicleNumber">{t("Vehicle Number", "गाड़ी नंबर")}</Label>
                          <Input
                            id="vehicleNumber"
                            value={vehicleNumber}
                            onChange={e => setVehicleNumber(e.target.value)}
                            placeholder="UP 32 XX 0000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="driverName">{t("Driver Name", "ड्राइवर का नाम")}</Label>
                          <Input
                            id="driverName"
                            value={driverName}
                            onChange={e => setDriverName(e.target.value)}
                            placeholder={t("Enter driver name", "ड्राइवर का नाम दर्ज करें")}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="space-y-2 mt-6">
                      <div className="flex justify-between text-base">
                        <span>{t("Subtotal", "उप-योग")}</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span>{t("Discount", "छूट")}</span>
                        <span>- ₹{discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span>{t("CGST", "सीजीएसटी")}</span>
                        <span>+ ₹{cgstAmount.toFixed(2)} ({cgstPercent}%)</span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span>{t("SGST", "एसजीएसटी")}</span>
                        <span>+ ₹{sgstAmount.toFixed(2)} ({sgstPercent}%)</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>{t("Total Bill", "कुल बिल")}</span>
                        <span>₹{finalAmount.toFixed(2)}</span>
                      </div>

                      {/* Payment breakdown based on payment method */}
                      {(() => {
                        let paymentMethodLabel = '-';
                        const allowedPartials = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'online'];
                        const paid = paymentMethod === 'partial' ? partialAmount : (paymentMethod === 'cash' || paymentMethod === 'online') ? finalAmount : 0;
                        const due = finalAmount - paid;
                        if (paid > 0 && due > 0 && paymentMethod === 'partial') {
                          const method = (partialPaymentMethod || '').toLowerCase();
                          let methodLabel = '';
                          if (allowedPartials.includes(method)) {
                            switch (method) {
                              case 'cash': methodLabel = t('Cash', 'कैश'); break;
                              case 'upi': methodLabel = t('UPI', 'यूपीआई'); break;
                              case 'card': methodLabel = t('Card', 'कार्ड'); break;
                              case 'bank_transfer': methodLabel = t('Bank Transfer', 'बैंक ट्रांसफर'); break;
                              case 'cheque': methodLabel = t('Cheque', 'चेक'); break;
                              case 'online': methodLabel = t('Online/Card', 'ऑनलाइन/कार्ड'); break;
                              default: methodLabel = method ? method.charAt(0).toUpperCase() + method.slice(1) : '-';
                            }
                            paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
                          } else {
                            paymentMethodLabel = t('Partial', 'आंशिक');
                          }
                        } else if (due === 0) {
                          paymentMethodLabel = t('Full Payment', 'पूर्ण भुगतान');
                        } else if (paid === 0 && due > 0 && paymentMethod === 'loan') {
                          paymentMethodLabel = t('Loan/Credit', 'ऋण/क्रेडिट');
                        } else if (paymentMethod) {
                          paymentMethodLabel = t(paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1), paymentMethod === 'cash' ? 'कैश' : paymentMethod === 'upi' ? 'यूपीआई' : paymentMethod);
                        }
                        return (
                          <Fragment>
                            <div className="flex justify-between text-base">
                              <span>{t('Payment Method', 'भुगतान प्रकार')}</span>
                              <span>{paymentMethodLabel}</span>
                            </div>
                            {paymentMethod === 'partial' && (
                              <Fragment>
                                <div className="flex justify-between text-base">
                                  <span>{t('Paid Amount', 'भुगतान की गई राशि')}</span>
                                  <span className="text-green-600 font-semibold">₹{partialAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-base">
                                  <span>{t('Due Amount', 'बकाया राशि')}</span>
                                  <span className="text-red-600 font-semibold">₹{(finalAmount - partialAmount).toFixed(2)}</span>
                                </div>
                              </Fragment>
                            )}
                          </Fragment>
                        );
                      })()}
                    </div>

                    {/* General Date Picker for SUPER DUPER ADMIN */}
                    {userRole === 'SUPER_DUPER_ADMIN' && (
                      <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-4">
                        <Label htmlFor="generalCustomSaleDate" className="text-red-700 font-bold mb-2 block">
                          {t("Override Sale Date (Admin Only)", "बिक्री तिथि (केवल एडमिन)")}
                        </Label>
                        <Input
                          id="generalCustomSaleDate"
                          type="date"
                          value={customSaleDate}
                          onChange={(e) => setCustomSaleDate(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                    )}

                    {/* Bill Summary */}
                    {/* Submit Button */}
                    <div className="sticky bottom-4 z-10 pt-4 bg-white/80 backdrop-blur-sm -mx-4 px-4 border-t mt-4 md:static md:bg-transparent md:p-0 md:m-0 md:border-0 shadow-lg md:shadow-none pb-4 md:pb-0 safe-pb-4">
                      <Button
                        type="submit"
                        className="w-full h-14 text-lg font-bold shadow-md"
                        disabled={
                          isSubmitting ||
                          (customerType === 'existing' && !selectedCustomer) ||
                          (customerType === 'new' && !newCustomer.name) ||
                          (saleItems.length === 0 && tmtSaleItems.length === 0) ||
                          saleItems.some(item =>
                            (item.isDirectSale ? !item.name : !item.productId) ||
                            !item.unit ||
                            !item.quantity ||
                            parseQuantity(item.quantity.toString()) <= 0
                          )
                        }
                      >
                        {isSubmitting ? t("Creating Sale...", "बिक्री बनाई जा रही है...") : t("Create Sale", "बिक्री बनाएं")}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Print Prompt Dialog */}
          {showPrintPrompt && (
            <Dialog open={showPrintPrompt} onOpenChange={(open) => {
              if (!open) {
                setShowPrintPrompt(false);
                setBillType(null);
                setShowBillModal(false);
                resetForm();
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Do you want to print the bill?", "क्या आप बिल प्रिंट करना चाहते हैं?")}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-4 mt-4">
                  <Button className="flex-1" onClick={() => { setShowPrintPrompt(false); setShowBillModal(true); }}>
                    {t("Yes", "हाँ")}
                  </Button>
                  <Button className="flex-1" variant="outline" onClick={() => {
                    setShowPrintPrompt(false);
                    setBillType(null);
                    setShowBillModal(false);
                    resetForm();
                  }}>
                    {t("No", "नहीं")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Bill Modal */}
          {showBillModal && (
            <Dialog open={showBillModal} onOpenChange={(open) => {
              if (!open) {
                setShowBillModal(false);
                resetForm();
              }
            }}>
              <DialogContent>
                {!billType ? (
                  <div className="space-y-4">
                    <DialogHeader>
                      <DialogTitle>{t("Print Bill", "बिल प्रिंट करें")}</DialogTitle>
                    </DialogHeader>
                    {/* Only show Proper Bill option if tax details are entered */}
                    {tax > 0 ? (
                      <Fragment>
                        <Button onClick={() => setBillType("proper")} className="w-full">
                          {t("Proper Bill", "प्रॉपर बिल")} {t("(With Tax)", "(टैक्स के साथ)")}
                        </Button>
                        <Button onClick={() => setBillType("normal")} className="w-full" variant="outline">
                          {t("Normal Bill", "साधारण बिल")}
                        </Button>
                      </Fragment>
                    ) : (
                      <Fragment>
                        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-700 mb-2">
                            {t("No tax details entered", "कोई टैक्स विवरण नहीं दिया गया")}
                          </p>
                          <p className="text-xs text-blue-600">
                            {t("Only Normal Bill is available", "केवल साधारण बिल उपलब्ध है")}
                          </p>
                        </div>
                        <Button onClick={() => setBillType("normal")} className="w-full">
                          {t("Print Normal Bill", "साधारण बिल प्रिंट करें")}
                        </Button>
                      </Fragment>
                    )}
                  </div>
                ) : (
                  <div>
                    {billType === "proper" && lastSaleData && (
                      <ProperBillPrint
                        sale={lastSaleData}
                        onClose={() => {
                          setShowBillModal(false)
                          resetForm()
                        }}
                        userRole={userRole !== null ? userRole : undefined}
                      />
                    )}
                    {billType === "normal" && lastSaleData && (
                      <NormalBillPrint
                        sale={lastSaleData}
                        onClose={() => {
                          setShowBillModal(false)
                          resetForm()
                        }}
                        userRole={userRole !== null ? userRole : undefined}
                      />
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      );
    }

    export default AddSalePage;

