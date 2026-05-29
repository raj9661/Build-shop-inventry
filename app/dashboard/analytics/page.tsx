"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  BarChart3,
  Activity,
  Calendar,
  Target,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Settings,
  X,
  TrendingDown,
  Truck,
  UserCheck
} from "lucide-react"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  CartesianGrid,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { useLanguage } from "@/hooks/use-language"
import { useShop, ALL_SHOPS_ID } from "../../contexts/ShopContext"
import { toast } from "sonner"

interface AnalyticsData {
  totalRevenue: number
  totalSales: number
  totalProducts: number
  totalCustomers: number
  totalEmployees: number
  totalExpenses: number
  totalEmployeePayments?: number
  totalSupplierPayments?: number
  totalAllExpenses?: number
  netProfit?: number
  roi?: number
  ros?: number
  grossMargin?: number
  totalCustomerBalance?: number
  highestBalanceCustomers?: Array<{
    id: number
    name: string
    phone: string | null
    balance: number
    shopName: string
  }>
  revenueByShop: Array<{
    shopName: string
    revenue: number
    sales: number
  }>
  salesByMonth: Array<{
    month: string
    sales: number
    revenue: number
  }>
  expensesByMonth?: Array<{
    month: string
    expenses: number
  }>
  expensesByCategory?: Array<{
    category: string
    amount: number
  }>
  topProducts: Array<{
    name: string
    sales: number
    revenue: number
  }>
  topShops: Array<{
    name: string
    revenue: number
    sales: number
    customers: number
  }>
  paymentMethodBreakdown?: Array<{
    method: string
    amount: number
    count?: number
  }>
  salesByPaymentMethod?: Array<{
    method: string
    amount: number
    count: number
  }>
  businessMetrics?: Array<{
    id: number
    metricName: string
    value: number
    formula?: string
    period: string
    recordedAt: string | Date
    shopId: number
    shopName: string
  }>
  inventoryAnalytics?: Array<{
    id: number
    shopId: number
    productId: number
    shopName: string
    productName: string
    avgStock: number
    cogs: number
    turnoverRatio: number
    daysInInventory: number
    recordedAt: string | Date
  }>
  businessGoals?: Array<{
    id: number
    metricName: string
    targetValue: number
    period: string
    achieved: boolean
    achievedAt?: string | Date
    shopId: number
    shopName: string
  }>
}

interface WidgetConfig {
  id: string
  title: string
  visible: boolean
  order: number
  type?: 'metric' | 'chart'
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'totalRevenue', title: 'Total Revenue', visible: true, order: 0, type: 'metric' },
  { id: 'totalExpenses', title: 'Total Expenses', visible: true, order: 1, type: 'metric' },
  { id: 'totalSupplierPayments', title: 'Supplier Payments', visible: true, order: 2, type: 'metric' },
  { id: 'totalEmployeePayments', title: 'Employee Payments', visible: true, order: 3, type: 'metric' },
  { id: 'totalSales', title: 'Total Sales', visible: true, order: 4, type: 'metric' },
  { id: 'totalProducts', title: 'Total Products', visible: true, order: 5, type: 'metric' },
  { id: 'totalCustomers', title: 'Total Customers', visible: true, order: 6, type: 'metric' },
  { id: 'netProfit', title: 'Net Profit', visible: true, order: 7, type: 'metric' },
  { id: 'roi', title: 'ROI', visible: true, order: 8, type: 'metric' },
  { id: 'ros', title: 'ROS', visible: true, order: 9, type: 'metric' },
  { id: 'grossMargin', title: 'Gross Margin', visible: true, order: 10, type: 'metric' },
  { id: 'totalCustomerBalance', title: 'Total Customer Balance', visible: true, order: 11, type: 'metric' },
]

const DEFAULT_CHART_WIDGETS: WidgetConfig[] = [
  { id: 'revenueByShop', title: 'Revenue by Shop', visible: true, order: 0, type: 'chart' },
  { id: 'salesTrend', title: 'Sales Trend', visible: true, order: 1, type: 'chart' },
  { id: 'topProducts', title: 'Top Products', visible: true, order: 2, type: 'chart' },
  { id: 'salesByMonth', title: 'Sales by Month', visible: true, order: 3, type: 'chart' },
  { id: 'revenueDistribution', title: 'Revenue Distribution', visible: true, order: 4, type: 'chart' },
  { id: 'shopPerformance', title: 'Shop Performance', visible: true, order: 5, type: 'chart' },
  { id: 'paymentMethods', title: 'Payment Methods', visible: true, order: 6, type: 'chart' },
  { id: 'expenseTrend', title: 'Expense Trend', visible: true, order: 7, type: 'chart' },
  { id: 'expensesByCategory', title: 'Expenses by Category', visible: true, order: 8, type: 'chart' },
]

function HighestBalanceCustomersList({ customers, totalBalance }: { customers: NonNullable<AnalyticsData['highestBalanceCustomers']>, totalBalance?: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(customers.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleCustomers = customers.slice(startIndex, startIndex + itemsPerPage);

  if (customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-500">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>No customers with outstanding balance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 min-h-[300px]">
        {visibleCustomers.map((customer) => (
          <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">{customer.name}</p>
              <p className="text-xs text-muted-foreground">{customer.shopName} {customer.phone ? `• ${customer.phone}` : ''}</p>
            </div>
            <div className="font-bold text-red-600">
              ₹{customer.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {totalBalance !== undefined && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
          <span className="text-sm font-semibold text-red-900">Total Outstanding Balance</span>
          <span className="text-lg font-bold text-red-600">
            ₹{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { t } = useLanguage()
  const { userRole, shops, currentShopId, switchShop } = useShop()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("30")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [salesPage, setSalesPage] = useState(1)
  const [salesPerPage] = useState(5)
  const [isEditMode, setIsEditMode] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [chartWidgets, setChartWidgets] = useState<WidgetConfig[]>(DEFAULT_CHART_WIDGETS)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)

  // Add error handling
  const [error, setError] = useState<string | null>(null)

  // Business Goals state
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<any>(null)
  const [goalFormData, setGoalFormData] = useState({
    metricName: "",
    targetValue: "",
    period: "monthly",
    shopId: ""
  })

  // ── Cement Analytics ──
  interface CementBrandSales { quantity: number; revenue: number }
  interface CementBrandPurchase { quantity: number; totalCost: number; avgBuyingPrice: number; entryCount: number }
  interface CementMonthSales { month: string; brands: Record<string, CementBrandSales>; totalQuantity: number; totalRevenue: number }
  interface CementMonthPurchase { month: string; brands: Record<string, CementBrandPurchase>; totalQuantity: number; totalCost: number }
  interface CementData { salesByMonth: CementMonthSales[]; purchasesByMonth: CementMonthPurchase[]; allBrands: string[] }
  const [cementData, setCementData] = useState<CementData | null>(null)

  // Compute a human-readable label for the selected date range (used in chart subtitles)
  const dateRangeLabel = (() => {
    if (timeRange === 'all') return 'All time'
    if (timeRange === 'custom' && customFrom && customTo) return `${customFrom} → ${customTo}`
    if (timeRange === 'custom') return 'Custom range'
    if (timeRange === '7') return 'Last 7 days'
    if (timeRange === '30') return 'Last 30 days'
    if (timeRange === '90') return 'Last 90 days'
    if (timeRange === '365') return 'Last 12 months'
    return `Last ${timeRange} days`
  })()

  const [cementLoading, setCementLoading] = useState(false)
  const [cementLoaded, setCementLoaded] = useState(false)

  // Chart configuration with proper colors
  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(220, 100%, 50%)"
    },
    sales: {
      label: "Sales",
      color: "hsl(142, 100%, 40%)"
    },
    primary: {
      label: "Primary",
      color: "hsl(142, 100%, 40%)"
    },
    secondary: {
      label: "Secondary",
      color: "hsl(220, 100%, 50%)"
    }
  }

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('📊 Loading analytics for shop:', currentShopId, 'timeRange:', timeRange)
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        toast.error('Authentication required')
        return
      }

      // Determine which analytics endpoint to use based on user role
      let endpoint = '/api/analytics'

      // SUPER_DUPER_ADMIN uses system analytics, other users use their assigned shops
      if (userRole === 'SUPER_DUPER_ADMIN') {
        endpoint = '/api/analytics/system'
        const shopFilter = (currentShopId && currentShopId !== ALL_SHOPS_ID) ? `&shopId=${currentShopId}` : '';
        if (timeRange === 'all') {
          endpoint += `?days=36500${shopFilter}` // ~100 years = effectively all time
        } else if (timeRange === 'custom' && customFrom && customTo) {
          endpoint += `?from=${customFrom}&to=${customTo}${shopFilter}`
        } else {
          endpoint += `?days=${timeRange}${shopFilter}`
        }
      } else {
        endpoint = '/api/analytics/user'
        if (timeRange === 'all') {
          endpoint += `?days=36500`
        } else if (timeRange === 'custom' && customFrom && customTo) {
          endpoint += `?from=${customFrom}&to=${customTo}`
        } else {
          endpoint += `?days=${timeRange}`
        }
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Analytics API Response:', data)
        if (data.success) {
          console.log('📊 Analytics Data:', data.data)
          console.log('📊 Sales By Month:', data.data?.salesByMonth)
          console.log('📊 Payment Method Breakdown:', data.data?.paymentMethodBreakdown)
          setAnalyticsData(data.data)
        } else {
          toast.error(data.message || 'Failed to load analytics')
        }
      } else {
        const errorText = await response.text()
        console.error('❌ Analytics API Error:', response.status, errorText)
        toast.error('Failed to load analytics data')
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
      setError('Failed to load analytics data')
      toast.error('Error loading analytics data')
    } finally {
      setLoading(false)
    }
  }, [currentShopId, timeRange, customFrom, customTo, userRole])

  // Load cement analytics (lazy — only when Cement tab is first opened)
  const loadCementAnalytics = useCallback(async () => {
    if (userRole !== 'SUPER_DUPER_ADMIN') return
    setCementLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return
      const shopParam = (currentShopId && currentShopId !== ALL_SHOPS_ID) ? `&shopId=${currentShopId}` : ''
      const res = await fetch(`/api/analytics/cement?t=${Date.now()}${shopParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setCementData(data.data)
        setCementLoaded(true)
      } else {
        toast.error(data.message || 'Failed to load cement analytics')
      }
    } catch (err) {
      console.error('Cement analytics error:', err)
      toast.error('Error loading cement analytics')
    } finally {
      setCementLoading(false)
    }
  }, [currentShopId, userRole])


  useEffect(() => {
    console.log('🔄 Analytics: Shop or time range changed', { currentShopId, timeRange, userRole })
    setSalesPage(1) // Reset to first page when data changes
    loadAnalytics()
  }, [loadAnalytics])

  // Re-load cement when shop changes (if already loaded)
  useEffect(() => {
    if (cementLoaded && userRole === 'SUPER_DUPER_ADMIN') {
      setCementLoaded(false) // force re-fetch next time tab is opened
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId])

  // Load widget preferences from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem('analyticsWidgets')
    const savedChartWidgets = localStorage.getItem('analyticsChartWidgets')

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
        localStorage.setItem('analyticsWidgets', JSON.stringify(mergedWidgets))
      } catch (e) {
        console.error('Failed to parse saved widgets:', e)
        setWidgets(DEFAULT_WIDGETS)
      }
    } else {
      setWidgets(DEFAULT_WIDGETS)
    }

    if (savedChartWidgets) {
      try {
        const parsed = JSON.parse(savedChartWidgets)
        // Merge with DEFAULT_CHART_WIDGETS to include any new widgets that were added
        const mergedChartWidgets = DEFAULT_CHART_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.find((w: WidgetConfig) => w.id === defaultWidget.id)
          if (savedWidget) {
            return savedWidget // Use saved preferences
          }
          return defaultWidget // Use default for new widgets
        })
        // Add any saved widgets that are not in DEFAULT_CHART_WIDGETS (for backward compatibility)
        parsed.forEach((savedWidget: WidgetConfig) => {
          if (!mergedChartWidgets.find((w: WidgetConfig) => w.id === savedWidget.id)) {
            mergedChartWidgets.push(savedWidget)
          }
        })
        setChartWidgets(mergedChartWidgets)
        // Save merged chart widgets back to localStorage
        localStorage.setItem('analyticsChartWidgets', JSON.stringify(mergedChartWidgets))
      } catch (e) {
        console.error('Failed to parse saved chart widgets:', e)
        setChartWidgets(DEFAULT_CHART_WIDGETS)
      }
    } else {
      setChartWidgets(DEFAULT_CHART_WIDGETS)
    }
  }, [])

  // Save widget preferences to localStorage
  const saveWidgetPreferences = (newWidgets: WidgetConfig[]) => {
    localStorage.setItem('analyticsWidgets', JSON.stringify(newWidgets))
    setWidgets(newWidgets)
  }

  // Save chart widget preferences to localStorage
  const saveChartWidgetPreferences = (newChartWidgets: WidgetConfig[]) => {
    localStorage.setItem('analyticsChartWidgets', JSON.stringify(newChartWidgets))
    setChartWidgets(newChartWidgets)
  }

  // Toggle widget visibility
  const toggleWidgetVisibility = (widgetId: string) => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    )
    saveWidgetPreferences(updated)
  }

  // Toggle chart widget visibility
  const toggleChartWidgetVisibility = (widgetId: string) => {
    const updated = chartWidgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    )
    saveChartWidgetPreferences(updated)
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

    // Check if dragging metric widget or chart widget
    const isChartWidget = chartWidgets.some(w => w.id === draggedWidget)
    const widgetList = isChartWidget ? chartWidgets : widgets
    const saveFn = isChartWidget ? saveChartWidgetPreferences : saveWidgetPreferences

    const draggedIndex = widgetList.findIndex(w => w.id === draggedWidget)
    const targetIndex = widgetList.findIndex(w => w.id === targetWidgetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedWidget(null)
      return
    }

    const newWidgets = [...widgetList]
    const [removed] = newWidgets.splice(draggedIndex, 1)
    newWidgets.splice(targetIndex, 0, removed)

    // Update order numbers
    const updated = newWidgets.map((w, index) => ({ ...w, order: index }))
    saveFn(updated)
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

  // Get visible chart widgets sorted by order
  const visibleChartWidgets = chartWidgets
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order)

  // Allow access to all authenticated users
  // SUPER_DUPER_ADMIN can see all shops, other users see their assigned shops only

  const formatCurrency = (amount: number) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0'
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num === null || num === undefined || isNaN(num)) {
      return '0'
    }
    return new Intl.NumberFormat('en-IN').format(num)
  }

  // Pagination functions for sales data
  const getPaginatedSales = () => {
    if (!analyticsData?.salesByMonth) return []
    const startIndex = (salesPage - 1) * salesPerPage
    const endIndex = startIndex + salesPerPage
    return analyticsData.salesByMonth.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    if (!analyticsData?.salesByMonth) return 0
    return Math.ceil(analyticsData.salesByMonth.length / salesPerPage)
  }

  const handleSalesPageChange = (newPage: number) => {
    setSalesPage(newPage)
  }

  // Process payment method data for charts
  const getPaymentMethodData = () => {
    const paymentData = analyticsData?.paymentMethodBreakdown || analyticsData?.salesByPaymentMethod || []
    console.log('🔍 Payment method data:', paymentData)

    // Filter out methods with zero amount and format for chart
    const filteredData = paymentData
      .filter(item => item.amount > 0)
      .map(item => ({
        name: item.method,
        value: item.amount,
        color: getPaymentMethodColor(item.method)
      }))

    console.log('🔍 Filtered payment data:', filteredData)
    return filteredData
  }

  const getPaymentMethodColor = (method: string) => {
    const colors: { [key: string]: string } = {
      'CASH': '#10B981',
      'CARD': '#3B82F6',
      'UPI': '#8B5CF6',
      'BANK_TRANSFER': '#F59E0B',
      'CHEQUE': '#EF4444',
      'ONLINE': '#3B82F6',
      'LOAN': '#F59E0B'
    }
    return colors[method.toUpperCase()] || '#6B7280'
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      'SUPER_DUPER_ADMIN': 'bg-red-100 text-red-800',
      'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'ADMIN': 'bg-blue-100 text-blue-800',
      'USER': 'bg-gray-100 text-gray-800'
    }
    return (
      <Badge className={roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}>
        {role}
      </Badge>
    )
  }

  // Business Goals handlers
  const handleCreateGoal = () => {
    setEditingGoal(null)
    setGoalFormData({
      metricName: "",
      targetValue: "",
      period: "monthly",
      shopId: currentShopId > 0 ? currentShopId.toString() : ""
    })
    setShowGoalDialog(true)
  }

  const handleEditGoal = (goal: any) => {
    setEditingGoal(goal)
    setGoalFormData({
      metricName: goal.metricName,
      targetValue: goal.targetValue.toString(),
      period: goal.period,
      shopId: goal.shopId.toString()
    })
    setShowGoalDialog(true)
  }

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this business goal?')) return

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/business-goals?id=${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Business goal deleted successfully')
        loadAnalytics()
      } else {
        toast.error(data.message || 'Failed to delete goal')
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      toast.error('Error deleting business goal')
    }
  }

  const handleSaveGoal = async () => {
    if (!goalFormData.metricName || !goalFormData.targetValue || !goalFormData.shopId) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const url = editingGoal ? '/api/business-goals' : '/api/business-goals'
      const method = editingGoal ? 'PUT' : 'POST'

      const payload = editingGoal
        ? {
          id: editingGoal.id,
          metricName: goalFormData.metricName,
          targetValue: parseFloat(goalFormData.targetValue),
          period: goalFormData.period
        }
        : {
          metricName: goalFormData.metricName,
          targetValue: parseFloat(goalFormData.targetValue),
          period: goalFormData.period,
          shopId: parseInt(goalFormData.shopId)
        }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        toast.success(editingGoal ? 'Goal updated successfully' : 'Goal created successfully')
        setShowGoalDialog(false)
        loadAnalytics()
      } else {
        toast.error(data.message || 'Failed to save goal')
      }
    } catch (error) {
      console.error('Error saving goal:', error)
      toast.error('Error saving business goal')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Analytics</h1>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <Button onClick={loadAnalytics} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">No Data Available</h1>
          <p className="text-gray-600 mb-4">
            Unable to load analytics data. Please try again later.
          </p>
          <Button onClick={loadAnalytics} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analytics and insights for all shops with interactive charts
          </p>
        </div>
        <div className="flex items-center gap-4">
          {getRoleBadge(userRole || 'UNKNOWN')}

          {/* ── Time Range Picker ── */}
          <div className="relative">
            <Select
              value={timeRange}
              onValueChange={(val) => {
                if (val === 'custom') {
                  setShowCustomPicker(true);
                  setTimeRange('custom');
                } else {
                  setShowCustomPicker(false);
                  setTimeRange(val);
                }
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue>
                  {timeRange === 'all' && '🗓 All Time'}
                  {timeRange === '7' && 'Last 7 days'}
                  {timeRange === '30' && 'Last 30 days'}
                  {timeRange === '90' && 'Last 90 days'}
                  {timeRange === '365' && 'Last year'}
                  {timeRange === 'custom' && customFrom && customTo
                    ? `${customFrom} → ${customTo}`
                    : timeRange === 'custom' ? 'Custom Range' : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🗓 All Time</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="custom">📅 Custom Range...</SelectItem>
              </SelectContent>
            </Select>

            {/* Inline custom date range picker — appears below the select */}
            {timeRange === 'custom' && showCustomPicker && (
              <div className="absolute right-0 top-11 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom Date Range</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      max={customTo || undefined}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      min={customFrom || undefined}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (!customFrom || !customTo) {
                          toast.error('Please select both start and end date');
                          return;
                        }
                        setShowCustomPicker(false);
                        loadAnalytics();
                      }}
                      disabled={!customFrom || !customTo}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setCustomFrom('');
                        setCustomTo('');
                        setTimeRange('30');
                        setShowCustomPicker(false);
                      }}
                      className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {isEditMode ? "Done Editing" : "Edit Widgets"}
          </Button>
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

              <div>
                <h3 className="text-lg font-semibold mb-3">Chart Widgets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {chartWidgets.map((widget, widgetIndex) => (
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
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
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

      {/* Key Metrics - Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleWidgets.map((widget, widgetIndex) => {
          const isDragging = draggedWidget === widget.id
          const isDragOver = dragOverWidget === widget.id && !isDragging

          const renderWidget = () => {
            switch (widget.id) {
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalRevenue !== undefined ? formatCurrency(analyticsData.totalRevenue) : '₹0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last {timeRange} days
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Total Expenses (All)</CardTitle>
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsData?.totalAllExpenses !== undefined ? formatCurrency(analyticsData.totalAllExpenses) : (analyticsData?.totalExpenses !== undefined ? formatCurrency(analyticsData.totalExpenses) : '₹0')}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expenses + Salary + Supplier
                      </p>
                      {analyticsData?.totalExpenses !== undefined && (
                        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                          <div>🔧 Shop: {formatCurrency(analyticsData.totalExpenses)}</div>
                          <div>👷 Salary: {formatCurrency(analyticsData.totalEmployeePayments || 0)}</div>
                          <div>🚚 Supplier: {formatCurrency(analyticsData.totalSupplierPayments || 0)}</div>
                        </div>
                      )}
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalSupplierPayments !== undefined ? formatCurrency(analyticsData.totalSupplierPayments) : '₹0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last {timeRange} days
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Salary / Employee Pay</CardTitle>
                      <UserCheck className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {analyticsData?.totalEmployeePayments !== undefined ? formatCurrency(analyticsData.totalEmployeePayments) : '₹0'}
                      </div>
                      <p className="text-xs text-orange-500 font-medium">
                        ✅ Counted as expense
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last {timeRange} days
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalSales !== undefined ? formatNumber(analyticsData.totalSales) : '0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Transactions
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalProducts':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalProducts !== undefined ? formatNumber(analyticsData.totalProducts) : '0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Active products
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalCustomers':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalCustomers !== undefined ? formatNumber(analyticsData.totalCustomers) : '0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Active customers
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'netProfit':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${analyticsData?.netProfit !== undefined && analyticsData.netProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {analyticsData?.netProfit !== undefined ? formatCurrency(analyticsData.netProfit) : '₹0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Revenue − COGS − Expenses − Salary
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'roi':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">ROI</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.roi !== undefined ? `${analyticsData.roi.toFixed(2)}%` : '0%'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Return on Investment
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'ros':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">ROS</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.ros !== undefined ? `${analyticsData.ros.toFixed(2)}%` : '0%'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Return on Sales
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'grossMargin':
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
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.grossMargin !== undefined ? `${analyticsData.grossMargin.toFixed(2)}%` : '0%'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Profitability ratio
                      </p>
                    </CardContent>
                  </Card>
                )

              case 'totalCustomerBalance':
                return (
                  <Card
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                    style={isEditMode && !isDragging ? { '--widget-index': widgetIndex } as React.CSSProperties : undefined}
                    className={`relative transition-all border-red-100 bg-red-50/10 ${isDragging ? 'opacity-50 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                      } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                      }`}
                  >
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1">
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
                      <CardTitle className="text-sm font-medium">Total Customer Balance</CardTitle>
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsData?.totalCustomerBalance !== undefined ? formatCurrency(analyticsData.totalCustomerBalance) : '₹0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Across active customers
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
        <TabsList className="flex flex-wrap w-full h-auto gap-1 bg-muted p-1 rounded-lg justify-start overflow-hidden">
          <TabsTrigger value="overview" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2">
            <PieChartIcon className="h-4 w-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="shops" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2">
            <Building2 className="h-4 w-4" />
            Shops
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
          {userRole === 'SUPER_DUPER_ADMIN' && (
            <TabsTrigger
              value="cement"
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2 text-orange-600 data-[state=active]:text-orange-700"
              onClick={() => { if (!cementLoaded && !cementLoading) loadCementAnalytics() }}
            >
              <BarChart3 className="h-4 w-4" />
              🏗️ Cement
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Shop */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Revenue by Shop
                </CardTitle>
                <CardDescription>Revenue breakdown by shop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.revenueByShop?.length > 0 ? (
                    analyticsData.revenueByShop.map((shop, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{index + 1}</Badge>
                          <div>
                            <p className="font-medium">{shop.shopName}</p>
                            <p className="text-sm text-gray-500">{formatNumber(shop.sales)} sales</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(shop.revenue)}</p>
                          <p className="text-sm text-gray-500">
                            {analyticsData.totalRevenue > 0
                              ? ((shop.revenue / analyticsData.totalRevenue) * 100).toFixed(1)
                              : '0'}%
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No revenue data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Sales Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  Monthly Sales Trend
                </CardTitle>
                <CardDescription>
                  Sales performance over time
                  {analyticsData?.salesByMonth && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({analyticsData.salesByMonth.length} total months)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getPaginatedSales().map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{month.month}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatNumber(month.sales)} sales</p>
                        <p className="text-sm text-gray-500">{formatCurrency(month.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {getTotalPages() > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      Showing {((salesPage - 1) * salesPerPage) + 1} to {Math.min(salesPage * salesPerPage, analyticsData?.salesByMonth?.length || 0)} of {analyticsData?.salesByMonth?.length || 0} months
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSalesPageChange(salesPage - 1)}
                        disabled={salesPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-500">
                        Page {salesPage} of {getTotalPages()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSalesPageChange(salesPage + 1)}
                        disabled={salesPage === getTotalPages()}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Highest Customer Balances */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Highest Customer Balances
                </CardTitle>
                <CardDescription>
                  Customers with largest outstanding balances across assigned shops
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData?.highestBalanceCustomers ? (
                  <HighestBalanceCustomersList
                    customers={analyticsData.highestBalanceCustomers}
                    totalBalance={analyticsData.totalCustomerBalance}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-500">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No customer balance data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Revenue by Shop - Bar Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'revenueByShop');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Revenue by Shop</CardTitle>
                    <CardDescription>Revenue from all shops — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.revenueByShop && analyticsData.revenueByShop.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <BarChart data={analyticsData.revenueByShop} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <YAxis
                              dataKey="shopName"
                              type="category"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              width={80}
                            />
                            <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
                            <Bar dataKey="revenue" radius={[0, 8, 8, 0]} fill="var(--color-revenue)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No shop data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Sales Trend - Line Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'salesTrend');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Sales Trend</CardTitle>
                    <CardDescription>Sales trend — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.salesByMonth && analyticsData.salesByMonth.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <LineChart data={analyticsData.salesByMonth} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={3} dot={{ fill: "var(--color-revenue)", r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <LineChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No sales data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Top Products - Pie Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'topProducts');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Top Products</CardTitle>
                    <CardDescription>Best selling products — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.topProducts && analyticsData.topProducts.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                            <Pie
                              data={analyticsData.topProducts}
                              dataKey="revenue"
                              nameKey="name"
                              cx="50%"
                              cy="45%"
                              outerRadius={100}
                              innerRadius={30}
                            >
                              {analyticsData.topProducts.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No product data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Sales by Month - Bar Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'salesByMonth');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Sales by Month</CardTitle>
                    <CardDescription>Monthly sales — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.salesByMonth && analyticsData.salesByMonth.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <BarChart data={analyticsData.salesByMonth} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
                            <Bar dataKey="sales" fill="var(--color-sales)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No sales data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Revenue Distribution - Donut Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'revenueDistribution');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Revenue Distribution</CardTitle>
                    <CardDescription>Revenue share by shop — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.revenueByShop && analyticsData.revenueByShop.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                            <Pie
                              data={analyticsData.revenueByShop}
                              dataKey="revenue"
                              nameKey="shopName"
                              cx="50%"
                              cy="45%"
                              innerRadius={60}
                              outerRadius={100}
                            >
                              {analyticsData.revenueByShop.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No revenue data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Shop Performance - Line Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'shopPerformance');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Shop Performance</CardTitle>
                    <CardDescription>Revenue trend by shop — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.revenueByShop && analyticsData.revenueByShop.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <LineChart data={analyticsData.revenueByShop} margin={{ top: 5, right: 20, left: 20, bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="shopName" angle={-45} textAnchor="end" height={80} stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={3} dot={{ fill: "var(--color-revenue)", r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={3} dot={{ fill: "var(--color-sales)", r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <LineChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No shop data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Payment Methods - Pie Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'paymentMethods');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                    <CardDescription>Payment method distribution — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {getPaymentMethodData().length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend
                              layout="horizontal"
                              verticalAlign="bottom"
                              align="center"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Pie
                              data={getPaymentMethodData()}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="45%"
                              outerRadius={100}
                              innerRadius={30}
                            >
                              {getPaymentMethodData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No payment data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Expense Trend - Line Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'expenseTrend');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Expense Trend</CardTitle>
                    <CardDescription>Expenses trend — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.expensesByMonth && analyticsData.expensesByMonth.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <LineChart data={analyticsData.expensesByMonth} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: '#ef4444', strokeWidth: 1 }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} dot={{ fill: "#ef4444", r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <LineChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No expense data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Expenses by Category - Pie Chart */}
            {(() => {
              const widget = visibleChartWidgets.find(w => w.id === 'expensesByCategory');
              if (!widget) return null;
              const isDragging = draggedWidget === widget.id;
              const isDragOver = dragOverWidget === widget.id && !isDragging;

              return (
                <Card
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  style={isEditMode && !isDragging ? { '--widget-index': visibleChartWidgets.indexOf(widget) } as React.CSSProperties : undefined}
                  className={`xl:col-span-1 relative transition-all ${isDragging ? 'opacity-50 scale-95' : ''
                    } ${isDragOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''
                    } ${isEditMode && !isDragging ? 'cursor-move hover:ring-2 hover:ring-blue-300 widget-edit-wobble' : ''
                    }`}
                >
                  {isEditMode && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChartWidgetVisibility(widget.id)}
                        className="h-6 w-6 p-0"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>Expenses by Category</CardTitle>
                    <CardDescription>Distribution by expense category — {dateRangeLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.expensesByCategory && analyticsData.expensesByCategory.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[350px] w-full min-h-[300px] overflow-hidden">
                        <ResponsiveContainer>
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                            <Pie
                              data={analyticsData.expensesByCategory}
                              dataKey="amount"
                              nameKey="category"
                              cx="50%"
                              cy="45%"
                              outerRadius={100}
                              innerRadius={30}
                            >
                              {analyticsData.expensesByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[350px] text-gray-500">
                        <div className="text-center">
                          <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No expense data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </TabsContent>

        {/* Shops Tab */}
        <TabsContent value="shops" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Shop Performance
              </CardTitle>
              <CardDescription>Detailed performance metrics for each shop</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.topShops?.map((shop, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <div>
                        <h3 className="font-semibold text-lg">{shop.name}</h3>
                        <p className="text-sm text-gray-600">{formatNumber(shop.customers)} customers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{formatCurrency(shop.revenue)}</p>
                      <p className="text-sm text-gray-600">{formatNumber(shop.sales)} sales</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Top Performing Products
              </CardTitle>
              <CardDescription>Best selling products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData?.topProducts?.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="font-medium">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(product.sales)} sold</p>
                      <p className="text-sm text-gray-500">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Inventory Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Analytics
              </CardTitle>
              <CardDescription>Stock metrics, turnover ratios, and inventory performance</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.inventoryAnalytics && analyticsData.inventoryAnalytics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Shop</th>
                        <th className="text-left p-2">Product</th>
                        <th className="text-right p-2">Avg Stock</th>
                        <th className="text-right p-2">COGS</th>
                        <th className="text-right p-2">Turnover</th>
                        <th className="text-right p-2">Days in Inv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.inventoryAnalytics.slice(0, 30).map((analytics) => (
                        <tr key={analytics.id} className="border-b">
                          <td className="p-2">
                            {new Date(analytics.recordedAt).toLocaleDateString()}
                          </td>
                          <td className="p-2">{analytics.shopName}</td>
                          <td className="p-2 font-medium">{analytics.productName}</td>
                          <td className="p-2 text-right">{formatNumber(analytics.avgStock)}</td>
                          <td className="p-2 text-right">{formatCurrency(analytics.cogs)}</td>
                          <td className="p-2 text-right">{analytics.turnoverRatio.toFixed(2)}</td>
                          <td className="p-2 text-right">{analytics.daysInInventory.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No inventory analytics data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Growth */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sales Growth
                </CardTitle>
                <CardDescription>Month-over-month sales comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.salesByMonth?.slice(-6).map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{month.month}</span>
                      <div className="text-right">
                        <p className="font-bold">{formatNumber(month.sales)}</p>
                        <p className="text-sm text-gray-500">{formatCurrency(month.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Revenue Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Revenue Distribution
                </CardTitle>
                <CardDescription>Revenue share by shop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.revenueByShop?.map((shop, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{shop.shopName}</span>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(shop.revenue)}</p>
                        <p className="text-sm text-gray-500">
                          {analyticsData.totalRevenue > 0
                            ? ((shop.revenue / analyticsData.totalRevenue) * 100).toFixed(1)
                            : '0'}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Business Metrics History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Business Metrics History
              </CardTitle>
              <CardDescription>Historical ROI, ROS, and Gross Margin records</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.businessMetrics && analyticsData.businessMetrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Shop</th>
                        <th className="text-left p-2">Metric</th>
                        <th className="text-right p-2">Value</th>
                        <th className="text-left p-2">Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.businessMetrics.slice(0, 20).map((metric) => (
                        <tr key={metric.id} className="border-b">
                          <td className="p-2">
                            {new Date(metric.recordedAt).toLocaleDateString()}
                          </td>
                          <td className="p-2">{metric.shopName}</td>
                          <td className="p-2">
                            <Badge variant="outline">{metric.metricName}</Badge>
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {metric.metricName === 'ROI' || metric.metricName === 'ROS' || metric.metricName === 'Gross Margin'
                              ? `${metric.value.toFixed(2)}%`
                              : formatCurrency(metric.value)}
                          </td>
                          <td className="p-2">
                            <Badge variant="secondary">{metric.period}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No business metrics data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Goals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Business Goals
                  </CardTitle>
                  <CardDescription>Target metrics and achievement status</CardDescription>
                </div>
                <Button onClick={handleCreateGoal} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Goal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {analyticsData?.businessGoals && analyticsData.businessGoals.length > 0 ? (
                <div className="space-y-3">
                  {analyticsData.businessGoals.map((goal) => (
                    <div key={goal.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg group">
                      <div className="flex items-center gap-3">
                        <Badge variant={goal.achieved ? "default" : "outline"}>
                          {goal.achieved ? "✓ Achieved" : "Pending"}
                        </Badge>
                        <div>
                          <p className="font-semibold">{goal.metricName}</p>
                          <p className="text-sm text-gray-500">{goal.shopName} • {goal.period}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(goal.targetValue)}</p>
                          {goal.achievedAt && (
                            <p className="text-xs text-gray-500">
                              Achieved: {new Date(goal.achievedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditGoal(goal)}
                            className="h-8 w-8 p-0"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No business goals set</p>
                  <Button onClick={handleCreateGoal} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Goal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────── Cement Analytics Tab ─────── */}
        {userRole === 'SUPER_DUPER_ADMIN' && (
          <TabsContent value="cement" className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">🏗️ Cement Analytics</h2>
                <p className="text-gray-500 text-sm mt-1">12-month view — sales &amp; purchases by brand</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCementAnalytics}
                disabled={cementLoading}
                className="flex items-center gap-2"
              >
                {cementLoading ? (
                  <span className="animate-spin">⟳</span>
                ) : '⟳'} Refresh
              </Button>
            </div>

            {cementLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                  <p className="text-gray-500">Loading cement analytics…</p>
                </div>
              </div>
            ) : !cementData ? (
              <div className="text-center py-20 text-gray-400">
                <BarChart3 className="h-14 w-14 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">No cement data loaded</p>
                <p className="text-sm mt-1">Click the Cement tab to load data</p>
              </div>
            ) : cementData.allBrands.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Package className="h-14 w-14 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">No cement products found</p>
                <p className="text-sm mt-1">Add products under a "Cement" category to see analytics here</p>
              </div>
            ) : (() => {
              // ── Color palette ──
              const CEMENT_COLORS = [
                '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
                '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
                '#F97316', '#6366F1',
              ]
              const brandColor = (idx: number) => CEMENT_COLORS[idx % CEMENT_COLORS.length]

              // ── Build sales chart data: [{month, BrandA, BrandB, ...}, ...] ──
              const salesChartData = cementData.salesByMonth.map(m => {
                const row: any = { month: m.month, _total: m.totalQuantity, _revenue: m.totalRevenue }
                for (const brand of cementData.allBrands) {
                  row[brand] = m.brands[brand]?.quantity || 0
                  row[`${brand}_rev`] = m.brands[brand]?.revenue || 0
                }
                return row
              })

              // ── Build purchase chart data: [{month, BrandA_qty, BrandA_price, ...}] ──
              const purchaseChartData = cementData.purchasesByMonth.map(m => {
                const row: any = { month: m.month, _total: m.totalQuantity, _cost: m.totalCost }
                for (const brand of cementData.allBrands) {
                  row[`${brand}_qty`] = m.brands[brand]?.quantity || 0
                  row[`${brand}_price`] = m.brands[brand]?.avgBuyingPrice
                    ? Math.round(m.brands[brand].avgBuyingPrice) : null
                }
                return row
              })

              // ── Summary totals ──
              const totalSoldBags = cementData.salesByMonth.reduce((s, m) => s + m.totalQuantity, 0)
              const totalRevenue = cementData.salesByMonth.reduce((s, m) => s + m.totalRevenue, 0)
              const totalPurchasedBags = cementData.purchasesByMonth.reduce((s, m) => s + m.totalQuantity, 0)
              const totalPurchaseCost = cementData.purchasesByMonth.reduce((s, m) => s + m.totalCost, 0)

              return (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Sold', value: `${totalSoldBags.toLocaleString('en-IN')} bags`, sub: formatCurrency(totalRevenue), color: 'from-blue-500 to-blue-600' },
                      { label: 'Total Purchased', value: `${totalPurchasedBags.toLocaleString('en-IN')} bags`, sub: formatCurrency(totalPurchaseCost), color: 'from-emerald-500 to-emerald-600' },
                      { label: 'Brands Tracked', value: String(cementData.allBrands.length), sub: cementData.allBrands.join(', '), color: 'from-orange-500 to-amber-500' },
                      { label: 'Avg Buy Price', value: totalPurchasedBags > 0 ? `₹${Math.round(totalPurchaseCost / totalPurchasedBags)}/bag` : '—', sub: 'across all brands', color: 'from-purple-500 to-purple-600' },
                    ].map(card => (
                      <Card key={card.label} className={`bg-gradient-to-br ${card.color} text-white border-0 shadow-md`}>
                        <CardContent className="p-4">
                          <p className="text-xs text-white/80 mb-1">{card.label}</p>
                          <p className="text-xl font-bold">{card.value}</p>
                          <p className="text-xs text-white/70 mt-1 truncate">{card.sub}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Chart 1 — Cement Sales by Month (Stacked Bar) */}
                  <Card className="shadow-md border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Cement Sales — Monthly Quantity by Brand
                      </CardTitle>
                      <CardDescription>
                        How many bags of each cement brand were sold each month (last 12 months)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {totalSoldBags === 0 ? (
                        <div className="flex items-center justify-center h-72 text-gray-400">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-40" />
                            <p>No cement sales in the last 12 months</p>
                          </div>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={380}>
                          <BarChart data={salesChartData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              angle={-40}
                              textAnchor="end"
                              interval={0}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              label={{ value: 'Bags sold', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9ca3af' }}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
                                return (
                                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
                                    <p className="font-bold text-gray-800 mb-2 text-sm">{label}</p>
                                    {payload.map((p: any, i: number) => p.value > 0 && (
                                      <div key={i} className="flex items-center justify-between gap-3 mb-1">
                                        <span className="flex items-center gap-1">
                                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
                                          {p.name}
                                        </span>
                                        <span className="font-semibold">{p.value.toLocaleString('en-IN')} bags</span>
                                      </div>
                                    ))}
                                    <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-bold">
                                      <span>Total</span>
                                      <span>{total.toLocaleString('en-IN')} bags</span>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                            {cementData.allBrands.map((brand, idx) => (
                              <Bar
                                key={brand}
                                dataKey={brand}
                                name={brand}
                                stackId="cement"
                                fill={brandColor(idx)}
                                radius={idx === cementData.allBrands.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Chart 2 — Cement Revenue by Month (Stacked Bar) */}
                  <Card className="shadow-md border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        Cement Sales — Monthly Revenue by Brand
                      </CardTitle>
                      <CardDescription>
                        Revenue (₹) generated from each cement brand per month
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {totalRevenue === 0 ? (
                        <div className="flex items-center justify-center h-72 text-gray-400">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-40" />
                            <p>No revenue data</p>
                          </div>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={380}>
                          <BarChart
                            data={salesChartData.map(d => {
                              const row: any = { month: d.month }
                              for (const brand of cementData.allBrands) row[brand] = d[`${brand}_rev`] || 0
                              return row
                            })}
                            margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                              cursor={{ fill: 'rgba(16,185,129,0.05)' }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
                                return (
                                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
                                    <p className="font-bold text-gray-800 mb-2 text-sm">{label}</p>
                                    {payload.map((p: any, i: number) => p.value > 0 && (
                                      <div key={i} className="flex items-center justify-between gap-3 mb-1">
                                        <span className="flex items-center gap-1">
                                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
                                          {p.name}
                                        </span>
                                        <span className="font-semibold">{formatCurrency(p.value)}</span>
                                      </div>
                                    ))}
                                    <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-bold">
                                      <span>Total</span>
                                      <span>{formatCurrency(total)}</span>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                            {cementData.allBrands.map((brand, idx) => (
                              <Bar key={brand} dataKey={brand} name={brand} stackId="rev"
                                fill={brandColor(idx)}
                                radius={idx === cementData.allBrands.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Chart 3 — Cement Purchases + Buying Price (ComposedChart) */}
                  <Card className="shadow-md border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-500" />
                        Cement Purchases — Quantity &amp; Buying Price by Brand
                      </CardTitle>
                      <CardDescription>
                        Bars = bags purchased per brand · Lines = avg buying price (₹/bag)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {totalPurchasedBags === 0 ? (
                        <div className="flex items-center justify-center h-72 text-gray-400">
                          <div className="text-center">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-40" />
                            <p>No cement purchases in the last 12 months</p>
                          </div>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={420}>
                          <ComposedChart data={purchaseChartData} margin={{ top: 10, right: 50, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis
                              yAxisId="qty"
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              label={{ value: 'Bags bought', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9ca3af' }}
                            />
                            <YAxis
                              yAxisId="price"
                              orientation="right"
                              tick={{ fontSize: 11, fill: '#9ca3af' }}
                              tickFormatter={v => `₹${v}`}
                              label={{ value: '₹/bag', angle: 90, position: 'insideRight', fontSize: 11, fill: '#9ca3af' }}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const qtyEntries = payload.filter((p: any) => p.type === 'bar')
                                const priceEntries = payload.filter((p: any) => p.type === 'line')
                                return (
                                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
                                    <p className="font-bold text-gray-800 mb-2 text-sm">{label}</p>
                                    {qtyEntries.length > 0 && (
                                      <>
                                        <p className="text-gray-500 font-semibold mb-1">📦 Quantity purchased</p>
                                        {qtyEntries.map((p: any, i: number) => p.value > 0 && (
                                          <div key={i} className="flex justify-between gap-3 mb-0.5">
                                            <span className="flex items-center gap-1">
                                              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.fill }} />
                                              {p.name.replace(' (qty)', '')}
                                            </span>
                                            <span className="font-semibold">{Number(p.value).toLocaleString('en-IN')} bags</span>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {priceEntries.some((p: any) => p.value != null) && (
                                      <>
                                        <p className="text-gray-500 font-semibold mb-1 mt-2">💰 Avg buying price</p>
                                        {priceEntries.map((p: any, i: number) => p.value != null && (
                                          <div key={i} className="flex justify-between gap-3 mb-0.5">
                                            <span className="flex items-center gap-1">
                                              <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.stroke }} />
                                              {p.name.replace(' (₹/bag)', '')}
                                            </span>
                                            <span className="font-semibold">₹{Math.round(p.value)}/bag</span>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )
                              }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                            {cementData.allBrands.map((brand, idx) => (
                              <Bar
                                key={`${brand}_qty`}
                                yAxisId="qty"
                                dataKey={`${brand}_qty`}
                                name={`${brand} (qty)`}
                                fill={brandColor(idx)}
                                radius={[3, 3, 0, 0]}
                                opacity={0.85}
                              />
                            ))}
                            {cementData.allBrands.map((brand, idx) => (
                              <Line
                                key={`${brand}_price`}
                                yAxisId="price"
                                type="monotone"
                                dataKey={`${brand}_price`}
                                name={`${brand} (₹/bag)`}
                                stroke={brandColor(idx)}
                                strokeWidth={2}
                                dot={{ r: 4, fill: brandColor(idx) }}
                                connectNulls
                              />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}

                      {/* Brand legend with avg prices */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {cementData.allBrands.map((brand, idx) => {
                          const totalQty = cementData.purchasesByMonth.reduce((s, m) => s + (m.brands[brand]?.quantity || 0), 0)
                          const totalCostB = cementData.purchasesByMonth.reduce((s, m) => s + (m.brands[brand]?.totalCost || 0), 0)
                          const avgPrice = totalQty > 0 ? totalCostB / totalQty : 0
                          return (
                            <div key={brand} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: brandColor(idx) }} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{brand}</p>
                                <p className="text-xs text-gray-500">
                                  {totalQty.toLocaleString('en-IN')} bags · {avgPrice > 0 ? `₹${Math.round(avgPrice)}/bag` : 'n/a'}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })()}
          </TabsContent>
        )}
      </Tabs>

      {/* Business Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Business Goal' : 'Create Business Goal'}</DialogTitle>
            <DialogDescription>
              Set a target metric to track your business performance
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="metricName">Metric Name</Label>
              <Input
                id="metricName"
                value={goalFormData.metricName}
                onChange={(e) => setGoalFormData({ ...goalFormData, metricName: e.target.value })}
                placeholder="e.g., Monthly Revenue, Daily Sales"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                type="number"
                value={goalFormData.targetValue}
                onChange={(e) => setGoalFormData({ ...goalFormData, targetValue: e.target.value })}
                placeholder="e.g., 100000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="period">Period</Label>
              <Select value={goalFormData.period} onValueChange={(value) => setGoalFormData({ ...goalFormData, period: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingGoal && (
              <div className="grid gap-2">
                <Label htmlFor="shopId">Shop</Label>
                <Select value={goalFormData.shopId} onValueChange={(value) => setGoalFormData({ ...goalFormData, shopId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.filter(shop => shop.id > 0).map((shop) => (
                      <SelectItem key={shop.id} value={shop.id.toString()}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGoal}>
              {editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 