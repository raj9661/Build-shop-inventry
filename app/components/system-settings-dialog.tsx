"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Globe, 
  Shield, 
  Database, 
  Bell, 
  Palette,
  Save,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PasswordStrengthIndicator } from "./password-strength-indicator"
import { SecurityDashboard } from "./security-dashboard"

interface SystemSettings {
  general: {
    systemName: string
    timezone: string
    currency: string
    language: string
  }
  security: {
    sessionTimeout: number
    requireMFA: boolean
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
    }
  }
  notifications: {
    emailNotifications: boolean
    smsNotifications: boolean
    pushNotifications: boolean
    lowStockAlerts: boolean
    salesReports: boolean
    emailAddresses: string[]
    notificationEmail: string
    shopSpecificNotifications: boolean
    dailyReports: boolean
    weeklyReports: boolean
    monthlyReports: boolean
    criticalAlerts: boolean
  }
  appearance: {
    theme: string
    sidebarCollapsed: boolean
    compactMode: boolean
  }
  database: {
    backupFrequency: string
    retentionDays: number
    autoBackup: boolean
  }
}

interface CreateUserDialogProps {
  onUserCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SystemSettingsDialog({ onUserCreated, open: controlledOpen, onOpenChange }: CreateUserDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange || setUncontrolledOpen;
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  
  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      systemName: "Shop Inventory System",
      timezone: "Asia/Kolkata",
      currency: "INR",
      language: "en"
    },
    security: {
      sessionTimeout: 30,
      requireMFA: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false
      }
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      lowStockAlerts: true,
      salesReports: true,
      emailAddresses: [],
      notificationEmail: "",
      shopSpecificNotifications: false,
      dailyReports: true,
      weeklyReports: true,
      monthlyReports: true,
      criticalAlerts: true
    },
    appearance: {
      theme: "light",
      sidebarCollapsed: false,
      compactMode: false
    },
    database: {
      backupFrequency: "daily",
      retentionDays: 30,
      autoBackup: true
    }
  })

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "System settings have been updated successfully",
        })
        // Trigger a page reload to apply sidebar and compact mode changes
        window.location.reload()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.message || "Failed to save settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (section: keyof SystemSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const updateNestedSetting = <
    S extends keyof SystemSettings,
    N extends keyof SystemSettings[S],
    K extends keyof SystemSettings[S][N]
  >(
    section: S,
    nestedKey: N,
    key: K,
    value: SystemSettings[S][N][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [nestedKey]: {
          ...(prev[section][nestedKey as N] as SystemSettings[S][N]),
          [key]: value
        }
      }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            System Settings
          </DialogTitle>
          <DialogDescription>
            Configure system-wide settings and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="systemName">System Name</Label>
                      <Input
                        id="systemName"
                        value={settings.general.systemName}
                        onChange={(e) => updateSetting('general', 'systemName', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select
                        value={settings.general.timezone}
                        onValueChange={(value) => updateSetting('general', 'timezone', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={settings.general.currency}
                        onValueChange={(value) => updateSetting('general', 'currency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                          <SelectItem value="USD">US Dollar ($)</SelectItem>
                          <SelectItem value="EUR">Euro (€)</SelectItem>
                          <SelectItem value="GBP">British Pound (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={settings.general.language}
                        onValueChange={(value) => updateSetting('general', 'language', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Session Management */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Session Management</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                        <Input
                          id="sessionTimeout"
                          type="number"
                          min="5"
                          max="480"
                          value={settings.security.sessionTimeout}
                          onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Users will be automatically logged out after this period of inactivity
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="requireMFA"
                          checked={settings.security.requireMFA}
                          onCheckedChange={(checked) => updateSetting('security', 'requireMFA', checked)}
                        />
                        <Label htmlFor="requireMFA">Require Multi-Factor Authentication</Label>
                      </div>
                      <p className="text-xs text-gray-500">
                        When enabled, users will be required to set up 2FA for enhanced security
                      </p>
                    </div>
                  </div>
                  
                  {/* Password Policy */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Password Policy</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minLength">Minimum Length</Label>
                        <Input
                          id="minLength"
                          type="number"
                          min="6"
                          max="32"
                          value={settings.security.passwordPolicy.minLength}
                          onChange={(e) => updateNestedSetting('security', 'passwordPolicy', 'minLength', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="requireUppercase"
                          checked={settings.security.passwordPolicy.requireUppercase}
                          onCheckedChange={(checked) => updateNestedSetting('security', 'passwordPolicy', 'requireUppercase', checked)}
                        />
                        <Label htmlFor="requireUppercase">Require Uppercase</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="requireLowercase"
                          checked={settings.security.passwordPolicy.requireLowercase}
                          onCheckedChange={(checked) => updateNestedSetting('security', 'passwordPolicy', 'requireLowercase', checked)}
                        />
                        <Label htmlFor="requireLowercase">Require Lowercase</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="requireNumbers"
                          checked={settings.security.passwordPolicy.requireNumbers}
                          onCheckedChange={(checked) => updateNestedSetting('security', 'passwordPolicy', 'requireNumbers', checked)}
                        />
                        <Label htmlFor="requireNumbers">Require Numbers</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="requireSpecialChars"
                          checked={settings.security.passwordPolicy.requireSpecialChars}
                          onCheckedChange={(checked) => updateNestedSetting('security', 'passwordPolicy', 'requireSpecialChars', checked)}
                        />
                        <Label htmlFor="requireSpecialChars">Require Special Characters</Label>
                      </div>
                    </div>
                  </div>

                  {/* Security Status */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Security Status</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${settings.security.requireMFA ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                          <span className="text-sm">Multi-Factor Authentication</span>
                        </div>
                        <Badge variant={settings.security.requireMFA ? "default" : "secondary"}>
                          {settings.security.requireMFA ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${settings.security.sessionTimeout <= 30 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                          <span className="text-sm">Session Timeout</span>
                        </div>
                        <Badge variant={settings.security.sessionTimeout <= 30 ? "default" : "secondary"}>
                          {settings.security.sessionTimeout} minutes
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${settings.security.passwordPolicy.minLength >= 8 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                          <span className="text-sm">Password Policy</span>
                        </div>
                        <Badge variant={settings.security.passwordPolicy.minLength >= 8 ? "default" : "secondary"}>
                          {settings.security.passwordPolicy.minLength} chars min
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Security Recommendations */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Security Recommendations</h4>
                    <div className="space-y-2">
                      {!settings.security.requireMFA && (
                        <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-800">Enable Multi-Factor Authentication</p>
                            <p className="text-blue-600">Add an extra layer of security to protect user accounts</p>
                          </div>
                        </div>
                      )}
                      
                      {settings.security.sessionTimeout > 60 && (
                        <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-yellow-800">Consider Shorter Session Timeout</p>
                            <p className="text-yellow-600">Longer sessions may pose security risks</p>
                          </div>
                        </div>
                      )}
                      
                      {!settings.security.passwordPolicy.requireSpecialChars && (
                        <div className="flex items-start space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <Shield className="h-4 w-4 text-orange-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-orange-800">Enable Special Characters</p>
                            <p className="text-orange-600">Requiring special characters improves password strength</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Configuration */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Email Configuration</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="notificationEmail">Primary Notification Email</Label>
                        <Input
                          id="notificationEmail"
                          type="email"
                          placeholder="admin@company.com"
                          value={settings.notifications.notificationEmail}
                          onChange={(e) => updateSetting('notifications', 'notificationEmail', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Primary email address for receiving notifications
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="emailNotifications"
                          checked={settings.notifications.emailNotifications}
                          onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
                        />
                        <Label htmlFor="emailNotifications">Enable Email Notifications</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="shopSpecificNotifications"
                          checked={settings.notifications.shopSpecificNotifications}
                          onCheckedChange={(checked) => updateSetting('notifications', 'shopSpecificNotifications', checked)}
                        />
                        <Label htmlFor="shopSpecificNotifications">Shop-Specific Notifications</Label>
                      </div>
                    </div>
                  </div>

                  {/* Notification Types */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Notification Types</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="lowStockAlerts"
                          checked={settings.notifications.lowStockAlerts}
                          onCheckedChange={(checked) => updateSetting('notifications', 'lowStockAlerts', checked)}
                        />
                        <Label htmlFor="lowStockAlerts">Low Stock Alerts</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="criticalAlerts"
                          checked={settings.notifications.criticalAlerts}
                          onCheckedChange={(checked) => updateSetting('notifications', 'criticalAlerts', checked)}
                        />
                        <Label htmlFor="criticalAlerts">Critical Alerts</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="salesReports"
                          checked={settings.notifications.salesReports}
                          onCheckedChange={(checked) => updateSetting('notifications', 'salesReports', checked)}
                        />
                        <Label htmlFor="salesReports">Sales Reports</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="dailyReports"
                          checked={settings.notifications.dailyReports}
                          onCheckedChange={(checked) => updateSetting('notifications', 'dailyReports', checked)}
                        />
                        <Label htmlFor="dailyReports">Daily Reports</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="weeklyReports"
                          checked={settings.notifications.weeklyReports}
                          onCheckedChange={(checked) => updateSetting('notifications', 'weeklyReports', checked)}
                        />
                        <Label htmlFor="weeklyReports">Weekly Reports</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="monthlyReports"
                          checked={settings.notifications.monthlyReports}
                          onCheckedChange={(checked) => updateSetting('notifications', 'monthlyReports', checked)}
                        />
                        <Label htmlFor="monthlyReports">Monthly Reports</Label>
                      </div>
                    </div>
                  </div>

                  {/* Other Notification Methods */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-700">Other Notification Methods</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="smsNotifications"
                          checked={settings.notifications.smsNotifications}
                          onCheckedChange={(checked) => updateSetting('notifications', 'smsNotifications', checked)}
                        />
                        <Label htmlFor="smsNotifications">SMS Notifications</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="pushNotifications"
                          checked={settings.notifications.pushNotifications}
                          onCheckedChange={(checked) => updateSetting('notifications', 'pushNotifications', checked)}
                        />
                        <Label htmlFor="pushNotifications">Push Notifications</Label>
                      </div>
                    </div>
                  </div>

                  {/* Test Notification Button */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/notifications/test', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                            },
                            body: JSON.stringify({
                              email: settings.notifications.notificationEmail,
                              shopName: 'Test Shop'
                            })
                          });
                          
                          if (response.ok) {
                            toast({
                              title: "Test Notification Sent",
                              description: "Check your email for the test notification",
                            });
                          } else {
                            toast({
                              title: "Error",
                              description: "Failed to send test notification",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to send test notification",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!settings.notifications.emailNotifications || !settings.notifications.notificationEmail}
                    >
                      Send Test Notification
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Appearance Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                        value={settings.appearance.theme}
                        onValueChange={(value) => updateSetting('appearance', 'theme', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="sidebarCollapsed"
                        checked={settings.appearance.sidebarCollapsed}
                        onCheckedChange={(checked) => updateSetting('appearance', 'sidebarCollapsed', checked)}
                      />
                      <Label htmlFor="sidebarCollapsed">Collapsed Sidebar</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="compactMode"
                        checked={settings.appearance.compactMode}
                        onCheckedChange={(checked) => updateSetting('appearance', 'compactMode', checked)}
                      />
                      <Label htmlFor="compactMode">Compact Mode</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="backupFrequency">Backup Frequency</Label>
                      <Select
                        value={settings.database.backupFrequency}
                        onValueChange={(value) => updateSetting('database', 'backupFrequency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="retentionDays">Retention Days</Label>
                      <Input
                        id="retentionDays"
                        type="number"
                        value={settings.database.retentionDays}
                        onChange={(e) => updateSetting('database', 'retentionDays', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="autoBackup"
                        checked={settings.database.autoBackup}
                        onCheckedChange={(checked) => updateSetting('database', 'autoBackup', checked)}
                      />
                      <Label htmlFor="autoBackup">Automatic Backup</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 