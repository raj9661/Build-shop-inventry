'use client';

import React, { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  CreditCard,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';
import { NotificationBell } from '@/app/components/notification-bell';
import { DashboardContent } from './dashboard-content';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Hybrid approach: Use NextAuth session first, fallback to JWT token
        if (session?.user) {
          console.log('🔍 [Dashboard] Using NextAuth session:', session.user);
          setUser({
            id: parseInt((session.user as any).id),
            name: session.user.name || '',
            email: session.user.email || '',
            role: (session.user as any).role || ''
          });

          // Store API token for API calls
          if ((session as any).apiToken) {
            localStorage.setItem('accessToken', (session as any).apiToken);
          }
        } else {
          // Fallback to JWT token validation
          const token = localStorage.getItem('accessToken');
          if (!token || token === 'undefined' || token === 'null') {
            setLoading(false);
            return;
          }

          const response = await fetch('/api/auth/custom-session', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userRole');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userRole');
      } finally {
        setLoading(false);
      }
    };

    if (status !== 'loading') {
      checkAuth();
    }
  }, [session, status]);

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/login'} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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