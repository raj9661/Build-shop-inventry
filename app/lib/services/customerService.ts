const API_BASE_URL = '/api';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: 'REGULAR' | 'WHOLESALE' | 'RETAIL' | 'CONTRACTOR';
  creditLimit: number;
  currentBalance: number;
  shopId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  updatedBy?: number;
}

export interface ToggleStatusResponse {
  success: boolean;
  message: string;
  data: {
    customer: Customer;
    status: 'open' | 'closed';
  };
}

export class CustomerService {
  static async toggleAccountStatus(customerId: number): Promise<ToggleStatusResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling customer account status:', error);
      throw error;
    }
  }

  static async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    has_balance?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      customers: Customer[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.search) searchParams.append('search', params.search);
      if (params?.has_balance !== undefined) searchParams.append('has_balance', params.has_balance.toString());

      const response = await fetch(`${API_BASE_URL}/customers?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  static async getCustomerById(customerId: number): Promise<{
    success: boolean;
    data: { customer: Customer };
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  }
} 