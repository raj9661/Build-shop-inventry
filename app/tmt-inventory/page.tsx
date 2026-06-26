"use client"

import { useAuthGuard } from "@/app/hooks/use-auth-guard"
import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Package, TrendingUp, Download, Search, Filter, RefreshCw, RotateCcw } from "lucide-react"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "../contexts/ShopContext"
import { toast } from "sonner"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface TmtInventoryItem {
  id: number
  productId: number
  productName: string
  companyName: string
  sizeMM: number
  availableQtyKg: number
  availableTons: number
  availableBundles: number
  availablePieces: number
  sellingPricePerKg: number | null
  sellingPricePerPiece: number | null
  costPricePerKg: number | null
  costPricePerPiece: number | null
  lastUpdated: string
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
}

interface InventorySummary {
  totalProducts: number
  totalTons: number
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TmtInventoryPage() {
  const { authReady, isAuthenticated } = useAuthGuard()
  const { t } = useLanguage()
  const { currentShopId } = useShop()

  const [inventory, setInventory] = useState<TmtInventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [restocking, setRestocking] = useState(false)

  // Sales & purchase history per product
  const [salesMap, setSalesMap] = useState<Record<number, { bundles: number; pieces: number; kg: number }>>({})
  const [purchasesMap, setPurchasesMap] = useState<Record<number, { bundles: number; pieces: number; kg: number }>>({})

  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [selectedSize, setSelectedSize] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  // ── Fetch inventory ──────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    if (!currentShopId) return
    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/tmt/inventory?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch inventory')
      const data = await res.json()

      // API returns { success, data: { inventory: [...], summary: {...} } }
      const rawInventory: any[] = data?.data?.inventory || []
      const rawSummary = data?.data?.summary || null

      const mapped: TmtInventoryItem[] = rawInventory.map((item: any) => {
        const kg = Number(item.availableQtyKg || 0)
        return {
          id: Number(item.id),
          productId: Number(item.productId),
          productName: item.productName || '',
          companyName: item.companyName || '',
          sizeMM: Number(item.sizeMM || 0),
          availableQtyKg: kg,
          availableTons: kg / 1000,
          availableBundles: Number(item.availableBundles || 0),
          availablePieces: Number(item.availablePieces || 0),
          sellingPricePerKg: item.sellingPricePerKg ?? null,
          sellingPricePerPiece: item.sellingPricePerPiece ?? null,
          costPricePerKg: item.costPricePerKg ?? null,
          costPricePerPiece: item.costPricePerPiece ?? null,
          lastUpdated: item.lastUpdated,
          status: kg <= 0
            ? 'Out of Stock'
            : kg < 100
              ? 'Low Stock'
              : 'In Stock'
        }
      })

      setInventory(mapped)
      setSummary(rawSummary)
    } catch (err) {
      console.error('Error fetching inventory:', err)
      toast.error(t('Failed to fetch inventory', 'इन्वेंटरी लाने में विफल'))
    } finally {
      setLoading(false)
    }
  }, [currentShopId])

  // ── Fetch sales history (to show "total sold" per product) ───────────────────
  const fetchSalesHistory = useCallback(async () => {
    if (!currentShopId) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/tmt/sales?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      const sales: any[] = data?.data || []

      const map: Record<number, { bundles: number; pieces: number; kg: number }> = {}
      for (const sale of sales) {
        for (const item of (sale.items || [])) {
          const pid = Number(item.productId)
          if (!map[pid]) map[pid] = { bundles: 0, pieces: 0, kg: 0 }
          const qty = Number(item.quantity || 0)
          const unit = (item.unitType || 'KG').toUpperCase()
          // Use the snapshot values stored on the sale item for accurate totals
          const wpr = Number(item.weightPerRodKg || 0)
          const rpb = Number(item.rodsPerBundle || 0)
          if (unit === 'BUNDLE') {
            map[pid].bundles += qty
            map[pid].pieces += qty * rpb
            map[pid].kg += qty * rpb * wpr
          } else if (unit === 'PIECE') {
            map[pid].pieces += qty
            map[pid].bundles += rpb > 0 ? qty / rpb : 0
            map[pid].kg += qty * wpr
          } else if (unit === 'TON') {
            map[pid].kg += qty * 1000
          } else {
            map[pid].kg += qty
          }
        }
      }
      setSalesMap(map)
    } catch (_) { /* non-blocking */ }
  }, [currentShopId])

  // ── Fetch purchases history ──────────────────────────────────────────────────
  const fetchPurchasesHistory = useCallback(async () => {
    if (!currentShopId) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/tmt/purchases?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      const purchases: any[] = data?.data || []

      // Purchases API currently only returns summary-level data.
      // We use it to note purchase count; for detailed per-product, use restock API.
      const map: Record<number, { bundles: number; pieces: number; kg: number }> = {}
      setPurchasesMap(map)
    } catch (_) { /* non-blocking */ }
  }, [currentShopId])

  useEffect(() => {
    fetchInventory()
    fetchSalesHistory()
    fetchPurchasesHistory()
  }, [currentShopId])

  // ── Restock / Recalculate ────────────────────────────────────────────────────
  const handleRestock = async () => {
    if (!currentShopId) return
    setRestocking(true)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/tmt/inventory/restock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ shopId: currentShopId.toString() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Restock failed')

      toast.success(
        t(
          `✅ Restocked ${data.data?.length || 0} products successfully!`,
          `✅ ${data.data?.length || 0} उत्पादों का स्टॉक सही किया गया!`
        )
      )
      // Refresh all data after restock
      await fetchInventory()
      await fetchSalesHistory()
    } catch (err: any) {
      console.error('[Restock]', err)
      toast.error(err.message || t('Restock failed', 'रीस्टॉक विफल'))
    } finally {
      setRestocking(false)
    }
  }

  // ── Filters ──────────────────────────────────────────────────────────────────
  const uniqueBrands = Array.from(new Set(inventory.map(i => i.companyName).filter(Boolean)))
  const uniqueSizes = Array.from(new Set(inventory.map(i => i.sizeMM).filter(Boolean))).sort((a, b) => a - b)

  const filteredInventory = inventory.filter(item => {
    if (searchTerm && !item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.sizeMM.toString().includes(searchTerm) &&
        !item.productName.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (selectedBrand !== 'all' && item.companyName !== selectedBrand) return false
    if (selectedSize !== 'all' && item.sizeMM.toString() !== selectedSize) return false
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false
    return true
  })

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const headers = [
      'Company', 'Size (mm)', 'Product Name',
      'Available KG', 'Available Tons', 'Available Bundles', 'Available Pieces',
      'Sold Bundles', 'Sold Pieces', 'Sold KG',
      'Selling Price/KG', 'Selling Price/Piece',
      'Status', 'Last Updated'
    ]
    const csvContent = [
      headers.join(','),
      ...filteredInventory.map(item => [
        item.companyName,
        item.sizeMM,
        item.productName,
        item.availableQtyKg.toFixed(3),
        item.availableTons.toFixed(3),
        item.availableBundles.toFixed(2),
        item.availablePieces.toFixed(2),
        (salesMap[item.productId]?.bundles || 0).toFixed(2),
        (salesMap[item.productId]?.pieces || 0).toFixed(2),
        (salesMap[item.productId]?.kg || 0).toFixed(3),
        item.sellingPricePerKg ?? '',
        item.sellingPricePerPiece ?? '',
        item.status,
        new Date(item.lastUpdated).toLocaleDateString()
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tmt-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'Out of Stock') return 'destructive' as const
    if (status === 'Low Stock') return 'secondary' as const
    return 'default' as const
  }

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) return <SessionExpiredScreen />
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">{t('Loading inventory...', 'इन्वेंटरी लोड हो रही है...')}</p>
        </div>
      </div>
    )
  }

  // ── Summary card data ────────────────────────────────────────────────────────
  const totalBundlesAvailable = filteredInventory.reduce((s, i) => s + i.availableBundles, 0)
  const totalPiecesAvailable = filteredInventory.reduce((s, i) => s + i.availablePieces, 0)
  const totalTonsAvailable = filteredInventory.reduce((s, i) => s + i.availableTons, 0)
  const lowStockCount = filteredInventory.filter(i => i.status === 'Low Stock').length
  const outOfStockCount = filteredInventory.filter(i => i.status === 'Out of Stock').length

  // Chart data
  const brandChartData = Object.entries(
    filteredInventory.reduce((acc, item) => {
      acc[item.companyName] = (acc[item.companyName] || 0) + item.availableTons
      return acc
    }, {} as Record<string, number>)
  ).map(([brand, tons]) => ({ brand, tons: Math.round(tons * 100) / 100 }))

  const sizeChartData = Object.entries(
    filteredInventory.reduce((acc, item) => {
      acc[`${item.sizeMM}mm`] = (acc[`${item.sizeMM}mm`] || 0) + item.availableBundles
      return acc
    }, {} as Record<string, number>)
  ).map(([size, bundles]) => ({ size, bundles: Math.round(bundles * 10) / 10 }))

  const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('TMT Bar Inventory', 'TMT बार इन्वेंटरी')}</h1>
          <p className="text-gray-500 mt-1">{t('Real-time inventory with bundle & piece tracking', 'बंडल और पीस सहित रियल-टाइम इन्वेंटरी')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            id="btn-restock"
            onClick={handleRestock}
            disabled={restocking}
            variant="outline"
            className="flex items-center gap-2 border-orange-400 text-orange-600 hover:bg-orange-50"
          >
            {restocking
              ? <><RotateCcw className="h-4 w-4 animate-spin" />{t('Recalculating...', 'पुनर्गणना हो रही है...')}</>
              : <><RotateCcw className="h-4 w-4" />{t('Recalculate Stock', 'स्टॉक पुनर्गणना करें')}</>
            }
          </Button>
          <Button id="btn-refresh" onClick={fetchInventory} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('Refresh', 'ताज़ा करें')}
          </Button>
          <Button id="btn-export" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('Export CSV', 'CSV निर्यात')}
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500 mb-1">{t('Total Tons Available', 'कुल टन उपलब्ध')}</div>
            <div className="text-2xl font-bold text-blue-600">{totalTonsAvailable.toFixed(3)}</div>
            <div className="text-xs text-gray-400">{(totalTonsAvailable * 1000).toFixed(1)} kg</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500 mb-1">{t('Total Bundles', 'कुल बंडल')}</div>
            <div className="text-2xl font-bold text-green-600">{Math.round(totalBundlesAvailable)}</div>
            <div className="text-xs text-gray-400">{t('exact count from DB', 'DB से सटीक गिनती')}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-purple-500">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500 mb-1">{t('Total Pieces', 'कुल पीस')}</div>
            <div className="text-2xl font-bold text-purple-600">{Math.round(totalPiecesAvailable)}</div>
            <div className="text-xs text-gray-400">{t('exact count from DB', 'DB से सटीक गिनती')}</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${outOfStockCount > 0 ? 'border-red-500' : lowStockCount > 0 ? 'border-orange-500' : 'border-gray-300'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500 mb-1">{t('Stock Alerts', 'स्टॉक अलर्ट')}</div>
            <div className="text-2xl font-bold text-orange-600">{lowStockCount + outOfStockCount}</div>
            <div className="text-xs text-gray-400">{lowStockCount} {t('low', 'कम')}, {outOfStockCount} {t('out', 'खत्म')}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ── */}
      {filteredInventory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('Tons by Brand', 'ब्रांड के अनुसार टन')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={brandChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="brand" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} tons`, 'Tons']} />
                  <Bar dataKey="tons" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('Bundles by Size', 'आकार के अनुसार बंडल')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sizeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ size, percent }) => `${size} (${((percent || 0) * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    dataKey="bundles"
                  >
                    {sizeChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} bundles`, 'Bundles']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            {t('Filters & Search', 'फ़िल्टर और खोज')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('Search', 'खोजें')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('Brand, size, or product...', 'ब्रांड, आकार, या उत्पाद...')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Brand', 'ब्रांड')}</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('All brands', 'सभी ब्रांड')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All brands', 'सभी ब्रांड')}</SelectItem>
                  {uniqueBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Size (mm)', 'आकार (मिमी)')}</Label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('All sizes', 'सभी आकार')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All sizes', 'सभी आकार')}</SelectItem>
                  {uniqueSizes.map(s => <SelectItem key={s} value={s.toString()}>{s}mm</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Status', 'स्थिति')}</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('All status', 'सभी स्थिति')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All', 'सभी')}</SelectItem>
                  <SelectItem value="In Stock">{t('In Stock', 'स्टॉक में')}</SelectItem>
                  <SelectItem value="Low Stock">{t('Low Stock', 'कम स्टॉक')}</SelectItem>
                  <SelectItem value="Out of Stock">{t('Out of Stock', 'स्टॉक खत्म')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Inventory Table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('Inventory Details', 'इन्वेंटरी विवरण')}
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({filteredInventory.length} {t('items', 'आइटम')})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="whitespace-nowrap">{t('Brand', 'ब्रांड')}</TableHead>
                  <TableHead>{t('Size', 'आकार')}</TableHead>
                  <TableHead className="text-right">{t('Available KG', 'उपलब्ध KG')}</TableHead>
                  <TableHead className="text-right text-green-700">{t('Avail. Bundles', 'उपलब्ध बंडल')}</TableHead>
                  <TableHead className="text-right text-purple-700">{t('Avail. Pieces', 'उपलब्ध पीस')}</TableHead>
                  <TableHead className="text-right text-red-600">{t('Sold Bundles', 'बेचे बंडल')}</TableHead>
                  <TableHead className="text-right text-red-600">{t('Sold Pieces', 'बेचे पीस')}</TableHead>
                  <TableHead>{t('Selling Price', 'बिक्री मूल्य')}</TableHead>
                  <TableHead>{t('Status', 'स्थिति')}</TableHead>
                  <TableHead>{t('Last Updated', 'अंतिम अपडेट')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-400">
                      {t('No inventory found', 'कोई इन्वेंटरी नहीं मिली')}
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.map(item => {
                  const soldBundles = salesMap[item.productId]?.bundles || 0
                  const soldPieces = salesMap[item.productId]?.pieces || 0
                  const rowBg = item.status === 'Out of Stock'
                    ? 'bg-red-50'
                    : item.status === 'Low Stock'
                      ? 'bg-orange-50'
                      : ''
                  return (
                    <TableRow key={item.id} className={rowBg}>
                      <TableCell className="font-semibold">{item.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{item.sizeMM}mm</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.availableQtyKg.toFixed(2)}
                        <span className="text-gray-400 text-xs ml-1">kg</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-700 font-bold">
                        {Math.round(item.availableBundles)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-purple-700 font-bold">
                        {Math.round(item.availablePieces)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-500">
                        {Math.round(soldBundles)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-400">
                        {Math.round(soldPieces)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.sellingPricePerKg != null && (
                          <div>₹{item.sellingPricePerKg}/kg</div>
                        )}
                        {item.sellingPricePerPiece != null && (
                          <div className="text-gray-500">₹{item.sellingPricePerPiece}/pc</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                          {item.status === 'Low Stock' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {new Date(item.lastUpdated).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Restock info banner ── */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800">
              <p className="font-semibold">{t('How "Recalculate Stock" works', '"स्टॉक पुनर्गणना" कैसे काम करता है')}</p>
              <p className="text-orange-700 mt-1">
                {t(
                  'It replays all purchases and all sales to compute the exact available bundles, pieces, and KG for each TMT product. Use this if the numbers look off after adding stock or making sales.',
                  'यह सभी खरीद और बिक्री को फिर से गणना करके प्रत्येक TMT उत्पाद के लिए सटीक बंडल, पीस और KG की गणना करता है।'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
