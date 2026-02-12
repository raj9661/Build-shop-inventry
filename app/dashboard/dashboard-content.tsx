"use client"

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingBag, AlertTriangle, CheckCircle2, XCircle, RotateCcw, IndianRupee, BarChart3, Eye, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "../contexts/ShopContext";
import { TodaySalesHistory } from "../components/today-sales-history";
import { useLanguage } from "@/hooks/use-language";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SalesTabs } from "./SalesTabs";

function safeCurrency(val: any) {
  const num = Number(val);
  return !isNaN(num) ? num.toLocaleString() : "0";
}

export function DashboardContent() {
  const { t } = useLanguage();
  const { userRole, currentShopId, shops } = useShop();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Debug shop context
  console.log('🔍 [DashboardContent] Shop context:', { userRole, currentShopId, shopsCount: shops.length, shops: shops.map(s => ({ id: s.id, name: s.name })) });
  
  // Debug dashboard data
  useEffect(() => {
    console.log('🔍 [DashboardContent] Dashboard data updated:', dashboardData);
  }, [dashboardData]);
  const [activeTab, setActiveTab] = useState("active");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    type: "OTHER",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [rateEdits, setRateEdits] = useState<{ [productId: string]: string }>({});
  const [savingRates, setSavingRates] = useState<{ [productId: string]: boolean }>({});

  // Extract dashboard fetch logic
  const fetchDashboardData = async (forceRefresh = false) => {
    console.log('🔍 [DashboardContent] fetchDashboardData called with:', { forceRefresh, currentShopId, userRole });
    setLoading(true);
    let prefetched = null;
    try {
      if (!forceRefresh) {
        const raw = sessionStorage.getItem("prefetchedDashboardData");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.data) {
            prefetched = parsed.data;
            setDashboardData(parsed.data);
            setLoading(false);
          }
        }
      }
    } catch {}

    if (!prefetched) {
      let url = currentShopId ? `/api/dashboard/ultra-fast?shopId=${currentShopId}` : "/api/dashboard/ultra-fast";
      if (forceRefresh) {
        url += currentShopId ? '&clearCache=true' : '?clearCache=true';
      }
      console.log('🔍 [DashboardContent] Fetching from URL:', url);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ [DashboardContent] No access token found');
        toast.error('Authentication required');
        return;
      }
      
      fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) {
            if (res.status === 403) {
              throw new Error('You do not have access to this shop. Please select a different shop.');
            } else if (res.status === 401) {
              throw new Error('Authentication required. Please log in again.');
            } else {
              throw new Error(`Server error: ${res.status}`);
            }
          }
          return res.json();
        })
        .then(data => {
          console.log('🔍 [DashboardContent] API Response:', data);
          if (data.success) {
            console.log('✅ [DashboardContent] Setting dashboard data:', data.data);
            setDashboardData(data.data);
          } else {
            console.log('❌ [DashboardContent] API returned error:', data.message);
            toast.error(data.message || "Failed to load dashboard data");
          }
        })
        .catch((error) => {
          console.error('Dashboard fetch error:', error);
          
          // If it's an access error, try to switch to a shop the user has access to
          if (error.message.includes('do not have access to this shop')) {
            console.log('🔄 [Dashboard] Access denied, trying to switch to available shop...');
            // This will trigger the shop context to select a different shop
            window.dispatchEvent(new CustomEvent('shopAccessDenied'));
            toast.error('Access denied to current shop. Switching to available shop...');
          } else if (error.message.includes('Authentication required')) {
            toast.error('Please log in again to continue');
            // Redirect to login
            window.location.href = '/login';
          } else {
            toast.error(error.message || "Failed to load dashboard data");
          }
        })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId]);

  // Auto-refresh dashboard (and today's revenue) every 15 minutes
  useEffect(() => {
    if (!currentShopId) return;
    const id = setInterval(() => {
      fetchDashboardData(true); // force refresh with fresh API call
    }, 15 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-blue-700 font-medium">Loading dashboard...</span>
      </div>
    );
  }

  // Check if user has no shops available
  if (!loading && shops && shops.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No shops available</p>
          <p className="text-sm">You don't have access to any shops. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center text-red-600 font-semibold py-12">
        Failed to load dashboard data.
      </div>
    );
  }

  const {
    totalSales,
    totalProducts,
    totalCustomers,
    totalEmployees,
    totalRevenue,
    sales = [],
    lowStockProducts,
    expenses,
    productsInStock
  } = dashboardData;

  // Debug: Log the dashboard data structure
  console.log('Dashboard data received:', {
    totalSales,
    totalProducts,
    totalCustomers,
    totalEmployees,
    totalRevenue,
    salesCount: sales?.length || 0,
    lowStockProductsCount: lowStockProducts?.length || 0,
    expensesCount: expenses?.length || 0,
    productsInStockCount: productsInStock?.length || 0,
    productsInStock: productsInStock
  });

  // Additional debugging for productsInStock
  if (productsInStock && productsInStock.length > 0) {
    console.log('Products in stock found:', productsInStock);
  } else {
    console.log('No products in stock found. productsInStock:', productsInStock);
    console.log('Dashboard data keys:', Object.keys(dashboardData));
    console.log('Full dashboard data:', dashboardData);
  }

  // Add Expense handler
  const handleSaveExpense = async () => {
    if (!newExpense.amount) {
      toast.error(t("Please enter amount", "कृपया राशि दर्ज करें"));
      return;
    }
    setSavingExpense(true);
    try {
      // Call your API to save expense (replace with your endpoint)
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newExpense,
          shopId: currentShopId
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("Expense saved successfully!", "खर्च सफलतापूर्वक सेव किया गया!"));
        setExpenseModalOpen(false);
        setNewExpense({ type: "OTHER", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
        // Refresh dashboard data
        fetchDashboardData(true);
      } else {
        toast.error(data.message || t("Failed to save expense", "खर्च सेव करने में विफल"));
      }
    } catch (error) {
      toast.error(t("Failed to save expense", "खर्च सेव करने में विफल"));
    } finally {
      setSavingExpense(false);
    }
  };

  // Set Daily Rate handler
  const handleSaveRate = async (productId: string, newRate: string) => {
    if (!newRate) return;
    setSavingRates((prev) => ({ ...prev, [productId]: true }));
    try {
      // Call your API to update product rate (replace with your endpoint)
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      
      const res = await fetch(`/api/products/${productId}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ rate: newRate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("Rate updated!", "दर अपडेट की गई!"));
        console.log('✅ Rate updated successfully for product:', productId, 'new rate:', newRate);
        
        // Update the local state immediately to show the new rate
        setDashboardData((prevData: any) => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            productsInStock: prevData.productsInStock.map((product: any) => 
              product.id === productId 
                ? { ...product, dailyRate: parseFloat(newRate) }
                : product
            )
          };
        });
        
        setRateEdits(prev => {
          const updated: { [productId: string]: string } = { ...prev };
          delete updated[productId];
          return updated;
        });
        
        // Clear dashboard cache for this shop
        if (currentShopId) {
          const token = localStorage.getItem('accessToken');
          if (token) {
            await fetch('/api/dashboard/ultra-fast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ action: 'clearCache', shopId: currentShopId }),
            });
          }
        }
        // Refetch dashboard data and await it
        await fetchDashboardData(true);
      } else {
        toast.error(data.message || t("Failed to update rate", "दर अपडेट करने में विफल"));
      }
    } catch (error) {
      toast.error(t("Failed to update rate", "दर अपडेट करने में विफल"));
    } finally {
      setSavingRates((prev) => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">{t("Today's Completed Sales", "आज की पूर्ण बिक्री")}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold">{safeCurrency(totalSales)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">{t("Total Products", "कुल उत्पाद")}</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold">{safeCurrency(totalProducts)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">{t("Total Customers", "कुल ग्राहक")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold">{safeCurrency(totalCustomers)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium">{t("Today's Revenue", "आज का राजस्व")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold">₹{safeCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Products */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
          <CardTitle className="text-sm font-medium">{t("Low Stock Products", "कम स्टॉक उत्पाद")}</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {lowStockProducts && lowStockProducts.length > 0 ? (
            <div className="space-y-2">
              {lowStockProducts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                    {p.stockQuantity} {p.unit}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">All products in stock.</div>
          )}
        </CardContent>
      </Card>

      {/* Sales Section - now a separate component with its own fetch logic */}
      <SalesTabs shopId={currentShopId} />

      {/* Expenses */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
          <CardTitle className="text-sm font-medium">{t("Expenses", "खर्च")}</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-base md:text-lg">{t("Today's Expenses", "आज के खर्च")}</span>
            <Button onClick={() => setExpenseModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
              {t("Add Expense", "खर्च जोड़ें")}
            </Button>
          </div>
          {expenses && expenses.length > 0 ? (
            <div className="space-y-2">
              {expenses.map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between">
                  <span>{exp.description || exp.type}</span>
                  <span className="font-medium">₹{safeCurrency(exp.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No expenses recorded.</div>
          )}
        </CardContent>
      </Card>
      {/* Add Expense Dialog */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Add New Expense", "नया खर्च जोड़ें")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newExpense.type}
              onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value })}
            >
              <option value="OTHER">{t("Other", "अन्य")}</option>
              <option value="TRANSPORTATION">{t("Transportation", "परिवहन")}</option>
              <option value="diesel">{t("Diesel", "डीजल")}</option>
              <option value="petrol">{t("Petrol", "पेट्रोल")}</option>
              <option value="RENT">{t("Rent", "किराया")}</option>
              <option value="ELECTRICITY">{t("Electricity", "बिजली")}</option>
              <option value="WATER">{t("Water", "पानी")}</option>
              <option value="INTERNET">{t("Internet", "इंटरनेट")}</option>
              <option value="SALARY">{t("Salary", "वेतन")}</option>
              <option value="MAINTENANCE">{t("Maintenance", "रखरखाव")}</option>
              <option value="MARKETING">{t("Marketing", "विपणन")}</option>
            </select>
            <Textarea
              placeholder={t("Description", "विवरण")}
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder={t("Amount", "राशि")}
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
            />
            <Input
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
            />
            <Button onClick={handleSaveExpense} className="w-full" disabled={savingExpense}>
              {savingExpense ? t("Saving...", "सेव हो रहा है...") : t("Save Expense", "खर्च सेव करें")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Daily Rate Section */}
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
          <CardTitle className="text-sm font-medium">{t("Set Daily Rate", "दैनिक दर सेट करें")}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {(() => { console.log("productsInStock for Set Daily Rate:", productsInStock); return null; })()}
          {productsInStock && productsInStock.length > 0 ? (
            <div className="space-y-2">
              {productsInStock.map((product: any) => {
                console.log('🔍 Rendering product for daily rate:', {
                  id: product.id,
                  name: product.name,
                  unit: product.unit,
                  dailyRate: product.dailyRate,
                  rateEdit: rateEdits[product.id]
                });
                return (
                <div key={product.id} className="flex items-center gap-2 justify-between border-b py-1">
                  <span>{product.name} ({product.unit})</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      value={
                        rateEdits[product.id] !== undefined
                          ? String(rateEdits[product.id])
                          : (product.dailyRate !== null && product.dailyRate !== undefined ? String(product.dailyRate) : "")
                      }
                      onChange={e => {
                        console.log('🔍 Rate input changed for product:', product.id, 'value:', e.target.value);
                        setRateEdits({ ...rateEdits, [product.id]: e.target.value });
                      }}
                      placeholder={t("Rate", "दर")}
                      disabled={savingRates[product.id]}
                    />
                    {/* Show green text for today's rate if set (not null/undefined/empty string) */}
                    {product.dailyRate !== null && product.dailyRate !== undefined && String(product.dailyRate).trim() !== "" && (
                      <span className="text-green-600 text-xs ml-2">
                        {t("Today's rate:", "आज की दर:")} {String(product.dailyRate)}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveRate(product.id, rateEdits[product.id] || product.dailyRate)}
                    disabled={savingRates[product.id]}
                  >
                    {savingRates[product.id] ? t("Saving...", "सेव हो रहा है...") : t("Save", "सेव करें")}
                  </Button>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground">No products in stock.</div>
          )}
        </CardContent>
      </Card>

    </div>
  );
} 