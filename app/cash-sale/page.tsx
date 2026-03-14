"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/hooks/use-language"
import { MobileNav } from "@/components/mobile-nav"
import { Plus, Minus, Phone, MapPin, User } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { salesService, type CreateSaleData } from "../lib/services/salesService"
import { useShop } from "../contexts/ShopContext"

type CashSaleItem = {
  productId: string;
  name: string;
  stockType: string;
  unit: string;
  quantity: number;
  price: number;
  isTmt?: boolean;
  tmtDetails?: {
    unitType: string;
    weightPerPiece?: number;
    rodsPerBundle?: number;
    weightPerBundle?: number;
    totalPieces?: number;
  }
};

export default function CashSale() {
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShopId } = useShop()
  const [items, setItems] = useState<CashSaleItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [tmtProducts, setTmtProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  // Product Type State
  const [productType, setProductType] = useState<'regular' | 'tmt'>('regular')

  const [currentItem, setCurrentItem] = useState({
    productId: '',
    name: '',
    stockType: 'normal',
    unit: '',
    quantity: '',
    price: ''
  })

  const [customerInfo, setCustomerInfo] = useState({
    phone: "",
    address: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // TMT Specific State
  const [tmtBundles, setTmtBundles] = useState('');
  const [tmtPieces, setTmtPieces] = useState('');
  const [tmtTotalPieces, setTmtTotalPieces] = useState(0);

  // Helper: Convert to KG for validation (Local implementation to avoid server-side imports)
  const convertToKg = (quantity: number, unitType: string, product: any) => {
    if (!unitType) return quantity;
    const weightPerRod = Number(product.weightPerRodKg || 0);
    const rodsPerBundle = Number(product.rodsPerBundle || 0);

    switch (unitType.toLowerCase()) {
      case 'piece': return quantity * weightPerRod;
      case 'bundle': return quantity * rodsPerBundle * weightPerRod;
      case 'ton': return quantity * 1000;
      case 'kg': return quantity;
      default: return quantity;
    }
  }

  // 2. Fetch products from inventory (Regular & TMT)
  const fetchProducts = async () => {
    setProductsLoading(true)
    const token = localStorage.getItem("accessToken")
    if (!token || !currentShopId) return

    try {
      // Fetch Regular Products
      const res = await fetch(`/api/products?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProducts((data.data.products || []).filter((p: any) => (p.stockQuantity - (p.damagedQuantity ?? 0)) > 0 || (p.damagedQuantity ?? 0) > 0))
      }

      // Fetch TMT Products
      const tmtRes = await fetch(`/api/tmt/products?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (tmtRes.ok) {
        const tmtData = await tmtRes.json()
        if (tmtData.success) {
          setTmtProducts(tmtData.data.products || [])
        }
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to load products")
    }
    setProductsLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [currentShopId])

  // Reset form when toggling product type
  useEffect(() => {
    setCurrentItem({ productId: '', name: '', stockType: 'normal', unit: '', quantity: '', price: '' })
    setTmtBundles('')
    setTmtPieces('')
    setTmtTotalPieces(0)
  }, [productType])


  // Auto-calculate total pieces for TMT Bars
  useEffect(() => {
    if (productType === 'tmt' && currentItem.productId) {
      const product = tmtProducts.find(p => String(p.id) === String(currentItem.productId));
      if (product && currentItem.unit === 'bundle') {
        // Placeholder for future logic if needed
      }
    }
  }, [tmtBundles, tmtPieces, productType]);

  // Handle TMT Unit Change to set Price
  const handleTmtUnitChange = (unit: string) => {
    const product = tmtProducts.find(p => String(p.id) === String(currentItem.productId));
    if (!product) return;

    let price = 0;
    // Determine price based on unit
    if (unit === 'piece') {
      price = product.sellingPricePerPiece || (product.sellingPricePerKg * product.weightPerRodKg) || 0;
    } else if (unit === 'bundle') {
      price = (product.sellingPricePerPiece * product.rodsPerBundle) || (product.sellingPricePerKg * product.weightPerBundleKg) || 0;
    } else if (unit === 'kg') {
      price = product.sellingPricePerKg || 0;
    } else if (unit === 'ton') {
      price = (product.sellingPricePerKg * 1000) || 0;
    }

    setCurrentItem(prev => ({ ...prev, unit, price: price > 0 ? price.toFixed(2) : '' }));
  }


  // In the Add Product form logic, auto-set unit for cement
  useEffect(() => {
    if (productType === 'regular') {
      const product = products.find((p: any) => String(p.id) === String(currentItem.productId));
      if (product && product.category && product.category.name && product.category.name.toLowerCase() === 'cement') {
        if (currentItem.stockType === 'damaged') {
          if (currentItem.unit !== 'kg') setCurrentItem(ci => ({ ...ci, unit: 'kg' }));
        } else if (currentItem.stockType === 'normal') {
          if (currentItem.unit !== 'bag') setCurrentItem(ci => ({ ...ci, unit: 'bag' }));
        }
      }
    }
  }, [currentItem.productId, currentItem.stockType, productType]);

  const handleAddItem = () => {
    // Validate
    if (!currentItem.productId || !currentItem.name || !currentItem.price || !currentItem.unit) {
      toast.error(t("Please select a product and unit", "कृपया उत्पाद और इकाई चुनें"));
      return;
    }

    const requestedQuantity = parseFloat(currentItem.quantity);
    if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      toast.error(t("Please enter a valid quantity", "कृपया एक वैध मात्रा दर्ज करें"));
      return;
    }

    if (productType === 'regular') {
      // ... Existing Regular Product Validation ...
      const product = products.find((p: any) => String(p.id) === String(currentItem.productId));
      if (!product) { toast.error("Product not found"); return; }

      const isCement = product.category?.name?.toLowerCase() === 'cement';
      let availableStock = 0;

      if (currentItem.stockType === 'normal') {
        availableStock = product.stockQuantity ?? 0;
        if (isCement && currentItem.unit === 'kg') availableStock = (product.stockQuantity ?? 0) * 50;
      } else if (currentItem.stockType === 'damaged') {
        availableStock = (product.damagedQuantity ?? 0);
      }

      const alreadyAdded = items
        .filter(i => !i.isTmt && i.productId === currentItem.productId && i.stockType === currentItem.stockType && i.unit === currentItem.unit)
        .reduce((sum, i) => sum + i.quantity, 0)

      if (availableStock - alreadyAdded < requestedQuantity) {
        toast.error(`Insufficient stock! Available: ${availableStock - alreadyAdded} ${currentItem.unit}`);
        return;
      }

      setItems([...items, {
        productId: currentItem.productId,
        name: currentItem.name,
        stockType: currentItem.stockType,
        unit: currentItem.unit,
        quantity: requestedQuantity,
        price: parseFloat(currentItem.price),
        isTmt: false
      }])

    } else {
      // ... TMT Validation ...
      const product = tmtProducts.find((p: any) => String(p.id) === String(currentItem.productId));
      if (!product) { toast.error("TMT Product not found"); return; }

      // Calculate available stock in requested unit if possible, or just Kg
      // Inventory is in Kg
      const availableKg = product.availableQtyKg || 0;
      const requestedKg = convertToKg(requestedQuantity, currentItem.unit, product);

      // Count already added
      const alreadyAddedKg = items
        .filter(i => i.isTmt && i.productId === currentItem.productId)
        .reduce((sum, i) => sum + convertToKg(i.quantity, i.unit, tmtProducts.find(p => p.id == i.productId)), 0);

      if (availableKg - alreadyAddedKg < requestedKg) {
        toast.error(`Insufficient TMT stock! Available: ${(availableKg - alreadyAddedKg).toFixed(2)} Kg`);
        return;
      }

      setItems([...items, {
        productId: currentItem.productId,
        name: currentItem.name,
        stockType: 'normal',
        unit: currentItem.unit,
        quantity: requestedQuantity,
        price: parseFloat(currentItem.price),
        isTmt: true,
        tmtDetails: {
          unitType: currentItem.unit,
          weightPerPiece: product.weightPerRodKg,
          rodsPerBundle: product.rodsPerBundle
        }
      }])
    }

    // Reset
    setCurrentItem({ productId: '', name: '', stockType: 'normal', unit: '', quantity: '', price: '' })
    setTmtBundles('')
    setTmtPieces('')
  }


  // Generic update quantity
  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...items]
    const item = newItems[index]

    // TMT Logic
    if (item.isTmt) {
      const product = tmtProducts.find((p: any) => String(p.id) === String(item.productId));
      if (!product) return;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        newItems.splice(index, 1);
        setItems(newItems);
        return;
      }

      // Check Stock
      const availableKg = product.availableQtyKg || 0;
      const requestedKg = convertToKg(newQuantity, item.unit, product);
      const otherItemsKg = items
        .filter((i, idx) => idx !== index && i.isTmt && i.productId === item.productId)
        .reduce((sum, i) => sum + convertToKg(i.quantity, i.unit, tmtProducts.find(p => p.id == i.productId)), 0);

      if (availableKg - otherItemsKg < requestedKg) {
        toast.error("Cannot increase quantity: Insufficient Stock");
        return;
      }

      newItems[index].quantity = newQuantity;
      setItems(newItems);
      return;
    }

    // Regular Logic
    const product = products.find((p: any) => String(p.id) === String(item.productId))
    if (!product) return

    const isCement = product.category?.name?.toLowerCase() === 'cement'
    let availableStock = 0
    if (item.stockType === 'normal') {
      availableStock = product.stockQuantity ?? 0
      if (isCement && item.unit === 'kg') availableStock = (product.stockQuantity ?? 0) * 50
    } else {
      availableStock = (product.damagedQuantity ?? 0)
    }

    const alreadyAdded = newItems
      .filter((i, idx) => idx !== index && i.productId === item.productId && i.stockType === item.stockType && i.unit === item.unit && !i.isTmt)
      .reduce((sum, i) => sum + i.quantity, 0)

    const newQuantity = item.quantity + delta
    if (newQuantity > availableStock - alreadyAdded) {
      toast.error(`Insufficient stock`);
      return
    }

    newItems[index].quantity = newQuantity
    if (newItems[index].quantity <= 0) newItems.splice(index, 1)
    setItems(newItems)
  }

  const handleFinalizeSale = async () => {
    if (!currentShopId) { toast.error(t("Please select a shop first", "कृपया पहले एक दुकान चुनें")); return; }
    if (!customerInfo.phone.trim()) { toast.error(t("Please enter customer phone number", "कृपया ग्राहक का फोन नंबर दर्ज करें")); return; }
    if (items.length === 0) { toast.error(t("Please add at least one item", "कृपया कम से कम एक आइटम जोड़ें")); return; }

    setIsSubmitting(true)
    const now = new Date();
    const token = localStorage.getItem("accessToken");

    // Split items
    const regularItems = items.filter(i => !i.isTmt);
    const tmtItems = items.filter(i => i.isTmt);

    let successCount = 0;
    let errorCount = 0;

    try {
      // 1. Process Regular Items
      if (regularItems.length > 0) {
        const saleData: CreateSaleData = {
          shopId: currentShopId,
          customerInfo: {
            name: `Walk-in Customer (${customerInfo.phone})`,
            phone: customerInfo.phone,
            address: customerInfo.address || "Walk-in customer"
          },
          saleDate: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString(),
          totalAmount: regularItems.reduce((acc, i) => acc + (i.price * i.quantity), 0),
          finalAmount: regularItems.reduce((acc, i) => acc + (i.price * i.quantity), 0),
          discount: 0,
          taxAmount: 0,
          notes: "",
          items: regularItems.map(item => ({
            productId: Number(item.productId),
            name: item.name,
            stockType: item.stockType,
            unit: item.unit,
            quantity: Number(item.quantity),
            price_per_unit: Number(item.price)
          })),
          payment_type: "cash",
          paid_amount: regularItems.reduce((acc, i) => acc + (i.price * i.quantity), 0)
        }
        await salesService.createSale(saleData);
        successCount++;
      }

      // 2. Process TMT Items
      if (tmtItems.length > 0) {
        const tmtTotal = tmtItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);

        // Prepare Payload with multiple items
        const tmtPayload = {
          shopId: currentShopId.toString(),
          saleDate: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString(),
          customerName: `Walk-in Customer (${customerInfo.phone})`,
          customerPhone: customerInfo.phone,
          customerAddress: customerInfo.address || "Walk-in customer",
          notes: "Cash Sale",
          paymentMethod: "CASH",
          paidAmount: tmtTotal,
          items: tmtItems.map(item => ({
            productId: Number(item.productId),
            soldQuantity: Number(item.quantity),
            unitType: item.unit.toUpperCase(),
            pricePerUnit: Number(item.price)
          }))
        };

        const res = await fetch('/api/tmt/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(tmtPayload)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create TMT sale");
        }
        successCount++;
      }

      toast.success(t("Sale finalized successfully!", "बिक्री सफलतापूर्वक पूरी हुई!"));
      // Reset
      setItems([]);
      setCustomerInfo({ phone: "", address: "" });
      setCurrentItem({ productId: '', name: '', stockType: 'normal', unit: '', quantity: '', price: '' });
      setTmtBundles('');
      setTmtPieces('');
      // Refresh
      fetchProducts();

    } catch (error) {
      console.error('Error finalizing sale:', error);
      toast.error("Failed to finalize sale. Check console for details.");
    } finally {
      setIsSubmitting(false)
    }
  }

  const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <MobileNav />
      <div className="p-4 pb-20 md:pb-4">
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 h-full max-w-6xl mx-auto">
          <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-white rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <User className="h-5 w-5" />
                  {t("Customer Information", "ग्राहक की जानकारी")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                <div>
                  <Label htmlFor="phone">{t("Phone Number", "फोन नंबर")} *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={customerInfo.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 10) setCustomerInfo({ ...customerInfo, phone: value });
                    }}
                    maxLength={10}
                    className="mt-1 h-12 text-base rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="address">{t("Address", "पता")}</Label>
                  <Textarea
                    id="address"
                    placeholder={t("Enter address (optional)", "पता दर्ज करें (वैकल्पिक)")}
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    className="mt-1 min-h-[80px] rounded-xl"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Plus className="h-5 w-5" />
                  {t("Add Product", "उत्पाद जोड़ें")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                {/* Product Type Toggle */}
                <div className="flex items-center justify-between bg-gray-100 p-2 rounded-lg">
                  <span className={`text-sm font-medium ${productType === 'regular' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {t("Regular Product", "सामान्य उत्पाद")}
                  </span>
                  <Switch
                    checked={productType === 'tmt'}
                    onCheckedChange={(checked) => setProductType(checked ? 'tmt' : 'regular')}
                  />
                  <span className={`text-sm font-medium ${productType === 'tmt' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {t("TMT Bar", "TMT बार")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="product-select">{t("Product", "उत्पाद")}</Label>
                    <select
                      id="product-select"
                      value={currentItem.productId}
                      onChange={e => {
                        const pid = e.target.value;
                        if (productType === 'regular') {
                          const product = products.find((p: any) => String(p.id) === String(pid))
                          let unit = currentItem.unit;
                          if (product && product.category?.name?.toLowerCase() === 'cement') {
                            unit = currentItem.stockType === 'damaged' ? 'kg' : 'bag';
                          } else if (product) {
                            unit = '';
                          }
                          setCurrentItem({ ...currentItem, productId: pid, name: product?.name || '', unit, price: product?.price || '' })
                        } else {
                          const product = tmtProducts.find((p: any) => String(p.id) === String(pid));
                          setCurrentItem({ ...currentItem, productId: pid, name: product?.productName || '', unit: 'bundle', price: '' })
                          // Trigger unit change to set default price
                          // We can't immediately trigger handleTmtUnitChange because state needs time. 
                          // But we can manually set it here.
                          if (product) {
                            // Default to bundle price
                            const price = (product.sellingPricePerPiece * product.rodsPerBundle) || (product.sellingPricePerKg * product.weightPerBundleKg) || 0;
                            setCurrentItem(prev => ({ ...prev, productId: pid, name: product.productName, unit: 'bundle', price: price > 0 ? price.toFixed(2) : '' }));
                          }
                        }
                      }}
                      className="mt-1 h-12 text-base rounded-xl w-full border-gray-300"
                    >
                      <option value="">{t("Select product", "उत्पाद चुनें")}</option>
                      {productType === 'regular' ? (
                        products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {currentItem.stockType === 'damaged' ? (p.damagedQuantity ?? 0) : (p.stockQuantity ?? 0)})
                          </option>
                        ))
                      ) : (
                        tmtProducts.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.productName} - {p.company?.name} {p.size?.sizeMm}mm
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {productType === 'regular' && (
                    <div>
                      <Label htmlFor="stock-type">{t("Stock Type", "स्टॉक प्रकार")}</Label>
                      <select
                        id="stock-type"
                        value={currentItem.stockType}
                        onChange={e => {
                          const product = products.find((p: any) => String(p.id) === String(currentItem.productId));
                          let unit = currentItem.unit;
                          if (product && product.category?.name?.toLowerCase() === 'cement') {
                            unit = e.target.value === 'damaged' ? 'kg' : 'bag';
                          }
                          setCurrentItem({ ...currentItem, stockType: e.target.value, unit })
                        }}
                        className="mt-1 h-12 text-base rounded-xl w-full border-gray-300"
                        disabled={!currentItem.productId}
                      >
                        <option value="normal">{t("Normal", "सामान्य")}</option>
                        {products.find(p => String(p.id) === String(currentItem.productId))?.damagedQuantity > 0 && (
                          <option value="damaged">{t("Damaged", "क्षतिग्रस्त")}</option>
                        )}
                      </select>
                    </div>
                  )}

                  {productType === 'tmt' && (
                    <div>
                      <Label htmlFor="tmt-unit">{t("Unit", "इकाई")}</Label>
                      <select
                        id="tmt-unit"
                        value={currentItem.unit}
                        onChange={(e) => handleTmtUnitChange(e.target.value)}
                        className="mt-1 h-12 text-base rounded-xl w-full border-gray-300"
                        disabled={!currentItem.productId}
                      >
                        <option value="bundle">Bundle</option>
                        <option value="piece">Piece</option>
                        <option value="kg">Kg</option>
                        <option value="ton">Ton</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {productType === 'regular' && (
                    <div>
                      <Label htmlFor="unit">{t("Unit", "इकाई")}</Label>
                      {(() => {
                        const product = products.find((p: any) => String(p.id) === String(currentItem.productId));
                        if (product?.category?.name?.toLowerCase() === 'cement') {
                          return (
                            <Input
                              id="unit"
                              value={currentItem.unit}
                              readOnly
                              className="mt-1 h-12 text-base rounded-xl bg-gray-100 cursor-not-allowed"
                              disabled
                            />
                          );
                        } else {
                          const unitOptions = [
                            { value: 'bag', label: t('Bag', 'बैग') },
                            { value: 'kg', label: t('Kg', 'किलो') },
                            { value: 'piece', label: t('Piece', 'पीस') },
                            { value: 'tina', label: t('Tina', 'टिना') },
                          ];
                          return (
                            <select
                              id="unit"
                              value={currentItem.unit}
                              onChange={e => setCurrentItem({ ...currentItem, unit: e.target.value })}
                              className="mt-1 h-12 text-base rounded-xl w-full border-gray-300"
                              disabled={!currentItem.productId}
                            >
                              <option value="">{t('Select unit', 'इकाई चुनें')}</option>
                              {unitOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          );
                        }
                      })()}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="quantity">{t("Quantity", "मात्रा")}</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={currentItem.quantity}
                      onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      placeholder={productType === 'tmt' ? `Enter ${currentItem.unit || 'quantity'}` : "Quantity"}
                      className="mt-1 h-12 text-base rounded-xl"
                      disabled={!currentItem.productId}
                    />
                    {productType === 'tmt' && currentItem.unit && (
                      <span className="text-xs text-gray-500">Entering {currentItem.unit}s</span>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="product-price">{t("Price", "कीमत")}</Label>
                    <Input
                      id="product-price"
                      type="number"
                      placeholder={t("Enter price", "कीमत दर्ज करें")}
                      value={currentItem.price}
                      onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })}
                      className="mt-1 h-12 text-base rounded-xl"
                      min="0"
                      step="0.01"
                      disabled={!currentItem.productId}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAddItem}
                  className="w-full h-12 text-base rounded-xl bg-blue-600 hover:bg-blue-700"
                  disabled={!currentItem.productId || !currentItem.unit || !currentItem.quantity || !currentItem.price}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add to Bill", "बिल में जोड़ें")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Bill Card */}
          <Card className="shadow-lg border-0 bg-white rounded-2xl h-fit">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                🧾 {t("Bill", "बिल")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 md:p-6 space-y-3 max-h-[400px] overflow-y-auto">
                {items.map((item, index) => (
                  <Card key={index} className={`border border-gray-200 ${item.isTmt ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                          <h4 className="font-medium text-base md:text-lg">{item.name}</h4>
                          {item.isTmt && <span className="text-xs text-blue-600 font-semibold">[TMT]</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{item.quantity} {item.unit}</span>
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(index, -1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(index, 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{t("Price", "कीमत")}: ₹{item.price}</span>
                        <span>{t("Total", "कुल")}: ₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-8 md:py-12 text-muted-foreground">
                    <div className="text-4xl md:text-6xl mb-4">🛒</div>
                    <p className="text-base md:text-lg">{t("No items in bill", "बिल में कोई आइटम नहीं है")}</p>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t bg-gray-50 rounded-b-2xl">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl md:text-2xl font-bold">{t("Total", "कुल")}:</span>
                    <span className="text-2xl md:text-3xl font-bold text-green-600">₹{total.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full h-12 md:h-16 text-base md:text-xl rounded-xl bg-blue-600 hover:bg-blue-700"
                    disabled={items.length === 0 || !customerInfo.phone.trim() || isSubmitting}
                    onClick={handleFinalizeSale}
                  >
                    {isSubmitting ? t("Finalizing...", "अंतिम रूप दिया जा रहा है...") : t("Finalize Sale", "बिक्री को अंतिम रूप दें")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
