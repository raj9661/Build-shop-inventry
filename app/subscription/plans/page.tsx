'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  CreditCard, 
  Crown,
  Star,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAuthGuard } from '@/app/hooks/use-auth-guard';
import { AuthLoadingScreen } from '@/app/components/auth-loading-screen';
import { SessionExpiredScreen } from '@/app/components/session-expired-screen';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  features: string[];
  popular: boolean;
  limits: {
    shops: number;
    products: number;
    users: number;
  };
}

interface SubscriptionPlansProps {
  currentPlan?: string;
  onPlanSelect?: (plan: SubscriptionPlan) => void;
}

export default function SubscriptionPlans({ currentPlan, onPlanSelect }: SubscriptionPlansProps) {
  const { authReady, isAuthenticated } = useAuthGuard();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(currentPlan || null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscription/plans');
      
      if (response.ok) {
        const data = await response.json();
        setPlans(data.data);
      } else {
        toast.error('Failed to load subscription plans');
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan.id);
    if (onPlanSelect) {
      onPlanSelect(plan);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    try {
      setUpgrading(true);
      
      // For now, we'll just show a success message
      // In a real implementation, you'd integrate with a payment provider
      toast.success(`Upgrading to ${plans.find(p => p.id === selectedPlan)?.name}...`);
      
      // Simulate upgrade process
      setTimeout(() => {
        toast.success('Plan upgraded successfully!');
        router.push('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Error upgrading plan:', error);
      toast.error('Failed to upgrade plan');
    } finally {
      setUpgrading(false);
    }
  };

  const getPlanIcon = (planId: string) => {
    if (planId.includes('ENTERPRISE')) return Crown;
    if (planId.includes('PROFESSIONAL')) return Star;
    return CreditCard;
  };

  const formatLimits = (limits: { shops: number; products: number; users: number }) => {
    const formatNumber = (num: number) => num === -1 ? 'Unlimited' : num.toString();
    
    return `${formatNumber(limits.shops)} Shops • ${formatNumber(limits.products)} Products • ${formatNumber(limits.users)} Users`;
  };

  if (!authReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <SessionExpiredScreen />;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
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
        
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Select the plan that best fits your business needs. All plans include our core inventory management features.
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
        {plans.map((plan) => {
          const PlanIcon = getPlanIcon(plan.id);
          const isSelected = selectedPlan === plan.id;
          const isCurrentPlan = currentPlan === plan.id;
          
          return (
            <Card
              key={plan.id}
              className={`relative cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              } ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => handlePlanSelect(plan)}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-4 bg-blue-500 text-white">
                  <Star className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
              
              {isCurrentPlan && (
                <Badge className="absolute -top-2 right-4 bg-green-500 text-white">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  <PlanIcon className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
                <CardDescription className="text-sm text-gray-500 mt-2">
                  {formatLimits(plan.limits)}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-4">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${
                        isSelected ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }`}
                      variant={isSelected ? 'default' : 'outline'}
                    >
                      {isSelected ? 'Selected' : 'Select Plan'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upgrade Button */}
      {selectedPlan && !currentPlan && (
        <div className="text-center">
          <Button
            onClick={handleUpgrade}
            disabled={upgrading}
            size="lg"
            className="px-8"
          >
            {upgrading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade to {plans.find(p => p.id === selectedPlan)?.name}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Features Comparison */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">Feature Comparison</h2>
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Features</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="text-center py-3 px-4 font-medium">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">Shops</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.limits.shops === -1 ? 'Unlimited' : plan.limits.shops}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Products</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.limits.products === -1 ? 'Unlimited' : plan.limits.products}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Users</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.limits.users === -1 ? 'Unlimited' : plan.limits.users}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Support</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.id.includes('ENTERPRISE') ? 'Dedicated' : 
                         plan.id.includes('PROFESSIONAL') ? 'Priority' : 'Email'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
