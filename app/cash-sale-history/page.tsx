"use client"

import { useAuthGuard } from "@/app/hooks/use-auth-guard"
import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

import { useShop } from "../contexts/ShopContext"
import { toast } from "sonner"
import {
  ShoppingBag,
  Store,
  Calendar,
  Search,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Package,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Filter,
  X,
  IndianRupee
} from "lucide-react"
import dayjs from "dayjs"

interface CashSaleItem {
  id: number
  name: string
  sku: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface CashSale {
  id: number
  source: 'sale' | 'tmt'
  saleDate: string
  saleType: 'cash' | 'regular'
  customerName: string
  customerPhone: string
  customerAddress: string
  shopId: number
  shopName: string
  shopLocation: string
  totalAmount: number
  finalAmount: number
  discount: number
  paymentMethod: string
  paymentStatus: string
  notes: string
  items: CashSaleItem[]
  createdAt: string
}

interface Shop {
  id: number
  name: string
  location: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function CashSaleHistoryPage() {
  const { authReady, isAuthenticated } = useAuthGuard()
  const router = useRouter()
  const { userRole, shops } = useShop()

  const [sales, setSales] = useState<CashSale[]>([])
  const [availableShops, setAvailableShops] = useState<Shop[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  // Filters
  const [selectedShopId, setSelectedShopId] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [saleType, setSaleType] = useState<'all' | 'cash' | 'regular'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<CashSale | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Expanded sale details
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null)

  const isSuperDuperAdmin = userRole === 'SUPER_DUPER_ADMIN'
  const canView = userRole === 'SUPER_DUPER_ADMIN' || userRole === 'SUPER_ADMIN'

  useEffect(() => {
    if (userRole && !canView) {
      setAccessDenied(true)
      setLoading(false)
    }
  }, [userRole, canView])

  const fetchSales = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const params = new URLSearchParams()
      if (selectedShopId !== 'all') params.set('shopId', selectedShopId)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (saleType !== 'all') params.set('saleType', saleType)
      if (searchQuery) params.set('search', searchQuery)
      params.set('page', currentPage.toString())
      params.set('limit', '20')

      const res = await fetch(`/api/sales/cash-sale-history?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 403) {
        setAccessDenied(true)
        return
      }

      const data = await res.json()
      if (data.success) {
        setSales(data.data.sales || [])
        setPagination(data.data.pagination)
        if (data.data.shops && data.data.shops.length > 0) {
          setAvailableShops(data.data.shops)
        }
      } else {
        toast.error(data.message || 'Failed to load cash sale history')
      }
    } catch (error) {
      console.error('Error fetching cash sale history:', error)
      toast.error('Failed to load cash sale history')
    } finally {
      setLoading(false)
    }
  }, [canView, selectedShopId, fromDate, toDate, saleType, searchQuery, currentPage])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const handleEdit = (sale: CashSale) => {
    setEditingSale(sale)
    setEditNotes(sale.notes || '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingSale) return
    setEditLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/sales/cash-sale-history', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: editingSale.id, notes: editNotes, source: editingSale.source })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Sale updated successfully')
        setEditDialogOpen(false)
        fetchSales()
      } else {
        toast.error(data.message || 'Failed to update sale')
      }
    } catch {
      toast.error('Failed to update sale')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSaleId) return
    setDeleteLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const deletingSource = sales.find(s => s.id === deletingSaleId)?.source || 'sale'
      const res = await fetch(`/api/sales/cash-sale-history?id=${deletingSaleId}&source=${deletingSource}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Cash sale deleted successfully')
        setDeleteDialogOpen(false)
        setDeletingSaleId(null)
        fetchSales()
      } else {
        toast.error(data.message || 'Failed to delete sale')
      }
    } catch {
      toast.error('Failed to delete sale')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleClearFilters = () => {
    setSelectedShopId('all')
    setFromDate('')
    setToDate('')
    setSearchQuery('')
    setSaleType('all')
    setCurrentPage(1)
  }

  // Search is now server-side; filteredSales = all returned sales
  const filteredSales = sales

  const totalAmount = filteredSales.reduce((sum, s) => sum + s.finalAmount, 0)

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">

        <Card className="max-w-md mx-auto bg-white/10 backdrop-blur-sm border-white/20 text-white">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
            <p className="text-white/70 mb-6">
              This page is only accessible to Super Admin and Super Duper Admin.
            </p>
            <Button onClick={() => router.back()} variant="outline" className="border-white/30 text-white hover:bg-white/10">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Auth guard
  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) return <SessionExpiredScreen />

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-4 pb-20 md:pb-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Sale History</h1>
              <p className="text-gray-500 text-sm">All sale transactions across shops</p>
            </div>
          </div>
          {!isSuperDuperAdmin && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              View Only Mode
            </Badge>
          )}
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 opacity-80" />
                <span className="text-sm opacity-90">Total Sales</span>
              </div>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <IndianRupee className="h-4 w-4 opacity-80" />
                <span className="text-sm opacity-90">Showing Total</span>
              </div>
              <div className="text-2xl font-bold">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-lg col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Store className="h-4 w-4 opacity-80" />
                <span className="text-sm opacity-90">Shops</span>
              </div>
              <div className="text-2xl font-bold">{availableShops.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Sale Type Filter ─── */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Sale Type:</span>
          {[
            { value: 'all',     label: 'All Sales',      activeClass: 'bg-gray-800 text-white border-gray-800' },
            { value: 'cash',    label: '💵 Cash Sale',   activeClass: 'bg-green-600 text-white border-green-600' },
            { value: 'regular', label: '📋 Regular Sale',activeClass: 'bg-blue-600 text-white border-blue-600' },
          ].map(({ value, label, activeClass }) => (
            <button
              key={value}
              onClick={() => { setSaleType(value as 'all' | 'cash' | 'regular'); setCurrentPage(1) }}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all shadow-sm ${
                saleType === value
                  ? activeClass
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6 shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="ml-auto text-gray-500 hover:text-gray-700">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Shop Filter */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Shop</Label>
                  <Select value={selectedShopId} onValueChange={(v) => { setSelectedShopId(v); setCurrentPage(1) }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Shops" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shops</SelectItem>
                      {availableShops.map(shop => (
                        <SelectItem key={shop.id} value={String(shop.id)}>
                          {shop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Date */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">From Date</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1) }}
                    className="h-9"
                  />
                </div>

                {/* To Date */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">To Date</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setCurrentPage(1) }}
                    className="h-9"
                  />
                </div>

                {/* Search */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Name, phone, shop..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Sale History
              <span className="ml-2 text-gray-400 text-sm font-normal">({pagination.total} total)</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
                <span className="ml-3 text-gray-500">Loading sale history...</span>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No sales found</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredSales.map(sale => (
                  <div key={sale.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Customer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-semibold text-gray-900 truncate">{sale.customerName}</span>
                          <Badge className={`text-xs ${sale.saleType === 'cash' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {sale.saleType === 'cash' ? '💵 Cash Sale' : '📋 Regular Sale'}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">#{sale.id}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {sale.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {sale.customerPhone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3" /> {sale.shopName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dayjs(sale.saleDate).format('DD/MM/YYYY')}
                          </span>
                        </div>

                        {/* Items collapsed/expanded */}
                        <div className="mt-2">
                          <button
                            onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <Package className="h-3 w-3" />
                            {sale.items.length} item(s)
                            {expandedSaleId === sale.id ? ' ▲' : ' ▼'}
                          </button>
                          {expandedSaleId === sale.id && (
                            <div className="mt-2 pl-3 border-l-2 border-blue-100 space-y-1">
                              {sale.items.map((item, idx) => (
                                <div key={idx} className="text-xs text-gray-600">
                                  {item.name} × {item.quantity} {item.unit} @ ₹{item.unitPrice} = <span className="font-medium">₹{item.totalPrice.toLocaleString('en-IN')}</span>
                                </div>
                              ))}
                              {sale.notes && (
                                <div className="text-xs text-gray-500 italic mt-1">📝 {sale.notes}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount + Actions */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            ₹{sale.finalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                          {sale.discount > 0 && (
                            <div className="text-xs text-green-600">-₹{sale.discount} disc.</div>
                          )}
                          <Badge className={`text-xs mt-1 ${sale.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                            {sale.paymentStatus}
                          </Badge>
                        </div>

                        {/* Actions (SUPER_DUPER_ADMIN only) */}
                        {isSuperDuperAdmin && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleEdit(sale)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setDeletingSaleId(sale.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sale Notes</DialogTitle>
            <DialogDescription>
              Update notes for cash sale #{editingSale?.id} — {editingSale?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Enter notes..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Cash Sale
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the cash sale and restore the stock. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
