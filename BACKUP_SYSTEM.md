# Database Backup System

This document describes the comprehensive backup system implemented for the Shop Inventory Management System.

## Overview

The backup system provides automated database backups with configurable frequency, retention policies, and manual backup/restore capabilities. It's designed specifically for CockroachDB and includes both scheduled and on-demand backup operations.

## Features

### 🔄 Automated Backups
- **Configurable Frequency**: Hourly, daily, weekly, or monthly backups
- **Smart Scheduling**: Automatic backup execution based on system settings
- **Retention Management**: Automatic cleanup of old backups based on retention policy

### 🛠️ Manual Operations
- **On-Demand Backups**: Create backups immediately when needed
- **Backup Restoration**: Restore database from any available backup
- **Backup Management**: List, view, and manage existing backups

### 🔒 Security & Access Control
- **SUPER_DUPER_ADMIN Only**: Backup operations restricted to super admin users
- **Activity Logging**: All backup operations logged for audit trails
- **Secure Storage**: Backups stored in protected local directory

## Architecture

### Core Components

1. **BackupService** (`app/lib/backup-service.ts`)
   - Handles backup creation, restoration, and management
   - Integrates with CockroachDB using `cockroach dump` and `cockroach sql`
   - Manages backup files and metadata

2. **ScheduledBackupService** (`app/lib/scheduled-backup.ts`)
   - Runs automated backups based on system settings
   - Handles cleanup of old backups
   - Provides service status monitoring

3. **Backup API** (`app/api/backup/route.ts`)
   - RESTful endpoints for backup operations
   - Authentication and authorization
   - Error handling and response formatting

4. **BackupManager Component** (`app/components/backup-manager.tsx`)
   - User interface for backup management
   - Real-time backup status and scheduling
   - Interactive backup operations

## Configuration

### System Settings Integration

The backup system integrates with the existing system settings:

```typescript
{
  database: {
    backupFrequency: "daily",     // hourly, daily, weekly, monthly
    retentionDays: 30,           // Number of days to keep backups
    autoBackup: true             // Enable/disable automatic backups
  }
}
```

### Environment Variables

Required environment variables:
- `DATABASE_URL`: CockroachDB connection string
- `JWT_SECRET`: For API authentication

## Usage

### Super Admin Dashboard

1. Navigate to the Super Admin Dashboard
2. Click on the "Backup" tab
3. Use the interface to:
   - Create manual backups
   - View existing backups
   - Restore from backups
   - Clean up old backups

### API Endpoints

#### GET `/api/backup`
- **Purpose**: List all backups and get backup schedule
- **Authentication**: Bearer token required
- **Access**: SUPER_DUPER_ADMIN only
- **Response**: List of backups, schedule, and settings

#### POST `/api/backup`
- **Purpose**: Perform backup operations
- **Authentication**: Bearer token required
- **Access**: SUPER_DUPER_ADMIN only
- **Actions**:
  - `{ action: "create" }` - Create new backup
  - `{ action: "restore", filename: "backup-xxx.sql" }` - Restore from backup
  - `{ action: "cleanup" }` - Clean up old backups

## Backup Storage

### File Structure
```
backups/
├── backup-2024-01-15T10-30-00-000Z.sql
├── backup-2024-01-16T02-00-00-000Z.sql
└── backup-2024-01-17T02-00-00-000Z.sql
```

### File Format
- **Format**: SQL dump files compatible with CockroachDB
- **Naming**: `backup-{ISO_TIMESTAMP}.sql`
- **Content**: Complete database schema and data

## Monitoring & Logging

### Activity Logs
All backup operations are logged in the `ActivityLog` table:
- `database_backup` - Backup creation events
- `database_restore` - Database restoration events
- `backup_cleanup` - Old backup cleanup events

### Console Logs
The system provides detailed console logging for:
- Backup creation success/failure
- Scheduled backup execution
- Cleanup operations
- Error conditions

## Security Considerations

### Access Control
- Only SUPER_DUPER_ADMIN users can access backup functionality
- All API endpoints require valid JWT authentication
- Backup files are stored locally and should be protected

### Data Protection
- Backup files contain sensitive business data
- Ensure backup directory has appropriate file permissions
- Consider encrypting backup files for additional security

## Troubleshooting

### Common Issues

1. **Backup Creation Fails**
   - Check CockroachDB connection
   - Verify `DATABASE_URL` environment variable
   - Ensure `cockroach` CLI is installed and accessible

2. **Restore Operation Fails**
   - Verify backup file exists and is not corrupted
   - Check database connection during restore
   - Ensure sufficient disk space

3. **Scheduled Backups Not Running**
   - Check if `autoBackup` is enabled in system settings
   - Verify scheduled backup service is running
   - Check console logs for errors

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## Future Enhancements

### Planned Features
- **Cloud Storage**: Integration with AWS S3, Google Cloud Storage
- **Backup Encryption**: Automatic encryption of backup files
- **Incremental Backups**: Support for incremental backup strategies
- **Backup Verification**: Automatic verification of backup integrity
- **Email Notifications**: Alerts for backup success/failure

### Performance Optimizations
- **Parallel Backups**: Support for concurrent backup operations
- **Compression**: Automatic compression of backup files
- **Streaming**: Stream large backups to reduce memory usage

## Maintenance

### Regular Tasks
1. **Monitor Backup Storage**: Ensure sufficient disk space
2. **Review Logs**: Check for backup failures or issues
3. **Test Restores**: Periodically test backup restoration
4. **Update Retention**: Adjust retention policies as needed

### Backup Testing
Regularly test the backup system by:
1. Creating a test backup
2. Restoring to a test environment
3. Verifying data integrity
4. Documenting test results

## Support

For issues or questions about the backup system:
1. Check the console logs for error messages
2. Review the activity logs in the database
3. Verify system settings configuration
4. Contact the development team with specific error details 