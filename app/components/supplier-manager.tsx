"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Edit, Trash2, Building2, Users } from "lucide-react"
import { useShop } from '../contexts/ShopContext'
import { toast } from "sonner"

interface Supplier {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  shopId: number
  isActive: boolean
  shop: {
    id: number
    name: string
  }
}

interface SupplierManagerProps {
  shop?: any
}

export function SupplierManager({ shop }: SupplierManagerProps) {
  const { currentShop, userRole, shops } = useShop()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedShops, setSelectedShops] = useState<number[]>([])
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  })

  // Determine which shops to show
  const availableShops = shop ? [shop] : shops
  const targetShop = shop || currentShop

  useEffect(() => {
    if (targetShop) {
      loadSuppliers()
    }
  }, [targetShop])

  const loadSuppliers = async () => {
    if (!targetShop) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/suppliers?shopId=${targetShop.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.suppliers) {
          setSuppliers(data.data.suppliers)
        } else {
          setSuppliers([])
        }
      } else {
        console.error('Failed to load suppliers:', response.status)
        toast.error('Failed to load suppliers')
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
      setSuppliers([])
      toast.error('Error loading suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('accessToken')
      const url = editingSupplier 
        ? `/api/suppliers/${editingSupplier.id}`
        : '/api/suppliers'
      
      const method = editingSupplier ? 'PUT' : 'POST'
      
      // Determine shop IDs for supplier creation
      let shopIds = selectedShops
      if (shopIds.length === 0 && targetShop) {
        shopIds = [targetShop.id]
      }

      const body = editingSupplier 
        ? { ...formData, shopId: targetShop?.id }
        : { ...formData, shopIds }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.data?.message || `Supplier ${editingSupplier ? 'updated' : 'created'} successfully`)
        setIsDialogOpen(false)
        resetForm()
        loadSuppliers()
      } else {
        const error = await response.json()
        toast.error(error.message || `Failed to ${editingSupplier ? 'update' : 'create'} supplier`)
      }
    } catch (error) {
      toast.error(`Failed to ${editingSupplier ? 'update' : 'create'} supplier. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSupplier = async (supplierId: number) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        toast.success('Supplier deleted successfully')
        loadSuppliers()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete supplier')
      }
    } catch (error) {
      toast.error('Failed to delete supplier. Please try again.')
    }
  }

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || ""
    })
    setSelectedShops([supplier.shopId])
  }

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "" })
    setEditingSupplier(null)
    setSelectedShops([])
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone?.includes(searchTerm) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!targetShop) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">Please select a shop to manage suppliers</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Supplier Management</h2>
          <p className="text-gray-600">
            {shop ? `Managing suppliers for ${shop.name}` : `Managing suppliers for ${targetShop.name}`}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) {
                        setFormData({ ...formData, phone: value });
                      }
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              {!editingSupplier && availableShops.length > 1 && (
                <div>
                  <Label>Assign to Shops</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {availableShops.map((shop) => (
                      <label key={shop.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedShops.includes(shop.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedShops([...selectedShops, shop.id])
                            } else {
                              setSelectedShops(selectedShops.filter(id => id !== shop.id))
                            }
                          }}
                        />
                        <span className="text-sm">{shop.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select multiple shops to create the same supplier across shops
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : (editingSupplier ? "Update Supplier" : "Create Supplier")}
                </Button>
                {editingSupplier && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading suppliers...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No suppliers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contactPerson || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {supplier.shop.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditSupplier(supplier)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteSupplier(supplier.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 