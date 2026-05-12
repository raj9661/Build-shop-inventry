"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/hooks/use-language"

import { Search, Phone, MapPin, Calendar, IndianRupee } from "lucide-react"
import { useShop } from "../contexts/ShopContext"
import { toast } from "sonner"

export default function CustomerDetails() {
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShop } = useShop()
  const [searchTerm, setSearchTerm] = useState("")
  const [customerData, setCustomerData] = useState<any>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch customer data and payment history from API
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!currentShop) return
      
      try {
        setLoading(true)
        const token = localStorage.getItem('accessToken')
        if (!token) {
          toast.error('Authentication required')
          return
        }

        // TODO: Fetch customer data and payment history from respective APIs
        // const customerResponse = await fetch(`/api/customers/${customerId}`, {
        //   headers: { 'Authorization': `Bearer ${token}` }
        // })
        // const paymentResponse = await fetch(`/api/customers/${customerId}/payments`, {
        //   headers: { 'Authorization': `Bearer ${token}` }
        // })
        
        // For now, set empty data
        setCustomerData(null)
        setPaymentHistory([])
        
      } catch (error) {
        console.error('Error loading customer data:', error)
        toast.error('Error loading customer data')
        setCustomerData(null)
        setPaymentHistory([])
      } finally {
        setLoading(false)
      }
    }

    fetchCustomerData()
  }, [currentShop])

  const filteredHistory = paymentHistory.filter(
    (payment) =>
      payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.method.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case "sale_payment":
        return "bg-green-100 text-green-800 border-green-200"
      case "loan_clearing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case "cash":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "online":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile Navigation */}


      {/* Desktop Header */}
      <div className="hidden md:flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
        <h1 className="text-2xl font-bold">{t("Customer Details", "ग्राहक विवरण")}</h1>
        <div className="flex items-center space-x-2">
          <Switch id="language-toggle" checked={language === "hi"} onCheckedChange={toggleLanguage} />
          <Label htmlFor="language-toggle">हिन्दी</Label>
        </div>
      </div>

      {/* Main Content with Mobile Padding */}
      <div className="p-4 space-y-4 md:space-y-6 pb-20 md:pb-4">
        {/* Customer Information Card - Mobile Optimized */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl p-4 md:p-6">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-lg md:text-xl">{customerData?.name}</span>
              <Badge variant="outline" className="bg-white/20 border-white/30 text-white">
                {t("Active Customer", "सक्रिय ग्राहक")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <Phone className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs font-medium text-blue-600">{t("Phone", "फ़ोन")}</p>
                  <p className="font-medium text-sm">{customerData?.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <MapPin className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs font-medium text-green-600">{t("Address", "पता")}</p>
                  <p className="font-medium text-sm">{customerData?.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                <Calendar className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-xs font-medium text-purple-600">{t("Customer Since", "ग्राहक बने")}</p>
                  <p className="font-medium text-sm">{new Date(customerData?.joinDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                <IndianRupee className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-xs font-medium text-orange-600">{t("Total Purchases", "कुल खरीदारी")}</p>
                  <p className="font-medium text-sm">₹{customerData?.totalPurchases.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Amount Card - Mobile Optimized */}
        <Card className="border-destructive shadow-lg bg-red-50">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-destructive text-lg md:text-xl">
              <IndianRupee className="h-5 w-5 md:h-6 md:w-6" />
              {t("Total Outstanding", "कुल उधार राशि")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-destructive mb-2">
                ₹{customerData?.totalOutstanding.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">{t("Amount pending from customer", "ग्राहक से बकाया राशि")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment History - Mobile Optimized */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">{t("Payment History", "भुगतान इतिहास")}</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="h-4 w-4 text-white" />
                <Input
                  placeholder={t("Search payments...", "भुगतान खोजें...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Cards View */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredHistory.map((payment) => (
                <Card key={payment.id} className="border border-gray-200 bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-lg text-green-600">₹{payment.amount.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant="outline" className={getMethodColor(payment.method)}>
                          {t(payment.method, payment.method === "Cash" ? "कैश" : "ऑनलाइन")}
                        </Badge>
                        <Badge variant="outline" className={getPaymentTypeColor(payment.type)}>
                          {payment.type === "sale_payment"
                            ? t("Sale Payment", "बिक्री भुगतान")
                            : t("Loan Clearing", "उधार चुकाना")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">{payment.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Date", "तारीख")}</TableHead>
                    <TableHead className="text-right">{t("Amount", "राशि")}</TableHead>
                    <TableHead>{t("Method", "तरीका")}</TableHead>
                    <TableHead>{t("Purpose", "किस लिए")}</TableHead>
                    <TableHead>{t("Description", "विवरण")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {new Date(payment.date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ₹{payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getMethodColor(payment.method)}>
                          {t(payment.method, payment.method === "Cash" ? "कैश" : "ऑनलाइन")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPaymentTypeColor(payment.type)}>
                          {payment.type === "sale_payment"
                            ? t("Sale Payment", "बिक्री भुगतान")
                            : t("Loan Clearing", "उधार चुकाना")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{payment.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredHistory.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t("No payment history found", "कोई भुगतान इतिहास नहीं मिला")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button className="h-12 md:h-14 text-base font-semibold rounded-xl bg-green-600 hover:bg-green-700">
            {t("Record New Payment", "नया भुगतान दर्ज करें")}
          </Button>
          <Button variant="outline" className="h-12 md:h-14 text-base font-semibold rounded-xl bg-transparent">
            {t("View Full Statement", "पूरा विवरण देखें")}
          </Button>
          <Button variant="outline" className="h-12 md:h-14 text-base font-semibold rounded-xl bg-transparent">
            {t("Send Payment Reminder", "भुगतान रिमाइंडर भेजें")}
          </Button>
        </div>
      </div>
    </div>
  )
}
