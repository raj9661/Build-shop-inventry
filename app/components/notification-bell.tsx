"use client"

import React, { useState, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch notifications with retry mechanism
  const fetchNotifications = async (retryCount = 0) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken')
      console.log('🔍 [NotificationBell] Fetching notifications with token:', token ? 'present' : 'missing')
      
      if (!token) {
        console.log('❌ [NotificationBell] No access token found')
        return
      }

      const response = await fetch('/api/platform/notifications?unreadOnly=false&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('🔍 [NotificationBell] API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 [NotificationBell] API response data:', data)
        const notificationList = data.notifications || []
        
        // Convert BigInt to Number for display
        const processedNotifications = notificationList.map((notif: any) => ({
          ...notif,
          id: Number(notif.id)
        }))
        
        console.log('🔍 [NotificationBell] Processed notifications:', processedNotifications)
        
        // Check for new notifications
        const previousUnreadCount = unreadCount
        const newUnreadCount = processedNotifications.filter((n: Notification) => !n.isRead).length
        
        setNotifications(processedNotifications)
        setUnreadCount(newUnreadCount)
        
        // If we get empty notifications due to database issues, don't show error
        if (processedNotifications.length === 0) {
          console.log('📭 No notifications available (database may be unavailable)')
        }
        
        // Show toast for new notifications
        if (newUnreadCount > previousUnreadCount && previousUnreadCount > 0) {
          const newNotifications = processedNotifications.filter((n: Notification) => !n.isRead)
          const latestNotification = newNotifications[0]
          
          if (latestNotification) {
            toast.success(`🔔 ${latestNotification.title}`, {
              description: latestNotification.message,
              duration: 5000,
            })
          }
        }
      } else {
        let errorData = {}
        try {
          const responseText = await response.text()
          if (responseText.trim()) {
            errorData = JSON.parse(responseText)
          }
        } catch (jsonError) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('❌ [NotificationBell] API error:', errorData)
        
        // Retry for database connection errors (500 status)
        if (response.status === 500 && retryCount < 2) {
          console.log(`🔄 [NotificationBell] Retrying in 5 seconds... (attempt ${retryCount + 1}/2)`)
          setTimeout(() => {
            fetchNotifications(retryCount + 1)
          }, 5000)
          return
        }
        
        // Don't show error toasts for notification failures to avoid spam
        // Just log the error and continue
      }
    } catch (error) {
      console.error('❌ [NotificationBell] Failed to fetch notifications:', error)
      
      // Retry for network errors
      if (retryCount < 2) {
        console.log(`🔄 [NotificationBell] Retrying in 5 seconds... (attempt ${retryCount + 1}/2)`)
        setTimeout(() => {
          fetchNotifications(retryCount + 1)
        }, 5000)
        return
      }
      
      // Don't show error toasts for notification failures to avoid spam
      // Just log the error and continue
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/platform/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notificationId })
      })

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId ? { ...notif, isRead: true } : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/platform/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ markAll: true })
      })

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        )
        setUnreadCount(0)
        toast.success("All notifications marked as read", {
          duration: 2000,
        })
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'USER_CREATED':
        return '👤'
      case 'USER_UPDATED':
        return '✏️'
      case 'USER_DELETED':
        return '🗑️'
      case 'SUBSCRIPTION_EXPIRY':
        return '⏰'
      case 'PAYMENT_DUE':
        return '💳'
      case 'SYSTEM_MAINTENANCE':
        return '🔧'
      case 'FEATURE_UPDATE':
        return '✨'
      default:
        return '📢'
    }
  }

  // Get notification color based on type
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'USER_CREATED':
        return 'text-green-600'
      case 'USER_UPDATED':
        return 'text-blue-600'
      case 'USER_DELETED':
        return 'text-red-600'
      case 'SUBSCRIPTION_EXPIRY':
        return 'text-orange-600'
      case 'PAYMENT_DUE':
        return 'text-red-600'
      case 'SYSTEM_MAINTENANCE':
        return 'text-yellow-600'
      case 'FEATURE_UPDATE':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  // Fetch notifications on mount and set up polling
  useEffect(() => {
    fetchNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-96">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No notifications yet
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium ${getNotificationColor(notification.type)}`}>
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
