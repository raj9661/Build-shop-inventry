"use client"

import React, { useEffect, useState } from "react";
import { useShop } from "../contexts/ShopContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Package, Pencil, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function exportToCSV(rows: any[], headers: string[], filename: string) {
  const csv = [headers.join(","), ...rows.map(row => headers.map(h => row[h] ?? "").join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper to format TMT bar quantity as bundles and pieces
function formatTmtStockDisplay(prod: any) {
  if (!prod || !prod.name?.toLowerCase().includes('tmt')) return prod.stockQuantity;
  const bundleSize = prod.type?.bundleSize || 0;
  if (!bundleSize) return prod.stockQuantity;
  const bundles = Math.floor(prod.stockQuantity / bundleSize);
  const pieces = prod.stockQuantity % bundleSize;
  return `${bundles} bundles, ${pieces} pieces (Total: ${prod.stockQuantity} pieces)`;
}

export default function InventoryPage() {
  const { currentShopId } = useShop();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  // 1. Add 'damaged' to editing state type
  type EditField = 'min' | 'max' | 'sku' | 'price' | 'costPrice' | 'damaged';
  const [editing, setEditing] = useState<{ id: any, field: EditField | null }>({ id: null, field: null });
  const [editValue, setEditValue] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);
  const [tab, setTab] = useState('inventory');
  const [stockEntries, setStockEntries] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      if (!token || !currentShopId) return;

      // Fetch regular products with aggressive cache busting
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const res = await fetch(`/api/products?shopId=${currentShopId}&_t=${timestamp}&_r=${randomId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      // Fetch TMT products with aggressive cache busting
      const tmtRes = await fetch(`/api/tmt/products?shopId=${currentShopId}&_t=${timestamp}&_r=${randomId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      let regularProducts = [];
      let tmtProducts = [];

      if (res.ok) {
        const data = await res.json();
        regularProducts = data.data.products || [];
        console.log('🔍 [Inventory] Regular products loaded:', regularProducts.length);
        console.log('🔍 [Inventory] All product names:', regularProducts.map((p: any) => p.name));
        console.log('🔍 [Inventory] Sample regular product:', regularProducts[0]);
        console.log('🔍 [Inventory] Stock quantities:', regularProducts.slice(0, 3).map((p: any) => ({
          id: p.id,
          name: p.name,
          stockQuantity: p.stockQuantity
        })));

        // Check if Bangur product is still in the list
        const bangurProduct = regularProducts.find((p: any) => p.name === 'Bangur');
        if (bangurProduct) {
          console.log('⚠️ [Inventory] Bangur product still found in API response:', bangurProduct);
        } else {
          console.log('✅ [Inventory] Bangur product not found in API response - deletion successful');
        }
      } else {
        console.error('🔍 [Inventory] Failed to load regular products:', res.status);
        toast.error("Failed to load regular products");
      }

      if (tmtRes.ok) {
        const tmtData = await tmtRes.json();
        tmtProducts = (tmtData.data.products || []).map((tmt: any) => {
          // Calculate bundles and pieces from available quantity
          const availableQtyKg = tmt.availableQtyKg || 0;
          const weightPerBundleKg = tmt.weightPerBundleKg || 1;
          const rodsPerBundle = tmt.rodsPerBundle || 0;

          // Calculate bundles from weight
          const availableBundles = weightPerBundleKg > 0 ? Math.floor(availableQtyKg / weightPerBundleKg) : 0;

          // Calculate pieces from weight (more accurate than bundle-based calculation)
          // Use weightPerRodKg directly to handle cases where weightPerBundleKg ≠ rodsPerBundle × weightPerRodKg
          const weightPerRodKg = tmt.weightPerRodKg || 1;
          const availablePieces = weightPerRodKg > 0 ? Math.floor(availableQtyKg / weightPerRodKg) : 0;

          return {
            id: `tmt-${tmt.id}`,
            name: tmt.productName,
            category: { name: "TMT Bars" },
            type: { name: `${tmt.company?.name} ${tmt.size?.sizeMm}mm` },
            unit: tmt.defaultUnit,
            price: tmt.sellingPricePerPiece || (tmt.sellingPricePerKg && tmt.weightPerRodKg ? tmt.sellingPricePerKg * tmt.weightPerRodKg : null) || 0, // Selling price per piece (preferred) or calculated from per kg
            costPrice: tmt.costPricePerPiece || (tmt.costPricePerKg && tmt.weightPerRodKg ? tmt.costPricePerKg * tmt.weightPerRodKg : null) || 0, // Cost price per piece (preferred) or calculated from per kg
            pricePerKg: tmt.sellingPricePerKg || tmt.latestSellingPricePerKg || 0, // Selling price per kg
            costPricePerKg: tmt.costPricePerKg || tmt.latestCostPricePerKg || 0, // Cost price per kg
            stockQuantity: availableQtyKg,
            availableQtyKg: availableQtyKg,
            availableBundles: availableBundles,
            availablePieces: availablePieces,
            minStockLevel: tmt.minStockKg || null,
            maxStockLevel: tmt.maxStockKg || null,
            totalAmount: tmt.totalAmount || null,
            sku: `TMT-${tmt.company?.name?.toUpperCase()}-${tmt.size?.sizeMm}`,
            updatedAt: tmt.lastSaleDate || tmt.lastPurchaseDate || new Date().toISOString(),
            damagedQuantity: 0,
            isTmtProduct: true,
            tmtData: tmt
          };
        });
      } else {
        toast.error("Failed to load TMT products");
      }

      // Combine both product types
      setProducts([...regularProducts, ...tmtProducts]);
    } catch (e) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      await loadProducts();
      toast.success("Inventory refreshed successfully");
    } catch (e) {
      toast.error("Failed to refresh inventory");
    } finally {
      setRefreshLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentShopId]);

  // Fetch stock entries for history tab
  useEffect(() => {
    if (tab === 'history') {
      setStockLoading(true);
      const fetchStockEntries = async () => {
        try {
          const token = localStorage.getItem('accessToken');
          if (!token || !currentShopId) return;
          const res = await fetch(`/api/stock?shopId=${currentShopId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setStockEntries(data.data.stockEntries || []);
          } else {
            toast.error('Failed to load stock history');
          }
        } catch (e) {
          toast.error('Failed to load stock history');
        } finally {
          setStockLoading(false);
        }
      };
      fetchStockEntries();
    }
  }, [tab, currentShopId]);

  // Low stock logic
  const lowStockProducts = products.filter(
    (prod) => prod.stockQuantity !== null && prod.minStockLevel !== null && prod.stockQuantity <= prod.minStockLevel
  );

  const filtered = products.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(search.toLowerCase()) ||
      (prod.category?.name && prod.category.name.toLowerCase().includes(search.toLowerCase())) ||
      (prod.type?.name && prod.type.name.toLowerCase().includes(search.toLowerCase()));
    if (showLowStockOnly) {
      const isLowStock = prod.stockQuantity !== null && prod.minStockLevel !== null && prod.stockQuantity <= prod.minStockLevel;
      return matchesSearch && isLowStock;
    }
    return matchesSearch;
  });

  // Summary calculations
  const totalProducts = filtered.length;
  const totalStockQty = filtered.reduce((sum, prod) => sum + (prod.stockQuantity || 0), 0);
  const totalValue = filtered.reduce((sum, prod) => sum + ((prod.price || 0) * (prod.stockQuantity || 0)), 0);

  // CSV export
  const handleExport = () => {
    const headers = [
      "name", "category", "type", "unit", "price", "costPrice", "stockQuantity", "minStockLevel", "maxStockLevel", "sku", "updatedAt"
    ];
    const rows = filtered.map(prod => ({
      name: prod.name,
      category: prod.category?.name,
      type: prod.type?.name,
      unit: prod.unit,
      price: prod.price,
      costPrice: prod.costPrice,
      stockQuantity: prod.stockQuantity,
      minStockLevel: prod.minStockLevel,
      maxStockLevel: prod.maxStockLevel,
      sku: prod.sku,
      updatedAt: prod.updatedAt ? new Date(prod.updatedAt).toLocaleString() : ""
    }));
    exportToCSV(rows, headers, "inventory.csv");
  };

  // Inline edit handler
  const handleEdit = (id: any, field: EditField, currentValue: any) => {
    setEditing({ id, field });
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : "");
  };

  const handleEditSave = async (product: any, field: EditField) => {
    if (editValue === '' || (['min', 'max', 'price', 'costPrice', 'damaged'].includes(field) && isNaN(Number(editValue)))) {
      toast.error('Please enter a valid value');
      return;
    }
    setEditLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');
      const patch: any = { productId: product.id };
      if (field === 'min') patch.minStockLevel = Number(editValue);
      if (field === 'max') patch.maxStockLevel = Number(editValue);
      if (field === 'sku') patch.sku = editValue;
      if (field === 'price') patch.price = Number(editValue);
      if (field === 'costPrice') patch.costPrice = Number(editValue);
      if (field === 'damaged') patch.damagedQuantity = Number(editValue);
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      if (res.ok) {
        toast.success('Product updated');
        setProducts((prev) => prev.map((p) =>
          p.id === product.id
            ? {
              ...p,
              minStockLevel: field === 'min' ? Number(editValue) : p.minStockLevel,
              maxStockLevel: field === 'max' ? Number(editValue) : p.maxStockLevel,
              sku: field === 'sku' ? editValue : p.sku,
              price: field === 'price' ? Number(editValue) : p.price,
              costPrice: field === 'costPrice' ? Number(editValue) : p.costPrice,
              damagedQuantity: field === 'damaged' ? Number(editValue) : p.damagedQuantity,
            }
            : p
        ));
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to update');
      }
    } catch (e) {
      toast.error('Failed to update');
    } finally {
      setEditLoading(false);
      setEditing({ id: null, field: null });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="inventory">Current Inventory</TabsTrigger>
          <TabsTrigger value="history">Stock Entry History</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          {/* Low Stock Summary Card */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <span className="text-red-700 font-bold text-lg">Low Stock Products:</span>
              <span className="text-red-700 font-bold text-xl">{lowStockProducts.length}</span>
            </div>
            <Button
              variant={showLowStockOnly ? "default" : "outline"}
              className={showLowStockOnly ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-300 text-red-700"}
              onClick={() => setShowLowStockOnly((v) => !v)}
            >
              {showLowStockOnly ? "Show All" : "Show Only Low Stock"}
            </Button>
          </div>
          <Card className="shadow-md border-0 bg-white/90">
            <CardHeader className="pb-2 border-b-0">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold tracking-tight">Stock / Inventory</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <Input
                  type="text"
                  placeholder="Search by name, category, or type..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full md:w-1/2 lg:w-1/3 border-gray-300 shadow-sm focus:ring-primary focus:border-primary"
                />
                <Button onClick={handleExport} variant="outline" className="border-primary text-primary hover:bg-primary/10">Export CSV</Button>
                <Button onClick={handleRefresh} variant="outline" className="border-primary text-primary hover:bg-primary/10" disabled={refreshLoading}>
                  {refreshLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  <div className="text-lg font-medium">
                    {showLowStockOnly ? "No low stock products found" : "No products found in inventory"}
                  </div>
                  <div className="text-sm">Try adjusting your search or add new stock.</div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">
                          Name
                          <div className="text-xs text-gray-400 font-normal">नाम</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Category
                          <div className="text-xs text-gray-400 font-normal">श्रेणी</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Type
                          <div className="text-xs text-gray-400 font-normal">प्रकार</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Unit
                          <div className="text-xs text-gray-400 font-normal">इकाई</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Price
                          <div className="text-xs text-gray-400 font-normal">विक्रय मूल्य</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Cost Price
                          <div className="text-xs text-gray-400 font-normal">खरीद मूल्य</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Stock Qty
                          <div className="text-xs text-gray-400 font-normal">मात्रा</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Min Stock
                          <div className="text-xs text-gray-400 font-normal">न्यूनतम स्टॉक</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Max Stock
                          <div className="text-xs text-gray-400 font-normal">अधिकतम स्टॉक</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          SKU
                          <div className="text-xs text-gray-400 font-normal">एसकेयू</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Last Updated
                          <div className="text-xs text-gray-400 font-normal">अंतिम अपडेट</div>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">Damaged Qty<div className="text-xs text-gray-400 font-normal">क्षतिग्रस्त</div></th>
                        <th className="px-3 py-2 text-left font-semibold">Available<div className="text-xs text-gray-400 font-normal">उपलब्ध</div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((prod) => {
                        const isLowStock = prod.stockQuantity !== null && prod.minStockLevel !== null && prod.stockQuantity <= prod.minStockLevel;
                        const isTmtProduct = prod.isTmtProduct;
                        return (
                          <tr key={prod.id} className={"transition hover:bg-primary/5 " + (isLowStock ? "bg-red-100 border-l-4 border-red-500" : "") + (isTmtProduct ? " bg-blue-50" : "")}>
                            <td className="px-3 py-2 font-medium">
                              {prod.name}
                              {isTmtProduct && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">TMT</span>}
                            </td>
                            <td className="px-3 py-2">{prod.category?.name}</td>
                            <td className="px-3 py-2">{prod.type?.name}</td>
                            <td className="px-3 py-2">{prod.unit}</td>
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <div className="text-blue-600 font-medium space-y-0.5">
                                  <div>₹{prod.price > 0 ? prod.price.toFixed(2) : 'N/A'}/piece</div>
                                  {prod.pricePerKg > 0 && (
                                    <div className="text-xs text-gray-600">₹{prod.pricePerKg.toFixed(2)}/kg</div>
                                  )}
                                </div>
                              ) : editing.id === prod.id && editing.field === 'price' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'price')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'price');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.price}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit Price"
                                    onClick={() => handleEdit(prod.id, 'price', prod.price)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <div className="text-blue-600 font-medium space-y-0.5">
                                  <div>₹{prod.costPrice > 0 ? prod.costPrice.toFixed(2) : 'N/A'}/piece</div>
                                  {prod.costPricePerKg > 0 && (
                                    <div className="text-xs text-gray-600">₹{prod.costPricePerKg.toFixed(2)}/kg</div>
                                  )}
                                </div>
                              ) : editing.id === prod.id && editing.field === 'costPrice' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'costPrice')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'costPrice');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.costPrice}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit Cost Price"
                                    onClick={() => handleEdit(prod.id, 'costPrice', prod.costPrice)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <div className="text-blue-600 font-medium space-y-0.5">
                                  <div className="font-semibold">{Math.round(prod.stockQuantity)} kg</div>
                                  {prod.availableBundles !== undefined && (
                                    <div className="text-xs text-gray-600">
                                      {prod.availableBundles} {prod.availableBundles === 1 ? 'bundle' : 'bundles'}
                                    </div>
                                  )}
                                  {prod.availablePieces !== undefined && (
                                    <div className="text-xs text-gray-600">
                                      {prod.availablePieces} {prod.availablePieces === 1 ? 'piece' : 'pieces'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                formatTmtStockDisplay(prod)
                              )}
                            </td>
                            {/* Inline editable Min Stock */}
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <span className="text-blue-600 font-medium">
                                  {prod.minStockLevel !== null && prod.minStockLevel !== undefined
                                    ? `${Math.round(prod.minStockLevel)}kg`
                                    : 'N/A'}
                                </span>
                              ) : editing.id === prod.id && editing.field === 'min' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'min')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'min');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.minStockLevel}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit Min Stock"
                                    onClick={() => handleEdit(prod.id, 'min', prod.minStockLevel)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                            {/* Inline editable Max Stock */}
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <span className="text-blue-600 font-medium">
                                  {prod.maxStockLevel !== null && prod.maxStockLevel !== undefined
                                    ? `${Math.round(prod.maxStockLevel)}kg`
                                    : 'N/A'}
                                </span>
                              ) : editing.id === prod.id && editing.field === 'max' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'max')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'max');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.maxStockLevel ?? "-"}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit Max Stock"
                                    onClick={() => handleEdit(prod.id, 'max', prod.maxStockLevel)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <span className="text-blue-600 font-medium">{prod.sku}</span>
                              ) : editing.id === prod.id && editing.field === 'sku' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="text"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'sku')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'sku');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.sku ?? "-"}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit SKU"
                                    onClick={() => handleEdit(prod.id, 'sku', prod.sku)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">{prod.updatedAt ? new Date(prod.updatedAt).toLocaleString() : "-"}</td>
                            <td className="px-3 py-2">
                              {isTmtProduct ? (
                                <span className="text-gray-500 italic">N/A</span>
                              ) : editing.id === prod.id && editing.field === 'damaged' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    autoFocus
                                    disabled={editLoading}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleEditSave(prod, 'damaged')}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEditSave(prod, 'damaged');
                                      if (e.key === 'Escape') setEditing({ id: null, field: null });
                                    }}
                                    className="h-7 text-xs px-2 py-1 border-gray-300"
                                  />
                                  {editLoading && <Loader2 className="animate-spin h-4 w-4 text-gray-400" />}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {prod.category?.name?.toLowerCase() === 'cement'
                                    ? (() => {
                                      const damagedBags = Math.floor((prod.damagedQuantity ?? 0) / 50);
                                      const looseKg = (prod.damagedQuantity ?? 0) % 50;
                                      const totalKg = damagedBags * 50 + looseKg;
                                      return damagedBags > 0 || looseKg > 0
                                        ? `${damagedBags} (${totalKg}kg)`
                                        : '0';
                                    })()
                                    : (prod.damagedQuantity ?? 0)}
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    title="Edit Damaged Qty"
                                    onClick={() => handleEdit(prod.id, 'damaged', prod.damagedQuantity ?? 0)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {/* Add Damaged Bag button for cement */}
                                  {prod.category?.name?.toLowerCase()?.trim() === 'cement' && (
                                    <>
                                      <button
                                        className="ml-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs border border-yellow-300 hover:bg-yellow-200"
                                        title="Add Damaged Bag (50kg)"
                                        disabled={editLoading || (prod.stockQuantity ?? 0) < 1}
                                        onClick={async () => {
                                          setEditLoading(true);
                                          try {
                                            const token = localStorage.getItem('accessToken');
                                            if (!token) throw new Error('No access token');
                                            const patch = {
                                              productId: prod.id,
                                              damagedQuantity: (prod.damagedQuantity ?? 0) + 50,
                                              stockQuantity: (prod.stockQuantity ?? 0) - 1
                                            };
                                            const res = await fetch('/api/products', {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                              },
                                              body: JSON.stringify(patch)
                                            });
                                            if (res.ok) {
                                              toast.success('Added 1 damaged bag (50kg)');
                                              setProducts((prev) => prev.map((p) =>
                                                p.id === prod.id
                                                  ? { ...p, damagedQuantity: (prod.damagedQuantity ?? 0) + 50, stockQuantity: (prod.stockQuantity ?? 0) - 1 }
                                                  : p
                                              ));
                                            } else {
                                              const data = await res.json();
                                              toast.error(data.message || 'Failed to update');
                                            }
                                          } catch (e) {
                                            toast.error('Failed to update');
                                          }
                                          setEditLoading(false);
                                        }}
                                      >
                                        + Damaged Bag
                                      </button>
                                      {/* Remove Damaged Bag button for cement */}
                                      <button
                                        className="ml-1 px-2 py-0.5 rounded bg-yellow-50 text-yellow-700 text-xs border border-yellow-200 hover:bg-yellow-100"
                                        title="Remove Damaged Bag (50kg)"
                                        disabled={editLoading || (prod.damagedQuantity ?? 0) < 50}
                                        onClick={async () => {
                                          setEditLoading(true);
                                          try {
                                            const token = localStorage.getItem('accessToken');
                                            if (!token) throw new Error('No access token');
                                            const patch = {
                                              productId: prod.id,
                                              damagedQuantity: (prod.damagedQuantity ?? 0) - 50,
                                              stockQuantity: (prod.stockQuantity ?? 0) + 1
                                            };
                                            const res = await fetch('/api/products', {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                              },
                                              body: JSON.stringify(patch)
                                            });
                                            if (res.ok) {
                                              toast.success('Removed 1 damaged bag (50kg)');
                                              setProducts((prev) => prev.map((p) =>
                                                p.id === prod.id
                                                  ? { ...p, damagedQuantity: (prod.damagedQuantity ?? 0) - 50, stockQuantity: (prod.stockQuantity ?? 0) + 1 }
                                                  : p
                                              ));
                                            } else {
                                              const data = await res.json();
                                              toast.error(data.message || 'Failed to update');
                                            }
                                          } catch (e) {
                                            toast.error('Failed to update');
                                          }
                                          setEditLoading(false);
                                        }}
                                      >
                                        - Damaged Bag
                                      </button>
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-bold text-green-700">
                              {isTmtProduct ? (
                                <div className="text-blue-600 font-medium space-y-0.5">
                                  <div className="font-semibold">{Math.round(prod.stockQuantity)} kg</div>
                                  {prod.availableBundles !== undefined && (
                                    <div className="text-xs text-gray-600">
                                      {prod.availableBundles} {prod.availableBundles === 1 ? 'bundle' : 'bundles'}
                                    </div>
                                  )}
                                  {prod.availablePieces !== undefined && (
                                    <div className="text-xs text-gray-600">
                                      {prod.availablePieces} {prod.availablePieces === 1 ? 'piece' : 'pieces'}
                                    </div>
                                  )}
                                </div>
                              ) : prod.category?.name?.toLowerCase()?.trim() === 'cement'
                                ? prod.stockQuantity ?? 0
                                : (prod.stockQuantity ?? 0) - (prod.damagedQuantity ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold bg-gray-50">
                        <td colSpan={6} className="px-3 py-2">Total Products: {totalProducts}</td>
                        <td className="px-3 py-2">{totalStockQty}</td>
                        <td colSpan={2} className="px-3 py-2">Total Value:</td>
                        <td colSpan={2} className="px-3 py-2">₹{totalValue.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="shadow-md border-0 bg-white/90">
            <CardHeader className="pb-2 border-b-0">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold tracking-tight">Stock Entry History</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
                </div>
              ) : stockEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  <div className="text-lg font-medium">No stock entries found</div>
                  <div className="text-sm">No stock history available for this shop.</div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Product</th>
                        <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                        <th className="px-3 py-2 text-left font-semibold">Quantity</th>
                        <th className="px-3 py-2 text-left font-semibold">Unit Price</th>
                        <th className="px-3 py-2 text-left font-semibold">Total</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockEntries.map((entry) => (
                        <tr key={entry.id} className="transition hover:bg-primary/5">
                          <td className="px-3 py-2 font-medium">{entry.product?.name ?? '-'}</td>
                          <td className="px-3 py-2">{entry.supplier?.name ?? '-'}</td>
                          <td className="px-3 py-2">{entry.quantity}</td>
                          <td className="px-3 py-2">{entry.unitPrice}</td>
                          <td className="px-3 py-2">{entry.totalAmount}</td>
                          <td className="px-3 py-2">{entry.entryDate ? new Date(entry.entryDate).toLocaleString() : '-'}</td>
                          <td className="px-3 py-2">{entry.notes ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 