"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "../contexts/ShopContext"
import { IndianRupee, TrendingUp, ShoppingBag, Wallet, AlertCircle, Building2, Users, Package, ShoppingCart, PieChart as PieChartIcon, Loader2 } from "lucide-react"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
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
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { toast } from "sonner"
import { CategoryManager } from "@/app/components/category-manager"

interface SuperAdminStats {
  totalRevenue: number
  totalSales: number
  totalProducts: number
  totalCustomers: number
  totalEmployees: number
  totalExpenses: number
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
  expensesByMonth?: Array<{
    month: string
    expenses: number
  }>
  expensesByCategory?: Array<{
    category: string
    amount: number
  }>
  highestBalanceCustomers?: Array<{
    id: number
    name: string
    phone: string | null
    balance: number
    shopName: string
  }>
  totalCustomerBalance?: number
}

function HighestBalanceCustomersList({ customers, totalBalance }: { customers: NonNullable<SuperAdminStats['highestBalanceCustomers']>, totalBalance?: number }) {
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
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}


export default function SuperAdminDashboard() {
  const { t } = useLanguage()
  const { userRole, currentShop, shops } = useShop()
  const [stats, setStats] = useState<SuperAdminStats>({
    totalRevenue: 0,
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalEmployees: 0,
    totalExpenses: 0,
    revenueByShop: [],
    salesByMonth: [],
    topProducts: [],
    expensesByMonth: [],
    expensesByCategory: []
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("30")
  const [localUserRole, setLocalUserRole] = useState<string | null>(null)
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<any[]>([])

  // Load localUserRole from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('userRole')
      setLocalUserRole(storedRole)
    }
  }, [userRole])

  // Redirect SUPER_DUPER_ADMIN to the correct dashboard
    useEffect(() => {
    if (typeof window !== 'undefined' && (userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN')) {
      // Only redirect if we're not already on the correct dashboard
      if (!window.location.pathname.includes('/dashboard/super-admin')) {
        window.location.href = '/dashboard/super-admin'
      }
    }
  }, [userRole, localUserRole])

  // Check if user has SUPER_ADMIN role
  const hasAccess = userRole === 'SUPER_ADMIN' || localUserRole === 'SUPER_ADMIN'

  // Early return for SUPER_DUPER_ADMIN - redirect in progress
  if (userRole === 'SUPER_DUPER_ADMIN' || localUserRole === 'SUPER_DUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600 mb-4">Redirecting...</h1>
          <p className="text-gray-600 mb-4">
            You are a SUPER_DUPER_ADMIN. Redirecting you to the correct dashboard.
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (hasAccess && currentShop && currentShop.id > 0) {
      loadSuperAdminStats(currentShop.id)
    }
  }, [hasAccess, timeRange, currentShop])

  const loadSuperAdminStats = async (shopId: number) => {
    try {
      setLoading(true)
      // Use user analytics endpoint for SUPER_ADMIN users
      const response = await fetch(`/api/analytics/user?days=${timeRange}&shopId=${shopId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Super Admin Analytics Response:', data)
        if (data.success) {
          setStats(data.data)
          // Use salesByPaymentMethod if paymentMethodBreakdown is not available
          if (data.data.paymentMethodBreakdown) {
            setPaymentMethodBreakdown(data.data.paymentMethodBreakdown)
          } else if (data.data.salesByPaymentMethod) {
            console.log('🔍 Using salesByPaymentMethod:', data.data.salesByPaymentMethod)
            setPaymentMethodBreakdown(data.data.salesByPaymentMethod)
          }
        } else {
          toast.error(data.message || 'Failed to load analytics')
        }
      } else {
        toast.error('Failed to load analytics data')
      }
    } catch (error) {
      console.error('Error loading super admin stats:', error)
      toast.error('Error loading analytics data')
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

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            This dashboard is only accessible to SUPER_ADMIN users.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {userRole || localUserRole || 'Unknown'}
          </p>
        </div>
      </div>
    )
  }

  const metricCards = [
    { 
      title: t("Total Revenue", "कुल राजस्व"), 
      value: formatCurrency(stats.totalRevenue), 
      icon: TrendingUp, 
      color: "text-green-500" 
    },
    { 
      title: t("Total Sales", "कुल बिक्री"), 
      value: formatNumber(stats.totalSales), 
      icon: ShoppingCart, 
      color: "text-blue-500" 
    },
    { 
      title: t("Total Products", "कुल उत्पाद"), 
      value: formatNumber(stats.totalProducts), 
      icon: Package, 
      color: "text-indigo-500" 
    },
    { 
      title: t("Total Customers", "कुल ग्राहक"), 
      value: formatNumber(stats.totalCustomers), 
      icon: Users, 
      color: "text-purple-500" 
    },
    { 
      title: t("Total Expenses", "कुल खर्च"), 
      value: formatCurrency(stats.totalExpenses), 
      icon: TrendingDown, 
      color: "text-red-500" 
    },
    { 
      title: t("Total Customer Balance", "कुल ग्राहक शेष"), 
      value: stats.totalCustomerBalance !== undefined ? formatCurrency(stats.totalCustomerBalance) : formatCurrency(0), 
      icon: TrendingUp, 
      color: "text-red-600" 
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("SUPER_ADMIN Dashboard", "सुपर एडमिन डैशबोर्ड")}</h1>
          <p className="text-muted-foreground">
            Analytics for your assigned shops only
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="secondary" className="text-sm">
            SUPER_ADMIN
          </Badge>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("Select Date Range", "तिथि सीमा चुनें")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metricCards.map((card) => (
              <Card key={card.title} className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground">
                    Last {timeRange} days
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Analytics and Management Sections */}
          <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2">
            <div className="space-y-6">
              {/* Revenue by Shop */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("Revenue by Shop", "दुकान के अनुसार राजस्व")}</CardTitle>
                  <CardDescription>{t("Revenue from your assigned shops", "आपकी सौंपी गई दुकानों से राजस्व")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <BarChart data={stats.revenueByShop} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="shopName"
                          type="category"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12 }}
                          width={80}
                        />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" radius={5} fill="var(--color-primary)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Sales Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("Sales Trend", "बिक्री की प्रवृत्ति")}</CardTitle>
                  <CardDescription>{t("Sales over the last 6 months", "पिछले 6 महीनों की बिक्री")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.salesByMonth && stats.salesByMonth.length > 0 ? (
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No sales data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Payment Method Breakdown Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Payment Method Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution of payments received by method
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentMethodBreakdown && paymentMethodBreakdown.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip />
                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                        <Pie
                          data={paymentMethodBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ method, amount }: any) => `${method}: ₹${amount.toLocaleString()}`}
                        >
                          {paymentMethodBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No payment data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("Top Products", "शीर्ष उत्पाद")}</CardTitle>
                  <CardDescription>{t("Best selling products", "सबसे ज्यादा बिकने वाले उत्पाद")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.topProducts && stats.topProducts.length > 0 ? (
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                        <Pie 
                          data={stats.topProducts} 
                          dataKey="revenue" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={100} 
                          label={({ name, revenue }: any) => `${name}: ${formatCurrency(revenue)}`}
                        >
                          {stats.topProducts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No product data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Highest Customer Balances */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t("Highest Customer Balances", "उच्चतम ग्राहक शेष")}
                  </CardTitle>
                  <CardDescription>
                    {t("Customers with outstanding balances across all shops", "सभी दुकानों में बकाया शेष वाले ग्राहक")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-[250px]">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : stats?.highestBalanceCustomers ? (
                    <HighestBalanceCustomersList 
                      customers={stats.highestBalanceCustomers} 
                      totalBalance={stats.totalCustomerBalance}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-gray-500">
                      <div className="text-center">
                        <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No customers with outstanding balance</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expense Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("Expense Trend", "खर्च की प्रवृत्ति")}</CardTitle>
                  <CardDescription>{t("Expenses over the last 6 months", "पिछले 6 महीनों के खर्च")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.expensesByMonth && stats.expensesByMonth.length > 0 ? (
                  <ChartContainer config={{}} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={stats.expensesByMonth} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <Wallet className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No expense data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expenses by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    {t("Expenses by Category", "श्रेणी के अनुसार खर्च")}
                  </CardTitle>
                  <CardDescription>
                    {t("Distribution of expenses by category", "श्रेणी के अनुसार खर्च का वितरण")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.expensesByCategory && stats.expensesByCategory.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip />
                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                        <Pie
                          data={stats.expensesByCategory}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ category, amount }: any) => `${category}: ₹${amount.toLocaleString()}`}
                        >
                          {stats.expensesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No expense data available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Category & Product Management - Full Width */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('Category & Product Management', 'श्रेणी और उत्पाद प्रबंधन')}</CardTitle>
              <CardDescription>{t('Manage categories and products for this shop', 'इस दुकान के लिए श्रेणियाँ और उत्पाद प्रबंधित करें')}</CardDescription>
            </CardHeader>
            <CardContent>
              {currentShop && <CategoryManager shopId={currentShop.id} />}
            </CardContent>
          </Card>

          {/* Assigned Shops Summary - Full Width */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Your Assigned Shops
              </CardTitle>
              <CardDescription>
                Overview of shops you have access to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {shops.map((shop) => (
                  <div key={shop.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{shop.name}</h3>
                      <Badge variant="outline">{shop.location}</Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Total Sales: {formatNumber(shop.totalSales || 0)}</p>
                      <p>Products: {formatNumber(shop.totalProducts || 0)}</p>
                      <p>Customers: {formatNumber(shop.totalCustomers || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
