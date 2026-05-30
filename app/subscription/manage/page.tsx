'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Calendar, 
  Users, 
  Package, 
  Building2,
  ArrowLeft,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuthGuard } from '@/app/hooks/use-auth-guard';
import { AuthLoadingScreen } from '@/app/components/auth-loading-screen';
import { SessionExpiredScreen } from '@/app/components/session-expired-screen';
import { toast } from 'sonner';

interface SubscriptionData {
  id: number;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  trialEndDate?: string;
  price: number;
  currency: string;
  autoRenew: boolean;
  daysRemaining: number;
  isTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  planLimits: {
    shops: number;
    products: number;
    users: number;
    features: string[];
  };
  customer: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export default function SubscriptionManagement() {
  const { authReady, isAuthenticated } = useAuthGuard();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to load subscription');
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const formatPlanName = (plan: string) => {
    const planNames: { [key: string]: string } = {
      'TRIAL_30_DAYS': '30-Day Free Trial',
      'BASIC_MONTHLY': 'Basic Monthly',
      'BASIC_YEARLY': 'Basic Yearly',
      'PROFESSIONAL_MONTHLY': 'Professional Monthly',
      'PROFESSIONAL_YEARLY': 'Professional Yearly',
      'ENTERPRISE_MONTHLY': 'Enterprise Monthly',
      'ENTERPRISE_YEARLY': 'Enterprise Yearly'
    };
    return planNames[plan] || plan;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      TRIAL: { variant: 'outline' as const, className: 'text-blue-600 border-blue-200' },
      ACTIVE: { variant: 'default' as const, className: 'text-green-600 bg-green-100' },
      EXPIRED: { variant: 'destructive' as const, className: 'text-red-600 bg-red-100' },
      SUSPENDED: { variant: 'secondary' as const, className: 'text-yellow-600 bg-yellow-100' },
      CANCELLED: { variant: 'outline' as const, className: 'text-gray-600 border-gray-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.TRIAL;

    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleUpgrade = () => {
    router.push('/subscription/plans');
  };

  const handleDownloadInvoice = () => {
    toast.info('Invoice download feature coming soon');
  };

  if (!authReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <SessionExpiredScreen />;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Subscription Found</h1>
          <p className="text-gray-600 mb-6">You don't have an active subscription.</p>
          <Button onClick={handleUpgrade}>
            Choose a Plan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
            <p className="text-gray-600">Manage your subscription and billing details</p>
          </div>
          <Button onClick={loadSubscription} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Overview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Details */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{formatPlanName(subscription.plan)}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(subscription.status)}
                    {subscription.isTrial && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        Trial
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${subscription.price}
                    <span className="text-sm text-gray-600">/{subscription.currency.toLowerCase()}</span>
                  </div>
                  {subscription.isTrial && (
                    <div className="text-sm text-gray-500">Free Trial</div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                  <div className="text-sm text-gray-600">Start Date</div>
                  <div className="font-medium">{formatDate(subscription.startDate)}</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                  <div className="text-sm text-gray-600">
                    {subscription.isTrial ? 'Trial End Date' : 'End Date'}
                  </div>
                  <div className="font-medium">
                    {formatDate(subscription.trialEndDate || subscription.endDate)}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <RefreshCw className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                  <div className="text-sm text-gray-600">Days Remaining</div>
                  <div className="font-medium">{subscription.daysRemaining}</div>
                </div>
              </div>

              {/* Plan Limits */}
              <div>
                <h4 className="font-medium mb-3">Plan Limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">
                        {subscription.planLimits.shops === -1 ? 'Unlimited' : subscription.planLimits.shops} Shops
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Package className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">
                        {subscription.planLimits.products === -1 ? 'Unlimited' : subscription.planLimits.products} Products
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <Users className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-medium">
                        {subscription.planLimits.users === -1 ? 'Unlimited' : subscription.planLimits.users} Users
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="font-medium mb-3">Plan Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {subscription.planLimits.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscription.isTrial || subscription.isExpired ? (
                <Button onClick={handleUpgrade} className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              ) : (
                <Button variant="outline" onClick={handleUpgrade} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
              )}
              
              <Button variant="outline" onClick={handleDownloadInvoice} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Account Holder</div>
                <div className="font-medium">{subscription.customer.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{subscription.customer.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Role</div>
                <div className="font-medium">{subscription.customer.role}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Auto Renewal</div>
                <div className="font-medium">
                  {subscription.autoRenew ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
