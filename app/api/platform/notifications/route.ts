import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateToken } from '@/app/lib/tokenUtils';


// Get notifications for user
export async function GET(req: NextRequest) {
  try {
    let decoded: any = null;
    
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user from database using email
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      decoded = { userId: user.id };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Access token required' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      recipientId: decoded.userId,
      recipientType: 'user',
      isActive: true
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    let notifications, total;
    try {
      [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.notification.count({ where })
      ]);
    } catch (dbError) {
      console.error('❌ Database error in notifications API:', dbError);
      
      // Return empty notifications when database is unavailable
      return NextResponse.json({
        success: true,
        data: {
          notifications: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      });
    }

    // Convert BigInt to Number for JSON serialization
    const serializedNotifications = notifications.map(notification => ({
      ...notification,
      id: Number(notification.id),
      recipientId: notification.recipientId ? Number(notification.recipientId) : null,
      createdBy: notification.createdBy ? Number(notification.createdBy) : null
    }));

    return NextResponse.json({
      notifications: serializedNotifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
  }
}

// Mark notification as read
export async function PUT(req: NextRequest) {
  try {
    let decoded: any = null;
    
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user from database using email
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      decoded = { userId: user.id };
    } else {
      // Handle custom JWT Bearer token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Access token required' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { notificationId, markAllAsRead = false } = body;

    if (markAllAsRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          recipientId: decoded.userId,
          recipientType: 'user',
          isRead: false
        },
        data: {
          isRead: true,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({ message: 'All notifications marked as read' });
    } else {
      // Mark specific notification as read
      const notification = await prisma.notification.update({
        where: { id: BigInt(notificationId) },
        data: {
          isRead: true,
          updatedAt: new Date()
        }
      });

      // Convert BigInt to Number for JSON serialization
      const serializedNotification = {
        ...notification,
        id: Number(notification.id),
        recipientId: notification.recipientId ? Number(notification.recipientId) : null,
        createdBy: notification.createdBy ? Number(notification.createdBy) : null
      };

      return NextResponse.json({ notification: serializedNotification });
    }

  } catch (error) {
    console.error('Mark notification error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  } finally {
  }
}

// Create notification (for platform admins)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database using email
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true }
      });
    } catch (dbError) {
      console.error('❌ Database error in notifications POST:', dbError);
      return NextResponse.json({ 
        error: 'Database temporarily unavailable. Please try again later.' 
      }, { status: 503 });
    }

    if (!user || !['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      recipientId, 
      recipientType = 'user', 
      type, 
      title, 
      message, 
      scheduledFor 
    } = body;

    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          recipientId: BigInt(recipientId),
          recipientType,
          type,
          title,
          message,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          createdBy: user.id
        }
      });
    } catch (dbError) {
      console.error('❌ Database error creating notification:', dbError);
      return NextResponse.json({ 
        error: 'Database temporarily unavailable. Please try again later.' 
      }, { status: 503 });
    }

    return NextResponse.json({ notification });

  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  } finally {
  }
}
