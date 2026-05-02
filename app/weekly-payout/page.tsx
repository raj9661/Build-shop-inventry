"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/hooks/use-language"

import { Calendar, CreditCard, Users, Package, CheckCircle, Clock, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { useShop } from '../contexts/ShopContext'

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  // Only include fields that exist in the DB
}

// Week options
const weekOptions = [
  { value: "current", label: "Current Week (Dec 23 - Dec 28)", labelHi: "वर्तमान सप्ताह" },
  { value: "previous", label: "Previous Week (Dec 16 - Dec 21)", labelHi: "पिछला सप्ताह" },
  { value: "custom", label: "Custom Range", labelHi: "कस्टम रेंज" },
]

type PaymentData = {
  id: number
  name: string
  amount: number
  type: "supplier" | "employee"
  details?: any
}

export default function WeeklyPayout() {
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShop } = useShop()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSuppliers() {
      if (!currentShop) return
      setLoading(true)
      try {
        const token = localStorage.getItem('accessToken')
        const res = await fetch(`/api/suppliers?shopId=${currentShop.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.success && data.data && data.data.suppliers) {
          setSuppliers(data.data.suppliers)
    } else {
          setSuppliers([])
        }
      } catch (e) {
        setSuppliers([])
      } finally {
        setLoading(false)
      }
    }
    fetchSuppliers()
  }, [currentShop])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      <div className="p-4 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-20 md:pb-4">
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("Suppliers", "सप्लायर")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
              <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">{t("Supplier Name", "सप्लायर नाम")}</TableHead>
                  <TableHead className="font-semibold">{t("Phone", "फोन")}</TableHead>
                  <TableHead className="font-semibold">{t("Address", "ठेवाई")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {suppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell>{supplier.address}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            {suppliers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t("No suppliers found", "कोई सप्लायर नहीं मिला")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
