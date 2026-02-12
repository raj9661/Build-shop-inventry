import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useLanguage } from "@/hooks/use-language"

interface ProductManagerProps {
  shopId: number
}

export function ProductManager({ shopId }: ProductManagerProps) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    typeId: '',
    unit: '',
    price: '',
    costPrice: '',
    description: ''
  })
  const [adding, setAdding] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [itemsPerPage] = useState(12)

  useEffect(() => {
    loadData()
  }, [shopId])

  // Add this effect to auto-set unit to 'bundle' for Rings
  useEffect(() => {
    const selectedCategory = categories.find((c: any) => c.id === parseInt(form.categoryId));
    if (selectedCategory && selectedCategory.name && selectedCategory.name.toLowerCase().includes('ring')) {
      if (form.unit !== 'bundle') {
        setForm((prev) => ({ ...prev, unit: 'bundle', price: '' }));
      }
    }
  }, [form.categoryId, categories]);

  // Reset pagination when search terms change
  useEffect(() => {
    setProductPage(1)
  }, [productSearch])

  // Pagination functions
  const getFilteredProducts = () => {
    return products.filter(product =>
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(productSearch.toLowerCase())) ||
      (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(productSearch.toLowerCase()))
    )
  }

  const getTotalProductPages = () => {
    return Math.ceil(getFilteredProducts().length / itemsPerPage)
  }

  const handleProductPageChange = (page: number) => {
    setProductPage(page)
  }

  const resetProductPagination = () => {
    setProductPage(1)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return
      // Products
      const prodRes = await fetch(`/api/products?shopId=${shopId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (prodRes.ok) {
        const data = await prodRes.json()
        setProducts(data.data.products || [])
        console.log('Loaded products:', data.data.products)
      }
      // Categories
      const catRes = await fetch(`/api/categories?shopId=${shopId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.data || [])
      }
      // Types
      const typeRes = await fetch(`/api/categories/types?shopId=${shopId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (typeRes.ok) {
        const data = await typeRes.json()
        setTypes(data.data || [])
      }
    } catch (e) {
      toast.error('Failed to load product data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return
      const body = {
        ...form,
        shopId,
        categoryId: parseInt(form.categoryId),
        typeId: parseInt(form.typeId),
        price: parseFloat(form.price),
        costPrice: parseFloat(form.costPrice)
      }
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const data = await res.json()
        toast.success('Product added!')
        
        // Instant rendering - add product to local state immediately
        console.log('➕ Adding new product instantly:', data.data.product)
        setProducts(prevProducts => {
          const newProducts = [data.data.product, ...prevProducts]
          console.log('📋 Products after instant add:', newProducts.length, 'total products')
          return newProducts
        })
        
        setForm({ name: '', categoryId: '', typeId: '', unit: '', price: '', costPrice: '', description: '' })
        
        // Reset pagination to show the new product
        resetProductPagination()
        
        // Note: Instant rendering is sufficient - no need to reload data
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to add product')
      }
    } catch (e) {
      toast.error('Failed to add product')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Products</h3>
      </div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search products..."
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          className="w-full md:w-1/2 lg:w-1/3"
        />
      </div>

      {/* Product Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={form.categoryId} onValueChange={value => setForm({ ...form, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Product Type</Label>
                <Select value={form.typeId} onValueChange={value => setForm({ ...form, typeId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.filter((type: any) => type.categoryId === parseInt(form.categoryId)).map((type: any) => (
                      <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g., piece, kg, bundle"
                  required
                />
              </div>
              <div>
                <Label htmlFor="price">Selling Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={e => setForm({ ...form, costPrice: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Product description (optional)"
              />
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : 'Add Product'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Products Display */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Products ({getFilteredProducts().length})</h3>
        </div>

        {/* Scrollable grid for products */}
        <div className="overflow-y-auto max-h-[600px]">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" style={{ minHeight: 400 }}>
            {getFilteredProducts()
              .slice((productPage - 1) * itemsPerPage, productPage * itemsPerPage)
              .map((product) => (
                <Card key={product.id} className="h-fit">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{product.name}</CardTitle>
                      <div className="flex gap-1">
                        <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs px-2 py-0.5">
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Category:</span>
                        <span>{categories.find(c => c.id === product.categoryId)?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span>{types.find(t => t.id === product.typeId)?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unit:</span>
                        <span>{product.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span className="font-semibold">₹{product.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost:</span>
                        <span>₹{product.costPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stock:</span>
                        <span className={product.stockQuantity <= product.minStockLevel ? 'text-red-600 font-semibold' : ''}>
                          {product.stockQuantity} {product.unit}
                        </span>
                      </div>
                      {product.sku && (
                        <div className="flex justify-between">
                          <span>SKU:</span>
                          <span className="font-mono text-xs">{product.sku}</span>
                        </div>
                      )}
                      {product.barcode && (
                        <div className="flex justify-between">
                          <span>Barcode:</span>
                          <span className="font-mono text-xs">{product.barcode}</span>
                        </div>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-gray-500 mt-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {product.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>

        {/* Pagination Controls */}
        {getTotalProductPages() > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <Button onClick={() => handleProductPageChange(productPage - 1)} disabled={productPage === 1}>Previous</Button>
            <span className="text-sm text-gray-600">Page {productPage} of {getTotalProductPages()}</span>
            <Button onClick={() => handleProductPageChange(productPage + 1)} disabled={productPage === getTotalProductPages()}>Next</Button>
          </div>
        )}
      </div>
    </div>
  )
} 