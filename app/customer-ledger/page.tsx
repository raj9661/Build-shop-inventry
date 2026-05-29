"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/hooks/use-language"
import { getAvailableUnits } from "../lib/tmtUtils"

import {
  Plus,
  Search,
  Filter,
  IndianRupee,
  User,
  ShoppingBag,
  Phone,
  MapPin,
  Loader2,
  Pencil,
  Trash2,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { useShop } from '../contexts/ShopContext'
import dynamic from "next/dynamic"
import type { AdminEditField } from '../components/admin/AdminEditModal'

const AdminEditModal = dynamic(() => import('../components/admin/AdminEditModal'), { ssr: false, loading: () => <div className="hidden" /> })
const AdminDeleteConfirm = dynamic(() => import('../components/admin/AdminDeleteConfirm'), { ssr: false, loading: () => <div className="hidden" /> })


type LedgerItem = {
  name: string
  quantity: number
  price: number
  unit: string
}

type LedgerEntry = {
  id: number; // Database ID for uniqueness
  saleId: string;
  date: string;
  time: string;
  items: LedgerItem[];
  qty: number;
  price: number;
  total: number;
  paymentMode: string;
  isPartial: boolean;
  paid: number;
  due: number;
  runningBalance: number;
  type?: 'debit' | 'credit';
  purpose?: string; // Added for filtering
  description?: string; // Added for UI display
};

interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  isActive: boolean;
  currentBalance?: number;
  stats?: {
    recentSales: number;
    recentPayments: number;
    totalTransactions: number;
  };
}

export default function CustomerLedger() {
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShop, userRole } = useShop()
  const isAdmin = userRole === 'SUPER_DUPER_ADMIN' || userRole === 'SUPER_ADMIN'

  // Admin edit/delete state
  const [adminEditEntry, setAdminEditEntry] = useState<LedgerEntry | null>(null)
  const [adminDeleteEntry, setAdminDeleteEntry] = useState<LedgerEntry | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" })
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("ledger")
  const [showFilters, setShowFilters] = useState(false)
  const [customerStatuses, setCustomerStatuses] = useState<{ [key: number]: boolean }>({})
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState({ name: "", phone: "", address: "" })
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false)

  // Return items state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [returnItems, setReturnItems] = useState<Array<{ productId: string; name: string; quantity: string; conversionCft: string; unit: string; categoryName: string; isTrueBulkCft: boolean; isTmt?: boolean }>>([])
  const [returnCreditAmount, setReturnCreditAmount] = useState("")
  const [returnNotes, setReturnNotes] = useState("")
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [availableCategories, setAvailableCategories] = useState<any[]>([])
  const [returnProductType, setReturnProductType] = useState<'regular' | 'tmt'>('regular')
  const [returnTmtProducts, setReturnTmtProducts] = useState<any[]>([])
  const [returnCategoryFilter, setReturnCategoryFilter] = useState("all")
  const [returnProductSearch, setReturnProductSearch] = useState("")
  const [returnSelectedProduct, setReturnSelectedProduct] = useState<any>(null)
  const [returnQty, setReturnQty] = useState("")
  const [returnConvCft, setReturnConvCft] = useState("")
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)

  const [newEntry, setNewEntry] = useState({
    amount: "",
    type: "debit" as "debit" | "credit" | "old_balance_due" | "old_balance_adv",
    method: "CASH",
    purpose: "purchase",
    description: "",
    items: [] as LedgerItem[],
    itemName: "",
    quantity: "1",
    unitPrice: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [customers, setCustomers] = useState<Customer[]>([])

  // Debounced customer search
  // Cache for search results to reduce API calls
  const searchCache = useRef(new Map<string, Customer[]>());

  // Fetch customers with search
  const fetchCustomers = useCallback(async (search = "") => {
    if (!currentShop) return;

    // Check cache first (only for valid searches)
    const cacheKey = `${currentShop.id}-${search}-${dateFilter.from}-${dateFilter.to}`; // Include filters in key if they affect result, but simplified for now: just based on search and shop. 
    // Actually, fetchCustomers here uses 'status=all' constant, so only 'search' and 'shopId' matter.
    // Let's use a simpler key.
    const effectiveKey = `${currentShop.id}:${search}`;

    if (searchCache.current.has(effectiveKey)) {
      // console.log("Using cached results for:", search);
      const cachedCustomers = searchCache.current.get(effectiveKey) || [];
      setCustomers(cachedCustomers);

      // Re-initialize statuses from cache
      const statuses: { [key: number]: boolean } = {};
      cachedCustomers.forEach((customer) => {
        statuses[customer.id] = customer.isActive;
      });
      setCustomerStatuses(statuses);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        shopId: currentShop.id.toString(),
        limit: '100',
        status: 'all', // Include both active and inactive customers for ledger
        ...(search && { search })
      });

      const res = await fetch(`/api/customers?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json();

      if (data.success && data.data && data.data.customers) {
        setCustomers(data.data.customers);

        // Cache the result
        searchCache.current.set(effectiveKey, data.data.customers);

        // Initialize customer statuses
        const statuses: { [key: number]: boolean } = {};
        data.data.customers.forEach((customer: Customer) => {
          statuses[customer.id] = customer.isActive;
        });
        setCustomerStatuses(statuses);


      } else {
        setCustomers([]);
        setCustomerStatuses({});
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
      setCustomers([]);
      toast.error(t("Failed to fetch customers", "ग्राहकों को लाने में विफल"));
    } finally {
      setLoading(false);
    }
  }, [currentShop, t]);

  // Auto-select first customer when customers are loaded and none is selected
  useEffect(() => {
    if (!selectedCustomer && customers.length > 0) {
      setSelectedCustomer(customers[0].id);
    }
  }, [customers, selectedCustomer]);

  // Keep track of latest fetchCustomers function
  const fetchCustomersRef = useRef(fetchCustomers);
  useEffect(() => {
    fetchCustomersRef.current = fetchCustomers;
  }, [fetchCustomers]);

  // Debounced customer search
  const debouncedCustomerSearch = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout;
      return (searchTerm: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fetchCustomersRef.current(searchTerm);
        }, 300);
      };
    },
    []
  );

  // Fetch ledger entries when customer changes
  const fetchLedgerEntries = useCallback(async () => {
    if (!selectedCustomer || !currentShop) return;

    setLedgerLoading(true);
    try {
      const token = localStorage.getItem('accessToken');

      const params = new URLSearchParams({
        customerId: selectedCustomer.toString(),
        limit: '200', // Increased limit for better performance
        _t: Date.now().toString() // Cache busting
      });

      // Add date filters if set
      if (dateFilter.from) params.append('fromDate', dateFilter.from);
      if (dateFilter.to) params.append('toDate', dateFilter.to);

      const res = await fetch(`/api/ledger?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      const data = await res.json();

      if (data.success && data.data && data.data.entries) {
        setLedgerEntries(data.data.entries);
      } else {
        setLedgerEntries([]);
      }
    } catch (e) {
      console.error('Error fetching ledger entries:', e);
      setLedgerEntries([]);
      toast.error(t("Failed to fetch ledger entries", "खाता एंट्री लाने में विफल"));
    } finally {
      setLedgerLoading(false);
    }
  }, [selectedCustomer, currentShop, dateFilter.from, dateFilter.to, t]);

  // Initial load
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch ledger when customer changes
  useEffect(() => {
    fetchLedgerEntries();
  }, [fetchLedgerEntries]);

  // Handle customer search
  useEffect(() => {
    debouncedCustomerSearch(customerSearchTerm);
  }, [customerSearchTerm, debouncedCustomerSearch]);

  // Fetch available products when return modal opens
  useEffect(() => {
    if (isReturnModalOpen && currentShop) {
      // Reset picker state on open
      setReturnSelectedProduct(null);
      setReturnQty("");
      setReturnConvCft("");
      setReturnProductSearch("");
      setReturnCategoryFilter("all");
      setReturnProductType('regular');

      const fetchProducts = async () => {
        try {
          const token = localStorage.getItem('accessToken');
          // Regular products
          const res = await fetch(`/api/products?shopId=${currentShop.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            const products = data.data.products;
            setAvailableProducts(products);
            const cats = Array.from(new Set(
              products.map((p: any) => p.category?.name).filter(Boolean)
            )) as string[];
            setAvailableCategories(cats);
          } else {
            toast.error(t("Failed to load products", "उत्पाद लोड करने में विफल"));
          }
          // TMT products
          const tmtRes = await fetch(`/api/tmt/products?shopId=${currentShop.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (tmtRes.ok) {
            const tmtData = await tmtRes.json();
            if (tmtData.success) setReturnTmtProducts(tmtData.data.products || []);
          }
        } catch (error) {
          console.error("Error loading products:", error);
          toast.error(t("Failed to load products", "उत्पाद लोड करने में विफल"));
        }
      };
      fetchProducts();
    }
  }, [isReturnModalOpen, currentShop, t]);

  const handleReturnSubmit = async () => {
    if (!selectedCustomer) {
      toast.error(t("Please select a customer first", "कृपया पहले एक ग्राहक चुनें"));
      return;
    }
    if (returnItems.length === 0) {
      toast.error(t("Please add at least one item to return", "कृपया वापसी के लिए कम से कम एक आइटम जोड़ें"));
      return;
    }
    const credit = parseFloat(returnCreditAmount || "0");
    if (isNaN(credit) || credit < 0) {
      toast.error(t("Invalid credit amount", "अमान्य क्रेडिट राशि"));
      return;
    }
    if (!currentShop) {
      toast.error(t("Please select a shop first", "कृपया पहले एक दुकान चुनें"));
      return;
    }

    try {
      setIsSubmittingReturn(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/sales/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          shopId: currentShop.id,
          date: returnDate,
          creditAmount: credit,
          notes: returnNotes,
          items: returnItems.map(item => ({
            productId: parseInt(item.productId),
            quantity: parseFloat(item.quantity),
            conversionCft: parseFloat(item.conversionCft),
            unitName: item.unit,
            isTmt: !!item.isTmt
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("Items returned and restocked successfully", "सामान सफलतापूर्वक वापस और रीस्टॉक कर दिया गया"));
        setIsReturnModalOpen(false);
        // Reset state
        setReturnItems([]);
        setReturnCreditAmount("");
        setReturnNotes("");
        // Refresh ledger
        fetchLedgerEntries();
        // Refresh customers
        fetchCustomers();
      } else {
        toast.error(data.message || t("Failed to submit return", "वापसी सबमिट करने में विफल"));
      }
    } catch (error) {
      console.error("Error submitting return:", error);
      toast.error(t("Failed to submit return", "वापसी सबमिट करने में विफल"));
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer)

  const handleEditClick = () => {
    if (selectedCustomerData) {
      setEditingCustomer({
        name: selectedCustomerData.name,
        phone: selectedCustomerData.phone,
        address: selectedCustomerData.address || ""
      })
      setIsEditCustomerOpen(true)
    }
  }

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer || !editingCustomer.name || !editingCustomer.phone) {
      toast.error(t("Name and phone are required", "नाम और फोन आवश्यक हैं"))
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedCustomer,
          ...editingCustomer
        })
      })

      const data = await res.json()

      if (data.success) {
        // Update local state
        setCustomers(prev => prev.map(c =>
          c.id === selectedCustomer
            ? { ...c, ...editingCustomer }
            : c
        ))

        setIsEditCustomerOpen(false)
        toast.success(t("Customer updated successfully", "ग्राहक सफलतापूर्वक अपडेट किया गया"))
      } else {
        toast.error(data.message || t("Failed to update customer", "ग्राहक अपडेट करने में विफल"))
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error(t("Failed to update customer", "ग्राहक अपडेट करने में विफल"))
    }
  }
  const isCustomerActive = customerStatuses[selectedCustomer || 0] ?? true

  // Always get current balance from the most recent entry (top row in descending order)
  const sortedByDateDesc = [...ledgerEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentBalance = sortedByDateDesc.length > 0
    ? sortedByDateDesc[0].runningBalance
    : selectedCustomerData?.currentBalance || 0;

  // Filter entries based on search and date
  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      let matchesSearch = false;
      if (!searchTerm) {
        matchesSearch = true;
      } else if (entry.type === 'credit') {
        matchesSearch = !!(
          entry.paymentMode && entry.paymentMode.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        matchesSearch = entry.items.some((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      const matchesDate = (!dateFilter.from || entry.date >= dateFilter.from) && (!dateFilter.to || entry.date <= dateFilter.to);
      return matchesSearch && matchesDate;
    });
  }, [ledgerEntries, searchTerm, dateFilter]);

  // Always show newest entries at the top
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredEntries]);

  // Tabs logic for All, Purchase, Payment
  const allEntries = sortedEntries;
  const purchaseEntries = sortedEntries.filter(
    entry => entry.type === 'debit' && (!entry.purpose || entry.purpose === 'purchase')
  );
  const paymentEntries = sortedEntries.filter(
    entry => entry.type === 'credit' && (!entry.purpose || entry.purpose === 'payment')
  );

  const handleAddItem = () => {
    if (!newEntry.itemName || !newEntry.quantity || !newEntry.unitPrice) {
      toast.error(t("Please enter all item details", "कृपया सभी सामान विवरण दर्ज करें"));
      return;
    }
    const newItem = {
      name: newEntry.itemName,
      quantity: Number(newEntry.quantity),
      price: Number(newEntry.unitPrice),
      unit: 'units'
    };
    setNewEntry(prev => {
      const newItems = [...prev.items, newItem];
      const newAmount = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toString();
      return {
        ...prev,
        items: newItems,
        itemName: "",
        quantity: "1",
        unitPrice: "",
        amount: newAmount === '0' ? '' : newAmount
      };
    });
  };

  const handleRemoveItem = (index: number) => {
    setNewEntry(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const currentInputTotal = (Number(prev.quantity || 0) * Number(prev.unitPrice || 0));
      const itemsTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const newAmount = itemsTotal + currentInputTotal;
      return {
        ...prev,
        items: newItems,
        amount: newAmount === 0 ? '' : newAmount.toString()
      };
    });
  };

  const handleAddEntry = async () => {
    if (isSubmitting) return;

    if (!newEntry.amount || !selectedCustomer) {
      toast.error(t("Please enter amount and select customer", "कृपया राशि दर्ज करें और ग्राहक चुनें"))
      return
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');

      const itemsToSend = [...newEntry.items];
      if (newEntry.type === 'debit' && newEntry.itemName && newEntry.quantity && newEntry.unitPrice) {
        itemsToSend.push({
          name: newEntry.itemName,
          quantity: Number(newEntry.quantity),
          price: Number(newEntry.unitPrice),
          unit: 'units'
        });
      }

      let mappedType = newEntry.type;
      let mappedDescription = newEntry.description;

      if (newEntry.type === 'old_balance_due') {
        mappedType = 'debit';
        mappedDescription = newEntry.description || 'Opening Balance (Due)';
      } else if (newEntry.type === 'old_balance_adv') {
        mappedType = 'credit';
        mappedDescription = newEntry.description || 'Opening Balance (Advance)';
      }

      let mappedMethod = newEntry.method;
      if (newEntry.type === 'old_balance_due') {
        mappedMethod = 'LOAN';
      }

      const entryData = {
        customerId: selectedCustomer,
        date: newEntry.date,
        amount: Number(newEntry.amount),
        type: mappedType,
        paymentMethod: mappedMethod, // Send as paymentMethod for consistency
        method: mappedMethod, // Keep for backward compatibility
        purpose: (newEntry.type === 'old_balance_due' || newEntry.type === 'old_balance_adv') ? 'opening_balance' : newEntry.purpose,
        description: mappedDescription,
        items: mappedType === 'debit' && newEntry.type !== 'old_balance_due' && newEntry.type !== 'old_balance_adv' ? itemsToSend : newEntry.items,
      };

      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entryData)
      });

      const data = await res.json();

      if (data.success) {
        // Refresh ledger entries
        await fetchLedgerEntries();

        setNewEntry({
          amount: "",
          type: "debit",
          method: "CASH",
          purpose: "purchase",
          description: "",
          items: [],
          itemName: "",
          quantity: "1",
          unitPrice: "",
          date: new Date().toISOString().split("T")[0],
        });
        setIsAddEntryOpen(false);
        toast.success(t("Entry added successfully!", "एंट्री सफलतापूर्वक जोड़ी गई!"));
      } else {
        toast.error(data.message || t("Failed to add entry", "एंट्री जोड़ने में विफल"));
      }
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error(t("Failed to add entry", "एंट्री जोड़ने में विफल"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleToggleAccountStatus = async () => {
    if (!selectedCustomer) return;

    try {
      const response = await fetch(`/api/customers/${selectedCustomer}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          // Update local state
          const newStatus = data.data.customer.isActive;

          setCustomerStatuses(prev => ({
            ...prev,
            [selectedCustomer]: newStatus
          }));

          // Update customers list
          setCustomers(prev => prev.map(customer =>
            customer.id === selectedCustomer
              ? { ...customer, isActive: newStatus }
              : customer
          ));

          // UPDATE CACHE: Iterate through cache and update the customer in all cached results
          // UPDATE CACHE: Iterate through cache and update the customer in all cached results
          searchCache.current.forEach((cachedList, key) => {
            const updatedList = cachedList.map(c =>
              String(c.id) === String(selectedCustomer) ? { ...c, isActive: newStatus } : c
            );
            searchCache.current.set(key, updatedList);
          });

          toast.success(data.message);
        } else {
          toast.error(data.message || t("Failed to toggle account status", "खाता स्थिति बदलने में विफल"));
        }
      } else {
        toast.error(t("Failed to toggle account status", "खाता स्थिति बदलने में विफल"));
      }
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast.error(t("Failed to toggle account status", "खाता स्थिति बदलने में विफल"));
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone || !newCustomer.address) {
      toast.error(t("All fields are required", "सभी फ़ील्ड आवश्यक हैं"));
      return;
    }

    if (newCustomer.phone.length !== 10 || !/^\d+$/.test(newCustomer.phone)) {
      toast.error(t("Phone number must be 10 digits", "फोन नंबर 10 अंकों का होना चाहिए"));
      return;
    }

    if (newCustomer.name.length > 50) {
      toast.error(t("Name cannot exceed 50 characters", "नाम 50 अक्षरों से अधिक नहीं हो सकता"));
      return;
    }

    if (newCustomer.address.length > 150) {
      toast.error(t("Address cannot exceed 150 characters", "पता 150 अक्षरों से अधिक नहीं हो सकता"));
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newCustomer,
          shopId: currentShop?.id
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t("Customer added successfully", "ग्राहक सफलतापूर्वक जोड़ा गया"));
        setIsAddCustomerOpen(false);
        setNewCustomer({ name: "", phone: "", address: "" });

        setSelectedCustomer(data.data.id);
        setCustomerSearchTerm(data.data.name);

        // Clear cache and fetch fresh customers asynchronously to not block the UI close
        searchCache.current.clear();
        fetchCustomers().catch(err => console.error("Error refreshing customers:", err));
      } else {
        toast.error(data.message || t("Failed to add customer", "ग्राहक जोड़ने में विफल"));
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error(t("Failed to add customer", "ग्राहक जोड़ने में विफल"));
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // When opening the Add dialog, set type and purpose based on activeTab
  const handleOpenAddEntry = () => {
    if (activeTab === 'payment') {
      setNewEntry({
        amount: '',
        type: 'credit',
        method: 'CASH',
        purpose: 'payment',
        description: '',
        items: [],
        itemName: '',
        quantity: '1',
        unitPrice: '',
        date: new Date().toISOString().split('T')[0],
      });
    } else {
      setNewEntry({
        amount: '',
        type: 'debit',
        method: 'CASH',
        purpose: 'purchase',
        description: '',
        items: [],
        itemName: '',
        quantity: '1',
        unitPrice: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    setIsAddEntryOpen(true);
  };

  // Admin ledger entry edit handler
  const handleAdminLedgerEdit = async (changes: Record<string, any>, reason: string) => {
    if (!adminEditEntry) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/api/admin/ledger/${adminEditEntry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...changes, reason })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Edit failed')
    toast.success('Ledger entry updated successfully')
    await fetchLedgerEntries()
  }

  // Admin ledger entry delete handler
  const handleAdminLedgerDelete = async (reason: string) => {
    if (!adminDeleteEntry) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/api/admin/ledger/${adminDeleteEntry.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reason })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Delete failed')
    toast.success('Ledger entry deleted')
    await fetchLedgerEntries()
  }

  // Add a single row rendering function for all tabs
  function renderLedgerRow(entry: LedgerEntry, index: number) {
    const isCredit = entry.type === 'credit';
    const isOpeningBalance = entry.items && entry.items.length > 0 && entry.items[0]?.name.toLowerCase().includes('opening balance');
    
    // Fallback single row rendering
    if (isCredit || isOpeningBalance || !entry.items || entry.items.length <= 1) {
      const singleItem = entry.items && entry.items.length > 0 ? entry.items[0] : null;
      return (
        <TableRow key={`ledger-entry-${entry.id}-${index}`} className="hover:bg-gray-50 transition-colors">
          <TableCell className="border-r text-xs md:text-sm">
            <div>
              <div className="font-medium">{entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : '-'}</div>
              <div className="text-gray-500 text-xs">{entry.time || '-'}</div>
              {isAdmin && (
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setAdminEditEntry(entry)} className="p-0.5 rounded text-amber-600 hover:bg-amber-50 transition-colors" title="Admin: Edit this entry"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => setAdminDeleteEntry(entry)} className="p-0.5 rounded text-red-500 hover:bg-red-50 transition-colors" title="Admin: Delete this entry"><Trash2 className="h-3 w-3" /></button>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm">
            {isCredit ? <span className="text-green-700 font-semibold">{entry.description && (entry.description.includes('Opening Balance') || entry.description.includes('Return') || entry.description.includes('Returned')) ? entry.description : 'Payment'}</span> : (singleItem ? <span className="font-medium">{singleItem.name}</span> : <span className="text-gray-400">-</span>)}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-center">
            {isCredit || isOpeningBalance ? <span className="text-gray-400">-</span> : (singleItem?.quantity ? `${singleItem.quantity} ${singleItem.unit || ""}` : (entry.qty || <span className="text-gray-400">-</span>))}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-right">
            {isCredit || isOpeningBalance ? <span className="text-gray-400">-</span> : (singleItem?.price ? `₹${singleItem.price.toLocaleString()}` : (entry.price ? `₹${entry.price.toLocaleString()}` : <span className="text-gray-400">-</span>))}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-right">
            {isCredit ? <span className="font-bold text-green-600">-₹{entry.paid.toLocaleString()}</span> : (entry.total ? <span className="font-bold text-red-600">+₹{entry.total.toLocaleString()}</span> : <span className="text-gray-400">-</span>)}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-center">
            {entry.paymentMode && entry.paymentMode !== '-' ? (entry.isPartial ? <Badge variant="outline">{entry.paymentMode}</Badge> : <Badge variant="default">{entry.paymentMode}</Badge>) : <span className="text-gray-400">-</span>}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-right">
            {isCredit ? <span className="font-bold text-green-600">₹{entry.paid.toLocaleString()}</span> : (entry.paid ? <span className="font-bold text-green-600">₹{entry.paid.toLocaleString()}</span> : <span className="text-gray-400">-</span>)}
          </TableCell>
          <TableCell className="border-r text-xs md:text-sm text-right">
            {isCredit ? <span className="text-gray-400">-</span> : (entry.due ? <span className="font-bold text-blue-600">₹{entry.due.toLocaleString()}</span> : <span className="text-gray-400">-</span>)}
          </TableCell>
          <TableCell className="text-xs md:text-sm text-right">
            <div className={`font-bold ${entry.runningBalance > 0 ? "text-red-600" : entry.runningBalance < 0 ? "text-green-600" : "text-gray-600"}`}>
              ₹{Math.abs(entry.runningBalance).toLocaleString()}
              <div className="text-xs text-gray-500">
                {entry.runningBalance > 0 && t("Due", "बकाया")}
                {entry.runningBalance < 0 && t("Advance", "अग्रिम")}
                {entry.runningBalance === 0 && t("Clear", "साफ")}
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    // Multi-item rendering with rowSpan
    const rowCount = entry.items.length;
    return (
      <React.Fragment key={`ledger-entry-fragment-${entry.id}-${index}`}>
        {entry.items.map((item, idx) => {
          if (idx === 0) {
            return (
              <TableRow key={`ledger-entry-${entry.id}-${index}-${idx}`} className="hover:bg-gray-50 transition-colors">
                <TableCell rowSpan={rowCount} className="border-r border-b text-xs md:text-sm align-top">
                  <div>
                    <div className="font-medium">{entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : '-'}</div>
                    <div className="text-gray-500 text-xs">{entry.time || '-'}</div>
                    {isAdmin && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => setAdminEditEntry(entry)} className="p-0.5 rounded text-amber-600 hover:bg-amber-50 transition-colors" title="Admin: Edit this entry"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => setAdminDeleteEntry(entry)} className="p-0.5 rounded text-red-500 hover:bg-red-50 transition-colors" title="Admin: Delete this entry"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="border-r text-xs md:text-sm"><span className="font-medium">{item.name}</span></TableCell>
                <TableCell className="border-r text-xs md:text-sm text-center">{item.quantity} {item.unit || ""}</TableCell>
                <TableCell className="border-r text-xs md:text-sm text-right">{item.price ? `₹${item.price.toLocaleString()}` : <span className="text-gray-400">-</span>}</TableCell>
                <TableCell rowSpan={rowCount} className="border-r border-b text-xs md:text-sm text-right align-top">
                  {entry.total ? <span className="font-bold text-red-600">+₹{entry.total.toLocaleString()}</span> : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell rowSpan={rowCount} className="border-r border-b text-xs md:text-sm text-center align-top">
                  {entry.paymentMode && entry.paymentMode !== '-' ? (entry.isPartial ? <Badge variant="outline">{entry.paymentMode}</Badge> : <Badge variant="default">{entry.paymentMode}</Badge>) : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell rowSpan={rowCount} className="border-r border-b text-xs md:text-sm text-right align-top">
                  {entry.paid ? <span className="font-bold text-green-600">₹{entry.paid.toLocaleString()}</span> : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell rowSpan={rowCount} className="border-r border-b text-xs md:text-sm text-right align-top">
                  {entry.due ? <span className="font-bold text-blue-600">₹{entry.due.toLocaleString()}</span> : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell rowSpan={rowCount} className="border-b text-xs md:text-sm text-right align-top">
                  <div className={`font-bold ${entry.runningBalance > 0 ? "text-red-600" : entry.runningBalance < 0 ? "text-green-600" : "text-gray-600"}`}>
                    ₹{Math.abs(entry.runningBalance).toLocaleString()}
                    <div className="text-xs text-gray-500">
                      {entry.runningBalance > 0 && t("Due", "बकाया")}
                      {entry.runningBalance < 0 && t("Advance", "अग्रिम")}
                      {entry.runningBalance === 0 && t("Clear", "साफ")}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          } else {
            return (
              <TableRow key={`ledger-entry-${entry.id}-${index}-${idx}`} className="hover:bg-gray-50 transition-colors">
                <TableCell className="border-r text-xs md:text-sm"><span className="font-medium">{item.name}</span></TableCell>
                <TableCell className="border-r text-xs md:text-sm text-center">{item.quantity} {item.unit || ""}</TableCell>
                <TableCell className="border-r text-xs md:text-sm text-right">{item.price ? `₹${item.price.toLocaleString()}` : <span className="text-gray-400">-</span>}</TableCell>
              </TableRow>
            );
          }
        })}
      </React.Fragment>
    );
  }

  // State for dropdown visibility
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      {/* Mobile Navigation */}


      {/* Main Content with Bottom Padding for Mobile Nav */}
      <div className="p-4 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-20 md:pb-4">
        {/* Customer Selection & Balance - Mobile Optimized */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Customer Selection */}
          <Card className="md:col-span-2 shadow-lg border-0 bg-white">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                {t("Select Customer", "ग्राहक चुनें")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Customer Search & Selection (Amazon-like) */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
                      <Input
                        placeholder={t("Search customers by name or phone...", "नाम या फोन से ग्राहक खोजें...")}
                        value={customerSearchTerm}
                        onFocus={() => setIsDropdownOpen(true)}
                        onBlur={() => {
                          // Delay closing to allow click event to fire
                          setTimeout(() => setIsDropdownOpen(false), 200);
                        }}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        className="pl-10 h-12 text-base rounded-xl border-2 border-indigo-100 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                      />
                      {loading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        </div>
                      )}
                    </div>

                    {/* Dropdown Results - Show when searching or typing */}
                    {(isDropdownOpen && (customerSearchTerm.length > 0 || customers.length > 0)) && (
                      <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto">
                        {customers.length === 0 && !loading ? (
                          <div className="p-4 text-center text-gray-500">
                            {t("No customers found", "कोई ग्राहक नहीं मिला")}
                          </div>
                        ) : (
                          <div className="py-2">
                            {customers.map((customer) => (
                              <div
                                key={customer.id}
                                className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 border-gray-50 transition-colors ${selectedCustomer === customer.id ? 'bg-indigo-50' : ''}`}
                                onClick={() => {
                                  setSelectedCustomer(customer.id);
                                  setCustomerSearchTerm(customer.name);
                                  setIsDropdownOpen(false);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5 text-indigo-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900 truncate">{customer.name}</div>
                                    <div className="text-sm text-gray-500 truncate">{customer.phone}</div>
                                    {customer.stats && (
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        {customer.stats.totalTransactions} {t("transactions", "लेनदेन")}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <Badge
                                      variant={customer.isActive ? "default" : "secondary"}
                                      className={`text-xs ${customer.isActive
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : "bg-red-100 text-red-800 border-red-200"
                                        }`}
                                    >
                                      {customer.isActive ? t("Active", "सक्रिय") : t("Inactive", "निष्क्रिय")}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setIsAddCustomerOpen(true)}
                    className="h-12 w-12 flex-shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md"
                    size="icon"
                    title={t("Add New Customer", "नया ग्राहक जोड़ें")}
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
                </div>

                {selectedCustomerData && (
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-600" />
                        <span className="font-medium text-indigo-800 text-sm">{selectedCustomerData.name}</span>
                        {(userRole === 'SUPER_DUPER_ADMIN' || userRole === 'SUPER_ADMIN') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100"
                            onClick={handleEditClick}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Badge
                        variant={isCustomerActive ? "default" : "secondary"}
                        className={`text-xs ${isCustomerActive
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                          }`}
                      >
                        {isCustomerActive ? t("Open", "खुला खाता") : t("Closed Account", "बंद खाता")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-indigo-600 mb-1">
                      <Phone className="h-3 w-3" />
                      <span>{selectedCustomerData.phone}</span>
                    </div>
                    {selectedCustomerData.address && (
                      <div className="flex items-center gap-2 text-xs text-indigo-600 mb-3">
                        <MapPin className="h-3 w-3" />
                        <span>{selectedCustomerData.address}</span>
                      </div>
                    )}

                    {/* Account Status Toggle */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="account-status" className="text-xs text-indigo-700">
                        {t("Account Status", "खाता स्थिति")}
                      </Label>
                      <Switch
                        id="account-status"
                        checked={isCustomerActive}
                        onCheckedChange={handleToggleAccountStatus}
                        className="data-[state=checked]:bg-indigo-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current Balance */}
          <Card
            className={`shadow-lg border-0 ${currentBalance > 0
              ? "bg-red-50 border-red-200"
              : currentBalance < 0
                ? "bg-green-50 border-green-200"
                : "bg-gray-50"
              }`}
          >
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <IndianRupee className="h-4 w-4" />
                {t("Current Balance", "कुल बकाया")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-center">
                <div
                  className={`text-2xl md:text-4xl font-bold mb-2 ${currentBalance > 0 ? "text-red-600" : currentBalance < 0 ? "text-green-600" : "text-gray-600"
                    }`}
                >
                  ₹{Math.abs(currentBalance).toLocaleString()}
                </div>
                <div className="text-xs">
                  {currentBalance > 0 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">
                      {t("Customer Owes", "ग्राहक का बकाया")}
                    </Badge>
                  )}
                  {currentBalance < 0 && (
                    <Badge className="bg-green-100 text-green-800 text-xs">{t("Advance Balance", "अग्रिम राशि")}</Badge>
                  )}
                  {currentBalance === 0 && (
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs">
                      {t("No Balance", "कोई बकाया नहीं")}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Ledger Section - Mobile Optimized */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                📖 <ShoppingBag className="h-5 w-5" />
                {t("Customer Ledger", "ग्राहक खाता")}
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {t("Filters", "फिल्टर")}
                </Button>
                <Button
                  onClick={handleOpenAddEntry}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-none"
                  disabled={!selectedCustomer}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add Entry", "एंट्री जोड़ें")}
                </Button>
                {isAdmin && (
                  <Button
                    onClick={() => {
                      setReturnItems([]);
                      setReturnCreditAmount("");
                      setReturnNotes("");
                      setReturnDate(new Date().toISOString().split('T')[0]);
                      setIsReturnModalOpen(true);
                    }}
                    className="bg-red-600 border-red-500 hover:bg-red-700 text-white flex-1 sm:flex-none"
                    disabled={!selectedCustomer}
                  >
                    ↩️ {t("Return Items", "सामान वापसी")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filters Section */}
            {showFilters && (
              <div className="p-4 border-b bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder={t("Search entries...", "एंट्री खोजें...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10"
                  />
                  <Input
                    type="date"
                    placeholder={t("From date", "प्रारंभ तिथि")}
                    value={dateFilter.from}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, from: e.target.value }))}
                    className="h-10"
                  />
                  <Input
                    type="date"
                    placeholder={t("To date", "अंतिम तिथि")}
                    value={dateFilter.to}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, to: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 mx-2 my-3 rounded-xl" style={{ width: 'calc(100% - 16px)' }}>
                <TabsTrigger value="ledger" className="text-xs md:text-sm py-2 rounded-lg min-w-0 px-1">
                  <span className="flex items-center gap-0.5 truncate">
                    <span>📋</span>
                    <span className="ml-0.5">{t("All", "सभी")}</span>
                    <span className="ml-0.5">({allEntries.length})</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="purchase" className="text-xs md:text-sm py-2 rounded-lg min-w-0 px-1">
                  <span className="flex items-center gap-0.5 truncate">
                    <span>🛒</span>
                    <span className="hidden sm:inline ml-1">{t("Purchase", "खरीदारी")}</span>
                    <span className="sm:hidden ml-0.5 truncate max-w-[50px]">{t("Buy", "खरीद")}</span>
                    <span className="ml-0.5">({purchaseEntries.length})</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="payment" className="text-xs md:text-sm py-2 rounded-lg min-w-0 px-1">
                  <span className="flex items-center gap-0.5 truncate">
                    <span>💰</span>
                    <span className="hidden sm:inline ml-1">{t("Payment", "भुगतान")}</span>
                    <span className="sm:hidden ml-0.5 truncate max-w-[50px]">{t("Pay", "भुगतान")}</span>
                    <span className="ml-0.5">({paymentEntries.length})</span>
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* All Entries Tab */}
              <TabsContent value="ledger" className="p-4 space-y-4">
                {ledgerLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="ml-2">{t("Loading ledger entries...", "खाता एंट्री लोड हो रही हैं...")}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="border border-gray-200 rounded-lg">
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Date", "दिनांक")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Items", "माल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Qty", "मात्रा")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Price", "कीमत")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Total", "कुल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Payment Mode", "भुगतान प्रकार")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Paid", "भुगतान")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Due", "बकाया")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 text-right">{t("Balance", "बैलेंस")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allEntries.length > 0 ? allEntries.map(renderLedgerRow) : (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              <div className="text-4xl mb-4">📖</div>
                              <p className="text-base md:text-lg">{t("No entries found", "कोई एंट्री नहीं मिली")}</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Purchase Entries Tab */}
              <TabsContent value="purchase" className="p-4 space-y-4">
                {ledgerLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="ml-2">{t("Loading purchase entries...", "खरीदारी एंट्री लोड हो रही हैं...")}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="border border-gray-200 rounded-lg">
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Date", "दिनांक")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Items", "माल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Qty", "मात्रा")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Price", "कीमत")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Total", "कुल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Payment Mode", "भुगतान प्रकार")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Paid", "भुगतान")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Due", "बकाया")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 text-right">{t("Balance", "बैलेंस")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseEntries.length > 0 ? purchaseEntries.map(renderLedgerRow) : (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              <div className="text-4xl mb-4">🛒</div>
                              <p className="text-base md:text-lg">{t("No purchase entries found", "कोई खरीदारी एंट्री नहीं मिली")}</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Payment Entries Tab */}
              <TabsContent value="payment" className="p-4 space-y-4">
                {ledgerLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="ml-2">{t("Loading payment entries...", "भुगतान एंट्री लोड हो रही हैं...")}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="border border-gray-200 rounded-lg">
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Date", "दिनांक")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r">{t("Items", "माल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Qty", "मात्रा")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Price", "कीमत")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Total", "कुल")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-center">{t("Payment Mode", "भुगतान प्रकार")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Paid", "भुगतान")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 border-r text-right">{t("Due", "बकाया")}</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-gray-700 text-right">{t("Balance", "बैलेंस")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentEntries.length > 0 ? paymentEntries.map(renderLedgerRow) : (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              <div className="text-4xl mb-4">💰</div>
                              <p className="text-base md:text-lg">{t("No payment entries found", "कोई भुगतान एंट्री नहीं मिली")}</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Return Items Dialog */}
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
          <DialogContent className="w-[95vw] md:max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl bg-white shadow-2xl">
            {/* Hidden title for screen-reader accessibility (Radix requirement) */}
            <DialogHeader className="sr-only">
              <DialogTitle>{t("Return Items & Restock", "सामान वापसी और रीस्टॉक")}</DialogTitle>
            </DialogHeader>
            {/* Visible gradient header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-5 rounded-t-2xl">
              <div className="flex items-center gap-2 text-xl font-bold">
                ↩️ {t("Return Items & Restock", "सामान वापसी और रीस्टॉक")}
              </div>
              <p className="text-red-100 text-sm mt-1">
                {t("Select products by category, set qty — items will be restocked in inventory.", "श्रेणी से उत्पाद चुनें, मात्रा सेट करें — इन्वेंट्री में वापस स्टॉक होगा।")}
              </p>
              <div className="mt-2 bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-2">
                👤 {selectedCustomerData?.name}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Product Picker Panel */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{t("Add Product to Return", "वापसी के लिए उत्पाद जोड़ें")}</p>
                  {/* Regular / TMT toggle — same as Cash Sale */}
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                    <span className={`text-xs font-medium ${returnProductType === 'regular' ? 'text-blue-600' : 'text-gray-400'}`}>
                      {t("Regular", "सामान्य")}
                    </span>
                    <Switch
                      checked={returnProductType === 'tmt'}
                      onCheckedChange={(checked) => {
                        setReturnProductType(checked ? 'tmt' : 'regular');
                        setReturnSelectedProduct(null);
                        setReturnQty("");
                        setReturnConvCft("");
                        setReturnCategoryFilter("all");
                      }}
                    />
                    <span className={`text-xs font-medium ${returnProductType === 'tmt' ? 'text-blue-600' : 'text-gray-400'}`}>
                      {t("TMT Bar", "TMT बार")}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {returnProductType === 'regular' ? (
                    <>
                  {/* Row 1: Category + Product search */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("Category (श्रेणी)", "श्रेणी")}</Label>
                      <Select value={returnCategoryFilter} onValueChange={(v) => { setReturnCategoryFilter(v); setReturnSelectedProduct(null); setReturnQty(""); setReturnConvCft(""); }}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder={t("All Categories", "सभी श्रेणियां")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Categories (सभी श्रेणियां)", "सभी श्रेणियां")}</SelectItem>
                          {availableCategories.map((cat: any) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("Product (उत्पाद)", "उत्पाद")}</Label>
                      <Select
                        value={returnSelectedProduct ? returnSelectedProduct.id.toString() : ""}
                        onValueChange={(val) => {
                          const prod = availableProducts.find(p => p.id.toString() === val);
                          setReturnSelectedProduct(prod || null);
                          const catName = prod?.category?.name?.toLowerCase() || '';
                          const isBulk = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');
                          setReturnConvCft(isBulk ? (prod?.latestConversionCft?.toString() || "1") : "");
                          setReturnQty("");
                        }}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder={t("Select product (उत्पाद चुनें)", "उत्पाद चुनें")} />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 pb-2 pt-1">
                            <Input
                              placeholder={t("Search product...", "उत्पाद खोजें...")}
                              value={returnProductSearch}
                              onChange={e => setReturnProductSearch(e.target.value)}
                              className="h-8 text-sm"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          {availableProducts
                            .filter(p =>
                              (returnCategoryFilter === 'all' || p.category?.name === returnCategoryFilter) &&
                              (returnProductSearch === '' || p.name.toLowerCase().includes(returnProductSearch.toLowerCase()))
                            )
                            .map(p => (
                              <SelectItem key={p.id.toString()} value={p.id.toString()}>
                                <span className="font-medium">{p.name}</span>
                                <span className="text-gray-400 text-xs ml-1">({p.unit})</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                    </>
                  ) : (
                    /* TMT Product picker */
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("TMT Product (TMT उत्पाद)", "TMT उत्पाद")}</Label>
                        <Select
                          value={returnSelectedProduct ? returnSelectedProduct.id.toString() : ""}
                          onValueChange={(val) => {
                            const prod = returnTmtProducts.find(p => p.id.toString() === val);
                            setReturnSelectedProduct(prod ? { ...prod, _isTmt: true, _selectedUnit: 'piece' } : null);
                            setReturnQty("");
                          }}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder={t("Select TMT product", "TMT उत्पाद चुनें")} />
                          </SelectTrigger>
                          <SelectContent>
                            {returnTmtProducts.map(p => (
                              <SelectItem key={p.id.toString()} value={p.id.toString()}>
                                <span className="font-medium">{p.productName}</span>
                                <span className="text-gray-400 text-xs ml-1">{p.company?.name} {p.size?.sizeMm}mm</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("TMT Unit", "TMT इकाई")}</Label>
                        <select
                          value={returnSelectedProduct?._selectedUnit || 'piece'}
                          onChange={e => setReturnSelectedProduct((prev: any) => prev ? { ...prev, _selectedUnit: e.target.value } : prev)}
                          disabled={!returnSelectedProduct}
                          className="h-10 text-sm rounded-lg w-full border border-gray-300 px-2 disabled:opacity-50"
                        >
                          <option value="piece">{t("Piece (पीस)", "पीस")}</option>
                          <option value="bundle">{t("Bundle (बंडल)", "बंडल")}</option>
                          <option value="kg">Kg</option>
                          <option value="ton">{t("Ton (टन)", "टन")}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Row 2: Qty + CFT + Add button */}
                  {returnSelectedProduct && (
                    <div className="flex items-end gap-3">
                      {/* Unit selector — regular only (TMT unit is already picked above) */}
                      {!returnSelectedProduct._isTmt && (() => {
                        const catName = returnSelectedProduct?.category?.name || '';
                        const unitOptions = getAvailableUnits(catName);
                        const isCement = catName.toLowerCase() === 'cement';
                        return (
                          <div className="flex-1">
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("Unit (इकाई)", "इकाई")}</Label>
                            {isCement ? (
                              <Input value="bag" readOnly className="h-10 text-sm bg-gray-100 cursor-not-allowed" />
                            ) : (
                              <select
                                value={returnSelectedProduct?._selectedUnit || ''}
                                onChange={e => {
                                  setReturnSelectedProduct((prev: any) => ({ ...prev, _selectedUnit: e.target.value }));
                                  const vehicleUnits = ['tempo','chota_haathi','tractor','407','small_hiwa','big_hiwa','highwa'];
                                  const isBulkCat = catName.toLowerCase().includes('sand') || catName.toLowerCase().includes('chips') || catName.toLowerCase().includes('aggregate');
                                  if (vehicleUnits.includes(e.target.value) && isBulkCat) {
                                    setReturnConvCft(returnSelectedProduct?.latestConversionCft?.toString() || '');
                                  } else {
                                    setReturnConvCft('');
                                  }
                                }}
                                className="h-10 text-sm rounded-lg w-full border border-gray-300 px-2"
                              >
                                <option value="">{t('Select unit', 'इकाई चुनें')}</option>
                                {unitOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })()}
                      {/* Quantity */}
                      <div className="flex-1">
                        <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                          {t("Quantity (मात्रा)", "मात्रा")}
                          {returnSelectedProduct._isTmt && returnSelectedProduct._selectedUnit && (
                            <span className="text-gray-400 ml-1">({returnSelectedProduct._selectedUnit})</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          placeholder={t("e.g. 10", "उदा. 10")}
                          value={returnQty}
                          onChange={e => setReturnQty(e.target.value)}
                          className="h-10 text-sm"
                          min="0.01"
                          step="any"
                        />
                      </div>
                      {/* CFT factor — only for vehicle units on bulk regular categories */}
                      {!returnSelectedProduct._isTmt && (() => {
                        const catName = returnSelectedProduct?.category?.name?.toLowerCase() || '';
                        const selectedUnit = returnSelectedProduct?._selectedUnit || '';
                        const vehicleUnits = ['tempo','chota_haathi','tractor','407','small_hiwa','big_hiwa','highwa'];
                        const isBulkCat = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');
                        return (vehicleUnits.includes(selectedUnit) && isBulkCat) ? (
                          <div className="flex-1">
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">{t("Conv. CFT", "CFT रूपांतरण")}</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 100"
                              value={returnConvCft}
                              onChange={e => setReturnConvCft(e.target.value)}
                              className="h-10 text-sm"
                              min="0.01"
                              step="any"
                            />
                          </div>
                        ) : null;
                      })()}
                      <Button
                        onClick={() => {
                          if (!returnSelectedProduct) return;
                          const isTmt = !!returnSelectedProduct._isTmt;
                          const selectedUnit = returnSelectedProduct._selectedUnit || (isTmt ? 'piece' : '');
                          if (!isTmt && !selectedUnit) {
                            toast.error(t("Please select a unit", "कृपया इकाई चुनें"));
                            return;
                          }
                          if (!returnQty || parseFloat(returnQty) <= 0) {
                            toast.error(t("Please enter a valid quantity", "कृपया वैध मात्रा दर्ज करें"));
                            return;
                          }
                          if (returnItems.some(item => item.productId === returnSelectedProduct.id.toString() && !!item.isTmt === isTmt)) {
                            toast.error(t("Product already in return list", "उत्पाद पहले से सूची में है"));
                            return;
                          }
                          const catName = returnSelectedProduct?.category?.name?.toLowerCase() || '';
                          const isBulk = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');
                          const vehicleUnits = ['tempo','chota_haathi','tractor','407','small_hiwa','big_hiwa','highwa'];
                          const needsCft = !isTmt && vehicleUnits.includes(selectedUnit) && isBulk;
                          setReturnItems(prev => [
                            ...prev,
                            {
                              productId: returnSelectedProduct.id.toString(),
                              name: isTmt ? returnSelectedProduct.productName : returnSelectedProduct.name,
                              quantity: returnQty,
                              conversionCft: needsCft ? (returnConvCft || "1") : "1",
                              unit: selectedUnit,
                              categoryName: isTmt ? 'TMT Bar' : (returnSelectedProduct.category?.name || ''),
                              isTrueBulkCft: needsCft,
                              isTmt
                            }
                          ]);
                          setReturnSelectedProduct(null);
                          setReturnQty("");
                          setReturnConvCft("");
                          setReturnProductSearch("");
                        }}
                        className="h-10 px-4 bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap self-end"
                      >
                        <Plus className="h-4 w-4 mr-1" />{t("Add", "जोड़ें")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Cart */}
              {returnItems.length > 0 && (
                <div className="border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 flex items-center justify-between">
                    <p className="text-sm font-semibold text-orange-700">📦 {t("Items to Return & Restock", "वापसी की सूची")} ({returnItems.length})</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {returnItems.map((item, idx) => {
                      const vehicleUnits = ['tempo','chota_haathi','tractor','407','small_hiwa','big_hiwa','highwa'];
                      const showCft = item.isTrueBulkCft && vehicleUnits.includes(item.unit);
                      const unitOptions = item.isTmt
                        ? [
                            { value: 'piece', label: t('Piece (पीस)', 'पीस') },
                            { value: 'bundle', label: t('Bundle (बंडल)', 'बंडल') },
                            { value: 'kg', label: 'Kg' },
                            { value: 'ton', label: t('Ton (टन)', 'टन') }
                          ]
                        : getAvailableUnits(item.categoryName || '');
                      return (
                        <div key={item.productId} className="flex flex-col gap-2 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                                {item.isTmt && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">TMT</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">{item.categoryName}</div>
                            </div>
                            <button
                              onClick={() => setReturnItems(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            {/* Unit selector */}
                            <div>
                              <Label className="text-xs text-gray-400">{t("Unit", "इकाई")}</Label>
                              <select
                                value={item.unit}
                                onChange={e => {
                                  const newUnit = e.target.value;
                                  const needsCft = !item.isTmt && vehicleUnits.includes(newUnit) && (item.categoryName?.toLowerCase().includes('sand') || item.categoryName?.toLowerCase().includes('chips') || item.categoryName?.toLowerCase().includes('aggregate'));
                                  setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: newUnit, isTrueBulkCft: needsCft } : it));
                                }}
                                className="h-8 text-sm rounded border border-gray-300 px-1 min-w-[90px]"
                              >
                                {unitOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            {/* Quantity */}
                            <div>
                              <Label className="text-xs text-gray-400">{t("Qty", "मात्रा")}</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={e => setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                                className="h-8 w-20 text-sm"
                                min="0.01" step="any"
                              />
                            </div>
                            {/* CFT only for vehicle units on bulk sand/chips (regular items only) */}
                            {showCft && (
                              <div>
                                <Label className="text-xs text-gray-400">CFT/unit</Label>
                                <Input
                                  type="number"
                                  value={item.conversionCft}
                                  onChange={e => setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, conversionCft: e.target.value } : it))}
                                  className="h-8 w-20 text-sm"
                                  min="0.01" step="any"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Credit & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">💰 {t("Refund / Credit Amount (₹)", "रिफंड / क्रेडिट राशि (₹)")}</Label>
                  <Input
                    type="number"
                    value={returnCreditAmount}
                    onChange={e => setReturnCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">📅 {t("Return Date", "वापसी तिथि")}</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">📝 {t("Reason / Notes", "कारण / टिप्पणी")}</Label>
                <Textarea
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder={t("e.g. Return due to wrong order...", "उदा: गलत ऑर्डर के कारण वापसी...")}
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-3 border-t">
                <div className="text-xs text-gray-500">
                  {returnItems.length > 0 ? (
                    <span className="text-orange-600 font-semibold">✅ {returnItems.length} {t("item(s) ready to restock", "उत्पाद रीस्टॉक के लिए तैयार")}</span>
                  ) : (
                    <span>{t("No items added yet", "कोई उत्पाद नहीं जोड़ा गया")}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsReturnModalOpen(false)} disabled={isSubmittingReturn}>
                    {t("Cancel", "रद्द करें")}
                  </Button>
                  <Button
                    onClick={handleReturnSubmit}
                    disabled={isSubmittingReturn || returnItems.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isSubmittingReturn ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("Submitting...", "सबमिट हो रहा है...")}</>
                    ) : (
                      <>↩️ {t("Submit Return", "वापसी दर्ज करें")}</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Entry Dialog */}
        <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
          <DialogContent className="w-[95vw] md:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>{t("Add Ledger Entry", "खाता एंट्री जोड़ें")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("Type", "प्रकार")}</Label>
                <Select
                  value={newEntry.type}
                  onValueChange={(value: "debit" | "credit" | "old_balance_due" | "old_balance_adv") => {
                    let newMethod = newEntry.method;
                    if (value === 'old_balance_due') {
                      newMethod = 'LOAN';
                    } else if (value === 'old_balance_adv') {
                      newMethod = 'OTHER';
                    } else if (newMethod === 'LOAN' || newMethod === 'OTHER') {
                      // Reset if switching back to normal purchase/payment
                      newMethod = 'CASH';
                    }

                    setNewEntry({
                      ...newEntry,
                      type: value,
                      method: newMethod,
                      // Clear amounts/items when switching types to avoid confusion
                      amount: "",
                      itemName: "",
                      quantity: "1",
                      unitPrice: ""
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">{t("Purchase", "खरीदारी")}</SelectItem>
                    <SelectItem value="credit">{t("Payment", "भुगतान")}</SelectItem>
                    <SelectItem value="old_balance_due">{t("Old Balance (Due)", "पिछला बकाया")}</SelectItem>
                    <SelectItem value="old_balance_adv">{t("Old Balance (Advance)", "पिछला जमा/एडवांस")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newEntry.type === 'debit' ? (
                <div className="space-y-4 p-4 border rounded-md bg-gray-50 flex flex-col">
                  <h4 className="font-medium text-sm text-gray-700 flex-shrink-0">{t("Item Details", "सामान विवरण")}</h4>

                  {newEntry.items.length > 0 && (
                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
                      {newEntry.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-white p-2 border rounded-md text-sm shadow-sm">
                          <div>
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-gray-500 ml-2">({item.quantity} × ₹{item.price})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-indigo-700">₹{item.quantity * item.price}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-700 p-0 rounded-full">
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex-shrink-0">
                    <Label>{t("Item Name", "सामान का नाम")}</Label>
                    <Input
                      value={newEntry.itemName}
                      onChange={(e) => setNewEntry({ ...newEntry, itemName: e.target.value })}
                      placeholder={t("e.g. Cement 50kg", "उदा. सीमेंट 50kg")}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                    <div>
                      <Label>{t("Quantity", "मात्रा")}</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newEntry.quantity}
                        onChange={(e) => {
                          const quantity = e.target.value;
                          const currentTotal = Number(quantity) * Number(newEntry.unitPrice || 0);
                          const itemsTotal = newEntry.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                          const amount = (itemsTotal + currentTotal).toString();
                          setNewEntry({ ...newEntry, quantity, amount: amount === '0' ? '' : amount });
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("Unit Price", "इकाई कीमत")}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newEntry.unitPrice}
                        onChange={(e) => {
                          const unitPrice = e.target.value;
                          const currentTotal = Number(newEntry.quantity || 0) * Number(unitPrice);
                          const itemsTotal = newEntry.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                          const amount = (itemsTotal + currentTotal).toString();
                          setNewEntry({ ...newEntry, unitPrice, amount: amount === '0' ? '' : amount });
                        }}
                        placeholder="₹"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="w-full mt-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex-shrink-0 flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("Add Another Item", "एक और सामान जोड़ें")}
                  </Button>
                </div>
              ) : null}

              <div>
                <Label>{t("Amount", "राशि")}</Label>
                <Input
                  type="number"
                  value={newEntry.amount}
                  readOnly={newEntry.type === 'debit'}
                  className={newEntry.type === 'debit' ? 'bg-gray-100 cursor-not-allowed' : ''}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  placeholder={newEntry.type === 'debit' ? t("Auto-calculated", "स्वतः गणना") : t("Enter amount", "राशि दर्ज करें")}
                />
              </div>
              <div>
                <Label>{t("Method", "तरीका")}</Label>
                <Select
                  value={newEntry.method}
                  disabled={newEntry.type === 'old_balance_due' || newEntry.type === 'old_balance_adv'}
                  onValueChange={(value) => setNewEntry({ ...newEntry, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">{t("Cash", "नकद")}</SelectItem>
                    <SelectItem value="CARD">{t("Card", "कार्ड")}</SelectItem>
                    <SelectItem value="UPI">{t("UPI", "यूपीआई")}</SelectItem>
                    <SelectItem value="BANK_TRANSFER">{t("Bank Transfer", "बैंक ट्रांसफर")}</SelectItem>
                    <SelectItem value="CHEQUE">{t("Cheque", "चेक")}</SelectItem>
                    <SelectItem value="LOAN">{t("Loan", "उधार")}</SelectItem>
                    <SelectItem value="OTHER">{t("Other", "अन्य")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Date", "दिनांक")}</Label>
                <Input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  disabled={userRole !== 'SUPER_DUPER_ADMIN'}
                  className={userRole !== 'SUPER_DUPER_ADMIN' ? 'bg-gray-100 cursor-not-allowed' : ''}
                />
              </div>
              <div>
                <Label>{t("Description", "विवरण")}</Label>
                <Textarea
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder={t("Optional description", "वैकल्पिक विवरण")}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddEntry} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("Adding...", "जोड़ रहा है...")}
                    </span>
                  ) : (
                    t("Add Entry", "एंट्री जोड़ें")
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsAddEntryOpen(false)} disabled={isSubmitting}>
                  {t("Cancel", "रद्द करें")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Edit Customer Details", "ग्राहक विवरण संपादित करें")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("Name", "नाम")}</Label>
                <Input
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t("Customer Name", "ग्राहक का नाम")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Phone", "फ़ोन")}</Label>
                <Input
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t("Phone Number", "फ़ोन नंबर")}
                  disabled={userRole === 'SUPER_ADMIN'}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Address", "पता")}</Label>
                <Textarea
                  value={editingCustomer.address}
                  onChange={(e) => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t("Address", "पता")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditCustomerOpen(false)}>
                {t("Cancel", "रद्द करें")}
              </Button>
              <Button onClick={handleUpdateCustomer}>
                {t("Save Changes", "परिवर्तन सहेजें")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
          <DialogContent className="w-[95vw] md:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>{t("Add New Customer", "नया ग्राहक जोड़ें")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("Name", "नाम")} <span className="text-red-500">*</span></Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t("Customer Name", "ग्राहक का नाम")}
                  maxLength={50}
                  required
                />
                <p className="text-[10px] text-gray-500 text-right">{newCustomer.name.length}/50</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Phone", "फ़ोन")} <span className="text-red-500">*</span></Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setNewCustomer(prev => ({ ...prev, phone: val }));
                  }}
                  placeholder={t("10-digit Phone Number", "10-अंकीय फ़ोन नंबर")}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  required
                />
                <p className="text-[10px] text-gray-500 text-right">{newCustomer.phone.length}/10</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Address", "पता")} <span className="text-red-500">*</span></Label>
                <Textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t("Address", "पता")}
                  maxLength={150}
                  required
                />
                <p className="text-[10px] text-gray-500 text-right">{newCustomer.address.length}/150</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddCustomerOpen(false)} disabled={isSubmittingCustomer}>
                {t("Cancel", "रद्द करें")}
              </Button>
              <Button onClick={handleAddCustomer} disabled={isSubmittingCustomer}>
                {isSubmittingCustomer ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("Saving...", "सहेज रहा है...")}
                  </span>
                ) : (
                  t("Save Customer", "ग्राहक सहेजें")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── SUPER_DUPER_ADMIN Modals ── */}
        {isAdmin && (
          <>
            <AdminEditModal
              open={!!adminEditEntry}
              title="Edit Ledger Entry"
              fields={adminEditEntry ? [
                { key: 'date', label: 'Date', type: 'date', value: adminEditEntry.date },
                { key: 'amount', label: 'Amount (₹)', type: 'number', value: adminEditEntry.total || adminEditEntry.paid, min: 0, step: 0.01 },
                { key: 'description', label: 'Description', type: 'textarea', value: adminEditEntry.description || adminEditEntry.items?.map(i => i.name).join(', ') || '' },
                { key: 'method', label: 'Payment Method', type: 'select', value: (adminEditEntry.paymentMode?.toUpperCase() === 'LOAN/CREDIT' || adminEditEntry.paymentMode?.toUpperCase() === 'LOAN') ? 'LOAN' : adminEditEntry.paymentMode?.toUpperCase() || 'CASH', options: [
                  { value: 'CASH', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                  { value: 'CHEQUE', label: 'Cheque' },
                  { value: 'LOAN', label: 'Loan' },
                  { value: 'OTHER', label: 'Other' },
                ]},
              ] : []}
              onSave={handleAdminLedgerEdit}
              onClose={() => setAdminEditEntry(null)}
            />
            <AdminDeleteConfirm
              open={!!adminDeleteEntry}
              title="Delete Ledger Entry"
              description={adminDeleteEntry
                ? `${adminDeleteEntry.type === 'credit' ? 'Payment' : 'Purchase'} of ₹${(adminDeleteEntry.total || adminDeleteEntry.paid || 0).toLocaleString('en-IN')} on ${adminDeleteEntry.date ? new Date(adminDeleteEntry.date).toLocaleDateString('en-IN') : '-'}`
                : ''}
              onConfirm={handleAdminLedgerDelete}
              onClose={() => setAdminDeleteEntry(null)}
            />
          </>
        )}
      </div>
    </div>
  )
}
