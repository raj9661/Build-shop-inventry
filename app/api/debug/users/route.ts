import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    console.log('🔍 Debug Users API: Current user:', decoded.userId, 'Role:', decoded.role);

    // Get all users in the database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        createdBy: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔍 Debug Users API: All users in database:', allUsers);

    // Get users created by current user
    const usersCreatedByCurrentUser = await prisma.user.findMany({
      where: {
        createdBy: decoded.userId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        createdBy: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔍 Debug Users API: Users created by current user:', usersCreatedByCurrentUser);

    return NextResponse.json({
      success: true,
      data: {
        currentUser: {
          id: decoded.userId,
          role: decoded.role
        },
        allUsers: allUsers.map(user => ({
          ...user,
          id: Number(user.id),
          createdBy: user.createdBy ? Number(user.createdBy) : null
        })),
        usersCreatedByCurrentUser: usersCreatedByCurrentUser.map(user => ({
          ...user,
          id: Number(user.id),
          createdBy: user.createdBy ? Number(user.createdBy) : null
        }))
      }
    });
  } catch (error) {
    console.error('Debug users error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch debug data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
