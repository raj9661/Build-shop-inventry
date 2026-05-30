'use client';

import React, { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Users, CreditCard, ShoppingCart, BarChart3, Settings, LogOut } from 'lucide-react';
import { NotificationBell } from '@/app/components/notification-bell';
import { DashboardContent } from './dashboard-content';
import { useAuthGuard } from '@/app/hooks/use-auth-guard';
import { AuthLoadingScreen } from '@/app/components/auth-loading-screen';
import { SessionExpiredScreen } from '@/app/components/session-expired-screen';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const { authReady, isAuthenticated } = useAuthGuard();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (session?.user) {
      setUser({
        id: parseInt((session.user as any).id) || 0,
        name: session.user.name || '',
        email: session.user.email || '',
        role: (session.user as any).role || ''
      });
    }
  }, [session]);

  if (!authReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return <SessionExpiredScreen />;

  const handleSignOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Welcome back, {user.name}!</p>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-end">
              <NotificationBell />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {user.role?.toLowerCase().replace('_', ' ')}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content with Active Sales and Daily Price Management */}
        <DashboardContent />

      </div>
    </div>
  );
}