"use client"

import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  policy?: PasswordPolicy;
  showPolicy?: boolean;
}

export function PasswordStrengthIndicator({ 
  password, 
  policy,
  showPolicy = true 
}: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState(0);
  const [level, setLevel] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [policyChecks, setPolicyChecks] = useState<{
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    specialChars: boolean;
  }>({
    minLength: false,
    uppercase: false,
    lowercase: false,
    numbers: false,
    specialChars: false
  });

  const defaultPolicy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  };

  const currentPolicy = policy || defaultPolicy;

  useEffect(() => {
    calculatePasswordStrength();
    checkPolicyCompliance();
  }, [password, currentPolicy]);

  const calculatePasswordStrength = () => {
    let score = 0;

    // Length contribution (up to 25 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;

    // Character variety contribution (up to 50 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20;

    // Complexity contribution (up to 25 points)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 15;
    if (uniqueChars >= password.length * 0.9) score += 10;

    score = Math.min(score, 100);
    setStrength(score);

    // Set level and color
    if (score >= 80) {
      setLevel('Very Strong');
      setColor('text-green-600');
      setDescription('Excellent password strength');
    } else if (score >= 60) {
      setLevel('Strong');
      setColor('text-blue-600');
      setDescription('Good password strength');
    } else if (score >= 40) {
      setLevel('Moderate');
      setColor('text-yellow-600');
      setDescription('Acceptable password strength');
    } else if (score >= 20) {
      setLevel('Weak');
      setColor('text-orange-600');
      setDescription('Password needs improvement');
    } else {
      setLevel('Very Weak');
      setColor('text-red-600');
      setDescription('Password is too weak');
    }
  };

  const checkPolicyCompliance = () => {
    setPolicyChecks({
      minLength: password.length >= currentPolicy.minLength,
      uppercase: !currentPolicy.requireUppercase || /[A-Z]/.test(password),
      lowercase: !currentPolicy.requireLowercase || /[a-z]/.test(password),
      numbers: !currentPolicy.requireNumbers || /\d/.test(password),
      specialChars: !currentPolicy.requireSpecialChars || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    });
  };

  const getProgressColor = () => {
    if (strength >= 80) return 'bg-green-500';
    if (strength >= 60) return 'bg-blue-500';
    if (strength >= 40) return 'bg-yellow-500';
    if (strength >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const isPolicyCompliant = () => {
    return Object.values(policyChecks).every(check => check);
  };

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Password Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Password Strength</span>
          <Badge variant={strength >= 60 ? "default" : "secondary"} className={color}>
            {level}
          </Badge>
        </div>
        <Progress value={strength} className="h-2" />
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {/* Policy Compliance */}
      {showPolicy && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Policy Requirements</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {policyChecks.minLength ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs">
                At least {currentPolicy.minLength} characters
              </span>
            </div>
            
            {currentPolicy.requireUppercase && (
              <div className="flex items-center space-x-2">
                {policyChecks.uppercase ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs">At least one uppercase letter</span>
              </div>
            )}
            
            {currentPolicy.requireLowercase && (
              <div className="flex items-center space-x-2">
                {policyChecks.lowercase ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs">At least one lowercase letter</span>
              </div>
            )}
            
            {currentPolicy.requireNumbers && (
              <div className="flex items-center space-x-2">
                {policyChecks.numbers ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs">At least one number</span>
              </div>
            )}
            
            {currentPolicy.requireSpecialChars && (
              <div className="flex items-center space-x-2">
                {policyChecks.specialChars ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs">At least one special character</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Status */}
      <div className={`flex items-center space-x-2 p-2 rounded-lg ${
        isPolicyCompliant() 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        {isPolicyCompliant() ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <span className={`text-xs font-medium ${
          isPolicyCompliant() ? 'text-green-800' : 'text-red-800'
        }`}>
          {isPolicyCompliant() 
            ? 'Password meets all requirements' 
            : 'Password does not meet all requirements'
          }
        </span>
      </div>
    </div>
  );
} 