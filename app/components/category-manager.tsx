"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, Edit, Edit2, Trash2, Package, Tag, Wrench, Building2, Scale } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useShop, ALL_SHOPS_ID } from "@/app/contexts/ShopContext"

interface Category {
  id: number
  name: string
  description: string
  isActive: boolean
  types: ProductType[]
  shopId?: number
  productCount?: number
}

interface ProductType {
  id: number
  name: string
  description: string
  isActive: boolean
  shopId?: number
  categoryId?: number
}

interface TmtCompany {
  id: number
  name: string
  location?: string
  contactInfo?: string
  isActive: boolean
}

interface TmtSize {
  id: number
  sizeMm: number
  description?: string
  isActive: boolean
}

interface TmtProduct {
  id: number
  companyId: number
  sizeId: number
  productName: string
  weightPerRodKg: number
  rodsPerBundle: number
  weightPerBundleKg: number
  defaultUnit: string
  isActive: boolean
  shopId?: number | null // Shop assignment - null for global products
  company?: TmtCompany
  size?: TmtSize
  availableQtyKg?: number
}

interface CategoryManagerProps {
  shopId: number
}

export function CategoryManager({ shopId }: CategoryManagerProps) {
  console.log('🔍 CategoryManager received shopId:', shopId, 'Type:', typeof shopId)

  // Get shops from context to validate shopId
  const { shops: contextShops } = useShop()

  // Validate shopId - must be > 0 and not ALL_SHOPS_ID
  const validShopId = shopId > 0 && shopId !== ALL_SHOPS_ID ? shopId : (contextShops.length > 0 ? contextShops[0].id : 0)

  console.log('🔍 Validated shopId:', { original: shopId, valid: validShopId, contextShopsLength: contextShops.length })

  const [categories, setCategories] = useState<Category[]>([])
  const [types, setTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("categories")

  // Debug initial state
  console.log('🔍 CategoryManager initial state:', {
    shopId,
    validShopId,
    categoriesLength: categories.length,
    loading,
    activeTab
  })

  // Filtered categories for product type form
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([])

  // TMT state
  const [tmtCompanies, setTmtCompanies] = useState<TmtCompany[]>([])
  const [tmtSizes, setTmtSizes] = useState<TmtSize[]>([])
  const [tmtProducts, setTmtProducts] = useState<TmtProduct[]>([])
  const [tmtLoading, setTmtLoading] = useState(false)
  const [availableShops, setAvailableShops] = useState<any[]>([])
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null)
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null)

  // Pagination state
  const [categoryPage, setCategoryPage] = useState(1)
  const [typePage, setTypePage] = useState(1)
  const [itemsPerPage] = useState(12) // 12 items per page for good grid layout

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)

  // Type form state
  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    categoryId: '',
  })
  const [editingType, setEditingType] = useState<ProductType | null>(null)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)

  // Add role state
  const [userRole, setUserRole] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserRole(localStorage.getItem('userRole'))
    }
  }, [])

  // Add global/shop selection state
  const [categoryScope, setCategoryScope] = useState<'global' | 'shop'>('shop')
  const [selectedCategoryShopId, setSelectedCategoryShopId] = useState<string | null>(null)

  // Add global/shop selection state for types
  const [typeScope, setTypeScope] = useState<'global' | 'shop'>('shop')
  const [selectedTypeShopId, setSelectedTypeShopId] = useState<string | null>(null)

  const [categorySearch, setCategorySearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')

  // Function to filter categories based on type scope and selected shop
  const updateFilteredCategories = useCallback(() => {
    if (typeScope === 'global') {
      // Show only global categories (shopId: null)
      const globalCategories = categories.filter(cat => cat.shopId === null)
      setFilteredCategories(globalCategories)
      console.log('🔍 Filtered categories for global type:', globalCategories.length)
    } else {
      // Show BOTH global categories and shop-specific categories for shop type
      // This allows creating local products in global categories
      const selectedShopId = selectedTypeShopId ? parseInt(selectedTypeShopId) : validShopId
      const shopCategories = categories.filter(cat => cat.shopId === selectedShopId || cat.shopId === null)
      setFilteredCategories(shopCategories)
      console.log('🔍 Filtered categories for shop type:', shopCategories.length, 'shopId:', selectedShopId, '(including global)')
    }
  }, [categories, typeScope, selectedTypeShopId, validShopId])

  // Update filtered categories when dependencies change
  useEffect(() => {
    if (categories.length > 0) {
      updateFilteredCategories()
    }
  }, [categories, updateFilteredCategories])

  // TMT form states
  const [tmtCompanyForm, setTmtCompanyForm] = useState({
    name: '',
    location: '',
    contactInfo: ''
  })
  const [tmtSizeForm, setTmtSizeForm] = useState({
    sizeMm: '',
    description: ''
  })
  const [tmtProductForm, setTmtProductForm] = useState({
    companyId: '',
    sizeId: '',
    productName: '',
    weightPerRodKg: '',
    rodsPerBundle: '',
    weightPerBundleKg: '',
    defaultUnit: 'BUNDLE',
    shopAssignment: 'global', // 'global' or 'shop'
    assignedShopId: ''
  })

  // TMT dialog states
  const [tmtCompanyDialogOpen, setTmtCompanyDialogOpen] = useState(false)
  const [tmtSizeDialogOpen, setTmtSizeDialogOpen] = useState(false)
  const [tmtProductDialogOpen, setTmtProductDialogOpen] = useState(false)
  const [editingTmtCompany, setEditingTmtCompany] = useState<TmtCompany | null>(null)
  const [editingTmtSize, setEditingTmtSize] = useState<TmtSize | null>(null)
  const [editingTmtProduct, setEditingTmtProduct] = useState<TmtProduct | null>(null)

  // TMT search states
  const [tmtCompanySearch, setTmtCompanySearch] = useState('')
  const [tmtSizeSearch, setTmtSizeSearch] = useState('')
  const [tmtProductSearch, setTmtProductSearch] = useState('')

  useEffect(() => {
    loadData()
    loadTmtData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validShopId])

  // Debug effect to log categories
  useEffect(() => {
    console.log('🔍 Categories for rendering:', categories.length, categories)
  }, [categories])

  // Debug effect to log shopId changes
  useEffect(() => {
    console.log('🔍 ShopId changed:', shopId, 'validShopId:', validShopId, 'Type:', typeof shopId)
  }, [shopId, validShopId])

  // Listen for shop changes from sidebar
  useEffect(() => {
    const handleShopChange = () => {
      console.log('🔄 Shop changed, reloading data...')
      loadData()
      loadTmtData()
    }

    window.addEventListener('shopChanged', handleShopChange)
    return () => window.removeEventListener('shopChanged', handleShopChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validShopId])

  // Reset pagination when search terms change
  useEffect(() => {
    setCategoryPage(1)
  }, [categorySearch])

  useEffect(() => {
    setTypePage(1)
  }, [typeSearch])

  const refreshToken = useCallback(async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken')
      if (!refreshTokenValue) {
        console.log('❌ No refresh token found')
        return null
      }

      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          localStorage.setItem('accessToken', data.data.token)
          localStorage.setItem('refreshToken', data.data.refreshToken)
          console.log('✅ Token refreshed successfully')
          return data.data.token
        }
      }

      console.log('❌ Token refresh failed')
      return null
    } catch (error) {
      console.error('Token refresh error:', error)
      return null
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      console.log('🔄 Loading data for shopId:', validShopId)
      let token = localStorage.getItem('accessToken')
      console.log('🔍 Token exists:', !!token, 'Token length:', token?.length)
      if (!token) {
        console.log('❌ No access token found in localStorage')
        toast.error('Authentication required')
        // Redirect to login if no token
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }

      // Helper function to handle 401 errors
      const handle401Error = async (response: Response, retryFn: () => Promise<Response>) => {
        if (response.status === 401) {
          console.log('❌ Token expired or invalid, attempting refresh')
          const newToken = await refreshToken()
          if (newToken) {
            console.log('✅ Token refreshed, retrying request')
            // Retry the request with the new token
            return retryFn()
          } else {
            // Token refresh failed, clear auth data and redirect
            console.log('❌ Token refresh failed, clearing auth data')
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('userRole')
            localStorage.removeItem('userName')
            toast.error('Session expired. Please log in again.')
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            return null
          }
        }
        return response
      }

      // Load categories
      let categoriesResponse = await fetch(
        `/api/categories?shopId=${validShopId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      // Handle 401 error for categories
      if (categoriesResponse.status === 401) {
        const retryResponse = await handle401Error(categoriesResponse, async () => {
          const newToken = localStorage.getItem('accessToken')
          return fetch(`/api/categories?shopId=${validShopId}`, {
            headers: { 'Authorization': `Bearer ${newToken}` }
          })
        })
        if (retryResponse === null) return // Redirected to login
        categoriesResponse = retryResponse
      }

      console.log('🔍 Categories API response status:', categoriesResponse.status)
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        console.log('🔍 Categories API response data:', categoriesData)
        setCategories(categoriesData.data || [])
        console.log('🔍 Set categories state:', categoriesData.data || [])
      } else {
        console.error('Failed to load categories:', categoriesResponse.status, categoriesResponse.statusText)
        const errorData = await categoriesResponse.json().catch(() => ({}))
        console.error('Categories error data:', errorData)
        if (categoriesResponse.status !== 401) {
          toast.error('Failed to load categories')
        }
      }

      // Get current token (might have been refreshed)
      token = localStorage.getItem('accessToken')
      if (!token) return // Already redirected to login

      // Load types
      let typesResponse = await fetch(
        `/api/categories/types?shopId=${validShopId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      // Handle 401 error for types
      if (typesResponse.status === 401) {
        const retryResponse = await handle401Error(typesResponse, async () => {
          const newToken = localStorage.getItem('accessToken')
          return fetch(`/api/categories/types?shopId=${validShopId}`, {
            headers: { 'Authorization': `Bearer ${newToken}` }
          })
        })
        if (retryResponse === null) return // Redirected to login
        typesResponse = retryResponse
      }

      if (typesResponse.ok) {
        const typesData = await typesResponse.json()
        console.log('Loaded types:', typesData.data)
        setTypes(typesData.data || [])
      } else {
        console.error('Failed to load types:', typesResponse.status, typesResponse.statusText)
        const errorData = await typesResponse.json().catch(() => ({}))
        console.error('Error data:', errorData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [validShopId, refreshToken])

  const loadTmtData = useCallback(async () => {
    console.log('🚀 Starting loadTmtData for shopId:', validShopId)
    setTmtLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      console.log('🔑 Token retrieved:', token ? `${token.substring(0, 20)}...` : 'No token')
      if (!token) {
        console.log('❌ No access token found')
        toast.error('Authentication required')
        return
      }
      console.log('✅ Access token found, proceeding with API calls')

      // Load TMT companies
      const companiesResponse = await fetch('/api/tmt/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json()
        setTmtCompanies(companiesData.data || [])
      }

      // Load TMT sizes
      const sizesResponse = await fetch('/api/tmt/sizes', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (sizesResponse.ok) {
        const sizesData = await sizesResponse.json()
        setTmtSizes(sizesData.data || [])
      }

      // Load available shops for assignment
      console.log('🔄 Loading available shops for TMT product assignment')
      console.log('🔑 Using token:', token ? 'Token present' : 'No token')

      let shopsResponse = await fetch('/api/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      console.log('📡 Shops response status:', shopsResponse.status)

      // If token is invalid, try to refresh it
      if (shopsResponse.status === 401) {
        console.log('🔄 Token expired, attempting to refresh...')
        const newToken = await refreshToken()
        if (newToken) {
          console.log('🔄 Retrying shops API with refreshed token')
          shopsResponse = await fetch('/api/shops', {
            headers: { 'Authorization': `Bearer ${newToken}` }
          })
          console.log('📡 Shops response status after refresh:', shopsResponse.status)
        }
      }

      if (shopsResponse.ok) {
        const shopsData = await shopsResponse.json()
        console.log('🏪 Shops data received:', shopsData)
        console.log('🏪 Shops data structure:', {
          success: shopsData.success,
          hasData: !!shopsData.data,
          hasShops: !!shopsData.data?.shops,
          shopsLength: shopsData.data?.shops?.length || 0
        })

        // API returns { data: { shops: [...] } }
        const userShops = shopsData.data?.shops || []
        console.log('👤 User shops loaded:', userShops.length, 'shops')
        console.log('🏪 User shops:', userShops.map((shop: any) => ({ id: shop.id, name: shop.name, createdBy: shop.createdBy })))
        setAvailableShops(userShops)
        console.log('✅ Available shops set:', userShops.length, 'shops')
      } else {
        console.log('❌ Shops API failed:', shopsResponse.status)
        const errorText = await shopsResponse.text()
        console.log('❌ Error response:', errorText)
        setAvailableShops([])
      }

      // Load TMT products
      console.log('🔄 Loading TMT products for shopId:', validShopId)
      const productsResponse = await fetch(`/api/tmt/products?shopId=${validShopId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      console.log('📡 TMT products response status:', productsResponse.status)
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        console.log('📦 TMT products data received:', productsData)
        // Ensure we always set an array - API returns { data: { products: [...] } }
        const products = Array.isArray(productsData.data?.products) ? productsData.data.products : []
        console.log('✅ TMT products set:', products.length, 'products')
        setTmtProducts(products)
      } else {
        console.log('❌ TMT products API failed:', productsResponse.status)
        const errorText = await productsResponse.text()
        console.log('❌ TMT products API error response:', errorText)
        // If API fails, ensure we have an empty array
        setTmtProducts([])
      }
    } catch (error) {
      console.error('Error loading TMT data:', error)
      toast.error('Failed to load TMT data')
      // Ensure tmtProducts is always an array even on error
      setTmtProducts([])
    } finally {
      setTmtLoading(false)
    }
  }, [validShopId])

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }
      const url = editingCategory ? '/api/categories' : '/api/categories'
      const method = editingCategory ? 'PUT' : 'POST'
      let body: any = editingCategory
        ? { ...categoryForm, id: editingCategory.id, isActive: true }
        : { ...categoryForm }

      // Set shopId for both create and update operations
      if (editingCategory) {
        // For editing, use the selected shop or existing shopId
        if (userRole === 'SUPER_DUPER_ADMIN') {
          // If global scope, set shopId to null, otherwise use selected shop
          body.shopId = categoryScope === 'global' ? null : (selectedCategoryShopId ? parseInt(selectedCategoryShopId) : (editingCategory.shopId || shopId))
        } else {
          body.shopId = editingCategory.shopId || shopId
        }
      } else {
        // For creating, use the selected shop or current shopId
        if (userRole === 'SUPER_DUPER_ADMIN') {
          // If global scope, set shopId to null, otherwise use selected shop
          body.shopId = categoryScope === 'global' ? null : (selectedCategoryShopId ? parseInt(selectedCategoryShopId) : shopId)
        } else {
          body.shopId = shopId
        }
      }

      console.log('🔍 Category submission debug:', {
        categoryScope,
        selectedCategoryShopId,
        shopId,
        finalShopId: body.shopId,
        userRole,
        availableShops: availableShops.length
      })
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Category API response:', data)
        console.log('🔍 Category data shopId:', data.data?.shopId)
        toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully')

        // Instant rendering - update local state immediately
        if (editingCategory) {
          // Update existing category - preserve product count and types
          console.log('🔄 Updating category instantly:', editingCategory.id)
          setCategories(prevCategories =>
            prevCategories.map(cat =>
              cat.id === editingCategory.id
                ? {
                  ...cat,
                  ...data.data,
                  types: cat.types, // Preserve existing types
                  productCount: cat.productCount // Preserve existing product count
                }
                : cat
            )
          )
        } else {
          // Add new category - use API response (includes productCount: 0)
          console.log('➕ Adding new category instantly:', data.data)
          setCategories(prevCategories => {
            const newCategories = [data.data, ...prevCategories]
            console.log('📋 Categories after instant add:', newCategories.length, 'total categories')
            return newCategories
          })
        }

        // Reset pagination to show the new/updated item
        resetCategoryPagination()

        setCategoryDialogOpen(false)
        setCategoryForm({ name: '', description: '' })
        setEditingCategory(null)

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const data = await response.json()
        toast.error(data.message || 'Failed to save category')
      }
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Failed to save category')
    }
  }

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }
      const url = editingType ? '/api/categories/types' : '/api/categories/types'
      const method = editingType ? 'PUT' : 'POST'
      let body: any = editingType
        ? { ...typeForm, id: editingType.id, isActive: true }
        : { ...typeForm }

      // Set shopId for both create and update operations
      if (editingType) {
        // For editing, use the selected shop or existing shopId
        if (userRole === 'SUPER_DUPER_ADMIN') {
          // If global scope, set shopId to null, otherwise use selected shop
          body.shopId = typeScope === 'global' ? null : (selectedTypeShopId ? parseInt(selectedTypeShopId) : (editingType.shopId || shopId))
        } else {
          body.shopId = editingType.shopId || shopId
        }
      } else {
        // For creating, use the selected shop or current shopId
        if (userRole === 'SUPER_DUPER_ADMIN') {
          // If global scope, set shopId to null, otherwise use selected shop
          body.shopId = typeScope === 'global' ? null : (selectedTypeShopId ? parseInt(selectedTypeShopId) : shopId)
        } else {
          body.shopId = shopId
        }
      }
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(editingType ? 'Product type updated successfully' : 'Product type created successfully')

        // Instant rendering - update local state immediately
        if (editingType) {
          // Update existing type
          setTypes(prevTypes =>
            prevTypes.map(type =>
              type.id === editingType.id
                ? { ...type, ...data.data }
                : type
            )
          )

          // Also update the category's types array
          setCategories(prevCategories =>
            prevCategories.map(category => ({
              ...category,
              types: category.types.map(type =>
                type.id === editingType.id
                  ? { ...type, ...data.data }
                  : type
              )
            }))
          )
        } else {
          // Add new type
          setTypes(prevTypes => [data.data, ...prevTypes])

          // Also add to the appropriate category's types array
          setCategories(prevCategories =>
            prevCategories.map(category =>
              category.id === parseInt(typeForm.categoryId)
                ? { ...category, types: [data.data, ...category.types] }
                : category
            )
          )
        }

        // Reset pagination to show the new/updated item
        resetTypePagination()

        setTypeDialogOpen(false)
        setTypeForm({ name: '', description: '', categoryId: '' })
        setEditingType(null)

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const data = await response.json()
        toast.error(data.message || 'Failed to save product type')
      }
    } catch (error) {
      console.error('Error saving product type:', error)
      toast.error('Failed to save product type')
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    // Safety check: prevent deletion if category has products or product types
    const productCount = category.productCount || 0;
    const productTypeCount = category.types?.length || 0;

    if (productCount > 0 || productTypeCount > 0) {
      let message = '';
      if (productCount > 0 && productTypeCount > 0) {
        message = `Cannot delete "${category.name}" because it contains ${productCount} product(s) and has ${productTypeCount} product type(s). Please remove or reassign all products and product types from this category before deleting it.`;
      } else if (productCount > 0) {
        message = `Cannot delete "${category.name}" because it contains ${productCount} product(s). Please remove or reassign all products from this category before deleting it.`;
      } else if (productTypeCount > 0) {
        message = `Cannot delete "${category.name}" because it has ${productTypeCount} product type(s). Please remove or reassign all product types from this category before deleting it.`;
      }

      toast.error(message);
      return;
    }

    setDeletingCategoryId(category.id)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch(`/api/categories?id=${category.id}&shopId=${shopId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast.success('Category deleted successfully')

        // Immediately remove the category from the local state for instant UI update
        console.log('🗑️ Deleting category instantly:', category.id)
        setCategories(prevCategories =>
          prevCategories.filter(cat => cat.id !== category.id)
        )

        // Reset pagination if current page becomes empty
        const remainingCategories = categories.filter(cat => cat.id !== category.id)
        const filteredRemaining = remainingCategories.filter(cat =>
          cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(categorySearch.toLowerCase()))
        )
        const totalPages = Math.ceil(filteredRemaining.length / itemsPerPage)
        if (categoryPage > totalPages && totalPages > 0) {
          setCategoryPage(totalPages)
        }

        // Also refresh the full data to ensure consistency
        await loadData()
      } else {
        const data = await response.json()
        toast.error(data.message || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category')
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const handleDeleteType = async (type: ProductType) => {
    setDeletingTypeId(type.id)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch(`/api/categories/types?id=${type.id}&shopId=${shopId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast.success('Product type deleted successfully')

        // Immediately remove the type from the local state for instant UI update
        setTypes(prevTypes =>
          prevTypes.filter(t => t.id !== type.id)
        )

        setCategories(prevCategories =>
          prevCategories.map(category => ({
            ...category,
            types: category.types.filter(t => t.id !== type.id)
          }))
        )

        // Reset pagination if current page becomes empty
        const remainingTypes = types.filter(t => t.id !== type.id)
        const filteredRemaining = remainingTypes.filter(t =>
          t.name.toLowerCase().includes(typeSearch.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(typeSearch.toLowerCase()))
        )
        const totalPages = Math.ceil(filteredRemaining.length / itemsPerPage)
        if (typePage > totalPages && totalPages > 0) {
          setTypePage(totalPages)
        }

        // Also refresh the full data to ensure consistency
        await loadData()
      } else {
        const data = await response.json()
        toast.error(data.message || 'Failed to delete product type')
      }
    } catch (error) {
      console.error('Error deleting product type:', error)
      toast.error('Failed to delete product type')
    } finally {
      setDeletingTypeId(null)
    }
  }

  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, description: category.description })
      setCategoryScope(category.shopId ? 'shop' : 'global')
      setSelectedCategoryShopId(category.shopId ? category.shopId.toString() : null)
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
      setCategoryScope('shop')
      setSelectedCategoryShopId(null)
    }
    setCategoryDialogOpen(true)
  }

  const openTypeDialog = (type?: ProductType) => {
    if (type) {
      setEditingType(type)
      setTypeForm({ name: type.name, description: type.description, categoryId: type.categoryId?.toString() || '' })
      setTypeScope(type.shopId ? 'shop' : 'global')
      setSelectedTypeShopId(type.shopId ? type.shopId.toString() : null)
    } else {
      setEditingType(null)
      setTypeForm({ name: '', description: '', categoryId: '' })
      setTypeScope('shop')
      setSelectedTypeShopId(null)
    }
    setTypeDialogOpen(true)
  }

  // Pagination functions
  const getFilteredCategories = () => {
    return categories.filter(category =>
      category.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(categorySearch.toLowerCase()))
    )
  }

  const getFilteredTypes = () => {
    return types.filter(type =>
      type.name.toLowerCase().includes(typeSearch.toLowerCase()) ||
      (type.description && type.description.toLowerCase().includes(typeSearch.toLowerCase()))
    )
  }

  const getTotalCategoryPages = () => {
    return Math.ceil(getFilteredCategories().length / itemsPerPage)
  }

  const getTotalTypePages = () => {
    return Math.ceil(getFilteredTypes().length / itemsPerPage)
  }

  const handleCategoryPageChange = (page: number) => {
    setCategoryPage(page)
  }

  const handleTypePageChange = (page: number) => {
    setTypePage(page)
  }

  // Reset pagination when data changes
  const resetCategoryPagination = () => {
    setCategoryPage(1)
  }

  const resetTypePagination = () => {
    setTypePage(1)
  }

  // TMT Handler Functions
  const handleTmtCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const url = '/api/tmt/companies'
      const method = editingTmtCompany ? 'PUT' : 'POST'
      const body = editingTmtCompany
        ? { ...tmtCompanyForm, id: editingTmtCompany.id }
        : { ...tmtCompanyForm, shopId: validShopId }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(editingTmtCompany ? 'TMT Company updated successfully' : 'TMT Company created successfully')

        if (editingTmtCompany) {
          // Instant rendering for update
          console.log('🔄 Updating TMT company instantly:', data.data.company)
          setTmtCompanies(prevCompanies =>
            prevCompanies.map(company =>
              company.id === editingTmtCompany.id
                ? { ...company, ...data.data.company }
                : company
            )
          )
        } else {
          // Instant rendering for create
          console.log('➕ Adding new TMT company instantly:', data.data.company)
          setTmtCompanies(prevCompanies => {
            const newCompanies = [data.data.company, ...prevCompanies]
            console.log('📋 TMT Companies after instant add:', newCompanies.length, 'total companies')
            return newCompanies
          })
        }

        setTmtCompanyDialogOpen(false)
        setTmtCompanyForm({ name: '', location: '', contactInfo: '' })
        setEditingTmtCompany(null)

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const data = await response.json()
        toast.error(data.message || data.error || 'Failed to save TMT company')
      }
    } catch (error) {
      console.error('Error saving TMT company:', error)
      toast.error('Failed to save TMT company')
    }
  }

  const handleTmtSizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const url = '/api/tmt/sizes'
      const method = editingTmtSize ? 'PUT' : 'POST'
      const body = editingTmtSize
        ? { ...tmtSizeForm, id: editingTmtSize.id }
        : { ...tmtSizeForm, shopId: validShopId }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(editingTmtSize ? 'TMT Size updated successfully' : 'TMT Size created successfully')

        if (editingTmtSize) {
          // Instant rendering for update
          console.log('🔄 Updating TMT size instantly:', data.data.size)
          setTmtSizes(prevSizes =>
            prevSizes.map(size =>
              size.id === editingTmtSize.id
                ? { ...size, ...data.data.size }
                : size
            )
          )
        } else {
          // Instant rendering for create
          console.log('➕ Adding new TMT size instantly:', data.data.size)
          setTmtSizes(prevSizes => {
            const newSizes = [data.data.size, ...prevSizes]
            console.log('📋 TMT Sizes after instant add:', newSizes.length, 'total sizes')
            return newSizes
          })
        }

        setTmtSizeDialogOpen(false)
        setTmtSizeForm({ sizeMm: '', description: '' })
        setEditingTmtSize(null)

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || 'Failed to save TMT size'
        console.error('TMT Size API error:', errorData)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error saving TMT size:', error)
      toast.error('Failed to save TMT size')
    }
  }

  const handleTmtProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const url = '/api/tmt/products'
      const method = editingTmtProduct ? 'PUT' : 'POST'
      const body = editingTmtProduct
        ? {
          ...tmtProductForm,
          id: editingTmtProduct.id,
          companyId: parseInt(tmtProductForm.companyId),
          sizeId: parseInt(tmtProductForm.sizeId),
          weightPerRodKg: parseFloat(tmtProductForm.weightPerRodKg),
          rodsPerBundle: parseInt(tmtProductForm.rodsPerBundle),
          weightPerBundleKg: parseFloat(tmtProductForm.weightPerBundleKg),
          shopId: tmtProductForm.shopAssignment === 'global' ? null : parseInt(tmtProductForm.assignedShopId)
        }
        : {
          ...tmtProductForm,
          companyId: parseInt(tmtProductForm.companyId),
          sizeId: parseInt(tmtProductForm.sizeId),
          weightPerRodKg: parseFloat(tmtProductForm.weightPerRodKg),
          rodsPerBundle: parseInt(tmtProductForm.rodsPerBundle),
          weightPerBundleKg: parseFloat(tmtProductForm.weightPerBundleKg),
          shopId: tmtProductForm.shopAssignment === 'global' ? null : parseInt(tmtProductForm.assignedShopId)
        }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        let data
        try {
          const responseText = await response.text()
          if (responseText.trim()) {
            data = JSON.parse(responseText)
          } else {
            // Empty response, assume success
            data = { success: true, data: { product: {} } }
          }
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError)
          console.error('Response text:', await response.text())
          toast.error('Invalid response from server')
          return
        }

        toast.success(editingTmtProduct ? 'TMT Product updated successfully' : 'TMT Product created successfully')

        if (editingTmtProduct) {
          // Instant rendering for update
          console.log('🔄 Updating TMT product instantly:', data.data.product)
          setTmtProducts(prevProducts =>
            prevProducts.map(product =>
              product.id === editingTmtProduct.id
                ? { ...product, ...data.data.product }
                : product
            )
          )
        } else {
          // Instant rendering for create
          console.log('➕ Adding new TMT product instantly:', data.data.product)
          setTmtProducts(prevProducts => {
            const newProducts = [data.data.product, ...prevProducts]
            console.log('📋 TMT Products after instant add:', newProducts.length, 'total products')
            return newProducts
          })
        }

        setTmtProductDialogOpen(false)
        setTmtProductForm({ companyId: '', sizeId: '', productName: '', weightPerRodKg: '', rodsPerBundle: '', weightPerBundleKg: '', defaultUnit: 'BUNDLE', shopAssignment: 'global', assignedShopId: '' })
        setEditingTmtProduct(null)

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        let data
        try {
          const responseText = await response.text()
          if (responseText.trim()) {
            data = JSON.parse(responseText)
          } else {
            data = { message: `HTTP ${response.status}: ${response.statusText}` }
          }
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError)
          data = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        toast.error(data.message || 'Failed to save TMT product')
      }
    } catch (error) {
      console.error('Error saving TMT product:', error)
      toast.error('Failed to save TMT product')
    }
  }

  const handleDeleteTmtProduct = async (product: TmtProduct) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const confirmed = window.confirm(`Are you sure you want to delete "${product.productName}"? This action cannot be undone.`)
      if (!confirmed) return

      const response = await fetch(`/api/tmt/products?id=${product.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        toast.success('TMT Product deleted successfully')

        // Instant rendering - remove product from local state immediately
        console.log('🗑️ Deleting TMT product instantly:', product.productName)
        setTmtProducts(prevProducts => {
          const filteredProducts = prevProducts.filter(p => p.id !== product.id)
          console.log('📋 TMT Products after instant delete:', filteredProducts.length, 'remaining products')
          return filteredProducts
        })

        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const data = await response.json()
        toast.error(data.message || 'Failed to delete TMT product')
      }
    } catch (error) {
      console.error('Error deleting TMT product:', error)
      toast.error('Failed to delete TMT product')
    }
  }

  const openTmtCompanyDialog = (company?: TmtCompany) => {
    if (company) {
      setEditingTmtCompany(company)
      setTmtCompanyForm({ name: company.name, location: company.location || '', contactInfo: company.contactInfo || '' })
    } else {
      setEditingTmtCompany(null)
      setTmtCompanyForm({ name: '', location: '', contactInfo: '' })
    }
    setTmtCompanyDialogOpen(true)
  }

  const openTmtSizeDialog = (size?: TmtSize) => {
    if (size) {
      setEditingTmtSize(size)
      setTmtSizeForm({ sizeMm: size.sizeMm.toString(), description: size.description || '' })
    } else {
      setEditingTmtSize(null)
      setTmtSizeForm({ sizeMm: '', description: '' })
    }
    setTmtSizeDialogOpen(true)
  }

  const openTmtProductDialog = (product?: TmtProduct) => {
    if (product) {
      setEditingTmtProduct(product)
      setTmtProductForm({
        companyId: product.companyId.toString(),
        sizeId: product.sizeId.toString(),
        productName: product.productName,
        weightPerRodKg: product.weightPerRodKg.toString(),
        rodsPerBundle: product.rodsPerBundle.toString(),
        weightPerBundleKg: product.weightPerBundleKg.toString(),
        defaultUnit: product.defaultUnit,
        shopAssignment: product.shopId ? 'shop' : 'global',
        assignedShopId: product.shopId ? product.shopId.toString() : ''
      })
    } else {
      setEditingTmtProduct(null)
      setTmtProductForm({ companyId: '', sizeId: '', productName: '', weightPerRodKg: '', rodsPerBundle: '', weightPerBundleKg: '', defaultUnit: 'BUNDLE', shopAssignment: 'global', assignedShopId: '' })
    }
    setTmtProductDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading categories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Product Types
          </TabsTrigger>
          <TabsTrigger value="tmt" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            TMT Management
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            TMT Inventory
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Product Categories</h3>
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openCategoryDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  {/* Shop Assignment Section */}
                  {userRole === 'SUPER_DUPER_ADMIN' && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Shop Assignment</h4>
                        <p className="text-sm text-gray-500 mb-3">
                          Choose whether this category should be available globally or assigned to a specific shop
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="category-global"
                            name="categoryShopAssignment"
                            value="global"
                            checked={categoryScope === 'global'}
                            onChange={(e) => {
                              setCategoryScope('global')
                              setSelectedCategoryShopId(null)
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Label htmlFor="category-global" className="text-sm font-medium">
                            Assign to All Shops (Global)
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="category-shop"
                            name="categoryShopAssignment"
                            value="shop"
                            checked={categoryScope === 'shop'}
                            onChange={(e) => setCategoryScope('shop')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Label htmlFor="category-shop" className="text-sm font-medium">
                            Assign to Specific Shop
                          </Label>
                        </div>
                      </div>

                      {categoryScope === 'shop' && (
                        <div>
                          <Label htmlFor="categoryShopSelect">Select Shop</Label>
                          <Select
                            value={selectedCategoryShopId || (editingCategory ? (editingCategory.shopId?.toString() || shopId?.toString() || '') : (shopId?.toString() || ''))}
                            onValueChange={(value) => {
                              setSelectedCategoryShopId(value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a shop" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableShops.length > 0 ? (
                                availableShops.map((shop) => (
                                  <SelectItem key={shop.id} value={shop.id.toString()}>
                                    {shop.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={shopId?.toString() || ''} disabled>
                                  Current Shop
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="categoryName">Category Name</Label>
                    <Input
                      id="categoryName"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="e.g., Cement, TMT Bars"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoryDescription">Description</Label>
                    <Textarea
                      id="categoryDescription"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingCategory ? 'Update' : 'Create'} Category
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              className="w-full md:w-1/2 lg:w-1/3"
            />
          </div>

          {/* Scrollable grid for categories */}
          <div className="overflow-y-auto max-h-[600px]">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" style={{ minHeight: 400 }}>
              {categories.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No categories found. {loading ? 'Loading...' : 'Create your first category.'}
                </div>
              ) : (
                categories
                  .filter(category =>
                    category.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
                    (category.description && category.description.toLowerCase().includes(categorySearch.toLowerCase()))
                  )
                  .slice((categoryPage - 1) * itemsPerPage, categoryPage * itemsPerPage)
                  .map((category) => {
                    console.log('🔍 Category display debug:', {
                      id: category.id,
                      name: category.name,
                      shopId: category.shopId,
                      availableShops: availableShops.length,
                      shopName: availableShops.find(shop => shop.id === category.shopId)?.name
                    })
                    return (
                      <Card key={category.id} className="h-fit">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">{category.name}</CardTitle>
                            <div className="flex gap-1">
                              {category.shopId == null ? (
                                <Badge variant="outline" className="text-blue-700 border-blue-400 text-xs px-1.5 py-0.5">Global</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-700 border-green-400 text-xs px-1.5 py-0.5">
                                  {availableShops.find(shop => shop.id === category.shopId)?.name || 'Shop'}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openCategoryDialog(category)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {(category.productCount || 0) === 0 ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                                      title="Delete category"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{category.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteCategory(category)}
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={deletingCategoryId === category.id}
                                      >
                                        {deletingCategoryId === category.id ? 'Deleting...' : 'Delete'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400 cursor-not-allowed h-6 w-6 p-0"
                                  disabled={true}
                                  title="Cannot delete category with products"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0">
                          {category.description && (
                            <p className="text-xs text-gray-600 mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {category.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant={category.isActive ? "default" : "secondary"} className="text-xs px-2 py-0.5">
                              {category.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {category.types?.length || 0} types
                            </span>
                            <span className="text-xs text-gray-500">
                              {category.productCount || 0} products
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
              )}
            </div>

          </div>

          {/* Category Pagination */}
          {getTotalCategoryPages() > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCategoryPageChange(categoryPage - 1)}
                disabled={categoryPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {categoryPage} of {getTotalCategoryPages()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCategoryPageChange(categoryPage + 1)}
                disabled={categoryPage === getTotalCategoryPages()}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Product Types</h3>
            <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openTypeDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingType ? 'Edit Product Type' : 'Add New Product Type'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTypeSubmit} className="space-y-4">
                  {/* Shop Assignment Section */}
                  {userRole === 'SUPER_DUPER_ADMIN' && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Shop Assignment</h4>
                        <p className="text-sm text-gray-500 mb-3">
                          Choose whether this product type should be available globally or assigned to a specific shop
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="type-global"
                            name="typeShopAssignment"
                            value="global"
                            checked={typeScope === 'global'}
                            onChange={(e) => {
                              setTypeScope('global')
                              setSelectedTypeShopId(null)
                              // Clear selected category when switching to global
                              setTypeForm({ ...typeForm, categoryId: '' })
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Label htmlFor="type-global" className="text-sm font-medium">
                            Assign to All Shops (Global)
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="type-shop"
                            name="typeShopAssignment"
                            value="shop"
                            checked={typeScope === 'shop'}
                            onChange={(e) => {
                              setTypeScope('shop')
                              // Clear selected category when switching scope
                              setTypeForm({ ...typeForm, categoryId: '' })
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Label htmlFor="type-shop" className="text-sm font-medium">
                            Assign to Specific Shop
                          </Label>
                        </div>
                      </div>

                      {typeScope === 'shop' && (
                        <div>
                          <Label htmlFor="typeShopSelect">Select Shop</Label>
                          <Select
                            value={selectedTypeShopId || (editingType ? (editingType.shopId?.toString() || shopId?.toString() || '') : (shopId?.toString() || ''))}
                            onValueChange={(value) => {
                              setSelectedTypeShopId(value)
                              // Clear selected category when shop changes
                              setTypeForm({ ...typeForm, categoryId: '' })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a shop" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableShops.length > 0 ? (
                                availableShops.map((shop) => (
                                  <SelectItem key={shop.id} value={shop.id.toString()}>
                                    {shop.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={shopId?.toString() || ''} disabled>
                                  Current Shop
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="typeName">Type Name</Label>
                    <Input
                      id="typeName"
                      value={typeForm.name}
                      onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                      placeholder="e.g., Lafarge, Nuvoco, PSC"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="typeCategory">Category</Label>
                    <Select
                      value={typeForm.categoryId}
                      onValueChange={(value) => setTypeForm({ ...typeForm, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((cat) => {
                            const isGlobal = cat.shopId === null
                            const displayName = isGlobal ? `${cat.name} (Global)` : cat.name
                            return (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {displayName}
                              </SelectItem>
                            )
                          })
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            {typeScope === 'global'
                              ? 'No global categories available'
                              : 'No categories available for selected shop'
                            }
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {filteredCategories.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {typeScope === 'global'
                          ? `${filteredCategories.length} global categories available`
                          : `${filteredCategories.length} categories available (global + shop-specific)`
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="typeDescription">Description</Label>
                    <Textarea
                      id="typeDescription"
                      value={typeForm.description}
                      onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setTypeDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingType ? 'Update' : 'Create'} Type
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search types..."
              value={typeSearch}
              onChange={e => setTypeSearch(e.target.value)}
              className="w-full md:w-1/2 lg:w-1/3"
            />
          </div>

          {/* Scrollable grid for types */}
          <div className="overflow-y-auto max-h-[600px]">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" style={{ minHeight: 400 }}>
              {types.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500">No product types found. Create your first product type to get started.</p>
                </div>
              ) : (
                types
                  .filter(type =>
                    type.name.toLowerCase().includes(typeSearch.toLowerCase()) ||
                    (type.description && type.description.toLowerCase().includes(typeSearch.toLowerCase()))
                  )
                  .slice((typePage - 1) * itemsPerPage, typePage * itemsPerPage)
                  .map((type) => (
                    <Card key={type.id} className="h-fit">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">{type.name}</CardTitle>
                          <div className="flex gap-1">
                            {type.shopId == null ? (
                              <Badge variant="outline" className="text-blue-700 border-blue-400 text-xs px-1.5 py-0.5">Global</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-700 border-green-400 text-xs px-1.5 py-0.5">
                                {availableShops.find(shop => shop.id === type.shopId)?.name || 'Shop'}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTypeDialog(type)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-red-600 h-6 w-6 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product Type</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{type.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteType(type)}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={deletingTypeId === type.id}
                                  >
                                    {deletingTypeId === type.id ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 pt-0">
                        {type.description && (
                          <p className="text-xs text-gray-600 mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {type.description}
                          </p>
                        )}
                        <Badge variant={type.isActive ? "default" : "secondary"} className="text-xs px-2 py-0.5">
                          {type.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </div>

          {/* Type Pagination */}
          {getTotalTypePages() > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTypePageChange(typePage - 1)}
                disabled={typePage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {typePage} of {getTotalTypePages()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTypePageChange(typePage + 1)}
                disabled={typePage === getTotalTypePages()}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TMT Management Tab */}
        <TabsContent value="tmt" className="space-y-6">
          <div className="space-y-6">
            {/* TMT Companies Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  TMT Companies
                </h3>
                <Dialog open={tmtCompanyDialogOpen} onOpenChange={setTmtCompanyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openTmtCompanyDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingTmtCompany ? 'Edit TMT Company' : 'Add New TMT Company'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTmtCompanySubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          value={tmtCompanyForm.name}
                          onChange={(e) => setTmtCompanyForm({ ...tmtCompanyForm, name: e.target.value })}
                          placeholder="e.g., TATA Tiscon, Rungta Steel"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyLocation">Location</Label>
                        <Input
                          id="companyLocation"
                          value={tmtCompanyForm.location}
                          onChange={(e) => setTmtCompanyForm({ ...tmtCompanyForm, location: e.target.value })}
                          placeholder="e.g., Jamshedpur, India"
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyContact">Contact Info</Label>
                        <Input
                          id="companyContact"
                          value={tmtCompanyForm.contactInfo}
                          onChange={(e) => setTmtCompanyForm({ ...tmtCompanyForm, contactInfo: e.target.value })}
                          placeholder="e.g., www.tatatiscon.com"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setTmtCompanyDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingTmtCompany ? 'Update' : 'Create'} Company
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search companies..."
                  value={tmtCompanySearch}
                  onChange={e => setTmtCompanySearch(e.target.value)}
                  className="w-full md:w-1/2 lg:w-1/3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tmtCompanies
                  .filter(company =>
                    company.name.toLowerCase().includes(tmtCompanySearch.toLowerCase()) ||
                    (company.location && company.location.toLowerCase().includes(tmtCompanySearch.toLowerCase()))
                  )
                  .map((company) => (
                    <Card key={company.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{company.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTmtCompanyDialog(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {company.location && (
                          <p className="text-sm text-gray-600 mb-2">
                            {company.location}
                          </p>
                        )}
                        {company.contactInfo && (
                          <p className="text-sm text-gray-500 mb-3">
                            {company.contactInfo}
                          </p>
                        )}
                        <Badge variant={company.isActive ? "default" : "secondary"}>
                          {company.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>

            {/* TMT Sizes Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  TMT Sizes
                </h3>
                <Dialog open={tmtSizeDialogOpen} onOpenChange={setTmtSizeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openTmtSizeDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Size
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingTmtSize ? 'Edit TMT Size' : 'Add New TMT Size'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTmtSizeSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="sizeMm">Size (mm)</Label>
                        <Input
                          id="sizeMm"
                          type="number"
                          value={tmtSizeForm.sizeMm}
                          onChange={(e) => setTmtSizeForm({ ...tmtSizeForm, sizeMm: e.target.value })}
                          placeholder="e.g., 8, 10, 12"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="sizeDescription">Description</Label>
                        <Input
                          id="sizeDescription"
                          value={tmtSizeForm.description}
                          onChange={(e) => setTmtSizeForm({ ...tmtSizeForm, description: e.target.value })}
                          placeholder="e.g., 8mm TMT Bar"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setTmtSizeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingTmtSize ? 'Update' : 'Create'} Size
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search sizes..."
                  value={tmtSizeSearch}
                  onChange={e => setTmtSizeSearch(e.target.value)}
                  className="w-full md:w-1/2 lg:w-1/3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {tmtSizes
                  .filter(size =>
                    size.sizeMm.toString().includes(tmtSizeSearch) ||
                    (size.description && size.description.toLowerCase().includes(tmtSizeSearch.toLowerCase()))
                  )
                  .map((size) => (
                    <Card key={size.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{size.sizeMm}mm</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTmtSizeDialog(size)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {size.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {size.description}
                          </p>
                        )}
                        <Badge variant={size.isActive ? "default" : "secondary"}>
                          {size.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>

            {/* TMT Products Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  TMT Products
                </h3>
                <Dialog open={tmtProductDialogOpen} onOpenChange={setTmtProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openTmtProductDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTmtProduct ? 'Edit TMT Product' : 'Add New TMT Product'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTmtProductSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="productCompany">Company</Label>
                          <Select value={tmtProductForm.companyId} onValueChange={(value) => setTmtProductForm({ ...tmtProductForm, companyId: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {tmtCompanies.map((company) => (
                                <SelectItem key={company.id} value={company.id.toString()}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="productSize">Size</Label>
                          <Select value={tmtProductForm.sizeId} onValueChange={(value) => setTmtProductForm({ ...tmtProductForm, sizeId: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              {tmtSizes.map((size) => (
                                <SelectItem key={size.id} value={size.id.toString()}>
                                  {size.sizeMm}mm
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="productName">Product Name</Label>
                        <Input
                          id="productName"
                          value={tmtProductForm.productName}
                          onChange={(e) => setTmtProductForm({ ...tmtProductForm, productName: e.target.value })}
                          placeholder="e.g., TATA Tiscon 10mm TMT Bar"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="weightPerRod">Weight per Rod (kg)</Label>
                          <Input
                            id="weightPerRod"
                            type="number"
                            step="0.001"
                            value={tmtProductForm.weightPerRodKg}
                            onChange={(e) => setTmtProductForm({ ...tmtProductForm, weightPerRodKg: e.target.value })}
                            placeholder="e.g., 0.617"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="rodsPerBundle">Rods per Bundle</Label>
                          <Input
                            id="rodsPerBundle"
                            type="number"
                            value={tmtProductForm.rodsPerBundle}
                            onChange={(e) => setTmtProductForm({ ...tmtProductForm, rodsPerBundle: e.target.value })}
                            placeholder="e.g., 8"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="weightPerBundle">Weight per Bundle (kg)</Label>
                        <Input
                          id="weightPerBundle"
                          type="number"
                          step="0.001"
                          value={tmtProductForm.weightPerBundleKg}
                          onChange={(e) => setTmtProductForm({ ...tmtProductForm, weightPerBundleKg: e.target.value })}
                          placeholder="e.g., 4.936"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="defaultUnit">Default Unit</Label>
                        <Select value={tmtProductForm.defaultUnit} onValueChange={(value) => setTmtProductForm({ ...tmtProductForm, defaultUnit: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select default unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BUNDLE">Bundle</SelectItem>
                            <SelectItem value="PIECE">Piece</SelectItem>
                            <SelectItem value="KG">Kilogram</SelectItem>
                            <SelectItem value="TON">Ton</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Shop Assignment Section */}
                      <div className="border-t pt-4">
                        <Label className="text-base font-semibold">Shop Assignment</Label>
                        <p className="text-sm text-gray-600 mb-3">Choose whether this TMT product should be available globally or assigned to a specific shop</p>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="global-assignment"
                              name="shopAssignment"
                              value="global"
                              checked={tmtProductForm.shopAssignment === 'global'}
                              onChange={(e) => setTmtProductForm({ ...tmtProductForm, shopAssignment: e.target.value, assignedShopId: '' })}
                              className="h-4 w-4 text-blue-600"
                            />
                            <Label htmlFor="global-assignment" className="text-sm font-medium">
                              Assign to All Shops (Global)
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="shop-assignment"
                              name="shopAssignment"
                              value="shop"
                              checked={tmtProductForm.shopAssignment === 'shop'}
                              onChange={(e) => setTmtProductForm({ ...tmtProductForm, shopAssignment: e.target.value })}
                              className="h-4 w-4 text-blue-600"
                            />
                            <Label htmlFor="shop-assignment" className="text-sm font-medium">
                              Assign to Specific Shop
                            </Label>
                          </div>

                          {tmtProductForm.shopAssignment === 'shop' && (
                            <div className="ml-6">
                              <Label htmlFor="assignedShop">Select Shop</Label>
                              {/* Shop selection dropdown */}
                              <Select
                                value={tmtProductForm.assignedShopId}
                                onValueChange={(value) => setTmtProductForm({ ...tmtProductForm, assignedShopId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a shop" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableShops.length > 0 ? (
                                    availableShops.map((shop) => (
                                      <SelectItem key={shop.id} value={shop.id.toString()}>
                                        {shop.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value={shopId.toString()}>
                                      Current Shop (ID: {shopId})
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setTmtProductDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingTmtProduct ? 'Update' : 'Create'} Product
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={tmtProductSearch}
                  onChange={e => setTmtProductSearch(e.target.value)}
                  className="w-full md:w-1/2 lg:w-1/3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(tmtProducts) ? tmtProducts
                  .filter(product =>
                    product.productName.toLowerCase().includes(tmtProductSearch.toLowerCase()) ||
                    (product.company?.name && product.company.name.toLowerCase().includes(tmtProductSearch.toLowerCase()))
                  )
                  .map((product) => (
                    <Card key={product.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{product.productName}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openTmtProductDialog(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            <strong>Company:</strong> {product.company?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Size:</strong> {product.size?.sizeMm || 'Unknown'}mm
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Weight per Rod:</strong> {product.weightPerRodKg} kg
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Rods per Bundle:</strong> {product.rodsPerBundle}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Weight per Bundle:</strong> {product.weightPerBundleKg} kg
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant={product.isActive ? "default" : "secondary"}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              Default: {product.defaultUnit}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No TMT products found
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TMT Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Scale className="h-5 w-5" />
              TMT Inventory
            </h3>
          </div>

          {tmtLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading inventory...</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* TMT Products Grid */}
              {Array.isArray(tmtProducts) ? tmtProducts.map((product) => (
                <Card key={product.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{product.productName}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 h-6 w-6 p-0"
                          onClick={() => openTmtProductDialog(product)}
                          title="Edit TMT product"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          onClick={() => handleDeleteTmtProduct(product)}
                          title="Delete TMT product"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>Company:</strong> {product.company?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Size:</strong> {product.size?.sizeMm || 'Unknown'}mm
                      </p>
                      <div className="mt-4 space-y-1">
                        <p className="text-sm">
                          <strong>Available:</strong> {product.availableQtyKg?.toFixed(2) || '0.00'} kg
                        </p>
                        <p className="text-sm text-gray-600">
                          ≈ {((product.availableQtyKg || 0) / product.weightPerBundleKg).toFixed(1)} bundles
                        </p>
                        <p className="text-sm text-gray-600">
                          ≈ {((product.availableQtyKg || 0) / product.weightPerRodKg).toFixed(0)} pieces
                        </p>
                        <p className="text-sm text-gray-600">
                          ≈ {((product.availableQtyKg || 0) / 1000).toFixed(3)} tons
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No TMT products available
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 