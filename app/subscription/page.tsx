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
  ToggleRight,
  ArrowLeft,
  Settings,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';

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

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();
  const { t } = useLanguage();

  console.log('🔍 [SubscriptionPage] Component rendered');

  useEffect(() => {
    loadSubscriptionStatus();
    
    // Set up automatic refresh every 60 seconds
    const interval = setInterval(() => {
      loadSubscriptionStatus();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      console.log('🔄 [SubscriptionPage] Loading subscription status...');
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ [SubscriptionPage] No access token found');
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
        console.log('✅ [SubscriptionPage] Subscription data received:', data);
        setSubscription(data.data);
      } else {
        console.error('❌ [SubscriptionPage] API error:', response.status, response.statusText);
        let error = {};
        try {
          const responseText = await response.text();
          if (responseText.trim()) {
            error = JSON.parse(responseText);
          }
        } catch (jsonError) {
          error = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'TRIAL':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'EXPIRED':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPlanIcon = (plan: string) => {
    if (plan.includes('TRIAL')) return Clock;
    if (plan.includes('BASIC')) return Package;
    if (plan.includes('PROFESSIONAL')) return Star;
    if (plan.includes('ENTERPRISE')) return Crown;
    return CreditCard;
  };

  const handleUpgradePlan = () => {
    router.push('/subscription/plans');
  };

  const handleManageSubscription = () => {
    router.push('/subscription/manage');
  };

  const handleDownloadInvoice = () => {
    toast.info('Invoice download feature coming soon');
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-blue-700 font-medium">Loading subscription...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handleBackToDashboard}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
          </div>
          
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Subscription Found</h2>
                <p className="text-gray-600 mb-6">You don't have an active subscription.</p>
                <Button onClick={handleUpgradePlan} size="lg">
                  Choose a Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const PlanIcon = getPlanIcon(subscription.plan);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleBackToDashboard}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and billing</p>
        </div>

        {/* Main Subscription Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlanIcon className="h-6 w-6" />
                <div>
                  <CardTitle className="text-xl">Subscription Status</CardTitle>
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
          <CardContent className="space-y-6">
            {/* Plan Details */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-semibold text-xl">{formatPlanName(subscription.plan)}</h3>
                  {getStatusBadge(subscription.status)}
                  {subscription.isInherited && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      <Crown className="h-3 w-3 mr-1" />
                      Inherited
                    </Badge>
                  )}
                </div>
                
                {subscription.isTrial ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Trial ends on {new Date(subscription.trialEndDate!).toLocaleDateString()}
                    </p>
                    {subscription.daysRemaining > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Days remaining</span>
                          <span className="font-medium">{subscription.daysRemaining} days</span>
                        </div>
                        <Progress 
                          value={Math.max(0, 100 - (subscription.daysRemaining / 30) * 100)} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {subscription.autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Next billing: {new Date(subscription.endDate).toLocaleDateString()}
                    </p>
                    {subscription.daysRemaining > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Days until renewal</span>
                          <span className="font-medium">{subscription.daysRemaining} days</span>
                        </div>
                        <Progress 
                          value={Math.max(0, 100 - (subscription.daysRemaining / 365) * 100)} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold">₹{subscription.price}</div>
                <div className="text-sm text-gray-600">
                  {subscription.plan.includes('YEARLY') ? 'per year' : 'per month'}
                </div>
              </div>
            </div>

            {/* Plan Limits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <Building2 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{subscription.planLimits.shops}</div>
                <div className="text-sm text-gray-600">Shops</div>
              </div>
              <div className="text-center">
                <Package className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{subscription.planLimits.products}</div>
                <div className="text-sm text-gray-600">Products</div>
              </div>
              <div className="text-center">
                <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{subscription.planLimits.users}</div>
                <div className="text-sm text-gray-600">Users</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={handleManageSubscription} className="flex-1">
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
              {subscription.status !== 'ACTIVE' && (
                <Button onClick={handleUpgradePlan} variant="outline" className="flex-1">
                  <Star className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              )}
              <Button onClick={handleDownloadInvoice} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{subscription.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{subscription.customer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role</span>
                <span className="font-medium">{subscription.customer.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Start Date</span>
                <span className="font-medium">{new Date(subscription.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">End Date</span>
                <span className="font-medium">{new Date(subscription.endDate).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plan Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {subscription.planLimits.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
