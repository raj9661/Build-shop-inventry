import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/app/lib/tokenUtils'


function requireSuperDuperAdmin(user: any) {
  return user && user.role === 'SUPER_DUPER_ADMIN';
}

// Remove in-memory settings - use database only
// let settings = { ... }

export async function GET(req: NextRequest) {
  try {
    let decoded: any = null;
    
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ success: false, message: 'No active session' }, { status: 401 });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      decoded = {
        userId: user.id,
        role: user.role,
        email: session.user?.email
      };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
      }
    }
    
    if (!requireSuperDuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const systemSetting = await prisma.websiteSetting.findFirst({ 
      where: { 
        customerId: BigInt(decoded.userId), // Tenant-specific setting
        type: 'SEO_META_TAGS', // Use any type for system settings
        key: 'system_settings'
      } 
    })
    if (!systemSetting) {
      // Return default settings if not set in database
      return NextResponse.json({
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
    }
    return NextResponse.json(JSON.parse(systemSetting.value))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    let decoded: any = null;
    
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ success: false, message: 'No active session' }, { status: 401 });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      decoded = {
        userId: user.id,
        role: user.role,
        email: session.user?.email
      };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
      }
    }
    
    if (!requireSuperDuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json()
    const updated = await prisma.websiteSetting.upsert({
      where: { 
        customerId_type_key: {
          customerId: BigInt(decoded.userId),
          type: 'SEO_META_TAGS',
          key: 'system_settings'
        }
      },
      update: { 
        value: JSON.stringify(body),
        updatedAt: new Date()
      },
      create: { 
        customerId: BigInt(decoded.userId), // Tenant isolated setting
        type: 'SEO_META_TAGS',
        key: 'system_settings',
        value: JSON.stringify(body),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
} 