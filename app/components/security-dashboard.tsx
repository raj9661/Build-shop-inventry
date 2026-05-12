"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Activity,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SecurityStats {
  totalUsers: number;
  activeSessions: number;
  expiredSessions: number;
  recentSecurityEvents: number;
  failedLoginAttempts: number;
}

interface SecurityEvent {
  id: number;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { toast } = useToast();

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // Load security statistics
      const statsResponse = await fetch('/api/analytics?type=security', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load recent security events
      const eventsResponse = await fetch('/api/analytics?type=security_events&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setRecentEvents(eventsData.data || []);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast({
        title: "Error",
        description: "Failed to load security data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const getSecurityLevel = () => {
    if (!stats) return { level: 'Unknown', color: 'text-gray-600', score: 0 };
    
    let score = 100;
    
    // Deduct points for security issues
    if (stats.failedLoginAttempts > 10) score -= 20;
    if (stats.expiredSessions > stats.activeSessions * 0.5) score -= 15;
    if (stats.recentSecurityEvents > 50) score -= 25;
    
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600', score };
    if (score >= 60) return { level: 'Good', color: 'text-blue-600', score };
    if (score >= 40) return { level: 'Fair', color: 'text-yellow-600', score };
    return { level: 'Poor', color: 'text-red-600', score };
  };

  const formatEventAction = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'login': 'User Login',
      'logout': 'User Logout',
      'password_changed': 'Password Changed',
      'user_created': 'User Created',
      'user_updated': 'User Updated',
      'user_deleted': 'User Deleted',
      'forced_logout': 'Forced Logout',
      'failed_login': 'Failed Login',
      'suspicious_activity': 'Suspicious Activity'
    };
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventIcon = (action: string) => {
    if (action.includes('login')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('logout')) return <Clock className="h-4 w-4 text-blue-500" />;
    if (action.includes('password')) return <Shield className="h-4 w-4 text-purple-500" />;
    if (action.includes('user')) return <Users className="h-4 w-4 text-orange-500" />;
    if (action.includes('failed') || action.includes('suspicious')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const securityLevel = getSecurityLevel();

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: securityLevel.color.replace('text-', '').replace('-600', '') }}>
              {securityLevel.score}
            </div>
            <p className={`text-xs ${securityLevel.color}`}>
              {securityLevel.level} Security
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSessions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.expiredSessions || 0} expired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failedLoginAttempts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentSecurityEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Security Events
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitiveData(!showSensitiveData)}
              >
                {showSensitiveData ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSecurityData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading security events...</span>
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent security events
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  {getEventIcon(event.action)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {formatEventAction(event.action)}
                      </p>
                      <span className="text-xs text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {event.details}
                    </p>
                    {showSensitiveData && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">User:</span> {event.user.name} ({event.user.email})
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">IP:</span> {event.ipAddress}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          <span className="font-medium">User Agent:</span> {event.userAgent}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityLevel.score < 80 && (
              <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Security Score Needs Improvement
                  </p>
                  <p className="text-xs text-yellow-700">
                    Consider reviewing security settings and monitoring for suspicious activity.
                  </p>
                </div>
              </div>
            )}
            
            {stats && stats.failedLoginAttempts > 10 && (
              <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    High Number of Failed Login Attempts
                  </p>
                  <p className="text-xs text-red-700">
                    Consider implementing additional security measures like account lockout.
                  </p>
                </div>
              </div>
            )}
            
            {stats && stats.expiredSessions > stats.activeSessions * 0.5 && (
              <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Many Expired Sessions
                  </p>
                  <p className="text-xs text-blue-700">
                    Consider adjusting session timeout settings for better user experience.
                  </p>
                </div>
              </div>
            )}
            
            {securityLevel.score >= 80 && (
              <div className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Excellent Security Status
                  </p>
                  <p className="text-xs text-green-700">
                    Your system security is well-maintained. Keep monitoring for any changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 