"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Edit, Trash2, Search, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: number
  name?: string
  username: string
  email: string
  phone?: string
  role: string
  isActive: boolean
  createdAt: string
  assignedShops?: string[]
}

interface CreateUserDialogProps {
  onUserCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function UserManagementDialog({ onUserCreated, open: controlledOpen, onOpenChange }: CreateUserDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available: boolean | null
    message: string
  }>({
    checking: false,
    available: null,
    message: ''
  })
  const [usernameTimeout, setUsernameTimeout] = useState<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "STAFF"
  })

  useEffect(() => {
    if (open) {
      loadUsers()
    }
  }, [open])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameTimeout) {
        clearTimeout(usernameTimeout)
      }
    }
  }, [usernameTimeout])

  // Validation functions
  const validateName = (name: string): string => {
    if (!name.trim()) return "Name is required"
    if (name.length < 2) return "Name must be at least 2 characters"
    if (name.length > 50) return "Name must be less than 50 characters"
    if (!/^[a-zA-Z\s]+$/.test(name)) return "Name can only contain letters and spaces"
    return ""
  }

  const validateUsername = (username: string): string => {
    if (!username.trim()) return "Username is required"
    if (username.length < 3) return "Username must be at least 3 characters"
    if (username.length > 30) return "Username must be less than 30 characters"
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username can only contain letters, numbers, and underscores"
    return ""
  }

  const validateEmail = (email: string): string => {
    if (!email.trim()) return "Email is required"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return "Please enter a valid email address"
    return ""
  }

  const validatePhone = (phone: string): string => {
    if (!phone.trim()) return "" // Phone is optional
    if (!/^[0-9+\-\s()]+$/.test(phone)) return "Phone can only contain numbers, +, -, spaces, and parentheses"
    if (phone.replace(/[^0-9]/g, '').length < 10) return "Phone must have at least 10 digits"
    if (phone.replace(/[^0-9]/g, '').length > 15) return "Phone must have at most 15 digits"
    return ""
  }

  const validatePassword = (password: string, isEdit: boolean): string => {
    if (!isEdit && !password.trim()) return "Password is required"
    if (password && password.length < 8) return "Password must be at least 8 characters"
    if (password && password.length > 100) return "Password must be less than 100 characters"

    if (password) {
      // Check for at least one uppercase letter
      if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter"
      }

      // Check for at least one lowercase letter
      if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter"
      }

      // Check for at least one number
      if (!/[0-9]/.test(password)) {
        return "Password must contain at least one number"
      }

      // Check for at least one special character
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)"
      }

      // Check for only allowed characters (alphanumeric + special characters)
      if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(password)) {
        return "Password can only contain letters, numbers, and special characters"
      }
    }

    return ""
  }

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {}

    errors.name = validateName(formData.name)
    errors.username = validateUsername(formData.username)
    errors.email = validateEmail(formData.email)
    errors.phone = validatePhone(formData.phone)
    errors.password = validatePassword(formData.password, !!editingUser)

    // Check username availability if not editing or username changed
    if (formData.username && formData.username.length >= 3) {
      if (usernameStatus.checking) {
        errors.username = "Please wait while checking username availability"
      } else if (usernameStatus.available === false) {
        errors.username = usernameStatus.message
      }
    }

    setValidationErrors(errors)

    return Object.values(errors).every(error => error === "")
  }

  // Check password strength in real-time
  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    })
  }

  // Check username availability with debouncing
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.trim().length < 3) {
      setUsernameStatus({ checking: false, available: null, message: '' })
      return
    }

    try {
      setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' })

      const token = localStorage.getItem('accessToken')
      if (!token) {
        setUsernameStatus({ checking: false, available: false, message: 'Authentication required. Please refresh the page.' })
        return
      }

      // Check if token is expired or malformed
      try {
        const tokenParts = token.split('.')
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format')
        }

        const payload = JSON.parse(atob(tokenParts[1]))
        const currentTime = Math.floor(Date.now() / 1000)
        if (payload.exp && payload.exp < currentTime) {
          throw new Error('Token expired')
        }
      } catch (tokenError) {
        console.error('Token validation error:', tokenError)
        setUsernameStatus({
          checking: false,
          available: false,
          message: 'Session expired. Please refresh the page and login again.'
        })
        return
      }

      // Try to refresh token if authentication fails
      const makeRequest = async (retryCount = 0) => {
        const response = await fetch('/api/users/check-username', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            username: username.trim(),
            excludeUserId: editingUser?.id
          })
        })

        if (response.status === 401 && retryCount === 0) {
          // Try to refresh token
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
            })

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              localStorage.setItem('accessToken', refreshData.accessToken)
              // Retry with new token
              return makeRequest(1)
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
          }
        }

        return response
      }

      const response = await makeRequest()

      const data = await response.json()

      if (response.ok) {
        setUsernameStatus({
          checking: false,
          available: data.available,
          message: data.message
        })
      } else {
        let errorMessage = 'Failed to check username'
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please refresh the page and try again.'
        } else if (data.message) {
          errorMessage = data.message
        } else if (data.error) {
          errorMessage = data.error
        }

        setUsernameStatus({
          checking: false,
          available: false,
          message: errorMessage
        })
      }
    } catch (error) {
      console.error('Username check error:', error)
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Network error'
      })
    }
  }

  // Debounced username check
  const debouncedUsernameCheck = (username: string) => {
    if (usernameTimeout) {
      clearTimeout(usernameTimeout)
    }

    const timeout = setTimeout(() => {
      checkUsernameAvailability(username)
    }, 500) // 500ms delay

    setUsernameTimeout(timeout)
  }

  const loadUsers = async () => {
    try {
      console.log('🔍 UserManagementDialog: Starting to load users...')
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ UserManagementDialog: No access token found')
        toast.error("Authentication Required", {
          description: "Please log in again"
        });
        return;
      }

      console.log('🔍 UserManagementDialog: Token details:', {
        tokenLength: token.length,
        tokenStart: token.substring(0, 20) + '...',
        tokenEnd: '...' + token.substring(token.length - 20),
        tokenType: typeof token,
        isString: typeof token === 'string'
      });

      console.log('🔍 UserManagementDialog: Making API call to /api/users')
      const response = await fetch('/api/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('🔍 UserManagementDialog: API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 UserManagementDialog: API response:', data)
        if (data.users) {
          console.log('🔍 UserManagementDialog: Found', data.users.length, 'users')
          setUsers(data.users)
        }
        else if (data.data && data.data.users) {
          console.log('🔍 UserManagementDialog: Found', data.data.users.length, 'users in data.users')
          setUsers(data.data.users)
        }
        else {
          console.log('🔍 UserManagementDialog: No users found in response')
          setUsers([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ UserManagementDialog: Failed to load users:', response.status, errorData)
        toast.error(`Failed to load users: ${errorData.message || 'Server error'}`)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form before submission
    if (!validateForm()) {
      toast.error("Please fix the validation errors before submitting")
      return
    }

    setLoading(true)

    try {
      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : '/api/users'

      const method = editingUser ? 'PUT' : 'POST'
      const body = editingUser
        ? { ...formData, password: formData.password || undefined }
        : formData

      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error("Authentication Required", {
          description: "Please log in again"
        });
        return;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const responseData = await response.json()
        const user = responseData.user || responseData // Handle both response formats
        toast.success(editingUser ? "✅ User Updated Successfully" : "✅ User Created Successfully", {
          description: `Successfully ${editingUser ? 'updated' : 'created'} user "${user.username}" with role "${user.role}"`,
          duration: 5000,
        })
        setOpen(false)
        resetForm()
        onUserCreated?.()
        loadUsers()
      } else {
        const error = await response.json()
        toast.error("❌ User Creation Failed", {
          description: error.message || `Failed to ${editingUser ? 'update' : 'create'} user. Please try again.`,
          duration: 5000,
        })
      }
    } catch (error) {
      toast.error("❌ Network Error", {
        description: `Failed to ${editingUser ? 'update' : 'create'} user. Please check your connection and try again.`,
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error("Authentication Required", {
          description: "Please log in again"
        });
        return;
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        toast.success("User Deleted", {
          description: "User has been successfully deleted",
        })
        loadUsers()
      } else {
        const error = await response.json()
        toast.error("Error", {
          description: error.message || "Failed to delete user",
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to delete user. Please try again.",
      })
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name || user.username, // Use name if available, fallback to username
      username: user.username,
      email: user.email,
      phone: user.phone || "",
      password: "",
      role: user.role === "USER" ? "STAFF" : user.role
    })
  }

  const resetForm = () => {
    setFormData({ name: "", username: "", email: "", phone: "", password: "", role: "STAFF" })
    setEditingUser(null)
    setShowPassword(false)
    setValidationErrors({})
    setPasswordStrength({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    })
    setUsernameStatus({ checking: false, available: null, message: '' })
    if (usernameTimeout) {
      clearTimeout(usernameTimeout)
      setUsernameTimeout(null)
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUPER_DUPER_ADMIN: "destructive",
      SUPER_ADMIN: "default",
      ADMIN: "secondary",
      STAFF: "outline"
    }
    return <Badge variant={variants[role] || "outline"}>{role === "USER" ? "STAFF" : role}</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl p-4 md:p-6 max-h-[90vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </DialogTitle>
          <DialogDescription>
            Create, edit, and manage system users. Only SUPER_DUPER_ADMIN can manage all users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 w-full min-w-0">
          {/* Create/Edit User Form */}
          <div className="border rounded-lg p-4 w-full">
            <h3 className="text-lg font-medium mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    // Clear validation error when user starts typing
                    if (validationErrors.name) {
                      setValidationErrors({ ...validationErrors, name: "" })
                    }
                  }}
                  onBlur={() => {
                    const error = validateName(formData.name)
                    if (error) {
                      setValidationErrors({ ...validationErrors, name: error })
                    }
                  }}
                  required
                  className={validationErrors.name ? "border-red-500" : ""}
                />
                {validationErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => {
                    const username = e.target.value
                    setFormData({ ...formData, username })
                    // Clear validation error when user starts typing
                    if (validationErrors.username) {
                      setValidationErrors({ ...validationErrors, username: "" })
                    }
                    // Check username availability with debouncing
                    debouncedUsernameCheck(username)
                  }}
                  onBlur={() => {
                    const error = validateUsername(formData.username)
                    if (error) {
                      setValidationErrors({ ...validationErrors, username: error })
                    }
                  }}
                  required
                  className={validationErrors.username ? "border-red-500" : ""}
                />
                {validationErrors.username && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.username}</p>
                )}
                {formData.username && formData.username.length >= 3 && (
                  <div className="mt-1">
                    {usernameStatus.checking ? (
                      <div className="flex items-center text-blue-600 text-sm">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                        {usernameStatus.message}
                      </div>
                    ) : usernameStatus.available === true ? (
                      <div className="flex items-center text-green-600 text-sm">
                        <span className="mr-1">✓</span>
                        {usernameStatus.message}
                      </div>
                    ) : usernameStatus.available === false ? (
                      <div className="flex items-center text-red-500 text-sm">
                        <span className="mr-1">✗</span>
                        {usernameStatus.message}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    // Clear validation error when user starts typing
                    if (validationErrors.email) {
                      setValidationErrors({ ...validationErrors, email: "" })
                    }
                  }}
                  onBlur={() => {
                    const error = validateEmail(formData.email)
                    if (error) {
                      setValidationErrors({ ...validationErrors, email: error })
                    }
                  }}
                  required
                  className={validationErrors.email ? "border-red-500" : ""}
                />
                {validationErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 10) {
                      setFormData({ ...formData, phone: value })
                      // Clear validation error when user starts typing
                      if (validationErrors.phone) {
                        setValidationErrors({ ...validationErrors, phone: "" })
                      }
                    }
                  }}
                  onBlur={() => {
                    const error = validatePhone(formData.phone)
                    if (error) {
                      setValidationErrors({ ...validationErrors, phone: error })
                    }
                  }}
                  placeholder="9876543210"
                  maxLength={10}
                  className={validationErrors.phone ? "border-red-500" : ""}
                />
                {validationErrors.phone && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value })
                      checkPasswordStrength(e.target.value)
                      // Clear validation error when user starts typing
                      if (validationErrors.password) {
                        setValidationErrors({ ...validationErrors, password: "" })
                      }
                    }}
                    onBlur={() => {
                      const error = validatePassword(formData.password, !!editingUser)
                      if (error) {
                        setValidationErrors({ ...validationErrors, password: error })
                      }
                    }}
                    required={!editingUser}
                    disabled={editingUser?.role === 'SUPER_DUPER_ADMIN'}
                    className={`pr-10 ${validationErrors.password ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={editingUser?.role === 'SUPER_DUPER_ADMIN'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {validationErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
                )}
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-gray-600 mb-2">Password Requirements:</div>
                    <div className="space-y-1">
                      <div className={`flex items-center text-xs ${passwordStrength.length ? 'text-green-600' : 'text-red-500'}`}>
                        <span className="mr-2">{passwordStrength.length ? '✓' : '✗'}</span>
                        At least 8 characters
                      </div>
                      <div className={`flex items-center text-xs ${passwordStrength.uppercase ? 'text-green-600' : 'text-red-500'}`}>
                        <span className="mr-2">{passwordStrength.uppercase ? '✓' : '✗'}</span>
                        One uppercase letter (A-Z)
                      </div>
                      <div className={`flex items-center text-xs ${passwordStrength.lowercase ? 'text-green-600' : 'text-red-500'}`}>
                        <span className="mr-2">{passwordStrength.lowercase ? '✓' : '✗'}</span>
                        One lowercase letter (a-z)
                      </div>
                      <div className={`flex items-center text-xs ${passwordStrength.number ? 'text-green-600' : 'text-red-500'}`}>
                        <span className="mr-2">{passwordStrength.number ? '✓' : '✗'}</span>
                        One number (0-9)
                      </div>
                      <div className={`flex items-center text-xs ${passwordStrength.special ? 'text-green-600' : 'text-red-500'}`}>
                        <span className="mr-2">{passwordStrength.special ? '✓' : '✗'}</span>
                        One special character (!@#$%^&*...)
                      </div>
                    </div>
                  </div>
                )}
                {editingUser && editingUser.role === 'SUPER_DUPER_ADMIN' && (
                  <div className="text-xs text-red-600 mt-1">
                    SUPER_DUPER_ADMIN password can only be changed from the dashboard quick links.
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-2 mt-2">
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Saving..." : (editingUser ? "Update User" : "Create User")}
                </Button>
                {editingUser && (
                  <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Users List */}
          <div className="border rounded-lg w-full min-w-0">
            <div className="p-3 sm:p-4 border-b w-full min-w-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center w-full sm:w-auto flex-1 gap-2">
                  <Search className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:max-w-sm text-sm p-2"
                  />
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('accessToken');
                        console.log('🔍 Token info:', {
                          hasToken: !!token,
                          tokenLength: token?.length,
                          tokenStart: token?.substring(0, 20) + '...',
                          tokenParts: token?.split('.').length
                        });

                        // Test username check API
                        const response = await fetch('/api/users/check-username', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ username: 'testuser' })
                        });
                        const data = await response.json();
                        console.log('🔍 Username check response:', { status: response.status, data });
                        alert(`Debug info logged to console. Username check status: ${response.status}`);
                      } catch (error) {
                        console.error('Debug error:', error);
                        alert('Debug failed. Check console for details.');
                      }
                    }}
                  >
                    Debug
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('accessToken');
                      localStorage.removeItem('refreshToken');
                      alert('Tokens cleared. Please refresh the page and login again.');
                      window.location.reload();
                    }}
                  >
                    Clear Token
                  </Button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto w-full max-h-96">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || user.username}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 