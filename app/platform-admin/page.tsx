'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  CreditCard, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Shield,
  BarChart3
} from 'lucide-react';

interface PlatformOverview {
  totalCustomers: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  suspendedSubscriptions: number;
  monthlyRevenue: number;
  recentCustomers: any[];
  recentViolations: any[];
  platformAnalytics: any[];
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isActive: boolean;
  };
  endDate: string;
  price: number;
  currency: string;
}

interface Violation {
  id: string;
  type: string;
  status: string;
  title: string;
  severity: number;
  createdAt: string;
  customer: {
    name: string;
    email: string;
  };
}

export default function PlatformAdminDashboard() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);
      
      const [overviewRes, subscriptionsRes, violationsRes] = await Promise.all([
        fetch('/api/platform/admin'),
        fetch('/api/platform/subscriptions'),
        fetch('/api/platform/violations')
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setOverview(overviewData.overview);
      }

      if (subscriptionsRes.ok) {
        const subscriptionsData = await subscriptionsRes.json();
        setSubscriptions(subscriptionsData.subscriptions);
      }

      if (violationsRes.ok) {
        const violationsData = await violationsRes.json();
        setViolations(violationsData.violations);
      }
    } catch (error) {
      console.error('Error fetching platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      TRIAL: 'bg-blue-100 text-blue-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-yellow-100 text-yellow-800'
    };
    
    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: number) => {
    const severityColors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-orange-100 text-orange-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-red-200 text-red-900'
    };
    
    return (
      <Badge className={severityColors[severity] || 'bg-gray-100 text-gray-800'}>
        Level {severity}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Administration</h1>
          <p className="text-gray-600 mt-2">Manage your SaaS platform and customers</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.totalCustomers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.activeSubscriptions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {overview?.trialSubscriptions || 0} trials
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${overview?.monthlyRevenue?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +8% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suspended Accounts</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.suspendedSubscriptions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Requires attention
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Customers</CardTitle>
                  <CardDescription>Latest customer registrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {overview?.recentCustomers?.slice(0, 5).map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-600">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(customer.customerSubscription?.status)}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(customer.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Violations</CardTitle>
                  <CardDescription>Latest violation reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {overview?.recentViolations?.slice(0, 5).map((violation) => (
                      <div key={violation.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{violation.title}</p>
                          <p className="text-sm text-gray-600">{violation.customer?.name}</p>
                        </div>
                        <div className="text-right">
                          {getSeverityBadge(violation.severity)}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(violation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Management</CardTitle>
                <CardDescription>Manage your platform customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {overview?.recentCustomers?.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-600">{customer.email}</p>
                          <p className="text-xs text-gray-500">
                            Joined {new Date(customer.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(customer.customerSubscription?.status)}
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>Manage customer subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subscriptions.map((subscription) => (
                    <div key={subscription.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{subscription.customer.name}</p>
                          <p className="text-sm text-gray-600">{subscription.customer.email}</p>
                          <p className="text-xs text-gray-500">
                            Plan: {subscription.plan} • ${subscription.price}/{subscription.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(subscription.status)}
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="violations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Violation Management</CardTitle>
                <CardDescription>Handle customer violations and reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {violations.map((violation) => (
                    <div key={violation.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">{violation.title}</p>
                          <p className="text-sm text-gray-600">{violation.customer.name}</p>
                          <p className="text-xs text-gray-500">
                            Type: {violation.type} • {new Date(violation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getSeverityBadge(violation.severity)}
                        {getStatusBadge(violation.status)}
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
