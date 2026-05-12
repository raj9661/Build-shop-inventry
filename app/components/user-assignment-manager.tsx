"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, User, Plus, Trash2, Users, MapPin } from "lucide-react"
import { useShop } from '../contexts/ShopContext'
import { shopService } from '../lib/services/shopService'
import { toast } from "sonner"

interface UserAssignment {
  id: number
  name: string
  username: string
  email: string
  role: string
  shopRole: string
  assignedAt: string
}

interface User {
  id: number
  name?: string
  email: string
  role: string
  username?: string
}

interface Shop {
  id: number
  name: string
  location: string
}

interface UserAssignmentManagerProps {
  shop?: Shop
}

export function UserAssignmentManager({ shop }: UserAssignmentManagerProps) {
  const { currentShop, userRole } = useShop()
  const [assignments, setAssignments] = useState<UserAssignment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<number | null>(null)
  const assignmentsRef = useRef<UserAssignment[]>([])

  // Always use the shop prop if provided, never fall back to context for SUPER_DUPER_ADMIN
  const targetShop = shop

  // Debug logging
  console.log('🔍 [UserAssignmentManager] Props:', { shop, targetShop, userRole });

  // Token refresh function
  const refreshToken = async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken')
      if (!refreshTokenValue) {
        console.log('❌ No refresh token found')
        return null
      }

      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          localStorage.setItem('accessToken', data.data.token)
          localStorage.setItem('refreshToken', data.data.refreshToken)
          console.log('✅ Token refreshed successfully')
          return data.data.token
        }
      }

      console.log('❌ Token refresh failed')
      return null
    } catch (error) {
      console.error('❌ Token refresh error:', error)
      return null
    }
  }

  useEffect(() => {
    if (targetShop && userRole === 'SUPER_DUPER_ADMIN') {
      loadAssignments()
      loadUsers()
    }
  }, [targetShop, userRole])

  // Debug effect to monitor assignments changes
  useEffect(() => {
    console.log('🔍 Assignments state changed:', assignments.length, 'assignments')
    assignmentsRef.current = assignments
  }, [assignments])

  const loadAssignments = async () => {
    if (!targetShop) return

    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken');
      if (!token || token === 'undefined' || token === 'null') {
        console.log('❌ No valid token found for assignments')
        toast.error('Authentication required. Please log in again.');
        return;
      }

      console.log('🔍 Loading assignments for shop:', targetShop.id)
      const response = await fetch(`/api/shops/${targetShop.id}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('🔍 Assignments response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Assignments response:', data)
        if (data.success && data.users) {
          setAssignments(data.users)
        } else {
          console.error('Invalid response format:', data)
          setAssignments([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to load assignments:', response.status, errorData)

        // Handle different error types
        if (response.status === 401) {
          console.log('❌ Token expired or invalid, attempting refresh')
          const newToken = await refreshToken()
          if (newToken) {
            console.log('✅ Token refreshed, retrying assignments request')
            // Retry the request with the new token
            const retryResponse = await fetch(`/api/shops/${targetShop.id}/users`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`
              }
            })

            if (retryResponse.ok) {
              const retryData = await retryResponse.json()
              if (retryData.success && retryData.users) {
                setAssignments(retryData.users)
                return
              }
            }
          }

          // If refresh failed or retry failed, clear auth data
          console.log('❌ Token refresh failed, clearing auth data')
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('userRole')
          toast.error('Session expired. Please log in again.');
        } else if (response.status === 403) {
          console.log('❌ Access denied for assignments')
          toast.error('Access denied. You do not have permission to view user assignments.');
        } else if (response.status === 503) {
          console.log('📭 Database unavailable for assignments, showing empty list')
          setAssignments([])
        } else {
          toast.error(errorData.message || 'Failed to load user assignments')
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      setAssignments([])
      toast.error('Error loading user assignments')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token || token === 'undefined' || token === 'null') {
        console.log('❌ No valid token found for users')
        toast.error('Authentication required. Please log in again.');
        return;
      }

      console.log('🔍 Loading users')
      const response = await fetch('/api/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('🔍 Users response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Users response:', data)
        if (data.success && data.users) {
          // Filter out SUPER_DUPER_ADMIN and map to correct format
          const filteredUsers = data.users
            .filter((user: any) => user.role !== 'SUPER_DUPER_ADMIN')
            .map((user: any) => ({
              id: user.id,
              name: user.name || user.username, // Use name if available, fallback to username
              email: user.email,
              role: user.role,
              username: user.username
            }))
          console.log('Filtered users:', filteredUsers)
          setUsers(filteredUsers)
        } else {
          console.error('Invalid response format:', data)
          console.error('Response status:', response.status)
          console.error('Response headers:', response.headers)
          toast.error(`Failed to load users: ${data.message || 'Invalid response format'}`)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to load users:', response.status, errorData)

        // Handle different error types
        if (response.status === 401) {
          console.log('❌ Token expired or invalid, attempting refresh')
          const newToken = await refreshToken()
          if (newToken) {
            console.log('✅ Token refreshed, retrying users request')
            // Retry the request with the new token
            const retryResponse = await fetch('/api/users', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`
              }
            })

            if (retryResponse.ok) {
              const retryData = await retryResponse.json()
              if (retryData.success && retryData.users) {
                // Filter out SUPER_DUPER_ADMIN and map to correct format
                const filteredUsers = retryData.users
                  .filter((user: any) => user.role !== 'SUPER_DUPER_ADMIN')
                  .map((user: any) => ({
                    id: user.id,
                    name: user.name || user.username,
                    email: user.email,
                    role: user.role,
                    username: user.username
                  }))
                setUsers(filteredUsers)
                return
              }
            }
          }

          // If refresh failed or retry failed, clear auth data
          console.log('❌ Token refresh failed, clearing auth data')
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('userRole')
          toast.error('Session expired. Please log in again.');
        } else if (response.status === 403) {
          console.log('❌ Access denied for users')
          toast.error('Access denied. You do not have permission to view users.');
        } else if (response.status === 503) {
          console.log('📭 Database unavailable for users, showing empty list')
          setUsers([])
        } else {
          toast.error(`Failed to load users: ${errorData.message || 'Server error'}`)
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Error loading users')
    }
  }

  const handleAssignUser = async () => {
    if (!targetShop || !selectedUserId || !selectedRole) return

    // Find the user being assigned for optimistic update
    const userToAssign = users.find(user => user.id.toString() === selectedUserId)
    if (!userToAssign) {
      toast.error('User not found')
      return
    }

    // Store original state for potential rollback
    const originalAssignments = [...assignments]

    try {
      setAssigning(true)

      // Optimistic update - immediately add to UI
      const newAssignment: UserAssignment = {
        id: userToAssign.id,
        name: userToAssign.name || userToAssign.username || 'Unknown User',
        username: userToAssign.username || '',
        email: userToAssign.email,
        role: userToAssign.role,
        shopRole: selectedRole,
        assignedAt: new Date().toISOString()
      }

      setAssignments(prev => [newAssignment, ...prev])

      const response = await fetch(`/api/shops/${targetShop.id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          role: selectedRole
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Assignment response:', data)
        toast.success(data.message || 'User assigned successfully')
        setIsAssignDialogOpen(false)
        setSelectedUserId('')
        setSelectedRole('')
        // No need to reload - optimistic update is already applied
      } else {
        // Revert optimistic update on failure
        setAssignments(originalAssignments)
        const errorData = await response.json()
        console.error('Error assigning user:', errorData)
        toast.error(errorData.message || 'Failed to assign user to shop')
      }
    } catch (error) {
      // Revert optimistic update on error
      setAssignments(originalAssignments)
      console.error('Error assigning user:', error)
      toast.error('Error assigning user')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!targetShop || removingUserId === userId) return

    console.log('🔍 Removing user:', userId, 'from assignments:', assignments.length)

    // Use ref to get current assignments to avoid stale closure
    const currentAssignments = assignmentsRef.current
    const originalAssignments = [...currentAssignments]
    const filteredAssignments = currentAssignments.filter(assignment => assignment.id !== userId)
    console.log('🔍 After filtering:', filteredAssignments.length, 'assignments remaining')

    // Optimistic update - immediately remove from UI
    setAssignments(filteredAssignments)
    setRemovingUserId(userId)

    try {
      const response = await fetch(`/api/shops/${targetShop.id}/users?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        console.log('✅ User removed successfully from API')
        toast.success('User removed successfully')
        // No need to reload - optimistic update is already applied
      } else {
        console.log('❌ API failed to remove user, reverting optimistic update')
        // Revert optimistic update on failure
        setAssignments(originalAssignments)
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to remove user')
      }
    } catch (error) {
      // Revert optimistic update on error
      setAssignments(originalAssignments)
      console.error('Error removing user:', error)
      toast.error('Error removing user')
    } finally {
      setRemovingUserId(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      'SUPER_ADMIN': 'bg-red-100 text-red-800',
      'ADMIN': 'bg-blue-100 text-blue-800',
      'STAFF': 'bg-green-100 text-green-800'
    }

    return (
      <Badge className={roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    )
  }

  // Helper function to get display name
  const getDisplayName = (assignment: UserAssignment) => {
    return assignment.name || assignment.username || 'Unknown User'
  }

  if (userRole !== 'SUPER_DUPER_ADMIN') {
    return null
  }

  if (!targetShop) {
    console.log('🔍 [UserAssignmentManager] No targetShop provided, showing selection message');
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">Please select a shop to manage user assignments</p>
        </CardContent>
      </Card>
    )
  }

  console.log('🔍 [UserAssignmentManager] Target shop found:', targetShop);

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="px-0 sm:px-6 pt-0 sm:pt-6">
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="truncate">User Assignments - {targetShop.name}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6 pb-0 sm:pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            {targetShop.location}
          </div>

          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Assign User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[95vw] p-4 md:p-6 rounded-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign User to Shop</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="user">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name || user.username || 'Unknown User'} ({user.email}) - {user.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="role">Shop Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAssignUser}
                  disabled={!selectedUserId || !selectedRole || assigning}
                  className="w-full"
                >
                  {assigning ? 'Assigning...' : 'Assign User'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No users assigned to this shop</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={`${assignment.id}-${assignment.email}`}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg transition-all duration-200 gap-3 sm:gap-0 ${removingUserId === assignment.id ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                  }`}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <User className="h-5 w-5 text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="font-medium truncate">{getDisplayName(assignment)}</div>
                    <div className="text-sm text-gray-500 truncate">{assignment.email}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  {getRoleBadge(assignment.shopRole)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveUser(assignment.id)}
                    disabled={removingUserId === assignment.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 shrink-0"
                  >
                    {removingUserId === assignment.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 