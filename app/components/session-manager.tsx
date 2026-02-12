"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertTriangle, 
  LogOut, 
  RefreshCw,
  Shield,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

interface SessionInfo {
  userId: number;
  lastActivity: Date;
  isExpired: boolean;
  timeRemaining: number;
}

interface SessionManagerProps {
  showDetails?: boolean;
  autoRefresh?: boolean;
  onSessionExpired?: () => void;
}

export function SessionManager({ 
  showDetails = false, 
  autoRefresh = true,
  onSessionExpired 
}: SessionManagerProps) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Check session status
  const checkSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsExpired(true);
        return;
      }

      const response = await fetch('/api/auth/custom-session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSessionInfo(data.data.sessionInfo);
        setTimeRemaining(data.data.sessionInfo.timeRemaining);
        setIsExpired(false);
      } else {
        if (data.code === 'SESSION_EXPIRED') {
          setIsExpired(true);
          setSessionInfo(null);
          handleSessionExpired();
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
      setIsExpired(true);
    }
  }, []);

  // Extend session
  const extendSession = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/auth/custom-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSessionInfo(data.data.sessionInfo);
        setTimeRemaining(data.data.sessionInfo.timeRemaining);
        setIsExpired(false);
        toast({
          title: "Session Extended",
          description: "Your session has been extended successfully",
        });
      } else {
        toast({
          title: "Session Error",
          description: data.message || "Failed to extend session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Session Error",
        description: "Failed to extend session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Force logout
  const forceLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/auth/custom-session', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'User requested logout' })
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      handleSessionExpired();
    }
  };

  // Handle session expiration
  const handleSessionExpired = () => {
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });

    // Call callback if provided
    if (onSessionExpired) {
      onSessionExpired();
    } else {
      // Default behavior: redirect to login
      router.push('/login');
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (!sessionInfo || isExpired) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000; // Subtract 1 second
        if (newTime <= 0) {
          setIsExpired(true);
          handleSessionExpired();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionInfo, isExpired]);

  // Auto-refresh session status
  useEffect(() => {
    if (!autoRefresh) return;

    checkSession();
    const interval = setInterval(checkSession, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [checkSession, autoRefresh]);

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!sessionInfo) return 0;
    const totalTime = sessionInfo.timeRemaining + (Date.now() - sessionInfo.lastActivity.getTime());
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  };

  // Get status color
  const getStatusColor = () => {
    if (isExpired) return 'text-red-600';
    if (timeRemaining < 5 * 60 * 1000) return 'text-orange-600'; // Less than 5 minutes
    if (timeRemaining < 15 * 60 * 1000) return 'text-yellow-600'; // Less than 15 minutes
    return 'text-green-600';
  };

  if (isExpired) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Session Expired</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/login')}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sessionInfo) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm">Checking session...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          Session Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Time Remaining</span>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>

        {/* Session Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={extendSession}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Extend</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={forceLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Session Details */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Last Activity:</span>
              <span>{sessionInfo.lastActivity.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Status:</span>
              <Badge variant="outline" className="text-xs">
                Active
              </Badge>
            </div>
          </div>
        )}

        {/* Warning for low time */}
        {timeRemaining < 5 * 60 * 1000 && (
          <div className="flex items-center space-x-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-orange-800">
              Session will expire soon. Consider extending your session.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 