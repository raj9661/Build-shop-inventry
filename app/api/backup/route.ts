import { NextRequest, NextResponse } from 'next/server';
import { backupService } from '@/app/lib/backup-service';
import { validateToken } from '@/app/lib/tokenUtils';

function requireSuperDuperAdmin(user: any) {
  return user && user.role === 'SUPER_DUPER_ADMIN';
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperDuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const userId = decoded.userId;
    const backups = await backupService.listBackups(userId);
    const schedule = await backupService.getBackupSchedule();

    return NextResponse.json({
      backups,
      schedule,
      settings: {
        backupFrequency: schedule.frequency,
        nextBackup: schedule.nextBackup
      }
    });
  } catch (error) {
    console.error('Failed to get backups:', error);
    return NextResponse.json(
      { error: 'Failed to get backups' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperDuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const userId = decoded.userId;
    const body = await request.json();
    const { action, filename } = body;

    switch (action) {
      case 'create':
        const backup = await backupService.createBackup(userId);
        return NextResponse.json({ backup, message: 'Backup created successfully' });

      case 'cleanup':
        const cleanupResult = await backupService.cleanupOldBackups(userId);
        return NextResponse.json({ 
          message: cleanupResult.message,
          deletedCount: cleanupResult.deletedCount
        });

      case 'restore':
        if (!filename) {
          return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }
        await backupService.restoreBackup(filename, userId);
        return NextResponse.json({ message: 'Database restored successfully' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Backup operation failed:', error);
    return NextResponse.json(
      { error: 'Backup operation failed' },
      { status: 500 }
    );
  }
} 