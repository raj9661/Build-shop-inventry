'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: '',
    agreeToTerms: false,
    subscribeNewsletter: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [passwordCriteria, setPasswordCriteria] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isAlphanumeric: false
  });
  
  const router = useRouter();
  const { toast } = useToast();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, [validationTimeout]);

  const checkPasswordCriteria = (password: string) => {
    const criteria = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      isAlphanumeric: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/.test(password)
    };
    setPasswordCriteria(criteria);
    return criteria;
  };

  const checkUniqueness = async (field: 'email' | 'phone', value: string) => {
    if (!value.trim()) return;

    setValidating(prev => ({ ...prev, [field]: true }));

    try {
      const response = await fetch('/api/auth/check-uniqueness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      const data = await response.json();

      if (data.success && data.checks[field]) {
        if (data.checks[field].exists) {
          setErrors(prev => ({ ...prev, [field]: data.checks[field].message }));
        } else {
          setErrors(prev => ({ ...prev, [field]: '' }));
        }
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(prev => ({ ...prev, [field]: false }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const criteria = checkPasswordCriteria(formData.password);
      const allCriteriaMet = criteria.minLength && criteria.hasUppercase && criteria.hasLowercase && 
                            criteria.hasNumber && criteria.hasSpecialChar && criteria.isAlphanumeric;
      if (!allCriteriaMet) {
        newErrors.password = 'Password does not meet all requirements';
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.company.trim()) {
      newErrors.company = 'Company name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Phone number must be exactly 10 digits';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    // Set errors and return validation result
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          company: formData.company,
          phone: formData.phone.replace(/\D/g, ''), // Clean phone number to digits only
          subscribeNewsletter: formData.subscribeNewsletter
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.requiresVerification) {
          toast({
            title: "Account Created Successfully!",
            description: "Please check your email for verification code.",
          });
          router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
        } else {
          toast({
            title: "Account Created Successfully!",
            description: "Welcome to InventryPro! You can now sign in to your account.",
          });
          router.push('/login');
        }
      } else {
        toast({
          title: "Registration Failed",
          description: data.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Check password criteria immediately
    if (field === 'password' && typeof value === 'string') {
      checkPasswordCriteria(value);
      // Also check confirm password match if confirm password exists
      if (formData.confirmPassword) {
        if (value !== formData.confirmPassword) {
          setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
        } else {
          setErrors(prev => ({ ...prev, confirmPassword: '' }));
        }
      }
    }

    // Check phone number format immediately
    if (field === 'phone' && typeof value === 'string') {
      const phoneDigits = value.replace(/\D/g, '');
      if (phoneDigits.length > 10) {
        // Limit to 10 digits
        const limitedPhone = phoneDigits.slice(0, 10);
        setFormData(prev => ({ ...prev, phone: limitedPhone }));
        return;
      }
      
      // Check if phone is valid (exactly 10 digits)
      if (phoneDigits.length === 10) {
        setErrors(prev => ({ ...prev, phone: '' }));
      } else if (phoneDigits.length > 0) {
        setErrors(prev => ({ ...prev, phone: 'Phone number must be exactly 10 digits' }));
      }
    }

    // Check confirm password match immediately
    if (field === 'confirmPassword' && typeof value === 'string') {
      if (formData.password && value !== formData.password) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else if (formData.password && value === formData.password) {
        setErrors(prev => ({ ...prev, confirmPassword: '' }));
      }
    }

    // Debounced validation for email and phone
    if (field === 'email' || field === 'phone') {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }

      const timeout = setTimeout(() => {
        if (typeof value === 'string' && value.trim()) {
          // For phone, use only digits for uniqueness check
          const valueToCheck = field === 'phone' ? value.replace(/\D/g, '') : value;
          if (valueToCheck) {
            checkUniqueness(field as 'email' | 'phone', valueToCheck);
          }
        }
      }, 500);

      setValidationTimeout(timeout);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">InventryPro</span>
          </Link>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
            <CardDescription>
              Start your free 14-day trial today. No credit card required.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`${errors.email ? 'border-red-500' : ''} ${validating.email ? 'pr-10' : ''}`}
                  />
                  {validating.email && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Company */}
              <div className="space-y-2">
                <Label htmlFor="company">Company Name *</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Enter your company name"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className={errors.company ? 'border-red-500' : ''}
                />
                {errors.company && (
                  <p className="text-sm text-red-500">{errors.company}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`${errors.phone ? 'border-red-500' : ''} ${validating.phone ? 'pr-10' : ''}`}
                    maxLength={10}
                  />
                  {validating.phone && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone}</p>
                )}
                {formData.phone && formData.phone.replace(/\D/g, '').length === 10 && !errors.phone && (
                  <p className="text-sm text-green-600 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Valid phone number</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
                
                {/* Password Criteria */}
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 font-medium">Password must contain:</p>
                      {passwordCriteria.minLength && passwordCriteria.hasUppercase && passwordCriteria.hasLowercase && 
                       passwordCriteria.hasNumber && passwordCriteria.hasSpecialChar && passwordCriteria.isAlphanumeric && (
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          <span className="text-xs font-medium">Strong password!</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center space-x-1 ${passwordCriteria.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.minLength ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>8+ characters</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordCriteria.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.hasUppercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>1 uppercase</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordCriteria.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.hasLowercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>1 lowercase</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordCriteria.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>1 number</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordCriteria.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>1 special char</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordCriteria.isAlphanumeric ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${passwordCriteria.isAlphanumeric ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span>Valid chars only</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`${errors.confirmPassword ? 'border-red-500' : ''} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
                {formData.confirmPassword && formData.password && formData.password === formData.confirmPassword && !errors.confirmPassword && (
                  <p className="text-sm text-green-600 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Passwords match!</span>
                  </p>
                )}
              </div>

              {/* Terms and Newsletter */}
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked as boolean)}
                    className={errors.agreeToTerms ? 'border-red-500' : ''}
                  />
                  <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed">
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-600 hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </Link>
                    *
                  </Label>
                </div>
                {errors.agreeToTerms && (
                  <p className="text-sm text-red-500">{errors.agreeToTerms}</p>
                )}
                {formData.agreeToTerms && !errors.agreeToTerms && (
                  <p className="text-sm text-green-600 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Terms accepted!</span>
                  </p>
                )}

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="subscribeNewsletter"
                    checked={formData.subscribeNewsletter}
                    onCheckedChange={(checked) => handleInputChange('subscribeNewsletter', checked as boolean)}
                  />
                  <Label htmlFor="subscribeNewsletter" className="text-sm leading-relaxed">
                    Subscribe to our newsletter for product updates and tips
                  </Label>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                disabled={loading || validating.email || validating.phone}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-sm text-gray-600">14-day free trial</span>
          </div>
          <div className="flex flex-col items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-sm text-gray-600">No credit card</span>
          </div>
          <div className="flex flex-col items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-sm text-gray-600">Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
