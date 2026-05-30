'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  CreditCard, 
  Users, 
  BarChart3, 
  Shield,
  Star,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

const SUBSCRIPTION_PLANS = {
  TRIAL_30_DAYS: {
    name: '30-Day Free Trial',
    price: 0,
    currency: 'USD',
    period: '30 days',
    features: [
      '1 Shop',
      'Up to 100 products',
      'Basic TMT inventory',
      '1 user account',
      'Email support'
    ],
    popular: false
  },
  BASIC_MONTHLY: {
    name: 'Basic Monthly',
    price: 29,
    currency: 'USD',
    period: 'month',
    features: [
      '2 Shops',
      'Up to 500 products',
      'Complete inventory management',
      'Up to 3 user accounts',
      'Basic analytics',
      'Email support'
    ],
    popular: false
  },
  BASIC_YEARLY: {
    name: 'Basic Yearly',
    price: 290,
    currency: 'USD',
    period: 'year',
    features: [
      '2 Shops',
      'Up to 500 products',
      'Complete inventory management',
      'Up to 3 user accounts',
      'Basic analytics',
      'Email support',
      '2 months free'
    ],
    popular: true
  },
  PROFESSIONAL_MONTHLY: {
    name: 'Professional Monthly',
    price: 79,
    currency: 'USD',
    period: 'month',
    features: [
      '5 Shops',
      'Up to 2000 products',
      'Advanced analytics',
      'Up to 10 user accounts',
      'API access',
      'Priority support',
      'Custom reports'
    ],
    popular: false
  },
  PROFESSIONAL_YEARLY: {
    name: 'Professional Yearly',
    price: 790,
    currency: 'USD',
    period: 'year',
    features: [
      '5 Shops',
      'Up to 2000 products',
      'Advanced analytics',
      'Up to 10 user accounts',
      'API access',
      'Priority support',
      'Custom reports',
      '2 months free'
    ],
    popular: false
  },
  ENTERPRISE_MONTHLY: {
    name: 'Enterprise Monthly',
    price: 199,
    currency: 'USD',
    period: 'month',
    features: [
      'Unlimited shops',
      'Unlimited products',
      'White-label options',
      'Unlimited users',
      'Custom integrations',
      'Dedicated support',
      'Advanced security'
    ],
    popular: false
  },
  ENTERPRISE_YEARLY: {
    name: 'Enterprise Yearly',
    price: 1990,
    currency: 'USD',
    period: 'year',
    features: [
      'Unlimited shops',
      'Unlimited products',
      'White-label options',
      'Unlimited users',
      'Custom integrations',
      'Dedicated support',
      'Advanced security',
      '2 months free'
    ],
    popular: false
  }
};

export default function CustomerOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    name: '',
    email: '',
    phone: '',
    companyName: '',
    
    // Step 2: Plan Selection
    selectedPlan: 'TRIAL_30_DAYS',
    
    // Step 3: Business Information
    businessType: '',
    numberOfShops: '',
    currentSystem: '',
    specificNeeds: '',
    
    // Step 4: Account Setup
    username: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    subscribeToNewsletter: false
  });

  const totalSteps = 4;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Create customer account
      const response = await fetch('/api/platform/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerData: {
            name: formData.name,
            username: formData.username,
            email: formData.email,
            password: formData.password, // Should be hashed on server
            phone: formData.phone
          },
          subscriptionData: {
            plan: formData.selectedPlan,
            status: formData.selectedPlan === 'TRIAL_30_DAYS' ? 'TRIAL' : 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + (formData.selectedPlan.includes('YEARLY') ? 365 : 30) * 24 * 60 * 60 * 1000),
            trialEndDate: formData.selectedPlan === 'TRIAL_30_DAYS' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
            price: (SUBSCRIPTION_PLANS as any)[formData.selectedPlan].price,
            currency: (SUBSCRIPTION_PLANS as any)[formData.selectedPlan].currency,
            autoRenew: true
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Customer created:', result);
        
        // Redirect to dashboard or login
        router.push('/login?message=account-created');
      } else {
        const error = await response.json();
        console.error('Error creating customer:', error);
        alert('Failed to create account. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>Tell us about yourself and your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  handleInputChange('phone', value);
                }
              }}
              placeholder="9876543210"
              maxLength={10}
            />
          </div>
          <div>
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="Enter your company name"
              required
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>Select the plan that best fits your business needs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
            <div
              key={key}
              className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                formData.selectedPlan === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => handleInputChange('selectedPlan', key)}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-4 bg-blue-500">
                  <Star className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
              
              <div className="text-center">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
                
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>Help us understand your business better</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="businessType">Business Type</Label>
            <Select value={formData.businessType} onValueChange={(value) => handleInputChange('businessType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="construction">Construction Materials</SelectItem>
                <SelectItem value="hardware">Hardware Store</SelectItem>
                <SelectItem value="building-supplies">Building Supplies</SelectItem>
                <SelectItem value="distributor">Distributor</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="numberOfShops">Number of Shops</Label>
            <Select value={formData.numberOfShops} onValueChange={(value) => handleInputChange('numberOfShops', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select number of shops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Shop</SelectItem>
                <SelectItem value="2-5">2-5 Shops</SelectItem>
                <SelectItem value="6-10">6-10 Shops</SelectItem>
                <SelectItem value="10+">10+ Shops</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label htmlFor="currentSystem">Current System</Label>
          <Select value={formData.currentSystem} onValueChange={(value) => handleInputChange('currentSystem', value)}>
            <SelectTrigger>
              <SelectValue placeholder="What system are you currently using?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual/Paper-based</SelectItem>
              <SelectItem value="excel">Excel/Spreadsheets</SelectItem>
              <SelectItem value="other-software">Other Software</SelectItem>
              <SelectItem value="none">No System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="specificNeeds">Specific Needs</Label>
          <Textarea
            id="specificNeeds"
            value={formData.specificNeeds}
            onChange={(e) => handleInputChange('specificNeeds', e.target.value)}
            placeholder="Tell us about any specific requirements or features you need..."
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Account Setup</CardTitle>
        <CardDescription>Create your account credentials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="Choose a username"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Create a password"
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked)}
            />
            <Label htmlFor="agreeToTerms" className="text-sm">
              I agree to the Terms of Service and Privacy Policy *
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="subscribeToNewsletter"
              checked={formData.subscribeToNewsletter}
              onCheckedChange={(checked) => handleInputChange('subscribeToNewsletter', checked)}
            />
            <Label htmlFor="subscribeToNewsletter" className="text-sm">
              Subscribe to our newsletter for updates and tips
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.email && formData.companyName;
      case 2:
        return formData.selectedPlan;
      case 3:
        return true; // Optional step
      case 4:
        return formData.username && formData.password && formData.confirmPassword && 
               formData.password === formData.confirmPassword && formData.agreeToTerms;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Get Started</h1>
            <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid() || loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
