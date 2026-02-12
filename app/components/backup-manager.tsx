'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Trash2, Database, Clock, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authUtils } from '@/app/lib/utils';

interface BackupRecord {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  status: 'success' | 'failed';
  error?: string;
}

interface BackupSchedule {
  nextBackup: Date;
  frequency: string;
}

interface BackupData {
  backups: BackupRecord[];
  schedule: BackupSchedule;
  settings: {
    backupFrequency: string;
    nextBackup: Date;
  };
}

export function BackupManager() {
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!authUtils.isAuthenticated()) {
        setError('Authentication required');
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/backup', {
        headers: authUtils.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }

      const data = await response.json();
      setBackupData(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: "Error",
        description: "Failed to fetch backup information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const createBackup = async () => {
    try {
      setCreatingBackup(true);
      if (!authUtils.isAuthenticated()) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: authUtils.getAuthHeaders(),
        body: JSON.stringify({ action: 'create' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create backup');
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });

      await fetchBackups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive",
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore from backup "${filename}"? This will overwrite current data.`)) {
      return;
    }

    try {
      setRestoringBackup(filename);
      if (!authUtils.isAuthenticated()) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: authUtils.getAuthHeaders(),
        body: JSON.stringify({ action: 'restore', filename }),
      });

      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });

      await fetchBackups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore backup",
        variant: "destructive",
      });
    } finally {
      setRestoringBackup(null);
    }
  };

  const cleanupBackups = async () => {
    try {
      if (!authUtils.isAuthenticated()) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: authUtils.getAuthHeaders(),
        body: JSON.stringify({ action: 'cleanup' }),
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup backups');
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });

      await fetchBackups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cleanup old backups",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Database Backup Management</CardTitle>
            <CardDescription>Loading backup information...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Database Backup Management</CardTitle>
            <CardDescription>Error loading backup system</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => {
                setError(null);
                fetchBackups();
              }}
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backup Management
          </CardTitle>
          <CardDescription>
            Manage database backups, create new backups, and restore from existing ones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={createBackup} 
              disabled={creatingBackup}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {creatingBackup ? 'Creating Backup...' : 'Create Backup'}
            </Button>
            
            <Button 
              onClick={cleanupBackups}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Cleanup Old Backups
            </Button>
          </div>

          {backupData?.schedule && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Next scheduled backup: {formatDate(backupData.schedule.nextBackup)} 
                (Frequency: {backupData.schedule.frequency})
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Available Backups
          </CardTitle>
          <CardDescription>
            {backupData?.backups.length || 0} backup(s) available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupData?.backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No backups available. Create your first backup to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {backupData?.backups.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{backup.filename}</span>
                      <Badge variant={backup.status === 'success' ? 'default' : 'destructive'}>
                        {backup.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Created: {formatDate(backup.createdAt)} • Size: {formatFileSize(backup.size)}
                    </div>
                    {backup.error && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {backup.error}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreBackup(backup.filename)}
                      disabled={restoringBackup === backup.filename || backup.status === 'failed'}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {restoringBackup === backup.filename ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Backup Location</h4>
              <p className="text-sm text-muted-foreground">
                Backups are stored locally in the <code>backups/</code> directory
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Backup Format</h4>
              <p className="text-sm text-muted-foreground">
                SQL dump files compatible with CockroachDB
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Retention Policy</h4>
              <p className="text-sm text-muted-foreground">
                Old backups are automatically cleaned up based on system settings
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Security</h4>
              <p className="text-sm text-muted-foreground">
                Only SUPER_DUPER_ADMIN users can access backup management
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
