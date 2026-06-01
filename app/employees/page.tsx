"use client"

import { useAuthGuard } from "@/app/hooks/use-auth-guard"
import { AuthLoadingScreen, SessionExpiredScreen } from "@/app/components/auth-guard-screens"

import { useState, useEffect, useRef } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useLanguage } from "@/hooks/use-language"

import {
  Plus,
  Edit,
  Trash2,
  Phone,
  MapPin,
  UserPlus,
  Search,
  Eye,
  Users,
  IndianRupee,
  Clock,
  CheckCircle,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { useShop } from "../contexts/ShopContext"

// Remove mock employees data - will be fetched from API
// const initialEmployees: Employee[] = [...]

const roles = [
  { value: "Store Manager", label: "Store Manager", labelHi: "स्टोर मैनेजर" },
  { value: "Sales Assistant", label: "Sales Assistant", labelHi: "सेल्स असिस्टेंट" },
  { value: "Helper", label: "Helper", labelHi: "सहायक" },
  { value: "Driver", label: "Driver", labelHi: "ड्राइवर" },
  { value: "Loader", label: "Loader", labelHi: "लोडर" },
  { value: "Supervisor", label: "Supervisor", labelHi: "सुपरवाइजर" },
  { value: "Accountant", label: "Accountant", labelHi: "लेखाकार" },
]

type PaymentRecord = {
  id: number
  amount: number
  paymentDate: string
  paymentMethod: string
  notes?: string
}

type AttendanceRecord = {
  id: number
  date: string
  status: "present" | "absent" | "half_day"
  notes?: string
}

type WeeklySalary = {
  weekKey: string
  week: string
  hours: number
  amount: number
  status: "paid" | "unpaid"
  startDate: string
  endDate: string
}

type SalaryType = "hourly" | "daily" | "weekly" | "monthly";

type Employee = {
  id: number
  name: string
  phone: string
  address: string
  roles: string[]
  notes: string
  salaryType: SalaryType
  paymentDayOfWeek?: string
  salaryAmount: number
  salaryPaid: boolean
  hourlyRate: number
  joinDate: string
  totalEarnings: number
  currentWeekHours?: number
  currentWeekSalary?: number
  paymentHistory?: PaymentRecord[]
  attendanceRecords?: AttendanceRecord[]
  weeklySalaries?: WeeklySalary[]
}

const salaryTypeOptions = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Employees() {
  const { authReady, isAuthenticated } = useAuthGuard()
  const { language, toggleLanguage, t } = useLanguage()
  const { currentShop } = useShop()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("list")
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    roles: ["Helper"],
    notes: "",
    salaryType: "hourly" as SalaryType,
    paymentDayOfWeek: "Saturday",
    salaryAmount: 0,
    joinDate: new Date().toISOString().split('T')[0],
  })
  const [editingAttendance, setEditingAttendance] = useState<{ id?: number, date: string, status: string, notes?: string } | null>(null)
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null)
  const isProcessingPaymentRef = useRef(false);

  // Fetch employees from API
  useEffect(() => {
    fetchEmployees()
  }, [currentShop]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone.includes(searchTerm) ||
      employee.roles.some(role => role.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleAddEmployee = async () => {
    if (!formData.name || !formData.salaryAmount) {
      toast.error(t("Please fill all required fields", "कृपया सभी आवश्यक फ़ील्ड भरें"))
      return
    }

    if (!currentShop) {
      toast.error('Please select a shop')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          salary: Number(formData.salaryAmount),
          shopId: currentShop.id,
          positions: formData.roles,
          address: formData.address,
          notes: formData.notes,
          salaryType: formData.salaryType,
          paymentDayOfWeek: formData.salaryType === 'weekly' ? formData.paymentDayOfWeek : null,
          joinDate: formData.joinDate,
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(t("Employee added successfully!", "कर्मचारी सफलतापूर्वक जोड़ा गया!"))
        resetForm()
        setActiveTab("list")
        // Reload employees from API
        await fetchEmployees(true) // Silent refresh
      } else {
        toast.error(data.message || 'Failed to add employee')
      }
    } catch (error) {
      console.error('Error adding employee:', error)
      toast.error('Error adding employee')
    }
  }

  const fetchEmployees = async (silent = false) => {
    if (!currentShop || currentShop.id === 0) return

    try {
      if (!silent) setLoading(true)
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch(`/api/employees?shopId=${currentShop.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.employees) {
          // Convert API employees to the format expected by this component
          const convertedEmployees = data.data.employees.map((employee: any) => ({
            id: employee.id,
            name: employee.name,
            phone: employee.phone || '',
            address: employee.address || '',
            roles: employee.position ? employee.position.split(',') : ['Helper'], // Split joined position string into roles array
            notes: employee.notes || '',
            salaryAmount: employee.salary ? Number(employee.salary) : 0,
            salaryPaid: employee.hasPaidThisMonth || false, // Use hasPaidThisMonth from API
            hourlyRate: employee.salary ? Number(employee.salary) / 160 : 100, // Assuming 160 hours per month
            joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : (employee.createdAt ? new Date(employee.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            salaryType: employee.salaryType || 'monthly',
            paymentDayOfWeek: employee.paymentDayOfWeek || "Saturday",
            totalEarnings: employee.totalPaid || 0, // Use totalPaid from API
            currentWeekHours: employee.currentWeekHours || 0,
            currentWeekSalary: employee.currentWeekSalary || 0,
            paymentHistory: [],
            attendanceRecords: [],
            weeklySalaries: []
          }))
          setEmployees(convertedEmployees)
        } else {
          setEmployees([])
        }
      } else {
        console.error('Failed to load employees:', response.status)
        toast.error('Failed to load employees')
        setEmployees([])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Error loading employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      name: employee.name,
      phone: employee.phone,
      email: '', // Add email if available in employee object or keep as empty if not
      address: employee.address || '',
      roles: employee.roles || ['Helper'],
      notes: employee.notes || '',
      salaryType: employee.salaryType || 'monthly',
      paymentDayOfWeek: employee.paymentDayOfWeek || 'Saturday',
      salaryAmount: Number(employee.salaryAmount),
      joinDate: employee.joinDate || new Date().toISOString().split('T')[0],
    })
    setActiveTab("add")
  }

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          salary: Number(formData.salaryAmount),
          positions: formData.roles,
          address: formData.address,
          notes: formData.notes,
          salaryType: formData.salaryType,
          paymentDayOfWeek: formData.salaryType === 'weekly' ? formData.paymentDayOfWeek : null,
          joinDate: formData.joinDate,
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(t("Employee updated successfully!", "कर्मचारी सफलतापूर्वक अपडेट किया गया!"))
        setEditingEmployee(null)
        resetForm()
        setActiveTab("list")
        await fetchEmployees(true) // Silent refresh
      } else {
        toast.error(data.message || 'Failed to update employee')
      }
    } catch (error) {
      console.error('Error updating employee:', error)
      toast.error('Error updating employee')
    }
  }

  const handleDeleteEmployee = async (id: number) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        toast.success(t("Employee deleted successfully!", "कर्मचारी सफलतापूर्वक हटाया गया!"))
        await fetchEmployees(true) // Silent refresh
      } else {
        toast.error(data.message || 'Failed to delete employee')
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
      toast.error('Error deleting employee')
    }
  }

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", roles: ["Helper"], notes: "", salaryType: "hourly" as SalaryType, paymentDayOfWeek: "Saturday", salaryAmount: 0, joinDate: new Date().toISOString().split('T')[0] })
    setEditingEmployee(null)
  }

  const getRoleBadge = (roles: string[]) => {
    const colors = {
      "Store Manager": "bg-purple-100 text-purple-800 border-purple-200",
      "Sales Assistant": "bg-green-100 text-green-800 border-green-200",
      Helper: "bg-blue-100 text-blue-800 border-blue-200",
      Driver: "bg-yellow-100 text-yellow-800 border-yellow-200",
      Loader: "bg-orange-100 text-orange-800 border-orange-200",
      Supervisor: "bg-red-100 text-red-800 border-red-200",
      Accountant: "bg-indigo-100 text-indigo-800 border-indigo-200",
    }
    return (
      <div className="flex flex-wrap gap-1">
        {roles.map((role) => (
          <Badge key={role} variant="outline" className={colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
            {role}
          </Badge>
        ))}
      </div>
    )
  }

  const getSalaryStatusBadge = (status: string) => {
    if (status === "paid") {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          {t("Paid", "भुगतान किया गया")}
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
        <Clock className="h-3 w-3 mr-1" />
        {t("Unpaid", "भुगतान बाकी")}
      </Badge>
    )
  }

  // Handle viewing detailed employee profile
  const handleViewEmployee = async (employee: Employee) => {
    setViewingEmployee(employee);
    setActiveTab("view");
    
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Fetch full details with payment history
      const res = await fetch(`/api/employees/${employee.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Fetch current month attendance
      const d = new Date();
      const attRes = await fetch(`/api/employee-attendance?employeeId=${employee.id}&month=${d.getMonth()+1}&year=${d.getFullYear()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const attData = await attRes.json();

      // Fetch weekly salaries
      const weekRes = await fetch(`/api/employees/${employee.id}/weekly-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const weekData = await weekRes.json();

      if (data.success && data.data?.employee) {
        setViewingEmployee(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            paymentHistory: data.data.employee.paymentHistory || [],
            attendanceRecords: attData.data?.records || [],
            weeklySalaries: weekData.data?.weeklySalaries || []
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch employee details", error);
    }
  };

  const markAttendance = async (status: "present" | "absent" | "half_day") => {
    if (!viewingEmployee || !currentShop) return;
    try {
      const token = localStorage.getItem('accessToken');
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/employee-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          employeeId: viewingEmployee.id,
          date: today,
          status,
          shopId: currentShop.id
        })
      });
      if (res.ok) {
        toast.success(t(`Marked as ${status}`, `${status} के रूप में चिह्नित`));
        handleViewEmployee(viewingEmployee); // Refresh data
      }
    } catch (error) {
      console.error("Failed to mark attendance", error);
    }
  };

  const handleUpdateAttendance = async () => {
    if (!editingAttendance || !viewingEmployee || !currentShop) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/employee-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          employeeId: viewingEmployee.id,
          date: editingAttendance.date,
          status: editingAttendance.status,
          notes: editingAttendance.notes,
          shopId: currentShop.id
        })
      });
      if (res.ok) {
        toast.success(t(`Attendance updated`, `उपस्थिति अपडेट की गई`));
        setEditingAttendance(null);
        handleViewEmployee(viewingEmployee);
        await fetchEmployees(true);
      }
    } catch (error) {
      console.error("Failed to update attendance", error);
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !viewingEmployee) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/employee-payments/${editingPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          amount: Number(editingPayment.amount),
          paymentDate: editingPayment.paymentDate,
          notes: editingPayment.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t(`Payment updated`, `भुगतान अपडेट किया गया`));
        setEditingPayment(null);
        handleViewEmployee(viewingEmployee);
        await fetchEmployees(true);
      } else {
        toast.error(data.message || 'Failed to update payment');
      }
    } catch (error) {
      console.error("Failed to update payment", error);
    }
  };

  const handlePayNow = async (employeeId: number, amount?: number, notes?: string) => {
    // Prevent duplicate submissions
    if (isProcessingPaymentRef.current) {
      toast.error('Payment is already being processed');
      return;
    }

    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee || !currentShop) {
      toast.error('Employee or shop not found');
      return;
    }

    let finalNotes = notes;
    if (!finalNotes) {
      if (employee.salaryType === 'weekly' || employee.salaryType === 'hourly') {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const weekLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        finalNotes = `Weekly Salary - ${weekLabel}`;
      } else {
        finalNotes = 'Salary payment';
      }
    }

    isProcessingPaymentRef.current = true;
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      console.log('🔍 [Employee Payment] Creating payment for employee:', employeeId, 'shopId:', currentShop.id, 'amount:', employee.salaryAmount);

      const response = await fetch('/api/employee-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeId: employeeId,
          amount: amount || employee.salaryAmount,
          paymentMethod: 'CASH',
          paymentDate: new Date().toISOString().split('T')[0],
          shopId: currentShop.id,
          notes: finalNotes
        })
      });

      const data = await response.json();
      console.log('🔍 [Employee Payment] Payment response:', data);

      if (data.success) {
        toast.success(t("Salary marked as paid!", "वेतन भुगतान के रूप में चिह्नित!"))
        console.log('🔍 [Employee Payment] Refreshing employees list...');
        await fetchEmployees(true); // Silent refresh to avoid blocking UI
        if (viewingEmployee && viewingEmployee.id === employeeId) {
            handleViewEmployee(employees.find(emp => emp.id === employeeId)!);
        }
        console.log('🔍 [Employee Payment] Employees list refreshed');
      } else {
        toast.error(data.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Error recording payment');
    } finally {
      isProcessingPaymentRef.current = false;
    }
  }

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm(t("Are you sure you want to delete this payment?", "क्या आप वाकई इस भुगतान को हटाना चाहते हैं?"))) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/employee-payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        toast.success(t("Payment deleted successfully!", "भुगतान सफलतापूर्वक हटाया गया!"));
        await fetchEmployees(true);
        if (viewingEmployee) {
          handleViewEmployee(employees.find(emp => emp.id === viewingEmployee.id)!);
        }
      } else {
        toast.error(data.message || 'Failed to delete payment');
      }
    } catch (error) {
      console.error('Delete payment error:', error);
      toast.error('Failed to delete payment');
    }
  };

  // Auth guard
  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) return <SessionExpiredScreen />

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Mobile Navigation */}


      {/* Main Content with Bottom Padding for Mobile Nav */}
      <div className="p-4 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-20 md:pb-4">
        {/* Main Content */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex overflow-x-auto w-full bg-gray-100 p-1 rounded-t-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <TabsTrigger value="add" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4">
                📝 {t("Add", "जोड़ें")}
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4">
                📋 {t("List", "सूची")}
              </TabsTrigger>
              <TabsTrigger value="view" className="flex-1 min-w-[fit-content] text-sm md:text-base py-2 md:py-3 rounded-xl whitespace-nowrap px-4" disabled={!viewingEmployee}>
                👁️ {t("View Details", "विवरण देखें")}
              </TabsTrigger>
            </TabsList>

            {/* Add/Edit Employee Tab */}
            <TabsContent value="add" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingEmployee ? t("Edit Employee", "कर्मचारी संपादित करें") : t("Add New Employee", "नया कर्मचारी जोड़ें")}
                </h2>
                {editingEmployee && (
                  <Button variant="outline" onClick={resetForm}>
                    {t("Cancel", "रद्द करें")}
                  </Button>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Name */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">नाम / Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("Enter employee name", "कर्मचारी नाम दर्ज करें")}
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">मोबाइल नंबर / Phone Number</Label>
                  <Input
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
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Email */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">ईमेल / Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="employee@example.com"
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Address */}
                <div className="space-y-3 md:col-span-2">
                  <Label className="text-lg font-medium text-gray-800">पता / Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t("Enter complete address", "पूरा पता दर्ज करें")}
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Join Date */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">ज्वाइनिंग तारीख / Join Date</Label>
                  <Input
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Role */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">भूमिका / Role</Label>
                  <div className="flex flex-wrap gap-3">
                    {roles.map((role) => (
                      <label key={role.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          value={role.value}
                          checked={formData.roles.includes(role.value)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, roles: [...formData.roles, role.value] })
                            } else {
                              setFormData({ ...formData, roles: formData.roles.filter(r => r !== role.value) })
                            }
                          }}
                        />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">{t("Select one or more roles (max 2)", "एक या अधिक भूमिकाएँ चुनें (अधिकतम 2)")}</div>
                </div>

                {/* Salary Type */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">{t("Salary Type", "वेतन प्रकार")}</Label>
                  <Select value={formData.salaryType} onValueChange={value => setFormData({ ...formData, salaryType: value as SalaryType })}>
                    <SelectTrigger className="h-14 text-base rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {salaryTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-base py-3">
                          {t(opt.label, opt.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Payment Day (only if Weekly) */}
                {formData.salaryType === "weekly" && (
                  <div className="space-y-3">
                    <Label className="text-lg font-medium text-gray-800">{t("Payment Day", "भुगतान का दिन")}</Label>
                    <Select value={formData.paymentDayOfWeek} onValueChange={value => setFormData({ ...formData, paymentDayOfWeek: value })}>
                      <SelectTrigger className="h-14 text-base rounded-xl border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {daysOfWeek.map(day => (
                          <SelectItem key={day} value={day} className="text-base py-3">
                            {t(day, day)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Salary Amount */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-800">{t("Salary Amount", "वेतन राशि")}</Label>
                  <Input
                    type="number"
                    value={formData.salaryAmount}
                    onChange={e => setFormData({ ...formData, salaryAmount: Number(e.target.value) })}
                    placeholder={t("Enter salary amount", "वेतन राशि दर्ज करें")}
                    className="h-14 text-base rounded-xl border-gray-200"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-3 md:col-span-2">
                  <Label className="text-lg font-medium text-gray-800">
                    नोट्स / Notes {t("(Optional)", "(वैकल्पिक)")}
                  </Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t("Add any notes about the employee...", "कर्मचारी के बारे में कोई नोट्स जोड़ें...")}
                    rows={4}
                    className="text-base rounded-xl border-gray-200"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("list")}
                  className="flex-1 h-14 text-base font-semibold rounded-xl"
                >
                  {t("Cancel", "रद्द करें")}
                </Button>
                <Button
                  onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                  className="flex-1 h-14 text-base font-semibold rounded-xl bg-green-600 hover:bg-green-700"
                >
                  {editingEmployee ? t("Update Employee", "कर्मचारी अपडेट करें") : t("Add Employee", "कर्मचारी जोड़ें")}
                </Button>
              </div>
            </TabsContent>

            {/* Employees List Tab */}
            <TabsContent value="list" className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={t("Search employees...", "कर्मचारी खोजें...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-base rounded-xl"
                  />
                </div>
                <Button
                  onClick={() => setActiveTab("add")}
                  className="bg-green-600 hover:bg-green-700 h-12 px-6 rounded-xl"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {t("Add New Employee", "नया कर्मचारी जोड़ें")}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-semibold text-base">{t("Name", "नाम")}</TableHead>
                      <TableHead className="font-semibold text-base">{t("Role", "भूमिका")}</TableHead>
                      <TableHead className="font-semibold text-base">{t("Salary", "वेतन")}</TableHead>
                      <TableHead className="font-semibold text-base">{t("Current Week Salary", "इस सप्ताह वेतन")}</TableHead>
                      <TableHead className="font-semibold text-base">{t("Hours", "कार्य घंटे")}</TableHead>
                      <TableHead className="font-semibold text-base">{t("Actions", "एक्शन")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-base">{employee.name}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(employee.roles)}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold">₹{employee.salaryAmount}</span>
                            <span className="ml-2 text-xs text-gray-500">{t(employee.salaryType.charAt(0).toUpperCase() + employee.salaryType.slice(1), employee.salaryType)}</span>
                            {employee.salaryPaid ? (
                              <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">{t("Paid", "भुगतान किया गया")}</Badge>
                            ) : (
                              <Badge className="ml-2 bg-red-100 text-red-800 border-red-200">{t("Unpaid", "भुगतान बाकी")}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(employee.salaryType === "weekly" || employee.salaryType === "hourly") ? (
                            <span className="font-semibold text-green-600">₹{employee.currentWeekSalary?.toLocaleString() || 0}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(employee.salaryType === "weekly" || employee.salaryType === "hourly") ? (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Clock className="h-4 w-4" />
                              {employee.currentWeekHours || 0}h
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <Clock className="h-4 w-4" />
                              -
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewEmployee(employee)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditEmployee(employee)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteEmployee(employee.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={employee.salaryPaid ? "secondary" : "default"}
                              disabled={employee.salaryPaid}
                              onClick={() => handlePayNow(employee.id)}
                              className="h-8 px-3 text-xs"
                            >
                              {employee.salaryPaid ? t("Paid", "भुगतान किया गया") : t("Pay Now", "अभी भुगतान करें")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredEmployees.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{t("No employees found", "कोई कर्मचारी नहीं मिला")}</p>
                </div>
              )}
            </TabsContent>

            {/* View Employee Details Tab */}
            <TabsContent value="view" className="p-6 space-y-6">
              {viewingEmployee && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{t("Employee Details", "कर्मचारी विवरण")}</h2>
                    <Button variant="outline" onClick={() => setActiveTab("list")}>
                      {t("Back to List", "सूची पर वापस जाएं")}
                    </Button>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5" />
                          {t("Basic Information", "बुनियादी जानकारी")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Name", "नाम")}</p>
                          <p className="font-semibold text-lg">{viewingEmployee.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Phone", "फोन")}</p>
                          <p className="font-semibold">{viewingEmployee.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Address", "पता")}</p>
                          <p className="font-semibold">{viewingEmployee.address}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Role", "भूमिका")}</p>
                          <div className="mt-1">{getRoleBadge(viewingEmployee.roles)}</div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Join Date", "शामिल होने की तिथि")}</p>
                          <p className="font-semibold">{new Date(viewingEmployee.joinDate).toLocaleDateString()}</p>
                        </div>
                        {viewingEmployee.notes && (
                          <div>
                            <p className="text-sm text-muted-foreground">{t("Notes", "नोट्स")}</p>
                            <p className="font-semibold">{viewingEmployee.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <IndianRupee className="h-5 w-5" />
                          {t("Salary Information", "वेतन जानकारी")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Salary", "वेतन")}</p>
                          <div className="font-semibold">
                            ₹{viewingEmployee.salaryAmount} / {t(viewingEmployee.salaryType.charAt(0).toUpperCase() + viewingEmployee.salaryType.slice(1), viewingEmployee.salaryType)}
                            {viewingEmployee.salaryPaid ? (
                              <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">{t("Paid", "भुगतान किया गया")}</Badge>
                            ) : (
                              <Badge className="ml-2 bg-red-100 text-red-800 border-red-200">{t("Unpaid", "भुगतान बाकी")}</Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("Total Paid Earnings", "कुल भुगतान कमाई")}</p>
                          <p className="font-semibold text-xl text-green-600">₹{viewingEmployee.totalEarnings?.toLocaleString() || '0'}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendance Section */}
                  <Card className="shadow-lg border-0 bg-white">
                    <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-lg">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5" />
                          Today's Attendance (आज की उपस्थिति)
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" className="bg-white text-green-600 hover:bg-green-50" onClick={() => markAttendance('present')}>Present</Button>
                          <Button size="sm" variant="secondary" className="bg-white text-orange-600 hover:bg-orange-50" onClick={() => markAttendance('half_day')}>Half Day</Button>
                          <Button size="sm" variant="secondary" className="bg-white text-red-600 hover:bg-red-50" onClick={() => markAttendance('absent')}>Absent</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {viewingEmployee.attendanceRecords?.map((record, index) => (
                          <div 
                            key={index} 
                            onClick={() => setEditingAttendance({ id: record.id, date: record.date.split('T')[0], status: record.status, notes: record.notes })}
                            className={`flex flex-col items-center p-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${record.status === 'present' ? 'bg-green-50 border-green-200' : record.status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}
                          >
                            <span className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            <span className="font-bold text-sm">
                              {record.status === 'present' ? 'P' : record.status === 'absent' ? 'A' : 'HD'}
                            </span>
                          </div>
                        ))}
                        {(!viewingEmployee.attendanceRecords || viewingEmployee.attendanceRecords.length === 0) && (
                          <div className="text-muted-foreground text-sm py-2">No attendance marked this month.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Weekly Salary History */}
                  {(viewingEmployee.salaryType?.toLowerCase() === 'weekly' || viewingEmployee.salaryType?.toLowerCase() === 'hourly') && (
                    <Card className="shadow-lg border-0 bg-white">
                      <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {t("Weekly Salary History", "साप्ताहिक वेतन इतिहास")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-50">
                              <TableRow>
                                <TableHead className="font-semibold">{t("Week", "सप्ताह")}</TableHead>
                                <TableHead className="font-semibold">{t("Hours", "घंटे")}</TableHead>
                                <TableHead className="font-semibold text-right">{t("Amount", "राशि")}</TableHead>
                                <TableHead className="font-semibold">{t("Status", "स्थिति")}</TableHead>
                                <TableHead className="font-semibold">{t("Action", "एक्शन")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {viewingEmployee.weeklySalaries?.map((salary, index) => (
                                <TableRow key={index} className="hover:bg-gray-50">
                                  <TableCell className="font-medium">{salary.week}</TableCell>
                                  <TableCell>{salary.hours}h</TableCell>
                                  <TableCell className="text-right font-bold">₹{salary.amount.toLocaleString()}</TableCell>
                                  <TableCell>
                                    {salary.status === "paid" ? (
                                      <Badge className="bg-green-100 text-green-800 border-green-200">{t("Paid", "भुगतान किया गया")}</Badge>
                                    ) : (
                                      <Badge className="bg-red-100 text-red-800 border-red-200">{t("Unpaid", "भुगतान बाकी")}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {salary.status === "unpaid" && (
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => handlePayNow(viewingEmployee.id, salary.amount, `Weekly Salary - ${salary.week}`)}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        {t("Pay Now", "अभी भुगतान करें")}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {(!viewingEmployee.weeklySalaries || viewingEmployee.weeklySalaries.length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>{t("No weekly records found", "कोई साप्ताहिक रिकॉर्ड नहीं मिला")}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Payment History */}
                  <Card className="shadow-lg border-0 bg-white">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                      <CardTitle className="flex items-center gap-2">
                        <IndianRupee className="h-5 w-5" />
                        {t("Payment History", "भुगतान इतिहास")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow>
                              <TableHead className="font-semibold">{t("Date", "तारीख")}</TableHead>
                              <TableHead className="font-semibold">{t("Method", "तरीका")}</TableHead>
                              <TableHead className="font-semibold text-right">{t("Amount", "राशि")}</TableHead>
                              <TableHead className="font-semibold">{t("Notes", "नोट्स")}</TableHead>
                              <TableHead className="font-semibold text-right">{t("Action", "एक्शन")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewingEmployee.paymentHistory?.map((payment, index) => (
                              <TableRow key={index} className="hover:bg-gray-50">
                                <TableCell className="font-medium">{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{payment.paymentMethod}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold text-green-600">₹{payment.amount.toLocaleString()}</TableCell>
                                <TableCell className="text-gray-500 text-sm max-w-[200px] truncate">{payment.notes || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="icon" variant="ghost" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => setEditingPayment({ ...payment, paymentDate: payment.paymentDate.split('T')[0] })}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeletePayment(payment.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {(!viewingEmployee.paymentHistory || viewingEmployee.paymentHistory.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>{t("No payment records found", "कोई भुगतान रिकॉर्ड नहीं मिला")}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editingAttendance} onOpenChange={(open) => !open && setEditingAttendance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Edit Attendance", "उपस्थिति संपादित करें")}</DialogTitle>
          </DialogHeader>
          {editingAttendance && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("Date", "तारीख")}</Label>
                <Input type="date" value={editingAttendance.date} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>{t("Status", "स्थिति")}</Label>
                <Select value={editingAttendance.status} onValueChange={(val) => setEditingAttendance({ ...editingAttendance, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present (उपस्थित)</SelectItem>
                    <SelectItem value="half_day">Half Day (आधा दिन)</SelectItem>
                    <SelectItem value="absent">Absent (अनुपस्थित)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("Notes", "नोट्स")}</Label>
                <Input value={editingAttendance.notes || ''} onChange={(e) => setEditingAttendance({ ...editingAttendance, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAttendance(null)}>{t("Cancel", "रद्द करें")}</Button>
            <Button onClick={handleUpdateAttendance} className="bg-green-600 hover:bg-green-700">{t("Save", "सहेजें")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Edit Payment", "भुगतान संपादित करें")}</DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("Amount", "राशि")}</Label>
                <Input type="number" value={editingPayment.amount} onChange={(e) => setEditingPayment({ ...editingPayment, amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>{t("Date", "तारीख")}</Label>
                <Input type="date" value={editingPayment.paymentDate} onChange={(e) => setEditingPayment({ ...editingPayment, paymentDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("Notes", "नोट्स")}</Label>
                <Input value={editingPayment.notes || ''} onChange={(e) => setEditingPayment({ ...editingPayment, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)}>{t("Cancel", "रद्द करें")}</Button>
            <Button onClick={handleUpdatePayment} className="bg-green-600 hover:bg-green-700">{t("Save", "सहेजें")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
