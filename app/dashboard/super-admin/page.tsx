"use client"

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NotificationBell } from '@/app/components/notification-bell'
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  UserPlus,
  Settings,
  BarChart3,
  Activity,
  Shield,
  Globe,
  Database,
  RefreshCw,
  TrendingDown,
  Truck,
  UserCheck,
  GripVertical,
  Eye,
  EyeOff,
  X,
  Loader2
} from "lucide-react"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "../../contexts/ShopContext"
import { UserAssignmentManager } from "../../components/user-assignment-manager"
import { CreateShopDialog } from "@/app/components/create-shop-dialog"
import { UserManagementDialog } from "@/app/components/user-management-dialog"
import { AnalyticsDialog } from "@/app/components/analytics-dialog"
import { SystemSettingsDialog } from "@/app/components/system-settings-dialog"
import { PasswordChangeDialog } from "@/app/components/password-change-dialog"
import { ShopDeletionDialog } from "@/app/components/shop-deletion-dialog"
import { BackupManager } from "@/app/components/backup-manager"
import { CategoryManager } from "@/app/components/category-manager"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs as InnerTabs, TabsList as InnerTabsList, TabsTrigger as InnerTabsTrigger, TabsContent as InnerTabsContent } from "@/components/ui/tabs"
import { shopService } from "@/app/lib/services/shopService"
import { toast } from "sonner"
import { useShopLimits } from "@/app/hooks/use-shop-limits"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts"
import { useSearchParams, useRouter } from "next/navigation"

interface ShopStats {
  id: number
  name: string
  location: string
  totalSales: number
  totalProducts: number
  totalCustomers: number
  totalEmployees: number
  recentSales: number
  assignedUsers: number
}

interface SystemStats {
  totalShops: number
  totalUsers: number
  totalSales: number
  totalRevenue: number
  activeShops: number
  totalProducts: number
  totalCustomers: number
  totalEmployees: number
  totalExpenses: number
  totalSupplierPayments: number
  totalEmployeePayments: number
}

interface WidgetConfig {
  id: string
  title: string
  visible: boolean
  order: number
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'totalShops', title: 'Total Shops', visible: true, order: 0 },
  { id: 'totalUsers', title: 'Total Users', visible: true, order: 1 },
  { id: 'totalSales', title: 'Total Sales', visible: true, order: 2 },
  { id: 'totalRevenue', title: 'Total Revenue', visible: true, order: 3 },
  { id: 'totalExpenses', title: 'Total Expenses', visible: true, order: 4 },
  { id: 'totalSupplierPayments', title: 'Supplier Payments', visible: true, order: 5 },
  { id: 'totalEmployeePayments', title: 'Employee Payments', visible: true, order: 6 },
]

function SuperDuperAdminDashboardContent() {
  console.log('🔍 [SuperDuperAdminDashboard] Component rendering')
  // All hooks must be before any return!
  const { t } = useLanguage()
  const { userRole, setCurrentShop, shops: contextShops, currentShopId, refreshShops } = useShop()
  const { canCreate: canCreateShop, currentCount: shopCount, limit: shopLimit, loading: limitsLoading, refreshLimits } = useShopLimits()
  console.log('🔍 [SuperDuperAdminDashboard] useShop result:', {
    userRole,
    contextShopsCount: contextShops.length,
    currentShopId
  })
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalShops: 0,
    totalUsers: 0,
    totalSales: 0,
    totalRevenue: 0,
    activeShops: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalEmployees: 0,
    totalExpenses: 0,
    totalSupplierPayments: 0,
    totalEmployeePayments: 0
  })


  // Handle create shop button click with limit checking
  const handleCreateShopClick = () => {
    if (!canCreateShop) {
      toast.error("Shop Creation Limit Reached", {
        description: `You have reached the maximum number of shops (${shopCount}/${shopLimit}). Upgrade your plan to create more shops.`,
        duration: 5000,
      })
      return
    }
    // The CreateShopDialog will handle the rest
  }
  const [shops, setShops] = useState<ShopStats[]>([])
  const [revenueByShopToday, setRevenueByShopToday] = useState<{ shopId: number; name: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedShop, setSelectedShop] = useState<number | null>(null)
  const [localUserRole, setLocalUserRole] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ activityLog: any[]; loginLog: any[] }>({ activityLog: [], loginLog: [] })
  const [shopLogs, setShopLogs] = useState<{ activityLog: any[]; loginLog: any[] }>({ activityLog: [], loginLog: [] })
  const [activeTab, setActiveTab] = useState("overview")
  const [shopDialogOpen, setShopDialogOpen] = useState(false)
  const [shopDialogShop, setShopDialogShop] = useState<ShopStats | null>(null)
  const [shopDetails, setShopDetails] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [financials, setFinancials] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [logsTab, setLogsTab] = useState<'activity' | 'login'>('activity')
  const [logsSearch, setLogsSearch] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', date: '', category: 'OTHER' })
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false)
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<any[]>([])
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionDays, setTransactionDays] = useState(30)
  const [selectedTransactionShop, setSelectedTransactionShop] = useState<string>('all')

  // Widget management state
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [isEditMode, setIsEditMode] = useState(false)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)

  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab");

  const isSuperDuperAdmin = userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN'

  // Load widget preferences from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem('superAdminWidgets')
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets)
        // Merge with DEFAULT_WIDGETS to include any new widgets that were added
        const mergedWidgets = DEFAULT_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.find((w: WidgetConfig) => w.id === defaultWidget.id)
          if (savedWidget) {
            return savedWidget // Use saved preferences
          }
          return defaultWidget // Use default for new widgets
        })
        // Add any saved widgets that are not in DEFAULT_WIDGETS (for backward compatibility)
        parsed.forEach((savedWidget: WidgetConfig) => {
          if (!mergedWidgets.find((w: WidgetConfig) => w.id === savedWidget.id)) {
            mergedWidgets.push(savedWidget)
          }
        })
        setWidgets(mergedWidgets)
        // Save merged widgets back to localStorage
        localStorage.setItem('superAdminWidgets', JSON.stringify(mergedWidgets))
      } catch (e) {
        console.error('Failed to parse saved widgets:', e)
        setWidgets(DEFAULT_WIDGETS)
      }
    } else {
      setWidgets(DEFAULT_WIDGETS)
    }
  }, [])

  // Save widget preferences to localStorage
  const saveWidgetPreferences = (newWidgets: WidgetConfig[]) => {
    localStorage.setItem('superAdminWidgets', JSON.stringify(newWidgets))
    setWidgets(newWidgets)
  }

  // Toggle widget visibility
  const toggleWidgetVisibility = (widgetId: string) => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    )
    saveWidgetPreferences(updated)
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidget(widgetId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', widgetId)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, targetWidgetId?: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (targetWidgetId && draggedWidget && draggedWidget !== targetWidgetId) {
      setDragOverWidget(targetWidgetId)
    }
  }

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverWidget(null)
  }

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault()
    setDragOverWidget(null)

    if (!draggedWidget || draggedWidget === targetWidgetId) {
      setDraggedWidget(null)
      return
    }

    const widgetArray = [...widgets]
    const draggedIndex = widgetArray.findIndex(w => w.id === draggedWidget)
    const targetIndex = widgetArray.findIndex(w => w.id === targetWidgetId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedItem] = widgetArray.splice(draggedIndex, 1)
      widgetArray.splice(targetIndex, 0, draggedItem)

      // Update order values
      const updated = widgetArray.map((w, idx) => ({ ...w, order: idx }))
      saveWidgetPreferences(updated)
    }

    setDraggedWidget(null)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  // Get visible widgets sorted by order
  const visibleWidgets = widgets
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order)

  // Debug logging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('userRole')
      setLocalUserRole(storedRole)
      console.log('🔍 SUPER_DUPER_ADMIN Dashboard - User Role from Context:', userRole)
      console.log('🔍 SUPER_DUPER_ADMIN Dashboard - User Role from localStorage:', storedRole)
      console.log('🔍 SUPER_DUPER_ADMIN Dashboard - Has Access:', userRole === 'SUPER_DUPER_ADMIN' || storedRole === 'SUPER_DUPER_ADMIN')
    }
  }, [userRole])

  // Load data when user role is available
  useEffect(() => {
    const hasAccess = userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN'
    if (hasAccess) {
      console.log('🔍 Loading SUPER_DUPER_ADMIN data...')
      console.log('🔍 Current token in localStorage:', localStorage.getItem('accessToken') ? 'Present' : 'Missing')
      console.log('🔍 Token preview:', localStorage.getItem('accessToken')?.substring(0, 50) + '...')
      loadSystemStats()
      loadShops()
    } else {
      console.log('❌ No access - User Role:', userRole, 'Local Role:', localUserRole)
    }
  }, [userRole, localUserRole]) // Keep dependencies stable

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const hasAccess = userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN'
    if (!hasAccess) return

    console.log('🔄 Setting up auto-refresh for analytics data...')
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing analytics data...')
      loadSystemStats(true)
      loadShops() // Also refresh shops to update today's revenue
    }, 30000) // Refresh every 30 seconds

    return () => {
      console.log('🔄 Clearing auto-refresh interval')
      clearInterval(interval)
    }
  }, [userRole, localUserRole])

  // Check if date changed (midnight reset) and refresh today's revenue
  useEffect(() => {
    const hasAccess = userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN'
    if (!hasAccess) return

    const checkDateChange = () => {
      const now = new Date()
      const currentDate = now.toDateString()
      const lastCheckedDate = localStorage.getItem('lastRevenueCheckDate')

      if (lastCheckedDate !== currentDate) {
        console.log('🔄 Date changed (midnight reset), refreshing today\'s revenue...')
        localStorage.setItem('lastRevenueCheckDate', currentDate)
        loadShops() // Refresh to get new day's revenue
      }
    }

    // Check immediately
    checkDateChange()

    // Check every minute to catch midnight
    const dateCheckInterval = setInterval(checkDateChange, 60000)

    return () => {
      clearInterval(dateCheckInterval)
    }
  }, [userRole, localUserRole])

  // Add a refresh button handler
  const handleRefreshShops = async () => {
    console.log('🔄 Manual refresh triggered')
    setLoading(true)
    await loadShops()
  }

  const handleRefreshAnalytics = async () => {
    console.log('🔄 Refreshing all analytics data...')
    setAnalyticsLoading(true)
    try {
      // Refresh all analytics data
      await Promise.all([
        loadSystemStats(),
        loadShops()
      ])
      console.log('✅ Analytics data refreshed successfully')
    } catch (error) {
      console.error('❌ Error refreshing analytics data:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Load shops data when component mounts
  useEffect(() => {
    console.log('🔄 Component mounted, loading shops data...')
    loadShops()
  }, [])

  // Refresh analytics data when Analytics tab is accessed
  useEffect(() => {
    if (activeTab === 'analytics') {
      console.log('🔄 Analytics tab accessed, refreshing all analytics data...')
      handleRefreshAnalytics()
    }
  }, [activeTab])

  // Load shop details and analytics when dialog opens
  useEffect(() => {
    if (shopDialogOpen && shopDialogShop) {
      setEditing(false)
      setSaving(false)
      setDeleting(false)
      setShopDetails(null)
      setAnalytics(null)
      setFinancials(null)
      setExpenses([])
      setShopLogs({ activityLog: [], loginLog: [] })
      setLogsLoading(true)
      // Fetch shop details
      shopService.fetchShopById(shopDialogShop.id).then(setShopDetails)
      // Fetch analytics
      setAnalyticsLoading(true)
      shopService.getShopStats(shopDialogShop.id).then((data) => {
        setAnalytics(data)
        setAnalyticsLoading(false)
      })
      // Fetch expenses
      fetch(`/api/expenses?shopId=${shopDialogShop.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })
        .then(res => res.json())
        .then(data => setExpenses(data.data?.expenses || []))
      // Fetch logs (activity & login) - show shop-specific logs
      fetch(`/api/shops/${shopDialogShop.id}/logs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setShopLogs({
              activityLog: data.data?.activityLog || [],
              loginLog: data.data?.loginLog || []
            })
          } else {
            console.error('Failed to fetch shop logs:', data.message)
            setShopLogs({ activityLog: [], loginLog: [] })
          }
          setLogsLoading(false)
        })
        .catch(error => {
          console.error('Error fetching shop logs:', error)
          setShopLogs({ activityLog: [], loginLog: [] })
          setLogsLoading(false)
        })
    }
  }, [shopDialogOpen, shopDialogShop])

  // Check if user has SUPER_DUPER_ADMIN or SUPER_ADMIN role
  const hasAccess = userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN' || userRole === 'SUPER_ADMIN' || localUserRole === 'SUPER_ADMIN'

  const loadSystemStats = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      }
      console.log('🔍 Loading system-wide statistics...', isRefresh ? '(refresh)' : '(initial)')
      const response = await fetch('/api/analytics/system', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ System stats loaded:', data.data)
        console.log('🔍 Payment method breakdown from API:', data.data.paymentMethodBreakdown)

        if (data.success && data.data) {
          setSystemStats({
            totalShops: data.data.totalShops || 0,  // ✅ No need to subtract 1 anymore
            totalUsers: data.data.totalUsers || 0,
            totalSales: data.data.totalSales || 0,
            totalRevenue: data.data.totalRevenue || 0,
            activeShops: data.data.activeShops || 0,  // ✅ No need to subtract 1 anymore
            totalProducts: data.data.totalProducts || 0,
            totalCustomers: data.data.totalCustomers || 0,
            totalEmployees: data.data.totalEmployees || 0,
            totalExpenses: data.data.totalExpenses || 0,
            totalSupplierPayments: data.data.totalSupplierPayments || 0,
            totalEmployeePayments: data.data.totalEmployeePayments || 0
          })

          if (data.data.paymentMethodBreakdown) {
            setPaymentMethodBreakdown(data.data.paymentMethodBreakdown)
          } else {
            setPaymentMethodBreakdown([])
          }

          // Set logs if present (either activity or login logs)
          console.log('🔍 [Frontend] Setting logs:', {
            activityLogCount: data.data.activityLog?.length || 0,
            loginLogCount: data.data.loginLog?.length || 0,
            activityLogSample: data.data.activityLog?.[0],
            loginLogSample: data.data.loginLog?.[0]
          })
          setLogs({
            activityLog: data.data.activityLog || [],
            loginLog: data.data.loginLog || []
          })

          // Update last updated time
          setLastUpdated(new Date())
        }
      } else {
        console.error('❌ Failed to load system stats:', response.status, response.statusText)
        const errorData = await response.json()
        console.error('❌ Error details:', errorData)

        // Show user-friendly error message
        toast.error('Failed to load analytics data', {
          description: errorData.message || `Server returned ${response.status}: ${response.statusText}`,
          duration: 5000
        })
      }
    } catch (error) {
      console.error('❌ Error loading system stats:', error)
      toast.error('Failed to load analytics data', {
        description: 'Network error or invalid response',
        duration: 5000
      })
    } finally {
      if (isRefresh) {
        setRefreshing(false)
      }
    }
  }

  const loadShops = async () => {
    try {
      console.log('🔍 Loading shops data...')

      // Check if we have a valid token
      const token = localStorage.getItem('accessToken')
      console.log('🔍 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'No token')

      // Check if token is malformed
      if (token && (token.includes('undefined') || token.includes('null') || token.length < 10)) {
        console.error('❌ Malformed token detected, clearing localStorage')
        localStorage.removeItem('accessToken')
        setShops([])
        setLoading(false)
        return
      }

      if (!token || token === 'undefined' || token === 'null') {
        console.error('❌ No valid token found in localStorage')
        setShops([])
        setLoading(false)
        return
      }

      // Clear cache first
      try {
        await fetch('/api/debug/clear-cache', { method: 'POST' })
        console.log('🧹 Cache cleared')
      } catch (cacheError) {
        console.log('⚠️ Could not clear cache:', cacheError)
      }

      // Try the API call first
      const response = await fetch('/api/shops/user-assigned', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('🔍 API Response status:', response.status)

      if (response.ok) {
        const shopsData = await response.json()
        console.log('✅ Shops data loaded:', shopsData)
        console.log('✅ Shops data structure:', {
          success: shopsData.success,
          hasData: !!shopsData.data,
          hasShops: !!(shopsData.data && shopsData.data.shops),
          shopsLength: shopsData.data?.shops?.length || 0
        })
        console.log('✅ API response received:', shopsData.success ? 'Success' : 'Failed')

        if (shopsData.success && shopsData.data && shopsData.data.shops) {
          console.log('✅ Setting shops:', shopsData.data.shops.length, 'shops')
          console.log('✅ Raw shop data with assignedUsers:', shopsData.data.shops.map((s: any) => ({ name: s.name, assignedUsers: s.assignedUsers })))
          setShops(shopsData.data.shops)
          // Also refresh the ShopContext so the sidebar updates
          refreshShops()
          // Fetch today's revenue by shop (system analytics, last 1 day)
          try {
            const analyticsRes = await fetch('/api/analytics/system?days=1', {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (analyticsRes.ok) {
              const analyticsJson = await analyticsRes.json()
              const list = (analyticsJson?.data?.revenueByShop || []).map((r: any) => ({
                shopId: Number(r.shopId),
                name: r.shopName || r.name || `Shop ${r.shopId}`,
                amount: r.amount !== undefined ? Number(r.amount) : Number(r._sum?.finalAmount || 0)
              }))
              setRevenueByShopToday(list)
            }
          } catch (e) {
            console.error('Failed to load revenue by shop (today):', e)
          }
        } else {
          console.error('❌ Invalid shops data format:', shopsData)
          setShops([])
        }
      } else {
        console.error('❌ Failed to load shops:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('❌ Error response:', errorText)

        // If token is invalid, try direct database call as fallback
        if (response.status === 401) {
          console.log('🔧 Token invalid, trying direct database call...')
          try {
            const directResponse = await fetch('/api/shops/direct', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })

            if (directResponse.ok) {
              const directData = await directResponse.json()
              if (directData.success && directData.data && directData.data.shops) {
                console.log('✅ Direct call successful, setting shops:', directData.data.shops.length)
                setShops(directData.data.shops)
                refreshShops()
                return
              }
            }
          } catch (directError) {
            console.error('❌ Direct call also failed:', directError)
          }
        }

        setShops([])
        toast.error('Failed to load shops data', {
          description: 'Unable to fetch shop information',
          duration: 5000
        })
      }
    } catch (error) {
      console.error('❌ Error loading shops:', error)
      setShops([])
      toast.error('Failed to load shops data', {
        description: 'Network error or invalid response',
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  const regenerateToken = async () => {
    try {
      console.log('🔧 Attempting to regenerate token from NextAuth session...')

      // Try to get fresh session and regenerate token
      const { getSession } = await import('next-auth/react')
      const session = await getSession()

      if (session && (session as any).apiToken) {
        console.log('✅ Found fresh API token in session')
        localStorage.setItem('accessToken', (session as any).apiToken)
        await loadShops()
      } else {
        console.log('❌ No API token in session, redirecting to login')
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('❌ Error regenerating token:', error)
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      'SUPER_DUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'SUPER_ADMIN': 'bg-red-100 text-red-800',
      'ADMIN': 'bg-blue-100 text-blue-800',
      'STAFF': 'bg-green-100 text-green-800'
    }

    return (
      <Badge className={roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    )
  }

  // Shop Details handlers
  const handleEditDetails = () => setEditing(true)
  const handleCancelEdit = () => {
    setEditing(false)
    setShopDetails(shopDialogShop)
  }
  const handleSaveDetails = async () => {
    if (!shopDetails || !shopDialogShop) return
    setSaving(true)
    const updated = await shopService.updateShop(shopDialogShop.id, shopDetails)
    if (updated) {
      toast.success('Shop updated!')
      setEditing(false)
      setShopDialogShop({ ...shopDialogShop, ...shopDetails })
    }
    setSaving(false)
  }
  const handleDeleteShop = async () => {
    if (!shopDialogShop) return
    setDeletionDialogOpen(true)
  }
  // Expense handlers
  const handleAddExpense = async (e: any) => {
    e.preventDefault()
    if (!shopDialogShop) return
    setExpenseLoading(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ ...expenseForm, shopId: shopDialogShop.id })
    })
    const data = await res.json()
    if (data.success) {
      setExpenses([data.data, ...expenses])
      setExpenseForm({ amount: '', description: '', date: '', category: 'OTHER' })
      toast.success('Expense added!')
    } else {
      toast.error(data.message || 'Failed to add expense')
    }
    setExpenseLoading(false)
  }
  // Load all transactions
  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const shopFilter = selectedTransactionShop !== 'all' ? `&shopId=${selectedTransactionShop}` : ''
      const response = await fetch(`/api/transactions/all?days=${transactionDays}${shopFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTransactions(data.data || [])
        } else {
          toast.error(data.message || 'Failed to load transactions')
        }
      } else {
        toast.error('Failed to load transactions')
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
      toast.error('Error loading transactions')
    } finally {
      setTransactionsLoading(false)
    }
  }, [transactionDays, selectedTransactionShop])

  // Load transactions when tab is active, days change, or shop changes
  useEffect(() => {
    if (activeTab === 'transactions' && isSuperDuperAdmin) {
      loadTransactions()
    }
  }, [activeTab, loadTransactions, isSuperDuperAdmin])

  // Export CSV
  const exportCSV = (rows: any[], headers: string[], filename: string) => {
    const csv = [headers.join(','), ...rows.map(row => headers.map(h => row[h]).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Access check - must be after all hooks
  if (!hasAccess) {
    console.log('❌ Access Denied - User Role:', userRole, 'Local Role:', localUserRole)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            This dashboard is only accessible to SUPER_DUPER_ADMIN users.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {userRole || localUserRole || 'Unknown'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Please log in with a SUPER_DUPER_ADMIN account to access this dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SUPER_DUPER_ADMIN Dashboard</h1>
          <p className="text-muted-foreground">
            Complete system management and oversight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {isEditMode ? "Done Editing" : "Edit Widgets"}
          </Button>
          <NotificationBell />
          <Badge variant="destructive" className="text-sm">
            SUPER_DUPER_ADMIN
          </Badge>
        </div>
      </div>

      {/* Widget Configuration Modal */}
      {isEditMode && (
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Widget Settings
              </span>
              <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Overview Widgets</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Drag widgets to reorder or toggle visibility. Changes are saved automatically.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {widgets.map((widget, widgetIndex) => (
                    <div
                      key={widget.id}
                      draggable={isEditMode}
                      onDragStart={(e) => handleDragStart(e, widget.id)}
                      onDragOver={(e) => handleDragOver(e, widget.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, widget.id)}
                      onDragEnd={handleDragEnd}
                      style={isEditMode && draggedWidget !== widget.id ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border-2 transition-all
                        ${draggedWidget === widget.id ? 'opacity-50 border-blue-500 scale-95' : 'border-gray-200'}
                        ${dragOverWidget === widget.id && draggedWidget !== widget.id ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''}
                        ${isEditMode && draggedWidget !== widget.id ? 'cursor-move bg-white hover:border-blue-300 widget-edit-wobble' : isEditMode ? 'cursor-move bg-white hover:border-blue-300' : 'bg-gray-50'}
                      `}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {isEditMode && (
                          <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        )}
                        <span className="text-sm font-medium">{widget.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className="h-8 w-8 p-0"
                        title={widget.visible ? 'Hide widget' : 'Show widget'}
                      >
                        {widget.visible ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {visibleWidgets.map((widget, widgetIndex) => {
          const isDragging = draggedWidget === widget.id
          const isDragOver = dragOverWidget === widget.id && !isDragging

          const renderWidget = () => {
            switch (widget.id) {
              case 'totalShops':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{systemStats.totalShops}</div>
                      <p className="text-xs text-muted-foreground">
                        Active shops in system
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalUsers':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground">
                        Registered users
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalSales':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{(systemStats.totalSales ?? 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalRevenue':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(systemStats.totalRevenue ?? 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalExpenses':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(systemStats.totalExpenses ?? 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalSupplierPayments':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Supplier Payments</CardTitle>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(systemStats.totalSupplierPayments ?? 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalEmployeePayments':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWidgetVisibility(widget.id)}
                          className="h-6 w-6 p-0"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Employee Payments</CardTitle>
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(systemStats.totalEmployeePayments ?? 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        All time
                      </p>
                    </CardContent>
                  </Card>
                )

              default:
                return null
            }
          }

          return <div key={widget.id}>{renderWidget()}</div>
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="shops" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Shops
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.activityLog && logs.activityLog.length > 0 ? (
                    logs.activityLog.slice(0, 5).map((log: any, index: number) => {
                      console.log('🔍 Activity log item:', log, 'createdAt type:', typeof log.createdAt, 'createdAt value:', log.createdAt);
                      return (
                        <div key={log.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${log.action?.includes('create') ? 'bg-green-500' :
                                log.action?.includes('update') ? 'bg-blue-500' :
                                  log.action?.includes('delete') ? 'bg-red-500' :
                                    'bg-gray-500'
                              }`}></div>
                            <div>
                              <p className="font-medium">{log.action || 'Unknown action'}</p>
                              <p className="text-sm text-gray-500">
                                {log.user?.name || log.user?.email || log.userId} • {log.resource || 'Unknown resource'}
                              </p>
                              {log.details && (
                                <p className="text-xs text-gray-400">{log.details}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {(() => {
                              try {
                                const date = new Date(log.createdAt);
                                if (isNaN(date.getTime())) {
                                  return 'Invalid Date';
                                }
                                return date.toLocaleString();
                              } catch (error) {
                                console.error('Date parsing error:', error, 'log.createdAt:', log.createdAt);
                                return 'Invalid Date';
                              }
                            })()}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Debug Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Debug Information
                </CardTitle>
                <CardDescription>
                  Current authentication and system status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">User Role:</span>
                    <span className="font-medium">{userRole || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Local Role:</span>
                    <span className="font-medium">{localUserRole || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shops Count:</span>
                    <span className="font-medium">{shops.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">System Shops:</span>
                    <span className="font-medium">{systemStats.totalShops}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loaded Shops:</span>
                    <span className="font-medium">{shops.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Shop Limits:</span>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-medium">{shopCount}/{shopLimit} shops</div>
                        <div className="text-xs text-gray-500">
                          {!canCreateShop ? 'Limit Reached' : `${shopLimit - shopCount} remaining`}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshLimits}
                        disabled={limitsLoading}
                        className="h-6 px-2 text-xs"
                        title="Refresh shop limits"
                      >
                        {limitsLoading ? '...' : '↻'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Token Status:</span>
                    <span className="font-medium">
                      {localStorage.getItem('accessToken') ? 'Present' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loading State:</span>
                    <span className="font-medium">{loading ? 'Loading...' : 'Idle'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Links
                </CardTitle>
                <CardDescription>
                  Access important management sections quickly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {isSuperDuperAdmin && (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => setShowPasswordDialog(true)}>
                      <Shield className="h-4 w-4" /> Change Password
                    </Button>
                  )}
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setShowUserDialog(true)}>
                    <UserPlus className="h-4 w-4" /> Add User
                  </Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setShowSettingsDialog(true)}>
                    <Settings className="h-4 w-4" /> System Settings
                  </Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setActiveTab('shops')}>
                    <Building2 className="h-4 w-4" /> Manage Shops
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shops Tab */}
        <TabsContent value="shops" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Shops
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshShops}
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshLimits}
                    disabled={limitsLoading}
                    title="Refresh subscription limits"
                    className="flex items-center gap-1"
                  >
                    {limitsLoading ? '...' : (
                      <>
                        <span className="font-medium">{shopCount}/{shopLimit}</span>
                        <span className="text-xs text-gray-500">shops</span>
                        <span className="text-xs">↻</span>
                      </>
                    )}
                  </Button>
                  <CreateShopDialog onShopCreated={loadShops} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading shops...</p>
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-2">No shops found</p>
                  <p className="text-sm text-gray-400">
                    {userRole === 'SUPER_DUPER_ADMIN'
                      ? 'Create your first shop or check if you are properly authenticated.'
                      : 'You are not assigned to any shops. Contact your administrator.'
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shops.map((shop) => (
                    <Card key={shop.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{shop.name}</h3>
                            <p className="text-sm text-gray-500">{shop.location}</p>
                          </div>
                          <Badge variant="outline">{shop.assignedUsers} users</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Sales</p>
                            <p className="font-medium">{shop.totalSales}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Products</p>
                            <p className="font-medium">{shop.totalProducts}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Customers</p>
                            <p className="font-medium">{shop.totalCustomers}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Employees</p>
                            <p className="font-medium">{shop.totalEmployees}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            className="flex-1"
                            size="sm"
                            onClick={() => {
                              setShopDialogShop(shop);
                              setShopDialogOpen(true);
                            }}
                          >
                            Manage Shop
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log('🔍 [SuperAdmin] Setting selectedShop to:', shop.id, 'type:', typeof shop.id);
                              setSelectedShop(shop.id);
                              setActiveTab("users");
                            }}
                          >
                            Manage Users
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Shop Management Dialog */}
          <Dialog open={shopDialogOpen} onOpenChange={setShopDialogOpen}>
            <DialogContent className="max-w-3xl w-full">
              <DialogHeader>
                <DialogTitle>Manage Shop: {shopDialogShop?.name}</DialogTitle>
              </DialogHeader>
              <InnerTabs defaultValue="details" className="space-y-4">
                <InnerTabsList className="mb-4">
                  <InnerTabsTrigger value="details">Shop Details</InnerTabsTrigger>
                  <InnerTabsTrigger value="users">User Assignment</InnerTabsTrigger>
                  <InnerTabsTrigger value="analytics">Analytics</InnerTabsTrigger>
                  <InnerTabsTrigger value="financials">Financials</InnerTabsTrigger>
                  <InnerTabsTrigger value="logs">Logs</InnerTabsTrigger>
                </InnerTabsList>
                <InnerTabsContent value="details">
                  {shopDetails ? (
                    <form className="space-y-3" onSubmit={e => { e.preventDefault(); handleSaveDetails() }}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input type="text" className="w-full border rounded p-2" value={shopDetails.name || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Location</label>
                        <input type="text" className="w-full border rounded p-2" value={shopDetails.location || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, location: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <input type="text" className="w-full border rounded p-2" value={shopDetails.address || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, address: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <input type="text" className="w-full border rounded p-2" value={shopDetails.phone || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, phone: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" className="w-full border rounded p-2" value={shopDetails.email || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, email: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">GST Number</label>
                        <input type="text" className="w-full border rounded p-2" value={shopDetails.gstNo || ''} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, gstNo: e.target.value })} placeholder="Enter GST number" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <select className="w-full border rounded p-2" value={shopDetails.isActive ? 'active' : 'inactive'} disabled={!editing} onChange={e => setShopDetails({ ...shopDetails, isActive: e.target.value === 'active' })}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {editing ? (
                          <>
                            <button type="submit" className="btn btn-primary" disabled={saving}>Save</button>
                            <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-primary" onClick={handleEditDetails}>Edit</button>
                        )}
                        <button type="button" className="btn btn-danger ml-auto" onClick={handleDeleteShop} disabled={deleting}>Delete Shop</button>
                      </div>
                    </form>
                  ) : (
                    <div className="text-center py-8">Loading shop details...</div>
                  )}
                </InnerTabsContent>
                <InnerTabsContent value="users">
                  <UserAssignmentManager shop={shopDialogShop || undefined} />
                </InnerTabsContent>
                <InnerTabsContent value="analytics">
                  {analyticsLoading ? (
                    <div className="text-center py-8">Loading analytics...</div>
                  ) : analytics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded">
                          <div className="font-medium">Total Sales</div>
                          <div className="text-2xl font-bold">{analytics.stats?.totalSales ?? 0}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded">
                          <div className="font-medium">Total Products</div>
                          <div className="text-2xl font-bold">{analytics.stats?.productCount ?? 0}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded">
                          <div className="font-medium">Total Customers</div>
                          <div className="text-2xl font-bold">{analytics.stats?.totalCustomers ?? 0}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded">
                          <div className="font-medium">Total Expenses</div>
                          <div className="text-2xl font-bold">₹{analytics.stats?.totalExpenses?.toLocaleString() ?? 0}</div>
                        </div>
                      </div>
                      {/* Sales Chart */}
                      <div className="mt-6">
                        <div className="font-medium mb-2">Recent Sales</div>
                        <div className="flex gap-2">
                          {analytics.recentSales?.map((sale: any, i: number) => (
                            <div key={i} className="p-2 bg-blue-50 rounded text-center">
                              <div className="text-xs">Sale #{sale.id}</div>
                              <div className="font-bold">₹{sale.totalAmount}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">No analytics data available</div>
                  )}
                </InnerTabsContent>
                <InnerTabsContent value="financials">
                  <div className="mb-4">
                    <form className="flex gap-2 items-end" onSubmit={handleAddExpense}>
                      <div>
                        <label className="block text-xs">Amount</label>
                        <input type="number" className="border rounded p-1 w-24" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                      </div>
                      <div>
                        <label className="block text-xs">Description</label>
                        <input type="text" className="border rounded p-1 w-40" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
                      </div>
                      <div>
                        <label className="block text-xs">Date</label>
                        <input type="date" className="border rounded p-1 w-32" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                      </div>
                      <div>
                        <label className="block text-xs">Category</label>
                        <select className="border rounded p-1 w-32" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} required>
                          <option value="OTHER">Other</option>
                          <option value="TRANSPORTATION">Transportation</option>
                          <option value="diesel">Diesel</option>
                          <option value="petrol">Petrol</option>
                          <option value="RENT">Rent</option>
                          <option value="ELECTRICITY">Electricity</option>
                          <option value="WATER">Water</option>
                          <option value="INTERNET">Internet</option>
                          <option value="SALARY">Salary</option>
                          <option value="MAINTENANCE">Maintenance</option>
                          <option value="MARKETING">Marketing</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={expenseLoading}>Add</button>
                    </form>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1">Amount</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1">Date</th>
                          <th className="px-2 py-1">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp, i) => (
                          <tr key={exp.id || i}>
                            <td className="px-2 py-1">₹{exp.amount}</td>
                            <td className="px-2 py-1">{exp.description}</td>
                            <td className="px-2 py-1">{new Date(exp.date).toLocaleDateString()}</td>
                            <td className="px-2 py-1">{exp.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn-secondary mt-2" onClick={() => exportCSV(expenses, ['amount', 'description', 'date', 'category'], 'expenses.csv')}>Export CSV</button>
                </InnerTabsContent>
                <InnerTabsContent value="logs">
                  <div className="mb-2 flex gap-2 items-center">
                    <input type="text" className="border rounded p-1 w-48" placeholder="Search logs..." value={logsSearch} onChange={e => setLogsSearch(e.target.value)} />
                    <button className={`btn btn-sm ${logsTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogsTab('activity')}>Activity</button>
                    <button className={`btn btn-sm ${logsTab === 'login' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogsTab('login')}>Login</button>
                    <button className="btn btn-secondary ml-auto" onClick={() => exportCSV(shopLogs[`${logsTab}Log` as keyof typeof shopLogs], ['userId', 'action', 'resource', 'details', 'createdAt', 'ipAddress'], logsTab + '-logs.csv')}>Export CSV</button>
                  </div>
                  {logsLoading ? (
                    <div className="text-center py-8">Loading logs...</div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr>
                            <th className="px-2 py-1">User</th>
                            <th className="px-2 py-1">Action</th>
                            <th className="px-2 py-1">Resource</th>
                            <th className="px-2 py-1">Details</th>
                            <th className="px-2 py-1">Time</th>
                            <th className="px-2 py-1">IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(shopLogs[`${logsTab}Log` as keyof typeof shopLogs] as any[])
                            .filter((log: any) => Object.values(log).some((val: any) => val && val.toString().toLowerCase().includes(logsSearch.toLowerCase())))
                            .map((log: any, i: number) => (
                              <tr key={log.id || i} className="border-b">
                                <td className="px-2 py-1">{log.user?.name || log.userId}</td>
                                <td className="px-2 py-1">{log.action}</td>
                                <td className="px-2 py-1">{log.resource}</td>
                                <td className="px-2 py-1">{log.details}</td>
                                <td className="px-2 py-1">{new Date(log.createdAt).toLocaleString()}</td>
                                <td className="px-2 py-1">{(() => {
                                  console.log('🔍 Activity log IP:', log.ipAddress, 'type:', typeof log.ipAddress);
                                  if (log.ipAddress &&
                                    log.ipAddress !== 'null' &&
                                    log.ipAddress !== 'undefined' &&
                                    log.ipAddress !== 'unknown' &&
                                    log.ipAddress !== 'system') {
                                    return log.ipAddress;
                                  }
                                  return 'N/A';
                                })()}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </InnerTabsContent>
              </InnerTabs>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-6">
          {(() => {
            console.log('🔍 [SuperAdmin] User Management Tab - selectedShop:', selectedShop);
            console.log('🔍 [SuperAdmin] User Management Tab - shops:', shops);
            const foundShop = shops.find(s => s.id === selectedShop);
            console.log('🔍 [SuperAdmin] User Management Tab - found shop:', foundShop);
            return null;
          })()}
          {selectedShop ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  User Management - {shops.find(s => s.id === selectedShop)?.name || 'Unknown Shop'}
                </h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('🔍 [SuperAdmin] Clearing selectedShop');
                    setSelectedShop(null);
                  }}
                >
                  Back to All Shops
                </Button>
              </div>
              {(() => {
                const shopToPass = shops.find(s => s.id === selectedShop);
                console.log('🔍 [SuperAdmin] Passing shop to UserAssignmentManager:', shopToPass);
                return <UserAssignmentManager shop={shopToPass} />;
              })()}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Select a Shop for User Management
                </CardTitle>
                <CardDescription>
                  Please select a shop from the dropdown below or click on a shop card to manage user assignments for that specific shop.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading shops...</p>
                  </div>
                ) : shops.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No shops available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shops.map((shop) => (
                      <Card key={shop.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold">{shop.name}</h3>
                              <p className="text-sm text-gray-500">{shop.location}</p>
                            </div>
                            <Badge variant="outline">{shop.assignedUsers} users</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-gray-500">Sales</p>
                              <p className="font-medium">{shop.totalSales}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Products</p>
                              <p className="font-medium">{shop.totalProducts}</p>
                            </div>
                          </div>
                          <Button
                            className="w-full"
                            size="sm"
                            onClick={() => setSelectedShop(shop.id)}
                          >
                            Manage Users
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Categories Management Tab */}
        <TabsContent value="categories" className="space-y-6">
          <div className="overflow-y-auto max-h-[700px]">
            <CategoryManager shopId={currentShopId} />
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Enhanced Analytics Button */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">System Analytics</h2>
              <p className="text-gray-600">Comprehensive insights across all shops</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRefreshAnalytics}
                disabled={analyticsLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                {analyticsLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Button
                onClick={() => window.open('/dashboard/analytics', '_blank')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Enhanced Analytics
              </Button>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(systemStats.totalRevenue ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(systemStats.totalExpenses ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Supplier Payments</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(systemStats.totalSupplierPayments ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Employee Payments</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(systemStats.totalEmployeePayments ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Revenue by Shop */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Revenue by Shop</CardTitle>
                <CardDescription>System-wide revenue breakdown (today)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-indigo-600">Total Today's Revenue</span>
                  <span className="font-semibold text-green-700">₹{Number((revenueByShopToday || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const revenueMap = new Map(revenueByShopToday.map((r) => [r.shopId, r.amount]));
                    return shops.map((shop) => {
                      const amount = revenueMap.get(shop.id) ?? 0;
                      return (
                        <div key={shop.id} className="flex items-center justify-between">
                          <span className="text-sm">{shop.name}</span>
                          <span className="font-medium">₹{Number(amount).toLocaleString()}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* User Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
                <CardDescription>Users assigned to each shop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    console.log('🔍 Rendering User Distribution - shops state:', shops);
                    console.log('🔍 Shop assignedUsers values:', shops.map((s: any) => ({ name: s.name, assignedUsers: s.assignedUsers })));
                    return shops.map((shop) => (
                      <div key={shop.id} className="flex items-center justify-between">
                        <span className="text-sm">{shop.name}</span>
                        <Badge variant="secondary">{shop.assignedUsers || 0} users</Badge>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Analytics Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Analytics Overview
              </CardTitle>
              <CardDescription>
                Comprehensive analytics for all shops in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    ₹{systemStats.totalRevenue?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {systemStats.totalSales?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Sales</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {systemStats.totalProducts?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Products</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {systemStats.totalCustomers?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Customers</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    ₹{systemStats.totalExpenses?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Expenses</div>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">
                    ₹{systemStats.totalSupplierPayments?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Supplier Payments</div>
                </div>
                <div className="p-4 bg-teal-50 rounded-lg">
                  <div className="text-2xl font-bold text-teal-600">
                    ₹{systemStats.totalEmployeePayments?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Employee Payments</div>
                </div>
              </div>


            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Transactions</CardTitle>
                  <CardDescription>Expenses, Supplier Payments, and Employee Payments</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Shop:</label>
                    <select
                      className="border rounded p-1 text-sm"
                      value={selectedTransactionShop}
                      onChange={(e) => setSelectedTransactionShop(e.target.value)}
                    >
                      <option value="all">All shops</option>
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Days:</label>
                    <select
                      className="border rounded p-1 text-sm"
                      value={transactionDays}
                      onChange={(e) => setTransactionDays(Number(e.target.value))}
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                      <option value={365}>Last year</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadTransactions}
                    disabled={transactionsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${transactionsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="text-center py-8">Loading transactions...</div>
              ) : transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Time</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Shop</th>
                        <th className="px-4 py-2 text-left">Category/Recipient</th>
                        <th className="px-4 py-2 text-left">Payment Method</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Description/Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{transaction.date}</td>
                          <td className="px-4 py-2">{transaction.time}</td>
                          <td className="px-4 py-2">
                            <Badge
                              variant={
                                transaction.type === 'expense'
                                  ? 'destructive'
                                  : transaction.type === 'supplier_payment'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {transaction.type === 'expense'
                                ? 'Expense'
                                : transaction.type === 'supplier_payment'
                                  ? 'Supplier Payment'
                                  : 'Employee Payment'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">{transaction.shopName}</td>
                          <td className="px-4 py-2">
                            {transaction.type === 'expense'
                              ? transaction.category || 'N/A'
                              : transaction.recipientName || 'N/A'}
                          </td>
                          <td className="px-4 py-2">
                            {transaction.paymentMethod || (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            ₹{Number(transaction.amount).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {transaction.description || transaction.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-gray-50">
                        <td colSpan={6} className="px-4 py-2 font-semibold text-right">
                          Total:
                        </td>
                        <td className="px-4 py-2 text-right font-bold">
                          ₹{transactions
                            .reduce((sum, t) => sum + Number(t.amount), 0)
                            .toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                        </td>
                        <td className="px-4 py-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No transactions found for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Management Tab */}
        <TabsContent value="backup" className="space-y-6">
          <BackupManager />
        </TabsContent>

        {/* Logs Tab (God Mode) */}
        <TabsContent value="logs" className="space-y-6">
          {userRole === 'SUPER_DUPER_ADMIN' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Activity Log</CardTitle>
                      {lastUpdated && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('🔄 Manual refresh of activity logs...')
                          loadSystemStats(true)
                        }}
                        disabled={refreshing}
                        className="text-xs"
                      >
                        {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1">User</th>
                          <th className="px-2 py-1">Action</th>
                          <th className="px-2 py-1">Resource</th>
                          <th className="px-2 py-1">Details</th>
                          <th className="px-2 py-1">Time</th>
                          <th className="px-2 py-1">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.activityLog.map((log, i) => (
                          <tr key={log.id || i} className="border-b">
                            <td className="px-2 py-1">{log.user?.name || log.user?.email || log.userId}</td>
                            <td className="px-2 py-1">{log.action}</td>
                            <td className="px-2 py-1">{log.resource}</td>
                            <td className="px-2 py-1">{log.details}</td>
                            <td className="px-2 py-1">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-1">{log.ipAddress && log.ipAddress !== 'null' && log.ipAddress !== 'undefined' ? log.ipAddress : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Login Log</CardTitle>
                      {lastUpdated && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('🔄 Manual refresh of login logs...')
                          loadSystemStats(true)
                        }}
                        disabled={refreshing}
                        className="text-xs"
                      >
                        {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1">User</th>
                          <th className="px-2 py-1">Success</th>
                          <th className="px-2 py-1">Reason</th>
                          <th className="px-2 py-1">Time</th>
                          <th className="px-2 py-1">IP</th>
                          <th className="px-2 py-1">User Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.loginLog && logs.loginLog.length > 0 ? logs.loginLog.map((log, i) => {
                          console.log('🔍 Login log item:', log, 'user data:', log.user);
                          console.log('🔍 User display data:', {
                            name: log.user?.name,
                            email: log.user?.email,
                            userId: log.userId,
                            displayValue: log.user?.name || log.user?.email || log.userId
                          });
                          return (
                            <tr key={log.id || i} className="border-b">
                              <td className="px-2 py-1" title={`User: ${log.user?.name || log.user?.email || log.userId}`}>
                                {log.user?.name || log.user?.email || log.userId}
                              </td>
                              <td className="px-2 py-1">{log.success ? 'Yes' : 'No'}</td>
                              <td className="px-2 py-1">{log.failureReason || '-'}</td>
                              <td className="px-2 py-1">{new Date(log.createdAt).toLocaleString()}</td>
                              <td className="px-2 py-1">{log.ipAddress && log.ipAddress !== 'null' && log.ipAddress !== 'undefined' ? log.ipAddress : 'N/A'}</td>
                              <td className="px-2 py-1">{log.userAgent}</td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={6} className="px-2 py-4 text-center text-gray-500">
                              No login logs found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center text-gray-500">Logs are only visible to SUPER_DUPER_ADMIN</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Shop Deletion Dialog */}
      {shopDialogShop && (
        <ShopDeletionDialog
          open={deletionDialogOpen}
          onOpenChange={setDeletionDialogOpen}
          shopId={shopDialogShop.id}
          shopName={shopDialogShop.name}
          onShopDeleted={() => {
            setShopDialogOpen(false)
            setShops(shops.filter(s => s.id !== shopDialogShop.id))
            setDeletionDialogOpen(false)
          }}
        />
      )}

      {/* Dialogs for Quick Links */}
      {isSuperDuperAdmin && (
        <PasswordChangeDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          trigger={null}
          userEmail={undefined}
          key="reset-password-dialog"
        />
      )}
      <UserManagementDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        onUserCreated={() => setShowUserDialog(false)}
      />
      <SystemSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onUserCreated={() => setShowSettingsDialog(false)}
      />
    </div>
  )
}

export default function SuperDuperAdminDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <SuperDuperAdminDashboardContent />
    </Suspense>
  )
} 