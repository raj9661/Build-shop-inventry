"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { MobileNav } from "@/components/mobile-nav"
import { ShopSelector } from "../components/shop-selector"
import { PlusCircle, Trash2, Search, User, Plus, Phone, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { salesService, type CreateSaleData } from "../lib/services/salesService"
import { useShop } from "../contexts/ShopContext"
import ProperBillPrint from "./ProperBillPrint"
import NormalBillPrint from "./NormalBillPrint"
import { getAvailableTmtUnits, formatTmtQuantity, getWeightPerPiece, getBundleConfig, convertToKg, getAvailableChipSizes, getAvailableUnits } from "../lib/tmtUtils"

type SaleItem = { categoryId: number; categoryName: string; typeId: number; typeName: string; productId: number; name: string; quantity: number; price: number; unit: string; size: string; stockType?: 'normal' | 'damaged' }

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
  const [loading, setLoading] = useState(true)

  // State for sale
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{
    categoryId: 0,
    categoryName: "",
    typeId: 0,
    typeName: "",
    productId: 0,
    name: "",
    quantity: 1,
    price: 0,
    unit: "",
    size: "",
    stockType: undefined
  }])
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
        totalAmount: parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit)
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
    if (!selectedTmtProduct || !tmtQuantity || !tmtPricePerUnit) {
      toast.error('Please fill in all TMT product details')
      return
    }

    // Validate price is set
    if (parseFloat(tmtPricePerUnit) <= 0) {
      toast.error('Please enter a valid selling price')
      return
    }

    if (!selectedCustomer && customerType === 'existing') {
      toast.error('Please select a customer')
      return
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token')
      }

      // Calculate total amount
      const totalAmount = finalAmount

      // Create TMT sale item from current selection
      const tmtSaleItem = {
        productId: selectedTmtProduct.id,
        productName: selectedTmtProduct.productName,
        company: selectedTmtProduct.company?.name,
        size: selectedTmtProduct.size?.sizeMm,
        quantity: parseFloat(tmtQuantity),
        unitType: tmtUnit,
        pricePerUnit: parseFloat(tmtPricePerUnit),
        totalAmount: parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit)
      }

      // Create TMT sale
      const response = await fetch('/api/tmt/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedTmtProduct.id,
          soldQuantity: parseFloat(tmtQuantity),
          unitType: tmtUnit,
          pricePerUnit: parseFloat(tmtPricePerUnit),
          saleDate: new Date().toISOString(),
          customerName: customerType === 'new' ? newCustomer.name : selectedCustomer?.name,
          shopId: currentShopId,
          paymentMethod: paymentMethod,
          paidAmount: paymentMethod === 'partial' ? partialAmount : totalAmount,
          partialPaymentMethod: paymentMethod === 'partial' ? partialPaymentMethod : null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create TMT sale')
      }


      const result = await response.json()

      // Show payment status in success message
      const paymentStatusMsg = result.data?.paymentStatus === 'PARTIAL'
        ? ` | Paid: ₹${result.data?.paidAmount || 0}, Due: ₹${result.data?.dueAmount || 0}`
        : ''
      toast.success(`TMT sale completed successfully!${paymentStatusMsg}`)

      // Prepare sale data for print bill
      const tmtSaleData = {
        billNo: result.data?.saleId,
        date: new Date().toISOString(),
        shop: currentShop,
        customerName: customerType === 'new' ? newCustomer.name : selectedCustomer?.name,
        totalAmount: totalAmount,
        finalAmount: totalAmount,
        payment_type: paymentMethod,
        paid_amount: paymentMethod === 'partial' ? partialAmount : totalAmount,
        dueAmount: result.data?.dueAmount || 0,
        paymentStatus: result.data?.paymentStatus || 'PAID',
        items: [{
          ...tmtSaleItem,
          name: tmtSaleItem.productName
        }]
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

    fetchCategories()
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
  )

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

  const getTypesForCategory = (categoryId: number) => {
    // Build types from products data since categories API doesn't include types
    console.log('🔍 [AddSale] getTypesForCategory called with categoryId:', categoryId, 'type:', typeof categoryId);

    // Return empty array if categoryId is invalid (0 or undefined)
    if (!categoryId || categoryId === 0) {
      console.log('🔍 [AddSale] getTypesForCategory - invalid categoryId, returning empty array');
      return [];
    }

    const categoryProducts = products.filter((p: any) => Number(p.category?.id) === Number(categoryId))
    console.log('🔍 [AddSale] getTypesForCategory - categoryProducts found:', categoryProducts.length);
    console.log('🔍 [AddSale] getTypesForCategory - categoryProducts:', categoryProducts.map(p => ({
      id: p.id,
      name: p.name,
      categoryId: p.category?.id,
      typeId: p.type?.id,
      typeName: p.type?.name
    })));

    const typesMap = new Map()
    categoryProducts.forEach((product: any) => {
      if (product.type && product.type.id) {
        typesMap.set(product.type.id, product.type)
      }
    })
    const types = Array.from(typesMap.values())
    console.log('🔍 [AddSale] getTypesForCategory - returning types:', types.length, types.map(t => t.name));
    return types
  }

  const handleAddItem = () => {
    setSaleItems([...saleItems, {
      categoryId: 0,
      categoryName: "",
      typeId: 0,
      typeName: "",
      productId: 0,
      name: "",
      quantity: 1,
      price: 0,
      unit: "",
      size: "",
      stockType: undefined
    }])
  }

  const handleItemChange = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...saleItems]
    if (field === "unit") {
      newItems[index].unit = value
      // Robust TMT bar detection: check categoryName, typeName, and product name
      const item = newItems[index]
      const isTmt = [item.categoryName, item.typeName, item.name].some(
        v => typeof v === 'string' && v.toLowerCase().includes('tmt')
      )
      const bundleSize = getTmtBundleSize(item)
      const product = products.find((p: any) => p.id === item.productId)
      const bundlePrice = product?.price || 0
      // Debug log
      console.log('TMT DEBUG:', {
        categoryName: item.categoryName,
        typeName: item.typeName,
        name: item.name,
        bundleSize,
        bundlePrice,
        isTmt,
        unit: value
      })
      if (isTmt) {
        if (!bundleSize) {
          toast.error('No bundle size found for this TMT type!')
        }
        if (!bundlePrice) {
          toast.error('No bundle price found for this TMT product!')
        }
      }
      if (isTmt && bundleSize && bundlePrice) {
        if (value === "piece") {
          newItems[index].price = Number((bundlePrice / bundleSize).toFixed(2))
        } else if (value === "bundle") {
          newItems[index].price = Number(bundlePrice)
        }
      }
      // Cement logic (existing)
      if (item.name && item.name.toLowerCase().includes("cement")) {
        if (value === "kg") {
          newItems[index].stockType = "damaged";
        } else if (value === "bag" || value === "bags") {
          newItems[index].stockType = "normal";
        }
      }
    } else if (field === "categoryId") {
      const category = categories.find((c: any) => Number(c.id) === parseInt(value))
      if (category) {
        newItems[index] = {
          ...newItems[index],
          categoryId: Number(category.id),
          categoryName: category.name,
          typeId: 0,
          typeName: "",
          productId: 0,
          name: "",
          price: 0,
          unit: category.name.toLowerCase().includes("ring") ? "bundle" : ""
        }
      }
    } else if (field === "typeId") {
      console.log('🔍 [AddSale] Type selection - value:', value, 'categoryId:', newItems[index].categoryId);
      console.log('🔍 [AddSale] Type selection - value type:', typeof value, 'parsed:', parseInt(value));

      const availableTypes = getTypesForCategory(newItems[index].categoryId);
      console.log('🔍 [AddSale] Type selection - available types:', availableTypes.map(t => ({ id: t.id, name: t.name })));

      // Convert value to number and compare with type.id (which might be BigInt)
      const typeIdToFind = parseInt(value);
      const type = availableTypes.find((t: any) => Number(t.id) === typeIdToFind);
      console.log('🔍 [AddSale] Type selection - found type:', type);

      if (type) {
        const updatedItem = {
          ...newItems[index],
          typeId: Number(type.id), // Ensure typeId is a number
          typeName: type.name,
          productId: 0,
          name: "",
          price: 0,
          unit: ""
        };
        newItems[index] = updatedItem;
        console.log('🔍 [AddSale] Type selection - updated item:', updatedItem);
        console.log('🔍 [AddSale] Type selection - newItems array:', newItems);
      } else {
        console.log('❌ [AddSale] Type selection - type not found for value:', value);
      }
    } else if (field === "productId") {
      console.log('🔍 [AddSale] Product selection - value:', value, 'products count:', products.length);
      const product = products.find((p: any) => Number(p.id) === parseInt(value))
      console.log('🔍 [AddSale] Found product:', product);
      if (product) {
        // For sand and chips category or TMT bars, don't auto-set unit, let user choose
        const isSandChipsCategory = product.category?.name?.toLowerCase().includes("sand") ||
          product.category?.name?.toLowerCase().includes("chips")
        const isTMTBarCategory = product.category?.name?.toLowerCase().includes("tmt") ||
          product.category?.name?.toLowerCase().includes("steel")
        // Use dailyRate if available, else fallback to static price
        const defaultPrice = product.dailyRate !== null && product.dailyRate !== undefined ? Number(product.dailyRate) : Number(product.price);
        console.log('🔍 [AddSale] Product price - dailyRate:', product.dailyRate, 'price:', product.price, 'price type:', typeof product.price, 'defaultPrice:', defaultPrice);
        newItems[index] = {
          ...newItems[index],
          productId: Number(product.id),
          name: product.name,
          price: defaultPrice,
          unit: (isSandChipsCategory || isTMTBarCategory) ? newItems[index].unit || "" : (product.unit || newItems[index].unit || ""), // auto-set unit if not already set
          categoryId: Number(product.category?.id),
          categoryName: product.category?.name,
          typeId: Number(product.type?.id),
          typeName: product.type?.name
        }
        console.log('🔍 [AddSale] Updated item:', newItems[index]);
      }
    } else if (field === "quantity") {
      // If TMT and unit is piece, just update quantity
      const quantityValue = value === "" ? 0 : Number.parseInt(value) || 0

      // Check stock availability
      if (newItems[index].productId) {
        const product = products.find((p: any) => Number(p.id) === Number(newItems[index].productId))
        if (product && product.stockQuantity !== null && product.stockQuantity !== undefined) {
          const availableStock = Number(product.stockQuantity) || 0
          if (quantityValue > availableStock) {
            toast.error(`Insufficient stock! Available: ${availableStock} ${product.unit || ''}. You entered: ${quantityValue}`)
            return // Don't update quantity if it exceeds stock
          }
        }
      }

      newItems[index].quantity = quantityValue
    } else if (field === "price") {
      newItems[index].price = value === "" ? 0 : Number.parseFloat(value) || 0
    } else if (field === "stockType") {
      newItems[index].stockType = value as 'normal' | 'damaged'
    } else {
      (newItems[index] as any)[field] = value
    }
    setSaleItems(newItems)
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

  // Update TMT bundle/piece input and total pieces
  const handleTmtInputChange = (index: number, field: 'bundles' | 'pieces', value: string) => {
    setTmtBundleInputs(prev => {
      const prevItem = prev[index] || { bundles: '', pieces: '', totalPieces: 0, bundleSize: getTmtBundleSize(saleItems[index]) };
      const bundleSize = getTmtBundleSize(saleItems[index]);
      const bundles = field === 'bundles' ? value : prevItem.bundles;
      const pieces = field === 'pieces' ? value : prevItem.pieces;
      const totalPieces = bundleSize ? (parseInt(bundles) || 0) * bundleSize + (parseInt(pieces) || 0) : 0;
      // Update saleItems quantity as well
      handleItemChange(index, 'quantity', totalPieces.toString());
      return { ...prev, [index]: { bundles, pieces, totalPieces, bundleSize } };
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

    console.log('🔄 [AddSale] Form reset completed')
  }

  // Calculate totals
  const subtotal = isTmtMode
    ? (selectedTmtProduct && tmtQuantity && tmtPricePerUnit ? parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit) : 0)
    : saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount
  const cgstPercent = tax / 2
  const sgstPercent = tax / 2
  const cgstAmount = ((subtotal - discountAmount) * cgstPercent) / 100
  const sgstAmount = ((subtotal - discountAmount) * sgstPercent) / 100
  const finalAmount = subtotal - discountAmount + cgstAmount + sgstAmount

  // Use finalAmount for payment calculations
  const amountPaid = paymentMethod === "partial" ? partialAmount :
    paymentMethod === "loan" ? 0 : finalAmount
  const dueAmount = finalAmount - amountPaid
  const totalCost = isTmtMode
    ? (selectedTmtProduct && tmtQuantity ? (() => {
      const quantity = parseFloat(tmtQuantity)
      const costPerKg = selectedTmtProduct.costPricePerKg || 0
      const requiredKg = convertToKg(quantity, tmtUnit as any, selectedTmtProduct)
      return costPerKg * requiredKg
    })() : 0)
    : saleItems.reduce((sum, item) => {
      const product = products.find((p: any) => Number(p.id) === Number(item.productId))
      const itemQty = Number(item.quantity) || 0
      const itemCost = Number(product?.costPrice ?? 0)
      return sum + (itemQty * itemCost)
    }, 0)
  const profit = (subtotal - discountAmount) - totalCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) {
      toast.error(t("Please select or create a customer", "कृपया ग्राहक चुनें या बनाएं"))
      return
    }
    if (saleItems.length === 0 || saleItems.every(item => !item.categoryId || !item.typeId || !item.productId)) {
      toast.error(t("Please add at least one item with category, type, and product", "कृपया कम से कम एक आइटम श्रेणी, प्रकार और नाम के साथ जोड़ें"))
      return
    }

    // Check if sand and chips items have units selected
    const sandChipsItemsWithoutUnit = saleItems.filter(item =>
      item.categoryId && item.typeId && item.productId &&
      (item.categoryName.toLowerCase().includes("sand") || item.categoryName.toLowerCase().includes("chips")) &&
      !item.unit
    )

    if (sandChipsItemsWithoutUnit.length > 0) {
      toast.error(t("Please select units for sand and chips items", "कृपया रेत और चिप्स के लिए इकाई चुनें"))
      return
    }

    // Check if TMT bar items have units selected
    const tmtItemsWithoutUnit = saleItems.filter(item =>
      item.categoryId && item.typeId && item.productId &&
      (item.categoryName.toLowerCase().includes("tmt") || item.categoryName.toLowerCase().includes("steel")) &&
      !item.unit
    )

    if (tmtItemsWithoutUnit.length > 0) {
      toast.error(t("Please select units for TMT bar items", "कृपया TMT बार के लिए इकाई चुनें"))
      return
    }

    // Check if chip items have sizes selected
    const chipItemsWithoutSize = saleItems.filter(item =>
      item.categoryId && item.typeId && item.productId &&
      item.categoryName.toLowerCase().includes("chips") &&
      !item.size
    )

    if (chipItemsWithoutSize.length > 0) {
      toast.error(t("Please select sizes for chip items", "चिप्स के लिए साइज़ चुनें"))
      return
    }

    if (paymentMethod === "partial" && partialAmount >= finalAmount) {
      toast.error(t("Partial amount should be less than total amount", "आंशिक राशि कुल राशि से कम होनी चाहिए"))
      return
    }

    // Check stock availability for all items
    for (const item of saleItems.filter(item => item.categoryId && item.typeId && item.productId)) {
      const product = products.find((p: any) => Number(p.id) === Number(item.productId))
      if (product && product.stockQuantity !== null && product.stockQuantity !== undefined) {
        const availableStock = Number(product.stockQuantity) || 0
        const requestedQty = Number(item.quantity) || 0
        if (requestedQty > availableStock) {
          toast.error(`Insufficient stock for ${item.name}! Available: ${availableStock} ${product.unit || ''}, Requested: ${requestedQty}`)
          setIsSubmitting(false)
          return
        }
      }
    }

    setIsSubmitting(true)
    try {
      const saleDate = new Date().toISOString()
      const saleData: any = {
        customerId: selectedCustomer?.id,
        shopId: currentShopId,
        saleDate,
        totalAmount: subtotal,
        finalAmount,
        discount: discountAmount,
        cgst: cgstAmount,
        sgst: sgstAmount,
        items: saleItems.filter(item => item.categoryId && item.typeId && item.productId).map(item => {
          console.log('🔍 [AddSale] Mapping item for sale:', { productId: item.productId, name: item.name, quantity: item.quantity });
          if (item.name && item.name.toLowerCase().includes("cement") && item.unit === "kg") {
            return {
              ...item,
              stockType: "damaged",
              quantity: item.quantity,
              unit: "kg",
              unitPrice: item.price, // Add unitPrice for Prisma
              price_per_unit: item.price // Add price_per_unit for backend compatibility
            };
          }
          return {
            ...item,
            unitPrice: item.price, // Add unitPrice for Prisma
            price_per_unit: item.price // Add price_per_unit for backend compatibility
          };
        }),
        payment_type: paymentMethod as "cash" | "online" | "loan" | "partial",
        paid_amount: amountPaid,
        partial_payment_method: paymentMethod === "partial" ? partialPaymentMethod : null
      }

      console.log('🔍 [AddSale] Final sale data being sent:', saleData);
      // If it's a new customer, include customer info
      if (customerType === "new") {
        saleData.customerInfo = {
          name: selectedCustomer?.name,
          phone: selectedCustomer?.phone,
          address: selectedCustomer?.address
        }
        delete saleData.customerId // Remove customerId when creating new customer
      }
      const result = await salesService.createSale(saleData)
      if (result) {
        toast.success(t("Sale created successfully!", "बिक्री सफलतापूर्वक बनाई गई!"))
        setLastSaleData({ ...saleData, billNo: result.id, date: result.date, shop: currentShop, payment_type: paymentMethod, paid_amount: amountPaid, finalAmount })
        setShowPrintPrompt(true)
        // Notify dashboard components to refresh active/completed lists
        // Use multiple methods to ensure the refresh happens
        try {
          // Method 1: Custom event on window
          const event = new CustomEvent('sale:created', {
            detail: { shopId: currentShopId, saleId: result.id },
            bubbles: true,
            cancelable: true
          });
          window.dispatchEvent(event);
          document.dispatchEvent(event);
          console.log('📢 [AddSale] Dispatched sale:created event:', { shopId: currentShopId, saleId: result.id });

          // Method 2: Store in localStorage as fallback
          localStorage.setItem('sale:created', JSON.stringify({
            shopId: currentShopId,
            saleId: result.id,
            timestamp: Date.now()
          }));
          console.log('💾 [AddSale] Stored sale creation in localStorage');

          // Method 3: Clear session storage cache
          sessionStorage.removeItem('prefetchedDashboardData');
        } catch (error) {
          console.error('❌ [AddSale] Error notifying sale creation:', error);
        }

        // Refresh products to update inventory quantities
        console.log('🔄 [AddSale] Refreshing products after sale creation...');
        await fetchProducts();

        // Reset form
        setSaleItems([{
          categoryId: 0,
          categoryName: "",
          typeId: 0,
          typeName: "",
          productId: 0,
          name: "",
          quantity: 1,
          price: 0,
          unit: "",
          size: "",
          stockType: undefined
        }])
        setPartialAmount(0)
        setPartialPaymentMethod("cash")
        setPaymentMethod("cash")
        setSelectedCustomer(null)
        setSearchTerm("")
        setCustomerType("existing")
        // Clear dashboard cache in sessionStorage so dashboard always fetches fresh data
        sessionStorage.removeItem('prefetchedDashboardData');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Mobile Navigation */}
      <MobileNav />

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
                    <Label htmlFor="existing">{t("Existing Customer", "मौजूदा ग्राहक")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new">{t("New Customer", "नया ग्राहक")}</Label>
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

              {/* TMT Mode Toggle */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <Button
                  type="button"
                  variant={!isTmtMode ? "default" : "outline"}
                  onClick={() => setIsTmtMode(false)}
                  className="px-6 py-2"
                >
                  Regular Sale
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
                /* TMT Sale Form */
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">TMT Bar Sale</h3>

                  {/* TMT Product Selection */}
                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-gray-800">TMT Product</Label>
                    <Select
                      value={selectedTmtProduct?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const product = tmtProducts.find(p => p.id.toString() === value)
                        setSelectedTmtProduct(product)
                        // Auto-populate price based on current unit
                        if (product) {
                          updateTmtPriceForUnit(product, tmtUnit)
                        }
                      }}
                      disabled={loading}
                    >
                      <SelectTrigger className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50">
                        <SelectValue placeholder="Select TMT Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {tmtProducts.map((product: any) => (
                          <SelectItem key={product.id} value={product.id.toString()} className="text-base py-3">
                            {product.productName} - {product.company?.name} ({product.size?.sizeMm}mm)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity, Unit, and Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tmtQuantity}
                        onChange={(e) => setTmtQuantity(e.target.value)}
                        className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
                        placeholder="Enter quantity"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">Unit</Label>
                      <Select
                        value={tmtUnit}
                        onValueChange={(unit) => {
                          setTmtUnit(unit)
                          // Update price when unit changes
                          if (selectedTmtProduct) {
                            updateTmtPriceForUnit(selectedTmtProduct, unit)
                          }
                        }}
                      >
                        <SelectTrigger className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableTmtUnits().map((unit) => (
                            <SelectItem key={unit.value} value={unit.value} className="text-base py-3">
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-lg font-medium text-gray-800">Price per Unit (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tmtPricePerUnit}
                        onChange={(e) => setTmtPricePerUnit(e.target.value)}
                        className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
                        placeholder="Auto-filled from inventory"
                        required
                      />
                      {selectedTmtProduct && (
                        <p className="text-xs text-gray-500">
                          Price auto-filled from inventory. You can modify if needed.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* TMT Sale Summary */}
                  {selectedTmtProduct && tmtQuantity && tmtPricePerUnit && (
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-lg font-semibold">Sale Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{selectedTmtProduct.productName}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedTmtProduct.company?.name} ({selectedTmtProduct.size?.sizeMm}mm) - {formatTmtQuantity(parseFloat(tmtQuantity), tmtUnit as any, selectedTmtProduct)}
                        </div>
                        <div className="text-sm text-gray-600">₹{tmtPricePerUnit} per {tmtUnit}</div>
                        <div className="text-right text-lg font-semibold">
                          Total: ₹{(parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method for TMT Sale */}
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
                          <RadioGroupItem value="cash" id="tmt-cash" />
                          <Label htmlFor="tmt-cash">{t("Cash", "कैश")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="online" id="tmt-online" />
                          <Label htmlFor="tmt-online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="loan" id="tmt-loan" />
                          <Label htmlFor="tmt-loan">{t("Loan/Credit", "उधार/क्रेडिट")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partial" id="tmt-partial" />
                          <Label htmlFor="tmt-partial">{t("Partial", "आंशिक")}</Label>
                        </div>
                      </div>
                    </RadioGroup>

                    {paymentMethod === "partial" && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="tmt-partialAmount">{t("Partial Amount", "आंशिक राशि")}</Label>
                          <Input
                            id="tmt-partialAmount"
                            type="number"
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(Number(e.target.value) || 0)}
                            min="0"
                            max={tmtSaleItems.reduce((sum, item) => sum + item.totalAmount, 0)}
                            step="0.01"
                          />
                          <p className="text-sm text-gray-600 mt-1">
                            {t("Due Amount", "बकाया राशि")}: ₹{(tmtSaleItems.reduce((sum, item) => sum + item.totalAmount, 0) - partialAmount).toFixed(2)}
                          </p>
                        </div>

                        <div>
                          <Label>{t("How did you receive this partial payment?", "आपने यह आंशिक भुगतान कैसे प्राप्त किया?")}</Label>
                          <RadioGroup value={partialPaymentMethod} onValueChange={setPartialPaymentMethod}>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cash" id="tmt-partial-cash" />
                                <Label htmlFor="tmt-partial-cash">{t("Cash", "कैश")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="online" id="tmt-partial-online" />
                                <Label htmlFor="tmt-partial-online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="upi" id="tmt-partial-upi" />
                                <Label htmlFor="tmt-partial-upi">{t("UPI", "यूपीआई")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cheque" id="tmt-partial-cheque" />
                                <Label htmlFor="tmt-partial-cheque">{t("Cheque", "चेक")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="bank_transfer" id="tmt-partial-bank" />
                                <Label htmlFor="tmt-partial-bank">{t("Bank Transfer", "बैंक ट्रांसफर")}</Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Discount and Tax for TMT Sale */}
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

                  {/* TMT Sale Bill Summary */}
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
                            case 'online': methodLabel = t('Online', 'ऑनलाइन'); break;
                            default: methodLabel = method; break;
                          }
                          paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
                        }
                      } else if (paid > 0 && due === 0) {
                        switch (paymentMethod) {
                          case 'cash': paymentMethodLabel = t('Full Payment', 'पूर्ण भुगतान'); break;
                          case 'online': paymentMethodLabel = t('Full Payment', 'पूर्ण भुगतान'); break;
                          case 'loan': paymentMethodLabel = t('No Payment', 'कोई भुगतान नहीं'); break;
                          case 'partial': paymentMethodLabel = t('Partial Payment', 'आंशिक भुगतान'); break;
                          default: paymentMethodLabel = paymentMethod; break;
                        }
                      }
                      return (
                        <>
                          <div className="flex justify-between text-base">
                            <span>{t("Payment Method", "भुगतान प्रकार")}</span>
                            <span>{paymentMethodLabel}</span>
                          </div>

                          {/* Paid Amount - shown in green */}
                          <div className="flex justify-between text-base">
                            <span>{t("Paid Amount", "भुगतान की गई राशि")}</span>
                            <span className="text-green-600 font-semibold">₹{paid.toFixed(2)}</span>
                          </div>

                          {/* Due Amount - shown in red if > 0 */}
                          <div className="flex justify-between text-base">
                            <span>{t("Due Amount", "बकाया राशि")}</span>
                            <span className={due > 0 ? "text-red-600 font-semibold" : "text-gray-600"}>₹{due.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* TMT Sale Submit Button */}
                  <div className="sticky bottom-4 z-10 pt-4 bg-white/80 backdrop-blur-sm -mx-4 px-4 border-t mt-4 md:static md:bg-transparent md:p-0 md:m-0 md:border-0 shadow-lg md:shadow-none pb-4 md:pb-0 safe-pb-4">
                    <Button
                      type="button"
                      onClick={handleTmtSaleSubmit}
                      disabled={isSubmitting || !selectedTmtProduct || !tmtQuantity || !tmtPricePerUnit}
                      className="w-full h-14 text-lg font-bold shadow-md"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t("Creating Sale...", "बिक्री बनाई जा रही है...")}
                        </>
                      ) : (
                        t("Create Sale", "बिक्री बनाएं")
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Regular Sale Form */
                <div className="space-y-6">
                  {/* Sale Items */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{t("Sale Items", "बिक्री आइटम")}</h3>
                      <Button type="button" onClick={handleAddItem} variant="outline" size="sm">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        {t("Add Item", "आइटम जोड़ें")}
                      </Button>
                    </div>

                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">{t("Loading categories...", "श्रेणियां लोड हो रही हैं...")}</p>
                      </div>
                    ) : categories.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">{t("No categories found", "कोई श्रेणियां नहीं मिलीं")}</p>
                        <p className="text-sm text-gray-500">Debug: Categories count: {categories.length}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {saleItems.map((item, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end">
                            <div>
                              <Label>{t("Category", "श्रेणी")}</Label>
                              <Select
                                value={item.categoryId.toString()}
                                onValueChange={(value) => handleItemChange(index, "categoryId", value)}
                                disabled={loading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Select category", "श्रेणी चुनें")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>{t("Type", "प्रकार")}</Label>
                              <Select
                                value={item.typeId > 0 ? item.typeId.toString() : ""}
                                onValueChange={(value) => {
                                  handleItemChange(index, "typeId", value);
                                }}
                                disabled={!item.categoryId || loading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Select type", "प्रकार चुनें")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const types = getTypesForCategory(item.categoryId);
                                    return types.map((type: any) => (
                                      <SelectItem key={type.id} value={type.id.toString()}>
                                        {type.name}
                                      </SelectItem>
                                    ));
                                  })()}
                                </SelectContent>
                              </Select>

                            </div>
                            <div>
                              <Label>{t("Name", "नाम")}</Label>
                              <Select
                                value={item.productId > 0 ? item.productId.toString() : ""}
                                onValueChange={(value) => handleItemChange(index, "productId", value)}
                                disabled={!item.categoryId || !item.typeId || productsLoading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Select product", "आइटम चुनें")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {(() => {

                                    // Only filter products if both categoryId and typeId are valid (not 0)
                                    const filteredProducts = (item.categoryId > 0 && item.typeId > 0)
                                      ? products.filter(
                                        (p: any) =>
                                          Number(p.category?.id) === Number(item.categoryId) &&
                                          Number(p.type?.id) === Number(item.typeId)
                                      )
                                      : [];

                                    return filteredProducts.map((product: any) => (
                                      <SelectItem key={product.id} value={product.id.toString()}>
                                        {product.name}
                                      </SelectItem>
                                    ));
                                  })()}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* TMT Bar Bundle/Piece Input */}
                            {item.categoryName && (item.categoryName.toLowerCase().includes('tmt') || item.categoryName.toLowerCase().includes('steel')) && getTmtBundleSize(item) ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap gap-2 items-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={tmtBundleInputs[index]?.bundles || ''}
                                    onChange={e => handleTmtInputChange(index, 'bundles', e.target.value)}
                                    placeholder="Bundles"
                                    className="w-20"
                                  />
                                  <span>Bundles</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={tmtBundleInputs[index]?.pieces || ''}
                                    onChange={e => handleTmtInputChange(index, 'pieces', e.target.value)}
                                    placeholder="Pieces"
                                    className="w-20"
                                  />
                                  <span>Pieces</span>
                                  <span className="ml-2 text-xs text-gray-500">1 bundle = {getTmtBundleSize(item)} pieces</span>
                                </div>
                                <div className="text-xs text-blue-700">Total Pieces: {tmtBundleInputs[index]?.totalPieces || 0}</div>
                                <div className="text-xs text-green-700">Per Bundle Price: ₹{(item.price * getTmtBundleSize(item)).toFixed(2)} | Per Piece Price: ₹{item.price.toFixed(2)}</div>
                              </div>
                            ) : (
                              <div>
                                <Label>{t("Quantity", "मात्रा")}</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                  min="0"
                                />
                                <span className="ml-2 text-gray-700">{item.unit || '-'}</span>
                              </div>
                            )}
                            <div>
                              <Label>
                                {t("Unit", "इकाई")}
                                {((item.categoryName?.toLowerCase().includes("sand") || item.categoryName?.toLowerCase().includes("chips")) ||
                                  (item.categoryName?.toLowerCase().includes("tmt") || item.categoryName?.toLowerCase().includes("steel"))) && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                              </Label>
                              {item.name && item.name.toLowerCase().includes("cement") && (
                                <div className="col-span-full bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded mb-2">
                                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                                    <span className="font-semibold text-yellow-800">{t("Cement Sale Mode:", "सीमेंट बिक्री मोड:")}</span>
                                    <div className="flex gap-4 mt-2 md:mt-0">
                                      <label className="flex items-center gap-1">
                                        <input
                                          type="radio"
                                          name={`cement-mode-${index}`}
                                          checked={item.unit === "bag" || item.unit === "bags"}
                                          onChange={() => { handleItemChange(index, "unit", "bag"); handleItemChange(index, "stockType", "normal"); }}
                                        />
                                        <span>{t("Full Bag (50kg)", "फुल बैग (50 किलो)")}</span>
                                      </label>
                                      <label className="flex items-center gap-1">
                                        <input
                                          type="radio"
                                          name={`cement-mode-${index}`}
                                          checked={item.unit === "kg"}
                                          onChange={() => { handleItemChange(index, "unit", "kg"); handleItemChange(index, "stockType", item.quantity % 50 !== 0 ? "damaged" : "normal"); }}
                                        />
                                        <span>{t("Loose (kg)", "ढीला (किलो)")}</span>
                                      </label>
                                    </div>
                                  </div>
                                  {item.unit === "kg" && (
                                    <div className="text-xs text-blue-700 mt-2">
                                      {t("Loose cement will be deducted from damaged bag stock. If you enter a multiple of 50kg, it will be treated as full bags.", "ढीला सीमेंट डैमेज बैग स्टॉक से घटेगा। यदि आप 50 का गुणज दर्ज करते हैं, तो इसे फुल बैग माना जाएगा।")}
                                    </div>
                                  )}
                                </div>
                              )}
                              {!(item.name && item.name.toLowerCase().includes("cement")) && (
                                <Select
                                  value={item.unit}
                                  onValueChange={(value) => handleItemChange(index, "unit", value)}
                                  disabled={productsLoading}
                                >
                                  <SelectTrigger className={
                                    ((item.categoryName?.toLowerCase().includes("sand") || item.categoryName?.toLowerCase().includes("chips")) ||
                                      (item.categoryName?.toLowerCase().includes("tmt") || item.categoryName?.toLowerCase().includes("steel"))) && !item.unit
                                      ? "border-red-500"
                                      : ""
                                  }>
                                    <SelectValue placeholder={t("Select unit", "इकाई चुनें")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.categoryName ? getAvailableUnits(item.categoryName).map((unit) => (
                                      <SelectItem key={unit.value} value={unit.value}>
                                        {unit.label}
                                      </SelectItem>
                                    )) : (
                                      <SelectItem value="placeholder" disabled>
                                        {t("Select category first", "पहले श्रेणी चुनें")}
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                              {(item.categoryName?.toLowerCase().includes("sand") || item.categoryName?.toLowerCase().includes("chips")) && !item.unit && (
                                <div className="text-xs text-red-600 mt-1">
                                  {t("Unit is required for sand and chips", "रेत और चिप्स के लिए इकाई आवश्यक है")}
                                </div>
                              )}
                              {(item.categoryName?.toLowerCase().includes("tmt") || item.categoryName?.toLowerCase().includes("steel")) && !item.unit && (
                                <div className="text-xs text-red-600 mt-1">
                                  {t("Unit is required for TMT bars", "TMT बार के लिए इकाई आवश्यक है")}
                                </div>
                              )}

                              {/* TMT Bar Unit Conversion Display */}
                              {item.categoryName?.toLowerCase().includes("tmt") && item.unit && item.quantity > 0 && (
                                <div className="text-xs text-blue-600 mt-1 space-y-1">
                                  <div className="font-medium">{t("Equivalent quantities:", "समतुल्य मात्रा:")}</div>
                                  {item.unit !== "piece" && (
                                    <div>
                                      {t("Pieces:", "पीस:")} {item.unit === "bundle"
                                        ? (item.quantity * getBundleConfig(item.name)).toFixed(0)
                                        : item.unit === "kg"
                                          ? (item.quantity / getWeightPerPiece(item.name)).toFixed(1)
                                          : item.quantity
                                      }
                                    </div>
                                  )}
                                  {item.unit !== "bundle" && (
                                    <div>
                                      {t("Bundles:", "बंडल:")} {item.unit === "piece"
                                        ? (item.quantity / getBundleConfig(item.name)).toFixed(2)
                                        : item.unit === "kg"
                                          ? (item.quantity / getWeightPerPiece(item.name) / getBundleConfig(item.name)).toFixed(2)
                                          : (item.quantity / getBundleConfig(item.name)).toFixed(2)
                                      }
                                    </div>
                                  )}
                                  {item.unit !== "kg" && (
                                    <div>
                                      {t("Weight (kg):", "वजन (किलो):")} {item.unit === "piece"
                                        ? (item.quantity * getWeightPerPiece(item.name)).toFixed(2)
                                        : item.unit === "bundle"
                                          ? (item.quantity * getBundleConfig(item.name) * getWeightPerPiece(item.name)).toFixed(2)
                                          : (item.quantity * getWeightPerPiece(item.name)).toFixed(2)
                                      }
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Size selection for chips */}
                            {item.categoryName?.toLowerCase().includes("chips") && (
                              <div>
                                <Label>
                                  {t("Size", "साइज़")}
                                  <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Select
                                  value={item.size}
                                  onValueChange={(value) => handleItemChange(index, "size", value)}
                                  disabled={productsLoading}
                                >
                                  <SelectTrigger className={!item.size ? "border-red-500" : ""}>
                                    <SelectValue placeholder={t("Select size", "साइज़ चुनें")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableChipSizes().map((size) => (
                                      <SelectItem key={size.value} value={size.value}>
                                        {size.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {!item.size && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {t("Size is required for chips", "चिप्स के लिए साइज़ आवश्यक है")}
                                  </div>
                                )}
                              </div>
                            )}
                            <div>
                              <Label>{t("Price", "कीमत")}</Label>
                              <Input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleItemChange(index, "price", e.target.value)}
                                min="0"
                                step="0.01"
                                className="mb-1"
                              />
                              {item.productId && (
                                <div className="text-xs text-gray-500 mb-1">
                                  {t("Default:", "डिफ़ॉल्ट:")} ₹{
                                    (() => {
                                      const p = products.find((p: any) => Number(p.id) === Number(item.productId));
                                      if (!p) return "-";
                                      console.log('🔍 [AddSale] Default price debug - product:', p);
                                      console.log('🔍 [AddSale] Default price debug - dailyRate:', p.dailyRate, 'price:', p.price);

                                      // Use dailyRate if available, else fallback to price
                                      const defaultPrice = p.dailyRate !== null && p.dailyRate !== undefined ? Number(p.dailyRate) : Number(p.price);
                                      console.log('🔍 [AddSale] Default price debug - calculated:', defaultPrice);
                                      return defaultPrice || "-";
                                    })()
                                  }
                                  {(() => {
                                    const p = products.find((p: any) => Number(p.id) === Number(item.productId));
                                    if (p && p.dailyRate !== null && p.dailyRate !== undefined) {
                                      return <span className="ml-1 text-green-600">({t("Today's Rate", "आज की दर")})</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                              {item.productId && item.price < (products.find((p: any) => Number(p.id) === Number(item.productId))?.costPrice ?? 0) && (
                                <div className="text-xs text-red-600">
                                  {t("Warning: Price is below cost price!", "चेतावनी: कीमत लागत मूल्य से कम है!")}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Label>{t("Total", "कुल")}</Label>
                                <div className="p-2 bg-gray-100 rounded text-sm font-medium">
                                  ₹{(item.quantity * item.price).toFixed(2)}
                                </div>
                              </div>
                              <Button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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
                          <Label htmlFor="cash">{t("Cash", "कैश")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="online" id="online" />
                          <Label htmlFor="online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="loan" id="loan" />
                          <Label htmlFor="loan">{t("Loan/Credit", "उधार/क्रेडिट")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partial" id="partial" />
                          <Label htmlFor="partial">{t("Partial", "आंशिक")}</Label>
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
                                <Label htmlFor="partial-cash">{t("Cash", "कैश")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="online" id="partial-online" />
                                <Label htmlFor="partial-online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="upi" id="partial-upi" />
                                <Label htmlFor="partial-upi">{t("UPI", "यूपीआई")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cheque" id="partial-cheque" />
                                <Label htmlFor="partial-cheque">{t("Cheque", "चेक")}</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="bank_transfer" id="partial-bank" />
                                <Label htmlFor="partial-bank">{t("Bank Transfer", "बैंक ट्रांसफर")}</Label>
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
                        <>
                          <div className="flex justify-between text-base">
                            <span>{t('Payment Method', 'भुगतान प्रकार')}</span>
                            <span>{paymentMethodLabel}</span>
                          </div>
                          {paymentMethod === 'partial' && (
                            <>
                              <div className="flex justify-between text-base">
                                <span>{t('Paid Amount', 'भुगतान की गई राशि')}</span>
                                <span className="text-green-600 font-semibold">₹{partialAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-base">
                                <span>{t('Due Amount', 'बकाया राशि')}</span>
                                <span className="text-red-600 font-semibold">₹{(finalAmount - partialAmount).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Bill Summary */}
                  {/* Submit Button */}
                  <div className="sticky bottom-4 z-10 pt-4 bg-white/80 backdrop-blur-sm -mx-4 px-4 border-t mt-4 md:static md:bg-transparent md:p-0 md:m-0 md:border-0 shadow-lg md:shadow-none pb-4 md:pb-0 safe-pb-4">
                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-bold shadow-md"
                      disabled={
                        isSubmitting ||
                        !selectedCustomer ||
                        saleItems.length === 0 ||
                        saleItems.some(item =>
                          !item.productId ||
                          !item.unit ||
                          !item.quantity ||
                          item.quantity <= 0
                        )
                      }
                    >
                      {isSubmitting ? t("Creating Sale...", "बिक्री बनाई जा रही है...") : t("Create Sale", "बिक्री बनाएं")}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Print Prompt Dialog */}
      {showPrintPrompt && (
        <Dialog open={showPrintPrompt} onOpenChange={setShowPrintPrompt}>
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
        <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
          <DialogContent>
            {!billType ? (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{t("Print Bill", "बिल प्रिंट करें")}</DialogTitle>
                </DialogHeader>
                {/* Only show Proper Bill option if tax details are entered */}
                {tax > 0 ? (
                  <>
                    <Button onClick={() => setBillType("proper")} className="w-full">
                      {t("Proper Bill", "प्रॉपर बिल")} {t("(With Tax)", "(टैक्स के साथ)")}
                    </Button>
                    <Button onClick={() => setBillType("normal")} className="w-full" variant="outline">
                      {t("Normal Bill", "साधारण बिल")}
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
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

