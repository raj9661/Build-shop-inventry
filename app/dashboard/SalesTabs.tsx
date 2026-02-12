import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { TodaySalesHistory } from "../components/today-sales-history";
import { useLanguage } from "@/hooks/use-language";
import dayjs from "dayjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function safeCurrency(val: any) {
  const num = Number(val);
  return !isNaN(num) ? num.toLocaleString() : "0";
}

export function SalesTabs({ shopId }: { shopId: number }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("active");
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaleId, setCancelSaleId] = useState<number | null>(null);
  const [cancelIsTmt, setCancelIsTmt] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Helper: is within today's window
  const isToday = (d: any) => {
    if (!d) return false;
    const dt = new Date(d);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return dt >= start && dt <= end;
  };

  // Show only sales that are not cancelled and not completed as active (unchanged)
  const activeSales = sales?.filter((s: any) => !s.isCancelled && !s.isCompleted) || [];
  // Completed/Cancelled should disappear after midnight => show only today's
  const completedSales = sales?.filter((s: any) => s.isCompleted && isToday(s.updatedAt || s.createdAt || s.saleDate)) || [];
  const cancelledSales = sales?.filter((s: any) => s.isCancelled && isToday(s.updatedAt || s.createdAt || s.saleDate)) || [];
  // Pagination state for active sales
  const [activeSalesPage, setActiveSalesPage] = useState(1);
  const SALES_PER_PAGE = 10;
  const paginatedActiveSales = activeSales.slice(0, activeSalesPage * SALES_PER_PAGE);

  const fetchSales = async () => {
    setLoading(true);
    try {
      // Add timestamp to bust cache
      const timestamp = Date.now();
      const url = shopId ? `/api/dashboard/ultra-fast?shopId=${shopId}&t=${timestamp}` : `/api/dashboard/ultra-fast?t=${timestamp}`;
      console.log('🔍 [SalesTabs] Fetching sales from:', url, 'shopId:', shopId);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('🔍 [SalesTabs] API response:', { success: data.success, salesCount: data.data?.sales?.length || 0 });
      if (data.success && data.data && Array.isArray(data.data.sales)) {
        setSales(data.data.sales);
        console.log('🔍 [SalesTabs] Sales set:', data.data.sales.length, 'sales');
        // Log active sales count for debugging
        const activeCount = data.data.sales.filter((s: any) => !s.isCancelled && !s.isCompleted).length;
        console.log('🔍 [SalesTabs] Active sales:', activeCount);
      } else {
        console.log('🔍 [SalesTabs] No sales data or invalid response');
        setSales([]);
      }
    } catch (error) {
      console.error('🔍 [SalesTabs] Error fetching sales:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // Auto-refresh when a new sale is created anywhere in the app
  useEffect(() => {
    const onSaleCreated = (e: CustomEvent) => {
      const eventShopId = e?.detail?.shopId;
      console.log('🔍 [SalesTabs] Sale created event received:', {
        eventDetail: e?.detail,
        currentShopId: shopId,
        eventShopId: eventShopId,
        willRefresh: !eventShopId || eventShopId === shopId
      });

      // Optional: check shop match if provided
      if (!eventShopId || eventShopId === shopId) {
        console.log('🔄 [SalesTabs] Refreshing sales after sale creation...');
        // Clear any cached data first
        sessionStorage.removeItem('prefetchedDashboardData');
        // Add a delay to ensure the sale is persisted in the database
        // Increase delay to ensure transaction is complete
        setTimeout(() => {
          console.log('🔄 [SalesTabs] Executing fetchSales after delay...');
          fetchSales();
        }, 1000);
      } else {
        console.log('⏭️ [SalesTabs] Skipping refresh - shop mismatch:', { eventShopId, currentShopId: shopId });
      }
    };

    // Listen on window with capture phase for better reliability
    const handler = onSaleCreated as EventListener;
    window.addEventListener('sale:created', handler, true);
    document.addEventListener('sale:created', handler, true);

    // Also check localStorage for sale creation flag (fallback mechanism)
    const checkStorage = setInterval(() => {
      const saleCreated = localStorage.getItem('sale:created');
      if (saleCreated) {
        const data = JSON.parse(saleCreated);
        if (!data.shopId || data.shopId === shopId) {
          console.log('🔄 [SalesTabs] Detected sale creation via localStorage, refreshing...');
          sessionStorage.removeItem('prefetchedDashboardData');
          fetchSales();
          localStorage.removeItem('sale:created');
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('sale:created', handler, true);
      document.removeEventListener('sale:created', handler, true);
      clearInterval(checkStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // Debug: Log all sales data to diagnose filtering issues
  useEffect(() => {
    console.log('🔍 [SalesTabs] Sales data updated:', {
      salesCount: sales?.length || 0,
      sales: sales?.map(s => ({
        id: s.id,
        paymentStatus: s.paymentStatus,
        isCompleted: s.isCompleted,
        isCancelled: s.isCancelled
      })) || []
    });

    console.log('🔍 [SalesTabs] Filtered sales:', {
      activeSales: activeSales.length,
      completedSales: completedSales.length,
      cancelledSales: cancelledSales.length
    });
  }, [sales, activeSales, completedSales, cancelledSales]);

  // Reset pagination when switching to the active tab
  useEffect(() => {
    if (activeTab === 'active') setActiveSalesPage(1);
  }, [activeTab]);

  // Refresh sales function
  const refreshSales = async () => {
    console.log('🔍 [SalesTabs] Manual refresh triggered');
    try {
      // Clear dashboard cache first
      const clearCacheResponse = await fetch('/api/dashboard/ultra-fast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ action: 'clearCache', shopId })
      });

      if (clearCacheResponse.ok) {
        console.log('🔍 [SalesTabs] Dashboard cache cleared');
      }
    } catch (error) {
      console.error('🔍 [SalesTabs] Failed to clear cache:', error);
    }

    // Then fetch fresh data
    fetchSales();
  };

  return (
    <Card className="shadow-lg border-0 bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-sm font-medium">{t("Sales", "बिक्री")}</CardTitle>
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <Button size="sm" variant="outline" onClick={refreshSales} disabled={loading}>
            {loading ? t('Loading...', 'लोड हो रहा है...') : t('Refresh Sales', 'बिक्री रीफ्रेश करें')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ShoppingBag className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-blue-700 font-medium">{t('Loading sales...', 'बिक्री लोड हो रही है...')}</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full bg-gray-100 p-1 m-2 rounded-xl overflow-x-auto">
              <TabsTrigger value="active" className="text-xs py-1 px-2 md:py-2 md:px-3 rounded-lg whitespace-nowrap flex-shrink-0">
                🔄 {t("Active", "सक्रिय")} ({activeSales.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs py-1 px-2 md:py-2 md:px-3 rounded-lg whitespace-nowrap flex-shrink-0">
                ✅ {t("Completed", "पूर्ण")} ({completedSales.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs py-1 px-2 md:py-2 md:px-3 rounded-lg whitespace-nowrap flex-shrink-0">
                ❌ {t("Cancelled", "रद्द")} ({cancelledSales.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs py-1 px-2 md:py-2 md:px-3 rounded-lg whitespace-nowrap flex-shrink-0">
                📈 {t("Sales History", "बिक्री इतिहास")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {activeSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-base md:text-lg">{t("No active sales found", "कोई सक्रिय बिक्री नहीं मिली")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedActiveSales.map((sale: any) => {
                    const paid = Number(sale.paid_amount || 0);
                    const total = Number(sale.final_amount || 0);
                    const due = Number(sale.due_amount || (total - paid));

                    // Debug logging for partial payments
                    console.log('🔍 [SalesTabs] Sale payment data:', {
                      saleId: sale.id,
                      paid_amount: sale.paid_amount,
                      due_amount: sale.due_amount,
                      payment_type: sale.payment_type,
                      partial_payment_method: sale.partial_payment_method,
                      paymentStatus: sale.paymentStatus,
                      paid: paid,
                      due: due,
                      total: total
                    });

                    let paymentMethodLabel = '-';

                    // Simple and clear payment method logic
                    if (sale.payment_type === 'cash') {
                      paymentMethodLabel = t('Cash', 'कैश');
                    } else if (sale.payment_type === 'online') {
                      paymentMethodLabel = t('Online/Card', 'ऑनलाइन/कार्ड');
                    } else if (sale.payment_type === 'loan') {
                      paymentMethodLabel = t('Loan/Credit', 'ऋण/क्रेडिट');
                    } else if (sale.payment_type === 'partial') {
                      const method = sale.partial_payment_method || 'UPI';
                      let methodLabel = '';
                      switch (method.toLowerCase()) {
                        case 'cash': methodLabel = t('Cash', 'कैश'); break;
                        case 'upi': methodLabel = t('UPI', 'यूपीआई'); break;
                        case 'card': methodLabel = t('Card', 'कार्ड'); break;
                        case 'bank_transfer': methodLabel = t('Bank Transfer', 'बैंक ट्रांसफर'); break;
                        case 'cheque': methodLabel = t('Cheque', 'चेक'); break;
                        case 'online': methodLabel = t('Online', 'ऑनलाइन'); break;
                        default: methodLabel = method.charAt(0).toUpperCase() + method.slice(1);
                      }
                      paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
                    } else {
                      paymentMethodLabel = sale.payment_type ? sale.payment_type.charAt(0).toUpperCase() + sale.payment_type.slice(1) : '-';
                    }
                    return (
                      <Card key={`${sale.isTmtSale ? 'tmt' : 'reg'}-${sale.id}`} className="shadow border mb-2">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="font-semibold text-base md:text-lg">{sale.customerName}</span>
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200 w-fit">{t('Account', 'खाता')}</Badge>
                            </div>
                            {sale.customerPhone && (
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="font-semibold">{t('Phone', 'फोन')}:</span> {sale.customerPhone}
                              </div>
                            )}
                            {sale.customerAddress && (
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="font-semibold">{t('Address', 'पता')}:</span> {sale.customerAddress}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {t('Sale Time', 'बिक्री का समय')}: {dayjs(sale.createdAt).format('h:mm:ss A, DD/MM/YYYY')}
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0">
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">{t('Active', 'सक्रिय')}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">{t('Items:', 'आइटम:')}</span> {sale.items && sale.items.length > 0 && sale.items.map((item: any, idx: number) => (
                              <span key={idx} className="font-semibold">
                                {item.name || item.productName} × {item.quantity} {item.unit || ''}{idx < sale.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Total Bill', 'कुल राशि')}</span><br />
                              <span className="text-sm font-bold">₹{safeCurrency(total)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Amount Paid', 'भुगतान राशि')}</span><br />
                              <span className="text-sm font-bold text-green-600">₹{safeCurrency(paid)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Due Amount', 'बकाया राशि')}</span><br />
                              <span className="text-sm font-bold text-red-600">₹{safeCurrency(due)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Payment Method', 'भुगतान प्रकार')}</span><br />
                              <Badge variant={sale.payment_type === 'partial' ? 'outline' : 'default'} className={`text-xs ${sale.payment_type === 'partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                {paymentMethodLabel}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1" onClick={async () => {
                              try {
                                console.log('🔍 [SalesTabs] Completing sale:', sale.id, 'Current paymentStatus:', sale.paymentStatus);
                                const res = await fetch('/api/sales', {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                                  },
                                  body: JSON.stringify({ saleId: sale.id, action: 'complete', isTmtSale: sale.isTmtSale })
                                });
                                const data = await res.json();
                                console.log('🔍 [SalesTabs] Complete sale response:', data);
                                if (data.success) {
                                  toast.success(t('Sale completed!', 'बिक्री पूर्ण हुई!'));
                                  console.log('🔍 [SalesTabs] Refreshing sales after completion...');
                                  await refreshSales();
                                } else {
                                  console.error('🔍 [SalesTabs] Failed to complete sale:', data.message);
                                  toast.error(data.message || t('Failed to complete sale', 'बिक्री पूर्ण करने में विफल'));
                                }
                              } catch (e) {
                                console.error('🔍 [SalesTabs] Error completing sale:', e);
                                toast.error(t('Failed to complete sale', 'बिक्री पूर्ण करने में विफल'));
                              }
                            }}>
                              {t('Complete', 'पूर्ण करें')}
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => {
                              setCancelSaleId(sale.id);
                              setCancelIsTmt(sale.isTmtSale || false);
                              setCancelReason("");
                              setCancelDialogOpen(true);
                            }}>
                              {t('Cancel', 'रद्द करें')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {paginatedActiveSales.length < activeSales.length && (
                    <div className="flex justify-center mt-4">
                      <Button size="sm" variant="outline" onClick={() => setActiveSalesPage(activeSalesPage + 1)}>
                        {t('Read More', 'और देखें')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="completed">
              {completedSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-base md:text-lg">{t("No completed sales found", "कोई पूर्ण बिक्री नहीं मिली")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedSales.map((sale: any) => {
                    const paid = Number(sale.paid_amount || 0);
                    const total = Number(sale.final_amount || 0);
                    const due = Number(sale.due_amount || (total - paid));

                    let paymentMethodLabel = '-';

                    // Simple and clear payment method logic
                    if (sale.payment_type === 'cash') {
                      paymentMethodLabel = t('Cash', 'कैश');
                    } else if (sale.payment_type === 'online') {
                      paymentMethodLabel = t('Online/Card', 'ऑनलाइन/कार्ड');
                    } else if (sale.payment_type === 'loan') {
                      paymentMethodLabel = t('Loan/Credit', 'ऋण/क्रेडिट');
                    } else if (sale.payment_type === 'partial') {
                      const method = sale.partial_payment_method || 'UPI';
                      let methodLabel = '';
                      switch (method.toLowerCase()) {
                        case 'cash': methodLabel = t('Cash', 'कैश'); break;
                        case 'upi': methodLabel = t('UPI', 'यूपीआई'); break;
                        case 'card': methodLabel = t('Card', 'कार्ड'); break;
                        case 'bank_transfer': methodLabel = t('Bank Transfer', 'बैंक ट्रांसफर'); break;
                        case 'cheque': methodLabel = t('Cheque', 'चेक'); break;
                        case 'online': methodLabel = t('Online', 'ऑनलाइन'); break;
                        default: methodLabel = method.charAt(0).toUpperCase() + method.slice(1);
                      }
                      paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
                    } else {
                      paymentMethodLabel = sale.payment_type ? sale.payment_type.charAt(0).toUpperCase() + sale.payment_type.slice(1) : '-';
                    }
                    return (
                      <Card key={`${sale.isTmtSale ? 'tmt' : 'reg'}-${sale.id}`} className="shadow border mb-2">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="font-semibold text-base sm:text-lg truncate">{sale.customerName || t('Unknown Customer', 'अज्ञात ग्राहक')}</span>
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200 w-fit">{t('Account', 'खाता')}</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {t('Sale Time', 'बिक्री का समय')}: {dayjs(sale.createdAt).format('h:mm:ss A, DD/MM/YYYY')}
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0">
                            <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">{t('Completed', 'पूर्ण')}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">{t('Items:', 'आइटम:')}</span> {sale.items && sale.items.length > 0 && sale.items.map((item: any, idx: number) => (
                              <span key={idx} className="font-semibold">{item.name || item.productName} × {item.quantity} {item.unit || ''}{idx < sale.items.length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Total Bill', 'कुल राशि')}</span><br />
                              <span className="text-sm font-bold">₹{safeCurrency(total)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Amount Paid', 'भुगतान राशि')}</span><br />
                              <span className="text-sm font-bold text-green-600">₹{safeCurrency(paid)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Due Amount', 'बकाया राशि')}</span><br />
                              <span className="text-sm font-bold text-red-600">₹{safeCurrency(due)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Payment Method', 'भुगतान प्रकार')}</span><br />
                              <Badge variant={sale.payment_type === 'partial' ? 'outline' : 'default'} className={`text-xs ${sale.payment_type === 'partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                {paymentMethodLabel}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="cancelled">
              {cancelledSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-base md:text-lg">{t("No cancelled sales found", "कोई रद्द बिक्री नहीं मिली")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cancelledSales.map((sale: any) => {
                    const paid = Number(sale.paid_amount || 0);
                    const total = Number(sale.final_amount || 0);
                    const due = Number(sale.due_amount || (total - paid));
                    const cancelledText = "line-through text-gray-500";

                    let paymentMethodLabel = '-';

                    // Simple and clear payment method logic
                    if (sale.payment_type === 'cash') {
                      paymentMethodLabel = t('Cash', 'कैश');
                    } else if (sale.payment_type === 'online') {
                      paymentMethodLabel = t('Online/Card', 'ऑनलाइन/कार्ड');
                    } else if (sale.payment_type === 'loan') {
                      paymentMethodLabel = t('Loan/Credit', 'ऋण/क्रेडिट');
                    } else if (sale.payment_type === 'partial') {
                      const method = sale.partial_payment_method || 'UPI';
                      let methodLabel = '';
                      switch (method.toLowerCase()) {
                        case 'cash': methodLabel = t('Cash', 'कैश'); break;
                        case 'upi': methodLabel = t('UPI', 'यूपीआई'); break;
                        case 'card': methodLabel = t('Card', 'कार्ड'); break;
                        case 'bank_transfer': methodLabel = t('Bank Transfer', 'बैंक ट्रांसफर'); break;
                        case 'cheque': methodLabel = t('Cheque', 'चेक'); break;
                        case 'online': methodLabel = t('Online', 'ऑनलाइन'); break;
                        default: methodLabel = method.charAt(0).toUpperCase() + method.slice(1);
                      }
                      paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
                    } else {
                      paymentMethodLabel = sale.payment_type ? sale.payment_type.charAt(0).toUpperCase() + sale.payment_type.slice(1) : '-';
                    }
                    return (
                      <Card key={`${sale.isTmtSale ? 'tmt' : 'reg'}-${sale.id}`} className="shadow border mb-2">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className={`font-semibold text-base sm:text-lg truncate ${cancelledText}`}>{sale.customerName || t('Unknown Customer', 'अज्ञात ग्राहक')}</span>
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200 w-fit">{t('Account', 'खाता')}</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {t('Sale Time', 'बिक्री का समय')}: {dayjs(sale.createdAt).format('h:mm:ss A, DD/MM/YYYY')}
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0">
                            <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">{t('Cancelled', 'रद्द')}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">{t('Items:', 'आइटम:')}</span> {sale.items && sale.items.length > 0 && sale.items.map((item: any, idx: number) => (
                              <span key={idx} className={`font-semibold ${cancelledText}`}>{item.name || item.productName} × {item.quantity} {item.unit || ''}{idx < sale.items.length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                          {sale.notes && sale.notes.includes('Cancelled:') && (
                            <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <span className="font-medium">{t('Cancellation Reason:', 'रद्द करने का कारण:')}</span> {sale.notes.replace('Cancelled: ', '')}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Total Bill', 'कुल राशि')}</span><br />
                              <span className={`text-sm font-bold ${cancelledText}`}>₹{safeCurrency(total)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Amount Paid', 'भुगतान राशि')}</span><br />
                              <span className={`text-sm font-bold text-green-600 ${cancelledText}`}>₹{safeCurrency(paid)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Due Amount', 'बकाया राशि')}</span><br />
                              <span className={`text-sm font-bold text-red-600 ${cancelledText}`}>₹{safeCurrency(due)}</span>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <span className="font-medium text-xs">{t('Payment Method', 'भुगतान प्रकार')}</span><br />
                              <Badge variant={sale.payment_type === 'partial' ? 'outline' : 'default'} className={`text-xs ${sale.payment_type === 'partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                <span className={cancelledText}>{paymentMethodLabel}</span>
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="history">
              <TodaySalesHistory />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      {/* Cancel Sale Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Cancel Sale', 'बिक्री रद्द करें')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t('Enter reason for cancellation', 'रद्द करने का कारण दर्ज करें')}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>{t('Close', 'बंद करें')}</Button>
            <Button disabled={cancelLoading || !cancelReason.trim()} onClick={async () => {
              if (!cancelSaleId || !cancelReason.trim()) return;
              setCancelLoading(true);
              try {
                const res = await fetch('/api/sales', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                  },
                  body: JSON.stringify({ saleId: cancelSaleId, action: 'cancel', reason: cancelReason, isTmtSale: cancelIsTmt })
                });
                const data = await res.json();
                if (data.success) {
                  toast.success(t('Sale cancelled!', 'बिक्री रद्द हुई!'));
                  setCancelDialogOpen(false);
                  // Optimistically remove from current list to reflect immediately
                  setSales((prev: any[]) => (prev || []).filter((s: any) => s.id !== cancelSaleId));
                  // Force cache clear + refetch to ensure consistency
                  await refreshSales();
                } else {
                  toast.error(data.message || t('Failed to cancel sale', 'बिक्री रद्द करने में विफल'));
                }
              } catch (e) {
                toast.error(t('Failed to cancel sale', 'बिक्री रद्द करने में विफल'));
              } finally {
                setCancelLoading(false);
              }
            }}>{cancelLoading ? t('Cancelling...', 'रद्द किया जा रहा है...') : t('Cancel Sale', 'बिक्री रद्द करें')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 