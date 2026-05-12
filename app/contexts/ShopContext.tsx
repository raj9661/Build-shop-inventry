"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { shopService, type Shop } from '../lib/services/shopService'
import { useSession } from 'next-auth/react'

interface ShopContextType {
  currentShop: Shop | null
  setCurrentShop: (shop: Shop | null) => void
  currentShopId: number
  shops: Shop[]
  loading: boolean
  refreshShops: () => Promise<void>
  switchShop: (shopId: number) => Promise<void>
  switchToAllShops: () => void
  selectShopWithProducts: () => Promise<void>
  userRole: string | null
  getAnalyticsDisplayName: (t?: (en: string, hi: string) => string) => string
  getAnalyticsDisplayLocation: (t?: (en: string, hi: string) => string) => string
}

const defaultShop: Shop = {
  id: 0, // Use 0 instead of 1 to avoid conflicts with actual shops
  name: "No Shop Available",
  location: "Please create a shop first",
  createdAt: new Date().toISOString()
}

const ShopContext = createContext<ShopContextType | undefined>(undefined)

export function ShopProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [currentShop, setCurrentShop] = useState<Shop | null>(defaultShop)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Debug shop context changes
  useEffect(() => {
    console.log('🔍 [ShopContext] State updated:', { 
      currentShopId: currentShop?.id || 0, 
      currentShop: currentShop?.name, 
      userRole,
      shopsCount: shops.length,
      loading 
    });
  }, [currentShop, userRole, shops.length, loading]);

  // Debug when shops are loaded
  useEffect(() => {
    if (shops.length > 0) {
      console.log('🔍 [ShopContext] Shops loaded:', shops.map(s => ({ id: s.id, name: s.name })));
    }
  }, [shops]);

  const loadShops = async () => {
    try {
      setLoading(true)
      
      // Check if we're on the client side
      if (typeof window === 'undefined') {
        setUserRole(null);
        setLoading(false);
        return;
      }
      
      // Get JWT token from localStorage
      const token = localStorage.getItem('accessToken');
      if (!token || token === 'undefined' || token === 'null') {
        setUserRole(null);
        setLoading(false);
        return;
      }
      
      // Try to get role from localStorage first (faster), then fallback to JWT
      const storedRole = localStorage.getItem('userRole');
      if (storedRole && storedRole !== 'null' && storedRole !== 'undefined') {
        console.log('🔍 [ShopContext] Using stored role from localStorage:', storedRole);
        setUserRole(storedRole);
      } else {
        // Decode JWT token to get user role
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          
          const decoded = JSON.parse(jsonPayload);
          if (decoded.role) {
            console.log('🔍 [ShopContext] Using role from JWT:', decoded.role);
            setUserRole(decoded.role);
            // Store it in localStorage for faster access next time
            localStorage.setItem('userRole', decoded.role);
          } else {
            console.log('❌ [ShopContext] No role found in JWT');
            setUserRole(null);
            setLoading(false);
            return;
          }
        } catch (jwtError) {
          console.error('❌ [ShopContext] Error decoding JWT:', jwtError);
          setUserRole(null);
          setLoading(false);
          return;
        }
      }

      // Fetch shops
      const fetchedShops = await shopService.fetchUserShops()
      console.log(`🏪 [ShopContext] Fetched shops for ${userRole}:`, fetchedShops);
      setShops(fetchedShops)
      
      // Set current shop
      const isDefaultShop = !currentShop || currentShop.id === 0;
      const currentShopExists = currentShop && !isDefaultShop && fetchedShops.find(shop => shop.id === currentShop.id);
      console.log(`🏪 [ShopContext] Current shop check:`, { 
        currentShop: currentShop?.id, 
        currentShopName: currentShop?.name,
        isDefaultShop,
        currentShopExists, 
        fetchedShopsCount: fetchedShops.length 
      });
      
      // If current shop is default shop (id: 0) and we have shops, always update to a real shop
      if (isDefaultShop && fetchedShops.length > 0) {
        // Just use the first shop as preferred
        let preferredShop = fetchedShops[0];
        console.log(`🏪 [ShopContext] Default shop detected, setting preferred shop for ${userRole}:`, preferredShop);
        setCurrentShop(preferredShop);
        console.log(`🏪 [ShopContext] Current shop set to:`, preferredShop?.id, preferredShop?.name);
      } else if (!currentShopExists && fetchedShops.length > 0) {
        // Current shop doesn't exist in fetched shops, but we have shops - update it
        let preferredShop = fetchedShops[0];
        console.log(`🏪 [ShopContext] Current shop not found in fetched shops, setting preferred shop for ${userRole}:`, preferredShop);
        setCurrentShop(preferredShop);
        console.log(`🏪 [ShopContext] Current shop set to:`, preferredShop?.id, preferredShop?.name);
      } else if (fetchedShops.length === 0) {
        console.log('🏪 [ShopContext] No shops available, using default shop');
        setCurrentShop(defaultShop)
      } else {
        console.log(`🏪 [ShopContext] Current shop ${currentShop?.id} exists in fetched shops, keeping it`);
      }
    } catch (error) {
      console.error('Error loading shops:', error)
      setCurrentShop(defaultShop)
    } finally {
      setLoading(false)
    }
  }

  // Load shops on mount
  useEffect(() => {
    loadShops()
  }, [])

  // Listen for localStorage changes (e.g., when user switches or logs in)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userRole' || e.key === 'accessToken') {
        console.log('🔍 [ShopContext] localStorage changed, reloading shops:', e.key)
        loadShops()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const refreshShops = async () => {
    await loadShops()
  }

  const switchShop = async (shopId: number) => {
    const shop = shops.find(s => s.id === shopId)
    if (shop) {
      setCurrentShop(shop)
      // Store selected shop in localStorage for persistence (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedShopId', shopId.toString())
        // Dispatch custom event for same-tab listeners
        window.dispatchEvent(new CustomEvent('shopChanged'))
      }
    }
  }

  const switchToAllShops = () => {
    // Only allow "All shops" view for SUPER_DUPER_ADMIN users
    if (userRole !== 'SUPER_DUPER_ADMIN') {
      console.warn('Only SUPER_DUPER_ADMIN can switch to "All shops" view');
      return;
    }
    
    // For "All shops" view, switch to virtual shop ID
    const allShopsShop = {
      id: ALL_SHOPS_ID,
      name: "All shops Analytics Dashboard",
      location: "",
      createdAt: new Date().toISOString()
    }
    setCurrentShop(allShopsShop)
    // Store selected shop in localStorage for persistence (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedShopId', ALL_SHOPS_ID.toString())
      // Dispatch custom event for same-tab listeners
      window.dispatchEvent(new CustomEvent('shopChanged'))
    }
  }

  // Function to automatically select a shop with products
  const selectShopWithProducts = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Check each shop for products
      for (const shop of shops) {
        if (shop.id === ALL_SHOPS_ID) continue; // Skip "All shops"
        
        const response = await fetch(`/api/products?shopId=${shop.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const products = data.data?.products || [];
          
          if (products.length > 0) {
            console.log(`🏪 [ShopContext] Found shop with products: ${shop.name} (${products.length} products)`);
            setCurrentShop(shop);
            if (typeof window !== 'undefined') {
              localStorage.setItem('selectedShopId', shop.id.toString());
              window.dispatchEvent(new CustomEvent('shopChanged'));
            }
            return;
          }
        }
      }
      
      // If no shop with products found, use the last shop
      const lastShop = shops[shops.length - 1];
      if (lastShop) {
        console.log(`🏪 [ShopContext] No shop with products found, using last shop: ${lastShop.name}`);
        setCurrentShop(lastShop);
      }
    } catch (error) {
      console.error('Error selecting shop with products:', error);
    }
  }

  const getAnalyticsDisplayName = (t?: (en: string, hi: string) => string) => {
    // Handle default shop case (id === 0) - no shops available
    if (currentShop?.id === 0 || !currentShop) {
      return t ? t("No Shop Available", "कोई दुकान उपलब्ध नहीं") : "No Shop Available"
    }
    
    // For SUPER_DUPER_ADMIN users, show "All shops Analytics Dashboard" when All shops ID is selected on analytics page
    if (userRole === 'SUPER_DUPER_ADMIN') {
      const isAnalyticsPage = typeof window !== 'undefined' && window.location.pathname.includes('/analytics')
      if (isAnalyticsPage && currentShop?.id === ALL_SHOPS_ID) {
        return t ? t("All shops Analytics Dashboard", "सभी दुकानों का एनालिटिक्स डैशबोर्ड") : "All shops Analytics Dashboard"
      }
    }
    
    // For all other cases, return the current shop name
    if (currentShop?.name) {
      return currentShop.name
    }
    
    return t ? t("Select Shop", "दुकान चुनें") : "Select Shop"
  }

  const getAnalyticsDisplayLocation = (t?: (en: string, hi: string) => string) => {
    // Handle default shop case (id === 0) - no shops available
    if (currentShop?.id === 0 || !currentShop) {
      return t ? t("Please create a shop first", "कृपया पहले एक दुकान बनाएं") : "Please create a shop first"
    }
    
    // For SUPER_DUPER_ADMIN users, don't show address when showing "All shops" on analytics page
    if (userRole === 'SUPER_DUPER_ADMIN') {
      const isAnalyticsPage = typeof window !== 'undefined' && window.location.pathname.includes('/analytics')
      if (isAnalyticsPage && currentShop?.id === ALL_SHOPS_ID) {
        return "" // No address for "All shops"
      }
    }
    
    // For all other cases, return the current shop location
    if (currentShop?.location) {
      return currentShop.location
    }
    
    return ""
  }

  // Load selected shop from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedShopId = localStorage.getItem('selectedShopId')
      console.log(`🏪 [ShopContext] Loading from localStorage - savedShopId: ${savedShopId}, userRole: ${userRole}`);
      if (savedShopId && shops.length > 0) {
        const shop = shops.find(s => s.id === parseInt(savedShopId))
        if (shop) {
          console.log(`🏪 [ShopContext] Found saved shop:`, shop);
          setCurrentShop(shop)
        } else {
          // If saved shop doesn't exist, select the last shop (most recently created)
          // This is more likely to have products since it's the newest
          let preferredShop = shops[shops.length - 1];
          console.log(`🏪 [ShopContext] Saved shop not found, using preferred shop for ${userRole}:`, preferredShop);
          setCurrentShop(preferredShop);
        }
      }
    }
  }, [shops, userRole])

  // Handle shop access denied events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleShopAccessDenied = () => {
        console.log('🔄 [ShopContext] Shop access denied, switching to first available shop...');
        console.log('🔄 [ShopContext] Available shops:', shops.map(s => ({ id: s.id, name: s.name })));
        console.log('🔄 [ShopContext] Current user role:', userRole);
        
        if (shops.length > 0) {
          let preferredShop = shops[0];
          
          if (preferredShop) {
            console.log(`🏪 [ShopContext] Switching to available shop:`, preferredShop);
            setCurrentShop(preferredShop);
            localStorage.setItem('selectedShopId', preferredShop.id.toString());
            window.dispatchEvent(new CustomEvent('shopChanged'));
          } else {
            console.error('❌ [ShopContext] No available shops found for user');
            // Set to default shop if no shops available
            setCurrentShop(defaultShop);
          }
        } else {
          console.error('❌ [ShopContext] No shops loaded, cannot switch');
          // Set to default shop if no shops loaded
          setCurrentShop(defaultShop);
        }
      };

      window.addEventListener('shopAccessDenied', handleShopAccessDenied);
      return () => window.removeEventListener('shopAccessDenied', handleShopAccessDenied);
    }
  }, [shops, userRole]);

  const value = {
    currentShop,
    setCurrentShop,
    currentShopId: currentShop?.id || 0,
    shops,
    loading,
    refreshShops,
    switchShop,
    switchToAllShops,
    selectShopWithProducts,
    userRole,
    getAnalyticsDisplayName,
    getAnalyticsDisplayLocation
  }


  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const context = useContext(ShopContext)
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider')
  }
  return context
}

// Export the ALL_SHOPS_ID constant for use in other components
export const ALL_SHOPS_ID = -1 