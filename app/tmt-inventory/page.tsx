"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Package, TrendingUp, DollarSign, Download, Search, Filter } from "lucide-react"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "../contexts/ShopContext"
import { toast } from "sonner"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface TmtInventoryItem {
  id: string
  companyName: string
  sizeMM: number
  weightPerPiece: number
  rodsPerBundle: number
  totalBundlesAdded: number
  totalPiecesAdded: number
  totalTonsAdded: number
  totalSoldBundles: number
  totalSoldPieces: number
  totalSoldTons: number
  availableBundles: number
  availablePieces: number
  availableTons: number
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
  lastUpdated: string
  sellByWeight: boolean
  sellByBundle: boolean
  sellByPiece: boolean
}

interface InventorySummary {
  totalTmtBars: number
  totalTonsAvailable: number
  totalBundlesAvailable: number
  totalPiecesAvailable: number
  lowStockCount: number
  outOfStockCount: number
}

interface InventoryFilters {
  brands: string[]
  sizes: number[]
}

export default function TmtInventoryPage() {
  const { t } = useLanguage()
  const { currentShopId } = useShop()
  
  const [inventory, setInventory] = useState<TmtInventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [filters, setFilters] = useState<InventoryFilters>({ brands: [], sizes: [] })
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [selectedSize, setSelectedSize] = useState("all")
  const [selectedStockType, setSelectedStockType] = useState("all")
  const [selectedAvailabilityStatus, setSelectedAvailabilityStatus] = useState("all")

  // Fetch inventory data
  const fetchInventory = async () => {
    if (!currentShopId) return
    
    try {
      setLoading(true)
      const params = new URLSearchParams({
        shopId: currentShopId.toString(),
        ...(selectedBrand && selectedBrand !== "all" && { brand: selectedBrand }),
        ...(selectedSize && selectedSize !== "all" && { size: selectedSize }),
        ...(selectedStockType && selectedStockType !== "all" && { stockType: selectedStockType }),
        ...(selectedAvailabilityStatus && selectedAvailabilityStatus !== "all" && { availabilityStatus: selectedAvailabilityStatus })
      })

      const response = await fetch(`/api/tmt/inventory?${params}`)
      if (!response.ok) throw new Error('Failed to fetch inventory')
      
      const data = await response.json()
      setInventory(data.data)
      setSummary(data.summary)
      setFilters(data.filters)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast.error(t("Failed to fetch inventory data", "इन्वेंटरी डेटा लाने में विफल"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [currentShopId, selectedBrand, selectedSize, selectedStockType, selectedAvailabilityStatus])

  // Filter inventory based on search term
  const filteredInventory = inventory.filter(item => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      item.companyName.toLowerCase().includes(searchLower) ||
      item.sizeMM.toString().includes(searchLower)
    )
  })

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'In Stock': return 'default'
      case 'Low Stock': return 'destructive'
      case 'Out of Stock': return 'secondary'
      default: return 'default'
    }
  }

  // Export functionality
  const exportToCSV = () => {
    const headers = [
      'Company', 'Size (mm)', 'Weight per Piece (kg)', 'Rods per Bundle',
      'Total Bundles Added', 'Total Pieces Added', 'Total Tons Added',
      'Total Sold Bundles', 'Total Sold Pieces', 'Total Sold Tons',
      'Available Bundles', 'Available Pieces', 'Available Tons', 'Status'
    ]
    
    const csvContent = [
      headers.join(','),
      ...filteredInventory.map(item => [
        item.companyName,
        item.sizeMM,
        item.weightPerPiece,
        item.rodsPerBundle,
        item.totalBundlesAdded,
        item.totalPiecesAdded,
        item.totalTonsAdded,
        item.totalSoldBundles,
        item.totalSoldPieces,
        item.totalSoldTons,
        item.availableBundles,
        item.availablePieces,
        item.availableTons,
        item.status
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tmt-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">{t("Loading inventory...", "इन्वेंटरी लोड हो रही है...")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("TMT Bar Inventory", "TMT बार इन्वेंटरी")}
          </h1>
          <p className="text-gray-600 mt-2">
            {t("Real-time inventory tracking and analytics", "रियल-टाइम इन्वेंटरी ट्रैकिंग और एनालिटिक्स")}
          </p>
        </div>
        <Button onClick={exportToCSV} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t("Export CSV", "CSV एक्सपोर्ट करें")}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Total TMT Bars", "कुल TMT बार")}
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTmtBars}</div>
              <p className="text-xs text-muted-foreground">
                {t("Different brands & sizes", "विभिन्न ब्रांड और आकार")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Total Tons Available", "कुल टन उपलब्ध")}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTonsAvailable.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {t("In stock", "स्टॉक में")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Total Bundles Available", "कुल बंडल उपलब्ध")}
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalBundlesAvailable}</div>
              <p className="text-xs text-muted-foreground">
                {t("Ready for sale", "बिक्री के लिए तैयार")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Low Stock Alerts", "कम स्टॉक अलर्ट")}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.lowStockCount}</div>
              <p className="text-xs text-muted-foreground">
                {t("Need attention", "ध्यान की आवश्यकता")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {inventory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock by Brand Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Stock by Brand", "ब्रांड के अनुसार स्टॉक")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(
                  inventory.reduce((acc, item) => {
                    acc[item.companyName] = (acc[item.companyName] || 0) + item.availableTons
                    return acc
                  }, {} as Record<string, number>)
                ).map(([brand, tons]) => ({ brand, tons: Number(tons.toFixed(2)) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="brand" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} tons`, t("Tons", "टन")]} />
                  <Bar dataKey="tons" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Stock by Size Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Stock by Size", "आकार के अनुसार स्टॉक")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(
                      inventory.reduce((acc, item) => {
                        acc[`${item.sizeMM}mm`] = (acc[`${item.sizeMM}mm`] || 0) + item.availableTons
                        return acc
                      }, {} as Record<string, number>)
                    ).map(([size, tons]) => ({ size, tons: Number(tons.toFixed(2)) }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ size, percent }) => `${size} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="tons"
                  >
                    {Object.entries(
                      inventory.reduce((acc, item) => {
                        acc[`${item.sizeMM}mm`] = (acc[`${item.sizeMM}mm`] || 0) + item.availableTons
                        return acc
                      }, {} as Record<string, number>)
                    ).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} tons`, t("Tons", "टन")]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("Filters & Search", "फिल्टर और खोज")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>{t("Search", "खोजें")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("Brand or size...", "ब्रांड या आकार...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("Brand", "ब्रांड")}</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue placeholder={t("All brands", "सभी ब्रांड")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All brands", "सभी ब्रांड")}</SelectItem>
                  {filters.brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("Size (mm)", "आकार (मिमी)")}</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger>
                  <SelectValue placeholder={t("All sizes", "सभी आकार")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All sizes", "सभी आकार")}</SelectItem>
                  {filters.sizes.map(size => (
                    <SelectItem key={size} value={size.toString()}>{size}mm</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("Stock Type", "स्टॉक प्रकार")}</Label>
              <Select value={selectedStockType} onValueChange={setSelectedStockType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("All types", "सभी प्रकार")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All types", "सभी प्रकार")}</SelectItem>
                  <SelectItem value="bundles">{t("Bundles", "बंडल")}</SelectItem>
                  <SelectItem value="pieces">{t("Pieces", "पीस")}</SelectItem>
                  <SelectItem value="tons">{t("Tons", "टन")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("Availability", "उपलब्धता")}</Label>
              <Select value={selectedAvailabilityStatus} onValueChange={setSelectedAvailabilityStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t("All status", "सभी स्थिति")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All status", "सभी स्थिति")}</SelectItem>
                  <SelectItem value="In Stock">{t("In Stock", "स्टॉक में")}</SelectItem>
                  <SelectItem value="Low Stock">{t("Low Stock", "कम स्टॉक")}</SelectItem>
                  <SelectItem value="Out of Stock">{t("Out of Stock", "स्टॉक खत्म")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("Inventory Details", "इन्वेंटरी विवरण")} 
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredInventory.length} {t("items", "आइटम")})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Brand", "ब्रांड")}</TableHead>
                  <TableHead>{t("Size (mm)", "आकार (मिमी)")}</TableHead>
                  <TableHead>{t("Weight/Piece (kg)", "वजन/पीस (किलो)")}</TableHead>
                  <TableHead>{t("Rods/Bundle", "रॉड/बंडल")}</TableHead>
                  <TableHead>{t("Total Added", "कुल जोड़ा गया")}</TableHead>
                  <TableHead>{t("Total Sold", "कुल बेचा गया")}</TableHead>
                  <TableHead>{t("Available Stock", "उपलब्ध स्टॉक")}</TableHead>
                  <TableHead>{t("Status", "स्थिति")}</TableHead>
                  <TableHead>{t("Last Updated", "अंतिम अपडेट")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={item.status === 'Low Stock' ? 'bg-orange-50' : 
                              item.status === 'Out of Stock' ? 'bg-red-50' : ''}
                  >
                    <TableCell className="font-medium">{item.companyName}</TableCell>
                    <TableCell>{item.sizeMM}mm</TableCell>
                    <TableCell>{item.weightPerPiece}kg</TableCell>
                    <TableCell>{item.rodsPerBundle}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{item.totalBundlesAdded} {t("bundles", "बंडल")}</div>
                        <div>{item.totalPiecesAdded} {t("pieces", "पीस")}</div>
                        <div>{item.totalTonsAdded.toFixed(2)} {t("tons", "टन")}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{item.totalSoldBundles} {t("bundles", "बंडल")}</div>
                        <div>{item.totalSoldPieces} {t("pieces", "पीस")}</div>
                        <div>{item.totalSoldTons.toFixed(2)} {t("tons", "टन")}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        <div className={item.availableBundles <= 0 ? 'text-red-600' : ''}>
                          {item.availableBundles} {t("bundles", "बंडल")}
                        </div>
                        <div className={item.availablePieces <= 0 ? 'text-red-600' : ''}>
                          {item.availablePieces} {t("pieces", "पीस")}
                        </div>
                        <div className={item.availableTons <= 0 ? 'text-red-600' : ''}>
                          {item.availableTons.toFixed(2)} {t("tons", "टन")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status === 'Low Stock' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(item.lastUpdated).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
