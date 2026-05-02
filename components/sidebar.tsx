"use client"

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
  BarChart3,
  FileImage,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "@/app/contexts/ShopContext"

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const router = useRouter()
  const { userRole } = useShop()

  const navItems = [
    { href: "/super-admin", icon: LayoutDashboard, label: t("Super Admin", "सुपर एडमिन") },
    { href: "/dashboard", icon: Home, label: t("Dashboard", "डैशबोर्ड") },
    { href: "/add-sale", icon: ShoppingCart, label: t("Add Sale", "बिक्री जोड़ें") },
    { href: "/add-stock", icon: PackagePlus, label: t("Add Stock", "स्टॉक जोड़ें") },
    { href: "/inventory", icon: Package, label: t("Inventory", "इन्वेंटरी") },
    { href: "/suppliers", icon: Truck, label: t("Suppliers", "सप्लायर") },
    { href: "/employees", icon: UserPlus, label: t("Employees", "कर्मचारी") },
    { href: "/customer-ledger", icon: BookUser, label: t("Customer Ledger", "ग्राहक खाता") },
    { href: "/cash-sale", icon: IndianRupee, label: t("Cash Sale", "नकद बिक्री") },
    ...(userRole === "SUPER_DUPER_ADMIN" || userRole === "SUPER_ADMIN" ? [{ href: "/sale-documents", icon: FileImage, label: t("Sale Documents", "बिक्री दस्तावेज़") }] : []),
    ...(userRole === "SUPER_DUPER_ADMIN" || userRole === "SUPER_ADMIN" ? [{ href: "/cash-sale-history", icon: Receipt, label: t("Cash Sale History", "कैश बिक्री इतिहास") }] : []),
    { href: "/subscription", icon: CreditCard, label: t("Subscription", "सब्सक्रिप्शन") },
  ]

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-6 w-6" />
            <span className="">Inventry</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  pathname === item.href && "bg-muted text-primary",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 mt-auto">
          <button
            onClick={() => {
              localStorage.removeItem('accessToken');
              router.push('/login');
            }}
            className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            {t('Logout', 'लॉगआउट')}
          </button>
        </div>
      </div>
    </div>
  )
}
