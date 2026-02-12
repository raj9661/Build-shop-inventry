import { toast } from "sonner"

export interface Shop {
  id: number
  name: string
  location: string
  createdAt: string
  created_by?: number
  updated_by?: number
  createdBy?: {
    id: number
    name: string
    email: string
  }
  updatedBy?: {
    id: number
    name: string
    email: string
  }
  _count?: {
    products: number
    sales: number
    expenses: number
  }
  // Stats properties for dashboard display
  totalSales?: number
  totalProducts?: number
  totalCustomers?: number
  totalEmployees?: number
  recentSales?: number
  assignedUsers?: number
  gstNo?: string
  phone?: string
}

export interface ShopStats {
  totalSales: number
  totalAmount: number
  totalPaid: number
  totalDue: number
  productCount: number
  totalExpenses: number
  expenseCount: number
}

export interface CreateShopData {
  name: string
  location: string
  address?: string
  phone?: string
  email?: string
  gstNo?: string
}

export interface UpdateShopData {
  name?: string
  location?: string
}

export interface ShopsResponse {
  success: boolean
  data: {
    shops: Shop[]
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

class ShopService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    console.log('🔍 [shopService] getAuthHeaders called')
    
    // Hybrid approach: Try NextAuth session first, fallback to JWT token
    try {
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      console.log('🔍 [shopService] NextAuth session:', session ? 'exists' : 'null')
      
      if (session && (session as any).apiToken) {
        console.log('🔍 [shopService] Using NextAuth apiToken')
        // Use JWT token from NextAuth session
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any).apiToken}`
        };
      }
    } catch (error) {
      console.log('🔍 [shopService] NextAuth session not available:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fallback to JWT token from localStorage
    const token = localStorage.getItem('accessToken');
    console.log('🔍 [shopService] localStorage token:', token ? 'exists' : 'null')
    
    if (token && token !== 'undefined' && token !== 'null') {
      console.log('🔍 [shopService] Using localStorage token')
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
    }
    
    console.log('🔍 [shopService] No authentication available')
    // No authentication available
    return {
      'Content-Type': 'application/json'
    };
  }

  async fetchShops(params: {
    page?: number
    limit?: number
    search?: string
  } = {}): Promise<Shop[]> {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`${API_BASE_URL}/shops?${queryParams}`, {
        headers: await this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ShopsResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch shops')
      }

      return data.data.shops
    } catch (error) {
      console.error('Error fetching shops:', error)
      toast.error('Failed to fetch shops data')
      return []
    }
  }

  async fetchUserShops(): Promise<Shop[]> {
    try {
      console.log('🔍 [shopService] fetchUserShops called')
      const headers = await this.getAuthHeaders()
      console.log('🔍 [shopService] Auth headers:', headers)
      
      const response = await fetch(`${API_BASE_URL}/shops/user-assigned`, {
        headers
      })

      console.log('🔍 [shopService] Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔍 [shopService] HTTP error:', response.status, errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ShopsResponse = await response.json()
      console.log('🔍 [shopService] Response data:', data)
      console.log('🔍 [shopService] Response data structure:', {
        success: data.success,
        hasData: !!data.data,
        hasShops: !!(data.data && data.data.shops),
        shopsLength: data.data?.shops?.length || 0,
        shopsType: typeof data.data?.shops
      })
      
      if (!data.success) {
        console.error('🔍 [shopService] API returned success: false', data.message)
        throw new Error(data.message || 'Failed to fetch user shops')
      }

      if (!data.data || !data.data.shops) {
        console.error('🔍 [shopService] No shops data in response:', data)
        return []
      }

      console.log('🔍 [shopService] Returning shops:', data.data.shops.length)
      console.log('🔍 [shopService] Shop details:', data.data.shops)
      return data.data.shops
    } catch (error) {
      console.error('🔍 [shopService] Error fetching user shops:', error)
      toast.error('Failed to fetch user shops data')
      return []
    }
  }

  async fetchShopById(shopId: number): Promise<Shop | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        headers: await this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch shop')
      }

      return data.data.shop
    } catch (error) {
      console.error('Error fetching shop:', error)
      toast.error('Failed to fetch shop details')
      return null
    }
  }

  async createShop(shopData: CreateShopData): Promise<Shop | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/shops`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(shopData)
      })

      let data = null;
      try {
        data = await response.json();
      } catch (jsonErr) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        toast.error('Server error: ' + text.slice(0, 100));
        return null;
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      if (!data.success) {
        throw new Error(data.message || 'Failed to create shop')
      }

      toast.success('Shop created successfully!')
      return data.data.shop
    } catch (error) {
      console.error('Error creating shop:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create shop')
      return null
    }
  }

  async updateShop(shopId: number, shopData: UpdateShopData): Promise<Shop | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(shopData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update shop')
      }

      toast.success('Shop updated successfully!')
      return data.data.shop
    } catch (error) {
      console.error('Error updating shop:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update shop')
      return null
    }
  }

  async deleteShop(shopId: number, otp?: string): Promise<boolean> {
    try {
      // If no OTP provided, request one first
      if (!otp) {
        const otpResponse = await fetch(`${API_BASE_URL}/shops/${shopId}/delete-otp`, {
          method: 'POST',
          headers: await this.getAuthHeaders()
        });

        if (!otpResponse.ok) {
          const errorData = await otpResponse.json();
          throw new Error(errorData.message || `Failed to request OTP: ${otpResponse.status}`);
        }

        const otpData = await otpResponse.json();
        if (!otpData.success) {
          throw new Error(otpData.message || 'Failed to request OTP');
        }

        toast.success('OTP sent to your email. Please check your inbox and enter the OTP to confirm deletion.');
        return false; // Return false to indicate OTP is needed
      }

      // If OTP is provided, proceed with deletion
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ otp })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete shop');
      }

      toast.success('Shop deleted successfully!');
      return true;
    } catch (error) {
      console.error('Error deleting shop:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete shop');
      return false;
    }
  }

  async getShopStats(shopId: number, params: {
    from_date?: string
    to_date?: string
  } = {}): Promise<{ shop: Shop; stats: ShopStats; recentSales: any[] } | null> {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`${API_BASE_URL}/shops/${shopId}/stats?${queryParams}`, {
        headers: await this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch shop statistics')
      }

      return data.data
    } catch (error) {
      console.error('Error fetching shop stats:', error)
      toast.error('Failed to fetch shop statistics')
      return null
    }
  }
}

export const shopService = new ShopService() 