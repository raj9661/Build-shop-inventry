"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatePicker } from "@/components/ui/date-picker"
import { Loader2, Calendar, DollarSign, ShoppingBag, Users, TrendingUp, Eye, Download } from "lucide-react"
import { toast } from "sonner"
import { analyticsService, type TodaySale, type TodaySalesSummary } from "../lib/services/analyticsService"
import { useShop } from "../contexts/ShopContext"
import { useLanguage } from "@/hooks/use-language"
import { formatTmtQuantity } from "../lib/tmtUtils"

interface TodaySalesHistoryProps {
  className?: string
  hideCard?: boolean
}

export function TodaySalesHistory({ className, hideCard = false }: TodaySalesHistoryProps) {
  const { t, language } = useLanguage()
  const { currentShopId } = useShop()
  const [sales, setSales] = useState<TodaySale[]>([])
  const [summary, setSummary] = useState<TodaySalesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSale, setSelectedSale] = useState<TodaySale | null>(null)
  const [activeTab, setActiveTab] = useState("summary")

  useEffect(() => {
    fetchTodaySales()
  }, [currentShopId, selectedDate])

  const fetchTodaySales = async () => {
    if (!currentShopId) return
    
    setLoading(true)
    try {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`
      // Only pass shopId if it's valid, otherwise let the API use user's assigned shops
      const result = await analyticsService.fetchTodaySales(currentShopId && currentShopId > 0 ? currentShopId : undefined, dateString)
      
      if (result) {
        setSales(result.sales)
        setSummary(result.summary)
      }
    } catch (error) {
      console.error('Error fetching today sales:', error)
      toast.error(t("Failed to fetch sales data", "बिक्री डेटा प्राप्त करने में विफल"))
    } finally {
      setLoading(false)
    }
  }

  const getPaymentMethodBadge = (method: string, partialPaymentMethod?: string) => {
    const badges = {
      cash: { label: t("Cash", "कैश"), variant: "default" as const },
      online: { label: t("Online", "ऑनलाइन"), variant: "secondary" as const },
      upi: { label: "UPI", variant: "outline" as const },
      loan: { label: t("Credit", "क्रेडिट"), variant: "destructive" as const },
      partial: { label: t("Partial", "आंशिक"), variant: "outline" as const },
      cheque: { label: t("Cheque", "चेक"), variant: "outline" as const }
    }
    const badge = badges[method as keyof typeof badges] || badges.cash
    if (method === 'partial' && partialPaymentMethod) {
      const partialBadge = badges[partialPaymentMethod as keyof typeof badges] || badges.cash
      return (
        <div className="flex flex-col gap-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <Badge variant={partialBadge.variant}>{partialBadge.label}</Badge>
        </div>
      )
    }
    return <Badge variant={badge.variant}>{badge.label}</Badge>
  }

  const getPaymentStatusBadge = (status: string) => {
    const badges = {
      COMPLETED: { label: t("Completed", "पूर्ण"), variant: "default" as const },
      PENDING: { label: t("Pending", "लंबित"), variant: "secondary" as const },
      CANCELLED: { label: t("Cancelled", "रद्द"), variant: "destructive" as const }
    }
    
    const badge = badges[status as keyof typeof badges] || badges.PENDING
    return <Badge variant={badge.variant}>{badge.label}</Badge>
  }

  const exportToCSV = () => {
    if (sales.length === 0) {
      toast.error(t("No data to export", "एक्सपोर्ट करने के लिए कोई डेटा नहीं"))
      return
    }

    const headers = [
      "Date", "Time", "Customer", "Phone", "Total Amount", "Paid Amount", 
      "Due Amount", "Payment Method", "Status", "Items"
    ]
    
    const rows = sales.map(sale => [
      sale.date,
      sale.time,
      sale.customerName,
      sale.customerPhone,
      sale.final_amount.toFixed(2),
      sale.paid_amount.toFixed(2),
      sale.due_amount.toFixed(2),
      sale.payment_type,
      sale.paymentStatus,
      sale.items.map(item => `${item.name} (${item.quantity} ${item.sku})`).join(", ")
    ])

    const csv = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-${selectedDate.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success(t("Sales data exported successfully!", "बिक्री डेटा सफलतापूर्वक एक्सपोर्ट किया गया!"))
  }

  if (loading) {
    const content = (
      <>
        {!hideCard && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("Sales History", "बिक्री इतिहास")}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t("Loading...", "लोड हो रहा है...")}</span>
          </div>
        </CardContent>
      </>
    )

    if (hideCard) {
      return <div className={className}>{content}</div>
    }

    return (
      <Card className={className}>
        {content}
      </Card>
    )
  }

  const content = (
    <>
      {!hideCard && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("Sales History", "बिक्री इतिहास")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <DatePicker
                date={selectedDate}
                onDateChange={(date) => date && setSelectedDate(date)}
                locale="en"
              />
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {sales.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">{t("No sales found for this date", "इस तारीख के लिए कोई बिक्री नहीं मिली")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sales.map((sale, idx) => {
              // Use saleDate for primary categorization
              const amountPaid = sale.paid_amount !== undefined ? sale.paid_amount : (sale.payment_type?.toLowerCase() === "cash" && sale.paymentStatus === "COMPLETED" ? sale.final_amount : 0);
              const dueAmount = sale.due_amount !== undefined ? sale.due_amount : (sale.payment_type?.toLowerCase() === "cash" && sale.paymentStatus === "COMPLETED" ? 0 : sale.final_amount);

              let saleDateObj = null;
              let saleTimeStr = "--";
              let saleDateStr = "--";
              
              // ... (rest of date logic)
              if (sale.date && sale.time) {
                const isoString = `${sale.date}T${sale.time}`;
                const parsed = new Date(isoString);
                if (!isNaN(parsed.getTime())) {
                  saleDateObj = parsed;
                  saleTimeStr = parsed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                  saleDateStr = parsed.toLocaleDateString("en-CA");
                } else {
                  saleTimeStr = sale.time;
                  saleDateStr = sale.date;
                }
              } else if (sale.date) {
                const parsed = new Date(sale.date);
                if (!isNaN(parsed.getTime())) {
                  saleDateObj = parsed;
                  saleDateStr = parsed.toLocaleDateString("en-CA");
                } else {
                  saleDateStr = sale.date;
                }
                if (sale.time) saleTimeStr = sale.time;
              } else if (sale.time) {
                saleTimeStr = sale.time;
              }

              return (
                <Card key={sale.id || idx} className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="font-semibold text-lg">{sale.customerName}</div>
                      <div className="text-xs text-muted-foreground">Account (खाता)</div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{t("Sale Time", "बिक्री का समय")}: {saleTimeStr}{saleDateStr !== "--" ? `, ${saleDateStr}` : ""}</span>
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">₹{sale.final_amount}</span>
                      </div>
                      <div>
                        <span className="font-medium">Status: </span>
                        {getPaymentStatusBadge(sale.paymentStatus)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="font-medium">Items (आइटम):</div>
                      <ul className="list-disc list-inside ml-2">
                        {sale.items.map((item, i) => (
                          <li key={i} className="flex justify-between">
                            <span>
                              {item.name} × {item.quantity} {item.unit || item.sku || 'pcs'}
                            </span>
                            <span>₹{item.total_price}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <div>
                        <span className="font-medium">Total Bill (कुल राशि): </span>₹{sale.final_amount ?? sale.total_amount}
                      </div>
                      <div>
                        <span className="font-medium">Amount Paid (भुगतान राशि): </span>
                        <p className="font-bold text-green-600 text-sm md:text-base">
                          ₹{Number(amountPaid).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Due Amount (बकाया राशि): </span>
                        <p className="font-bold text-red-600 text-sm md:text-base">
                          ₹{Number(dueAmount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Payment Method (भुगतान प्रकार): </span>{getPaymentMethodBadge(sale.payment_type, sale.partial_payment_method)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        disabled
                        checked={sale.paymentStatus === 'COMPLETED'}
                        className="cursor-not-allowed accent-gray-400"
                        tabIndex={-1}
                      />
                      <span className="text-xs text-gray-400">{t("Completed", "पूर्ण")}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed pointer-events-none">{t("Reactivate", "पुनः सक्रिय करें")}</Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )

  if (hideCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={className}>
      {content}
    </Card>
  )
} 