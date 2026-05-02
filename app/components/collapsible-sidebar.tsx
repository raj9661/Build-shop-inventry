"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  ShoppingCart,
  Package,
  PackagePlus,
  IndianRupee,
  BookUser,
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
  Truck,
  PanelLeft,
  Store,
  Languages,
  FileImage,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/hooks/use-language"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useShop, ALL_SHOPS_ID } from "../contexts/ShopContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SystemSettings {
  appearance: {
    sidebarCollapsed: boolean
  }
}

export function CollapsibleSidebar() {
  const pathname = usePathname()
  const { t, language, toggleLanguage } = useLanguage()
  const router = useRouter()
  const { currentShop, shops, switchShop, userRole, getAnalyticsDisplayName, getAnalyticsDisplayLocation, switchToAllShops, refreshShops } = useShop()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>({
    appearance: {
      sidebarCollapsed: false
    }
  })

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Apply settings when they change
  useEffect(() => {
    setIsCollapsed(settings.appearance.sidebarCollapsed)
  }, [settings.appearance.sidebarCollapsed])

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const toggleSidebar = async () => {
    const newCollapsedState = !isCollapsed
    setIsCollapsed(newCollapsedState)
    
    // Update settings in database
    try {
      const token = localStorage.getItem('accessToken')
      const updatedSettings = {
        ...settings,
        appearance: {
          ...settings.appearance,
          sidebarCollapsed: newCollapsedState
        }
      }
      
      await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedSettings)
      })
      
      setSettings(updatedSettings)
    } catch (error) {
      console.error('Failed to save sidebar state:', error)
    }
  }

  // Define navigation items with role-based access
  const getDashboardLink = () => {
    if (userRole === 'SUPER_DUPER_ADMIN') {
      return '/dashboard/super-admin'
    } else if (userRole === 'SUPER_ADMIN') {
      return '/super-admin'
    }
    return '/dashboard'
  }
  
  const allNavItems = [
    { href: getDashboardLink(), icon: LayoutDashboard, label: t("Super Admin", "सुपर एडमिन"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN'] },
    { href: "/dashboard", icon: Home, label: t("Dashboard", "डैशबोर्ड"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'] },
    { href: "/add-sale", icon: ShoppingCart, label: t("Add Sale", "बिक्री जोड़ें"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF'] },
    { href: "/add-stock", icon: PackagePlus, label: t("Add Stock", "स्टॉक जोड़ें"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF'] },
    { href: "/inventory", icon: Package, label: t("Stock (Inventory)", "स्टॉक (इन्वेंट्री)"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'] },
    { href: "/suppliers", icon: Truck, label: t("Suppliers", "सप्लायर"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF'] },
    { href: "/employees", icon: UserPlus, label: t("Employees", "कर्मचारी"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN'] },
    { href: "/customer-ledger", icon: BookUser, label: t("Customer Ledger", "ग्राहक खाता"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'] },
    { href: "/cash-sale", icon: IndianRupee, label: t("Cash Sale", "नकद बिक्री"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF'] },
    { href: "/sale-documents", icon: FileImage, label: t("Sale Documents", "बिक्री दस्तावेज़"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN'] },
    { href: "/cash-sale-history", icon: Receipt, label: t("Sale History", "बिक्री इतिहास"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN'] },
    { href: "/subscription", icon: CreditCard, label: t("Subscription", "सब्सक्रिप्शन"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'] },
  ]

  // Filter navigation items based on user role (client-only, no SSR concerns)
  const navItems = allNavItems.filter(item =>
    !userRole || item.roles.includes(userRole)
  )

  return (
    <TooltipProvider>
      <div className={cn(
        "hidden border-r bg-muted/40 md:flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-6 w-6" />
            {!isCollapsed && <span className="">Inventry</span>}
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
        
        {/* Current Shop Display */}
        {currentShop && !isCollapsed && (
          <div className="px-4 py-2 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-primary">{getAnalyticsDisplayName(t)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {getAnalyticsDisplayLocation(t)}
            </div>
            {/* Debug button */}
            <button 
              onClick={() => {
                console.log('🔍 [Sidebar] Manual refresh triggered')
                refreshShops()
              }}
              className="mt-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Shops ({shops.length})
            </button>
          </div>
        )}
        
        {/* Current Shop Display (Collapsed) */}
        {currentShop && isCollapsed && (
          <div className="px-2 py-2 border-b bg-muted/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <Store className="h-4 w-4 text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div>
                  <div className="font-medium">{getAnalyticsDisplayName(t)}</div>
                  <div className="text-xs text-muted-foreground">{getAnalyticsDisplayLocation(t)}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 py-4">
            {navItems.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                      pathname === item.href && "bg-muted text-primary",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>
        </div>

        {/* Shop Switcher - Only show when there are multiple shops */}
        {shops.length > 1 && (
          <div className="p-4 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  {!isCollapsed && (
                    <Select
                      value={userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics') && currentShop?.id === ALL_SHOPS_ID ? ALL_SHOPS_ID.toString() : (currentShop?.id?.toString() || "")}
                      onValueChange={(value) => {
                        if (value === ALL_SHOPS_ID.toString() && userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics')) {
                          // Switch to "All shops" view
                          switchToAllShops()
                        } else {
                          switchShop(parseInt(value))
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select Shop", "दुकान चुनें")} />
                      </SelectTrigger>
                      <SelectContent>
                        {userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics') && (
                          <SelectItem key={ALL_SHOPS_ID.toString()} value={ALL_SHOPS_ID.toString()}>
                            All shops Analytics Dashboard
                          </SelectItem>
                        )}
                        {shops.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id.toString()}>
                            {shop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  {t("Switch Shop", "दुकान बदलें")}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Language Toggle */}
        <div className="p-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className={cn(
                  "w-full flex items-center gap-2",
                  isCollapsed && "justify-center"
                )}
              >
                <Languages className="h-4 w-4" />
                {!isCollapsed && (
                  <span>{language === 'hi' ? 'हिंदी' : 'English'}</span>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                {t("Toggle Language", "भाषा बदलें")}
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Logout */}
        <div className="p-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('userRole');
                  router.push('/login');
                }}
                className={cn(
                  "w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition",
                  isCollapsed && "px-2"
                )}
              >
                {!isCollapsed && t('Logout', 'लॉगआउट')}
                {isCollapsed && <span className="text-xs">LO</span>}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                {t('Logout', 'लॉगआउट')}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
} 