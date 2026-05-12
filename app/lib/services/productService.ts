import { authUtils } from '../utils'
import { toast } from 'sonner'

export interface Product {
  id: number
  name: string
  sku: string
  category: string
  stockQuantity: number
  minStockLevel: number
  unit: string
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LowStockProduct extends Product {
  stockStatus: 'critical' | 'low' | 'normal'
  daysUntilOutOfStock?: number
}

const API_BASE_URL = '/api'

class ProductService {
  private getAuthHeaders(): HeadersInit {
    return authUtils.getAuthHeaders()
  }

  async fetchLowStockProducts(shopId?: number, threshold?: number): Promise<LowStockProduct[]> {
    try {
      const queryParams = new URLSearchParams()
      if (shopId) queryParams.append('shopId', shopId.toString())
      if (threshold) queryParams.append('threshold', threshold.toString())

      const response = await fetch(`${API_BASE_URL}/products/low-stock?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        if (response.status === 401) {
          if (!authUtils.isAuthenticated()) {
            toast.error('Please login to access product data')
            authUtils.redirectToLogin()
            return []
          } else {
            toast.error('Session expired. Please login again.')
            authUtils.clearAuth()
            authUtils.redirectToLogin()
            return []
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch low stock products')
      }

      return data.data.products || []
    } catch (error) {
      console.error('Error fetching low stock products:', error)
      return []
    }
  }

  async fetchAllProducts(shopId?: number): Promise<Product[]> {
    try {
      const queryParams = new URLSearchParams()
      if (shopId) queryParams.append('shopId', shopId.toString())

      const response = await fetch(`${API_BASE_URL}/products?${queryParams}`, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        if (response.status === 401) {
          if (!authUtils.isAuthenticated()) {
            toast.error('Please login to access product data')
            authUtils.redirectToLogin()
            return []
          } else {
            toast.error('Session expired. Please login again.')
            authUtils.clearAuth()
            authUtils.redirectToLogin()
            return []
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch products')
      }

      return data.data.products || []
    } catch (error) {
      console.error('Error fetching products:', error)
      return []
    }
  }
}

export const productService = new ProductService() 