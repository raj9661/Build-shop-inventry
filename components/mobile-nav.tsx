"use client"

import { useState } from "react"
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
  Menu,
  X,
  ChevronLeft,
  FileImage,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/hooks/use-language"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useShop, ALL_SHOPS_ID } from "@/app/contexts/ShopContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Store } from "lucide-react"

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const { currentShop, shops, switchShop, userRole, switchToAllShops } = useShop()

  const navItems = [
    { href: "/super-admin", icon: LayoutDashboard, label: t("Super Admin", "सुपर एडमिन") },
    { href: "/dashboard", icon: Home, label: t("Dashboard", "डैशबोर्ड") },
    { href: "/add-sale", icon: ShoppingCart, label: t("Add Sale", "बिक्री जोड़ें") },
    { href: "/add-stock", icon: PackagePlus, label: t("Add Stock", "स्टॉक जोड़ें") },
    { href: "/suppliers", icon: Truck, label: t("Suppliers", "सप्लायर") },
    { href: "/employees", icon: UserPlus, label: t("Employees", "कर्मचारी") },
    { href: "/customer-ledger", icon: BookUser, label: t("Customer Ledger", "ग्राहक खाता") },
    { href: "/cash-sale", icon: IndianRupee, label: t("Cash Sale", "नकद बिक्री") },
    ...(userRole === "SUPER_DUPER_ADMIN" || userRole === "SUPER_ADMIN" ? [{ href: "/sale-documents", icon: FileImage, label: t("Sale Documents", "बिक्री दस्तावेज़") }] : []),
    ...(userRole === "SUPER_DUPER_ADMIN" || userRole === "SUPER_ADMIN" ? [{ href: "/cash-sale-history", icon: Receipt, label: t("Sale History", "बिक्री इतिहास") }] : []),
  ]

  const currentPage = navItems.find((item) => item.href === pathname)

  const handleBackClick = () => {
    if (pathname === "/") {
      router.push("/dashboard")
    } else {
      router.back()
    }
  }

  const getPageTitle = () => {
    if (currentPage) return currentPage.label
    if (pathname === "/") return t("Inventry", "इन्वेंट्री")
    return t("Inventry", "इन्वेंट्री")
  }

  return (
    <>
      {/* Mobile Header with Navigation */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="flex h-full flex-col">
                  {/* Header */}
                  <div className="flex h-14 items-center justify-between border-b px-4">
                    <Link href="/dashboard" className="flex items-center gap-2 font-semibold" onClick={() => setIsOpen(false)}>
                      <Package className="h-6 w-6 text-blue-600" />
                      <span className="text-lg">Inventry</span>
                    </Link>
                  </div>

                  {/* Navigation Items */}
                  <div className="flex-1 overflow-auto py-4">
                    <nav className="grid gap-1 px-2">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-gray-100",
                            pathname === item.href
                              ? "bg-blue-100 text-blue-700 border-r-2 border-blue-600"
                              : "text-gray-700 hover:text-gray-900",
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="flex-1">{item.label}</span>
                          {pathname === item.href && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                        </Link>
                      ))}
                    </nav>
                  </div>

                  {/* Shop Switcher - Only show when there are multiple shops */}
                  {shops.length > 1 && (
                    <div className="p-4 border-t">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                        <Store className="h-4 w-4" />
                        {t("Switch Shop", "दुकान बदलें")}
                      </div>
                      <Select
                        value={userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics') && currentShop?.id === ALL_SHOPS_ID ? ALL_SHOPS_ID.toString() : (currentShop?.id?.toString() || "")}
                        onValueChange={(value) => {
                          if (value === ALL_SHOPS_ID.toString() && userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics')) {
                            switchToAllShops()
                          } else {
                            switchShop(parseInt(value))
                          }
                          setIsOpen(false)
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
                    </div>
                  )}

                  {/* Footer */}
                  <div className="border-t p-4">
                    <div className="text-xs text-gray-500 text-center mb-2">
                      <div className="font-medium">Inventry</div>
                      <div>Inventory Management System</div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('userRole');
                        router.push('/login');
                        setIsOpen(false);
                      }}
                      className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      {t('Logout', 'लॉगआउट')}
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Back Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg"
              onClick={handleBackClick}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Go back</span>
            </Button>
          </div>

          {/* Current Page Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {getPageTitle()}
            </h1>
          </div>

          {/* Right side placeholder for balance */}
          <div className="w-10"></div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navItems.slice(1, 6).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors",
                pathname === item.href
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-full">{item.label.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
