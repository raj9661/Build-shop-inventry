import { toast } from "sonner"
import { authUtils } from "../utils"

export interface TodaySalesSummary {
  totalSales: number
  totalAmount: number
  totalPaid: number
  totalDue: number
  paymentBreakdown: {
    cash: number
    card: number
    upi: number
    bank_transfer: number
    cheque: number
    other: number
  }
  analyticsSummary: {
    id: number
    shopId: number
    date: string
    totalSales: number
    totalExpenses: number
    netProfit: number
    totalProducts: number
    totalCustomers: number
    totalSuppliers: number
    totalEmployees: number
  }
}

export interface TodaySale {
  id: number
  date: string
  time: string
  total_amount: number
  final_amount: number
  paid_amount: number
  due_amount: number
  discount: number
  tax_amount: number
  payment_type: string
  partial_payment_method?: string
  paymentStatus: string
  customerName: string
  customerPhone: string
  shopName: string
  shopLocation: string
  notes?: string
  items: Array<{
    id: number
    name: string
    sku: string
    quantity: number
    unit: string
    price_per_unit: number
    total_price: number
  }>
}

export interface AnalyticsResponse {
  success: boolean
  data: {
    sales: TodaySale[]
    summary: TodaySalesSummary
  }
  message?: string
}

const API_BASE_URL = '/api'

class AnalyticsService {
  private getAuthHeaders(): HeadersInit {
    return authUtils.getAuthHeaders()
  }

  async fetchTodaySales(shopId?: number, date?: string): Promise<{ sales: TodaySale[], summary: TodaySalesSummary } | null> {
    try {
      const queryParams = new URLSearchParams()
      // Only add shopId if it's provided and valid
      if (shopId && shopId > 0) queryParams.append('shopId', shopId.toString())
      if (date) queryParams.append('date', date)

      const response = await fetch(`${API_BASE_URL}/analytics?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        if (response.status === 401) {
          if (!authUtils.isAuthenticated()) {
            toast.error('Please login to access analytics data')
            authUtils.redirectToLogin()
            return null
          } else {
            toast.error('Session expired. Please login again.')
            authUtils.clearAuth()
            authUtils.redirectToLogin()
            return null
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AnalyticsResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch today sales')
      }

      return data.data
    } catch (error) {
      console.error('Error fetching today sales:', error)
      toast.error('Failed to fetch today sales data')
      return null
    }
  }

  async updateDailyAnalytics(data: {
    shopId: number
    date: string
    totalExpenses?: number
    totalProducts?: number
    totalCustomers?: number
    totalSuppliers?: number
    totalEmployees?: number
  }): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to update analytics')
      }

      toast.success('Analytics updated successfully!')
      return true
    } catch (error) {
      console.error('Error updating analytics:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update analytics')
      return false
    }
  }

  async getSalesHistory(params: {
    shopId?: number
    from_date?: string
    to_date?: string
    page?: number
    limit?: number
  } = {}): Promise<TodaySale[]> {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`${API_BASE_URL}/analytics?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AnalyticsResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch sales history')
      }

      return data.data.sales
    } catch (error) {
      console.error('Error fetching sales history:', error)
      toast.error('Failed to fetch sales history')
      return []
    }
  }
}

export const analyticsService = new AnalyticsService() 