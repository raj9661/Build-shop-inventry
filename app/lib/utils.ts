import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Authentication utilities
export const authUtils = {
  // Check if user is authenticated
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false
    const token = localStorage.getItem('accessToken')
    return !!token
  },

  // Get current user role
  getUserRole(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('userRole')
  },

  // Get current user name
  getUserName(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('userName')
  },

  // Check if token is valid (basic check)
  isTokenValid(): boolean {
    if (typeof window === 'undefined') return false
    const token = localStorage.getItem('accessToken')
    if (!token) return false

    try {
      // Basic JWT validation - check if token has 3 parts
      const parts = token.split('.')
      if (parts.length !== 3) return false

      // Check if token is expired (basic check)
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      
      if (payload.exp && payload.exp < currentTime) {
        // Token is expired, clear it
        this.clearAuth()
        return false
      }

      return true
    } catch (error) {
      console.error('Token validation error:', error)
      this.clearAuth()
      return false
    }
  },

  // Clear authentication data
  clearAuth(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('accessToken')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userName')
  },

  // Redirect to login
  redirectToLogin(): void {
    if (typeof window === 'undefined') return
    window.location.href = '/login'
  },

  // Get auth headers for API requests
  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }
}

// Mask email for display (shows last 3 characters before @ and full domain)
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) return email; // If local part is 3 or fewer chars, show full
  
  const maskedLocalPart = '*'.repeat(localPart.length - 3) + localPart.slice(-3);
  return `${maskedLocalPart}@${domain}`;
}

export function serializeBigInt(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeBigInt(v)])
    );
  } else if (typeof obj === 'bigint') {
    return obj.toString();
  }
  return obj;
} 