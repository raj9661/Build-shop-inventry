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
    UserPlus,
    CreditCard,
    Truck,
    Store,
    Languages,
    Menu,
    LogOut,
    FileImage
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/hooks/use-language"
import { Button } from "@/components/ui/button"
import { useShop, ALL_SHOPS_ID } from "../contexts/ShopContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function MobileNav() {
    const pathname = usePathname()
    const { t, language, toggleLanguage } = useLanguage()
    const router = useRouter()
    const { currentShop, shops, switchShop, userRole, getAnalyticsDisplayName, getAnalyticsDisplayLocation, switchToAllShops } = useShop()
    const [open, setOpen] = useState(false)

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
        { href: "/subscription", icon: CreditCard, label: t("Subscription", "सब्सक्रिप्शन"), roles: ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER'] },
    ]

    // Filter navigation items based on user role
    const navItems = allNavItems.filter(item =>
        !userRole || item.roles.includes(userRole)
    )

    return (
        <div className="flex items-center justify-between p-4 border-b bg-background md:hidden sticky top-0 z-50">
            <div className="flex items-center gap-2 font-semibold">
                <Package className="h-6 w-6" />
                <span>Inventry</span>
            </div>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col h-full max-h-screen">
                    <SheetHeader className="p-4 border-b text-left">
                        <SheetTitle className="flex items-center gap-2">
                            <Package className="h-6 w-6" />
                            <span>Inventry</span>
                        </SheetTitle>
                    </SheetHeader>

                    {/* Current Shop Display */}
                    {currentShop && (
                        <div className="px-4 py-3 border-b bg-muted/20">
                            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
                                <Store className="h-4 w-4" />
                                <span>{getAnalyticsDisplayName(t)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground ml-6">
                                {getAnalyticsDisplayLocation(t)}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto py-4 min-h-0">
                        <nav className="grid gap-1 px-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary",
                                        pathname === item.href
                                            ? "bg-muted text-primary"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-auto border-t">
                        {/* Shop Switcher */}
                        {shops.length > 1 && (
                            <div className="p-4 border-b">
                                <div className="flex items-center gap-2 mb-2">
                                    <Store className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {t("Switch Shop", "दुकान बदलें")}
                                    </span>
                                </div>
                                <Select
                                    value={userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics') && currentShop?.id === ALL_SHOPS_ID ? ALL_SHOPS_ID.toString() : (currentShop?.id?.toString() || "")}
                                    onValueChange={(value) => {
                                        if (value === ALL_SHOPS_ID.toString() && userRole === 'SUPER_DUPER_ADMIN' && pathname.includes('/analytics')) {
                                            switchToAllShops()
                                        } else {
                                            switchShop(parseInt(value))
                                        }
                                        setOpen(false)
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

                        {/* Language & Logout */}
                        <div className="p-4 flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleLanguage}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                <Languages className="h-4 w-4" />
                                <span>{language === 'hi' ? 'हिंदी' : 'English'}</span>
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    localStorage.removeItem('accessToken');
                                    localStorage.removeItem('userRole');
                                    router.push('/login');
                                    setOpen(false)
                                }}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>{t('Logout', 'लॉगआउट')}</span>
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
