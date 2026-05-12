"use client"

import React, { useState } from 'react'
import { useShop } from '../contexts/ShopContext'
import { Shop } from '../lib/services/shopService'
import { useLanguage } from "../../hooks/use-language"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Users, Package, TrendingUp, Loader2, ChevronDown, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ShopSelectorProps {
  className?: string
}

export function ShopSelector({ className = "" }: ShopSelectorProps) {
  const { t } = useLanguage()
  const { currentShop, shops, switchShop, loading, userRole } = useShop()
  const [isOpen, setIsOpen] = useState(false)

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 p-3 bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="animate-pulse bg-gray-200 h-6 w-6 rounded"></div>
        <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
      </div>
    )
  }

  if (shops.length === 0) {
    return (
      <div className={`flex items-center space-x-2 p-3 bg-white rounded-lg shadow-sm border ${className}`}>
        <Building2 className="h-6 w-6 text-gray-400" />
        <span className="text-sm text-gray-500">No shops available</span>
      </div>
    )
  }

  const handleShopSelect = async (shop: Shop) => {
    await switchShop(shop.id)
    setIsOpen(false)
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      'SUPER_DUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'SUPER_ADMIN': 'bg-red-100 text-red-800',
      'ADMIN': 'bg-blue-100 text-blue-800',
      'STAFF': 'bg-green-100 text-green-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}`}>
        <User className="h-3 w-3 mr-1" />
        {role.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
      >
        <div className="flex items-center space-x-3">
          <Building2 className="h-6 w-6 text-blue-600" />
          <div className="text-left">
            <div className="font-medium text-gray-900">{currentShop?.name}</div>
            <div className="text-sm text-gray-500">{currentShop?.location}</div>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2">
              Available Shops
            </div>
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => handleShopSelect(shop)}
                className={`w-full text-left p-3 rounded-md transition-colors duration-150 ${
                  currentShop?.id === shop.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">{shop.name}</div>
                      <div className="text-sm text-gray-500">{shop.location}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {userRole && getRoleBadge(userRole)}
                    {currentShop?.id === shop.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 