import { toast } from "sonner"
import { authUtils } from "../utils"

export interface SaleItem {
  id: number
  name: string
  quantity: number
  unit: string
  price_per_unit: number
  total_price: number
}

export interface Sale {
  id: number
  customerId?: number
  customerName?: string
  customerType: "account" | "walkin"
  shopId: number
  shopName?: string
  saleTime: string
  date: string
  time: string
  items: SaleItem[]
  totalBill: number
  total_amount: number
  amountPaid: number
  paid_amount: number
  dueAmount: number
  due_amount: number
  paymentMethod: "cash" | "online" | "loan" | "partial"
  payment_type: string
  partial_payment_method?: string
  partialPaymentMethod?: string
  paymentStatus?: string
  isCompleted: boolean
  isCancelled: boolean
  completedAt: string | null
  cancelledAt: string | null
  completedBy: string | null
  cancelledBy: string | null
  notes?: string
  createdById: number
  createdBy?: {
    id: number
    name: string
  }
  updatedAt?: string
  transportFare?: number
  vehicleNumber?: string
  driverName?: string
}

export interface CreateSaleData {
  customerId?: number
  customerInfo?: {
    name: string
    phone: string
    address: string
    alternatePhone?: string
  }
  shopId: number
  saleDate?: string;
  totalAmount?: number;
  finalAmount?: number;
  discount?: number;
  taxAmount?: number;
  transportFare?: number;
  vehicleNumber?: string;
  driverName?: string;
  notes?: string;
  items: {
    name: string
    quantity: number
    unit: string
    price_per_unit: number
    productId?: number
    stockType?: string
  }[]
  payment_type: "cash" | "online" | "loan" | "partial"
  paid_amount?: number
}

export interface SalesResponse {
  success: boolean
  data: {
    sales: Sale[]
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
  message?: string
}

const API_BASE_URL = '/api'

class SalesService {
  private getAuthHeaders(): HeadersInit {
    return authUtils.getAuthHeaders()
  }

  async fetchSales(params: {
    page?: number
    limit?: number
    shopId?: number
    customerId?: number
    payment_type?: string
    from_date?: string
    to_date?: string
    isCompleted?: boolean
  } = {}): Promise<Sale[]> {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`${API_BASE_URL}/sales?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Check if token exists
          if (!authUtils.isAuthenticated()) {
            toast.error('Please login to access sales data')
            authUtils.redirectToLogin()
            return []
          } else {
            toast.error('Session expired. Please login again.')
            // Clear invalid token and redirect
            authUtils.clearAuth()
            authUtils.redirectToLogin()
            return []
          }
        } else if (response.status === 403) {
          const errorData = await response.json()
          if (errorData.code === 'DEVICE_VERIFICATION_REQUIRED') {
            toast.error('Device verification required. Please complete OTP verification.')
            authUtils.redirectToLogin()
            return []
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: SalesResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch sales')
      }

      // Transform the data to match our frontend format
      const transformedSales = data.data.sales.map(sale => {
        // Handle BigInt and Decimal objects from Prisma
        const parseAmount = (value: any) => {
          if (value === null || value === undefined) return 0
          if (typeof value === 'object' && value.toString) {
            return parseFloat(value.toString())
          }
          return Number(value) || 0
        }
        

        
        // Debug: Log the raw sale data to see what we're getting
        console.log('Raw sale data:', {
          id: sale.id,
          paymentStatus: sale.paymentStatus,
          updatedAt: sale.updatedAt,
          updatedAtType: typeof sale.updatedAt,
          updatedAtString: sale.updatedAt ? sale.updatedAt.toString() : 'null'
        });
        
        const transformedSale = {
          ...sale,
          customerName: sale.customerName || (sale.customerId ? 'Account Customer' : 'Walk-in'),
          customerType: sale.customerId ? 'account' as const : 'walkin' as const,
          saleTime: sale.date + ' ' + sale.time,
          totalBill: parseAmount((sale as any)?.final_amount ?? (sale as any)?.finalAmount ?? sale.total_amount),
          amountPaid: parseAmount(sale.paid_amount),
          dueAmount: parseAmount(sale.due_amount),
          paymentMethod: sale.payment_type as "cash" | "online" | "loan" | "partial",
          paid_amount: parseAmount(sale.paid_amount), // Keep the API parsed values
          due_amount: parseAmount(sale.due_amount),   // Keep the API parsed values
          payment_type: sale.payment_type,            // Keep the API parsed values
          partial_payment_method: sale.partial_payment_method, // Keep the API parsed values
          isCompleted: sale.paymentStatus === 'COMPLETED',
          isCancelled: sale.paymentStatus === 'CANCELLED',
          completedAt: sale.paymentStatus === 'COMPLETED' ? 
            (sale.updatedAt ? new Date(sale.updatedAt).toISOString() : new Date().toISOString()) : null,
          cancelledAt: sale.paymentStatus === 'CANCELLED' ? 
            (sale.updatedAt ? new Date(sale.updatedAt).toISOString() : new Date().toISOString()) : null,
          notes: sale.notes,
          items: sale.items.map(item => {
            return {
              ...item,
              quantity: parseAmount(item.quantity),
              price_per_unit: parseAmount(item.price_per_unit),
              total_price: parseAmount(item.total_price)
            }
          }),
          transportFare: parseAmount(sale.transportFare),
          vehicleNumber: sale.vehicleNumber,
          driverName: sale.driverName
        }
        
        return transformedSale
      })

      return transformedSales
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast.error('Failed to fetch sales data')
      return []
    }
  }

  async fetchTodaySales(shopId?: number): Promise<Sale[]> {
    // Fetch only today's sales (from 12 AM today)
    // This aligns with the dashboard's daily cleanup behavior
    const today = new Date().toISOString().split('T')[0]
    return this.fetchSales({
      from_date: today,
      to_date: today,
      shopId,
      limit: 100
    })
  }

  async createSale(saleData: CreateSaleData): Promise<Sale | null> {
    try {
      // Determine if this is a cash sale (walk-in customer with customerInfo)
      const isCashSale = saleData.customerInfo && !saleData.customerId && !(saleData as any).isDirectSale;
      const endpoint = isCashSale ? `${API_BASE_URL}/sales/cash-sale` : `${API_BASE_URL}/sales`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(saleData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to create sale')
      }

      toast.success('Sale created successfully!')
      return data.data.sale
    } catch (error) {
      console.error('Error creating sale:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create sale')
      return null
    }
  }

  async updateSaleStatus(saleId: number, action: 'complete' | 'cancel' | 'reactivate', reason?: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ saleId, action, reason })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update sale')
      }

      const messages = {
        complete: 'Sale marked as completed!',
        cancel: 'Sale cancelled successfully!',
        reactivate: 'Sale reactivated successfully!'
      }

      toast.success(messages[action])
      return true
    } catch (error) {
      console.error('Error updating sale status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update sale')
      return false
    }
  }

  // Legacy method for backward compatibility
  async updateSaleCompletion(saleId: number, isCompleted: boolean): Promise<boolean> {
    return this.updateSaleStatus(saleId, isCompleted ? 'complete' : 'reactivate')
  }

  async getSaleById(saleId: number): Promise<Sale | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch sale')
      }

      return data.data.sale
    } catch (error) {
      console.error('Error fetching sale:', error)
      toast.error('Failed to fetch sale details')
      return null
    }
  }

  async getSalesStats(params: {
    shopId?: number
    from_date?: string
    to_date?: string
  } = {}): Promise<{
    totalSales: number
    totalAmount: number
    cashSales: number
    onlineSales: number
    creditSales: number
    partialSales: number
  } | null> {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`${API_BASE_URL}/sales/stats/overview?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch sales stats')
      }

      return data.data
    } catch (error) {
      console.error('Error fetching sales stats:', error)
      return null
    }
  }
}

export const salesService = new SalesService() 