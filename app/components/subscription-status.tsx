'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Calendar, 
  Users, 
  Package, 
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Crown,
  Star,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
  isInherited?: boolean;
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

interface SubscriptionStatusProps {
  className?: string;
}

export function SubscriptionStatus({ className }: SubscriptionStatusProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadSubscriptionStatus();
    
    // Set up automatic refresh every 30 seconds
    const interval = setInterval(() => {
      loadSubscriptionStatus();
    }, 30000); // 30 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      console.log('🔄 Loading subscription status...');
      const response = await fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Subscription data received:', data.data);
        setSubscription(data.data);
      } else {
        let error = {};
        try {
          const responseText = await response.text();
          if (responseText.trim()) {
            error = JSON.parse(responseText);
          }
        } catch (jsonError) {
          error = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Subscription API error:', error);
        
        // Don't show error toast for database unavailability to avoid spam
        if (response.status !== 503) {
          toast.error((error as any).message || 'Failed to load subscription status');
        }
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
      toast.error('Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePlan = () => {
    router.push('/subscription/plans');
  };

  const handleManageSubscription = () => {
    router.push('/subscription/manage');
  };

  const handleUpgradeToPlan = async (planId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      console.log('🔄 Upgrading to plan:', planId);
      
      const response = await fetch('/api/subscription/update', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: planId,
          paymentMethod: 'manual', // For now, manual payment
          paymentIntentId: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Plan upgraded successfully:', data.data);
        setSubscription(data.data);
        toast.success('Plan upgraded successfully!');
      } else {
        const error = await response.json();
        console.error('❌ Upgrade failed:', error);
        toast.error(error.message || 'Failed to upgrade plan');
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      toast.error('Failed to upgrade plan');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenewal = async () => {
    if (!subscription) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const newAutoRenew = !subscription.autoRenew;
      console.log('🔄 Toggling auto-renewal:', newAutoRenew);
      
      const response = await fetch('/api/subscription/update', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: subscription.plan,
          autoRenew: newAutoRenew
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Auto-renewal updated:', data.data);
        setSubscription(data.data);
        toast.success(`Auto-renewal ${newAutoRenew ? 'enabled' : 'disabled'} successfully!`);
      } else {
        const error = await response.json();
        console.error('❌ Auto-renewal update failed:', error);
        toast.error(error.message || 'Failed to update auto-renewal');
      }
    } catch (error) {
      console.error('Error updating auto-renewal:', error);
      toast.error('Failed to update auto-renewal');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      TRIAL: { variant: 'outline' as const, className: 'text-blue-600 border-blue-200', icon: Clock },
      ACTIVE: { variant: 'default' as const, className: 'text-green-600 bg-green-100', icon: CheckCircle },
      EXPIRED: { variant: 'destructive' as const, className: 'text-red-600 bg-red-100', icon: AlertTriangle },
      SUSPENDED: { variant: 'secondary' as const, className: 'text-yellow-600 bg-yellow-100', icon: AlertTriangle },
      CANCELLED: { variant: 'outline' as const, className: 'text-gray-600 border-gray-200', icon: AlertTriangle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.TRIAL;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getPlanIcon = (plan: string) => {
    if (plan.includes('ENTERPRISE')) return Crown;
    if (plan.includes('PROFESSIONAL')) return Star;
    return CreditCard;
  };

  const formatPlanName = (plan: string) => {
    const planNames: { [key: string]: string } = {
      'TRIAL_30_DAYS': 'Trial Plan',
      'BASIC_MONTHLY': 'Basic Monthly',
      'BASIC_YEARLY': 'Basic Yearly',
      'PROFESSIONAL_MONTHLY': 'Professional Monthly',
      'PROFESSIONAL_YEARLY': 'Professional Yearly',
      'ENTERPRISE_MONTHLY': 'Enterprise Monthly',
      'ENTERPRISE_YEARLY': 'Enterprise Yearly'
    };
    return planNames[plan] || plan;
  };

  const getTrialProgress = () => {
    if (!subscription?.isTrial || !subscription.trialEndDate) return 0;
    
    const startDate = new Date(subscription.startDate);
    const endDate = new Date(subscription.trialEndDate);
    const now = new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>Your current plan and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>Your current plan and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Unable to load subscription status</p>
            <Button onClick={loadSubscriptionStatus} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const PlanIcon = getPlanIcon(subscription.plan);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlanIcon className="h-5 w-5" />
            <div>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>Your current plan and usage</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubscriptionStatus}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Details */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{formatPlanName(subscription.plan)}</h3>
              {getStatusBadge(subscription.status)}
              {subscription.isInherited && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <Crown className="h-3 w-3 mr-1" />
                  Inherited
                </Badge>
              )}
            </div>
            
            {subscription.isTrial ? (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">30 days free trial</p>
                <p className="text-xs text-gray-500">
                  {subscription.daysRemaining > 0 
                    ? `Expires in ${subscription.daysRemaining} days`
                    : 'Trial expired'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  ${subscription.price}/{subscription.currency.toLowerCase()}
                </p>
                <p className="text-xs text-gray-500">
                  {subscription.autoRenew ? 'Auto-renewal enabled' : 'Manual renewal'}
                </p>
              </div>
            )}
            
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Plan Limits</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {subscription.planLimits.shops === -1 ? 'Unlimited' : subscription.planLimits.shops} Shops
              </div>
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {subscription.planLimits.products === -1 ? 'Unlimited' : subscription.planLimits.products} Products
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {subscription.planLimits.users === -1 ? 'Unlimited' : subscription.planLimits.users} Users
              </div>
            </div>
          </div>
        </div>

        {/* Trial Progress */}
        {subscription.isTrial && subscription.daysRemaining > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Trial Progress</span>
              <span className="text-gray-500">{Math.round(getTrialProgress())}%</span>
            </div>
            <Progress value={getTrialProgress()} className="h-2" />
          </div>
        )}

        {/* Auto-Renewal Toggle - Only show for non-inherited subscriptions */}
        {subscription.isActive && !subscription.isInherited && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Auto-Renewal</span>
              </div>
              <button
                onClick={handleToggleAutoRenewal}
                disabled={loading}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                {subscription.autoRenew ? (
                  <>
                    <ToggleRight className="h-5 w-5 text-green-600" />
                    <span className="text-green-600">Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-500">Disabled</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {subscription.autoRenew 
                ? 'Your subscription will automatically renew on the end date'
                : 'Your subscription will expire on the end date and won\'t auto-renew'
              }
            </p>
          </div>
        )}

        {/* Action Buttons - Only show for non-inherited subscriptions */}
        {!subscription.isInherited && (
          <div className="pt-2 space-y-2">
            {subscription.isTrial || subscription.isExpired ? (
            <div className="space-y-2">
              <Button onClick={handleUpgradePlan} className="w-full">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
              {/* Quick upgrade buttons for testing */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUpgradeToPlan('PROFESSIONAL_MONTHLY')}
                  disabled={loading}
                  className="text-xs"
                >
                  Professional
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUpgradeToPlan('ENTERPRISE_MONTHLY')}
                  disabled={loading}
                  className="text-xs"
                >
                  Enterprise
                </Button>
              </div>
            </div>
          ) : subscription.isActive ? (
            <div className="space-y-2">
              <Button variant="outline" onClick={handleManageSubscription} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
              {/* Quick upgrade buttons for active subscriptions */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUpgradeToPlan('PROFESSIONAL_MONTHLY')}
                  disabled={loading || subscription.plan === 'PROFESSIONAL_MONTHLY'}
                  className="text-xs"
                >
                  Professional
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleUpgradeToPlan('ENTERPRISE_MONTHLY')}
                  disabled={loading || subscription.plan === 'ENTERPRISE_MONTHLY'}
                  className="text-xs"
                >
                  Enterprise
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleUpgradePlan} className="w-full">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reactivate Plan
            </Button>
          )}
          </div>
        )}

        {/* Inherited Subscription Notice */}
        {subscription.isInherited && (
          <div className="pt-2 border-t">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <Crown className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Subscription Management</p>
                  <p className="text-xs text-blue-700">
                    This subscription is managed by {subscription.customer.email}. 
                    Contact them for plan changes, billing, or subscription management.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features - Only show for non-inherited subscriptions */}
        {!subscription.isInherited && (
          <div className="pt-2 border-t">
            <div className="text-sm font-medium text-gray-700 mb-2">Plan Features</div>
            <div className="grid grid-cols-1 gap-1">
              {subscription.planLimits.features.slice(0, 3).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {feature}
                </div>
              ))}
              {subscription.planLimits.features.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{subscription.planLimits.features.length - 3} more features
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
