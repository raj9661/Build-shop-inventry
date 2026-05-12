"use client"

import { useState, useEffect } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Building2, 
  ShoppingCart,
  Calendar,
  Target
} from "lucide-react"

interface AnalyticsDataContent {
  totalRevenue: number
  totalSales: number
  totalShops: number
  totalUsers: number
  totalProducts: number
  totalCustomers: number
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
  topProducts: Array<{
    name: string
    sales: number
    revenue: number
  }>
  userActivity: Array<{
    username: string
    role: string
    lastActivity: string
    totalActions: number
  }>
}

interface AnalyticsData {
  success: boolean
  data: AnalyticsDataContent
}

export function AnalyticsDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState("30")
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    if (open) {
      loadAnalytics()
    }
  }, [open, timeRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/analytics?days=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start" variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          View Analytics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            System Analytics
          </DialogTitle>
          <DialogDescription>
            Comprehensive analytics and insights for the entire system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Time Range:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading analytics...</p>
            </div>
          ) : analyticsData && analyticsData.success && analyticsData.data ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.data.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      Last {timeRange} days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(analyticsData.data.totalSales)}</div>
                    <p className="text-xs text-muted-foreground">
                      Transactions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(analyticsData.data.totalShops)}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered shops
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(analyticsData.data.totalUsers)}</div>
                    <p className="text-xs text-muted-foreground">
                      System users
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue by Shop */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue by Shop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.data.revenueByShop.map((shop: any, index: number) => (
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
                            {((shop.revenue / analyticsData.data.totalRevenue) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Sales Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Sales Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.data.salesByMonth.map((month: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="font-medium">{month.month}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatNumber(month.sales)} sales</p>
                          <p className="text-sm text-gray-500">{formatCurrency(month.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Top Performing Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.data.topProducts.map((product: any, index: number) => (
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

              {/* User Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recent User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.data.userActivity.map((user: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-gray-500">{user.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatNumber(user.totalActions)} actions</p>
                          <p className="text-xs text-gray-500">
                            {new Date(user.lastActivity).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No analytics data available</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 