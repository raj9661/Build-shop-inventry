import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { sessionService } from '@/app/lib/session-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


// GET: Check session status - supports both NextAuth.js and custom JWT
export async function GET(req: NextRequest) {
  try {
    // Check if this is a NextAuth.js request (has cookies)
    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      // Handle NextAuth.js session
      const session = await getServerSession(authOptions);
      
      if (!session) {
        return NextResponse.json({
          user: null,
          expires: null
        });
      }

      // Get user role from database
      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true, username: true }
      });

      return NextResponse.json({
        user: {
          ...session.user,
          id: user?.id ? Number(user.id) : null,
          role: user?.role || null,
          username: user?.username || null
        },
        expires: session.expires
      });
    }

    // Handle custom JWT Bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      }, { status: 401 });
    }

    // Check if session is expired
    const isExpired = await sessionService.isSessionExpired(decoded.userId);
    
    if (isExpired) {
      return NextResponse.json({
        success: false,
        message: 'Session expired',
        code: 'SESSION_EXPIRED'
      }, { status: 401 });
    }

    // Get session information
    const sessionInfo = await sessionService.getSessionInfo(decoded.userId);
    
    if (!sessionInfo) {
      return NextResponse.json({
        success: false,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionInfo,
        user: {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role
        }
      }
    });

  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check session',
      code: 'SESSION_CHECK_ERROR'
    }, { status: 500 });
  }
}

// POST: Extend session
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      }, { status: 401 });
    }

    // Check if session is expired
    const isExpired = await sessionService.isSessionExpired(decoded.userId);
    
    if (isExpired) {
      return NextResponse.json({
        success: false,
        message: 'Session expired',
        code: 'SESSION_EXPIRED'
      }, { status: 401 });
    }

    // Extend session
    const extended = await sessionService.extendSession(decoded.userId);
    
    if (!extended) {
      return NextResponse.json({
        success: false,
        message: 'Failed to extend session',
        code: 'SESSION_EXTEND_FAILED'
      }, { status: 500 });
    }

    // Get updated session information
    const sessionInfo = await sessionService.getSessionInfo(decoded.userId);

    return NextResponse.json({
      success: true,
      message: 'Session extended successfully',
      data: {
        sessionInfo
      }
    });

  } catch (error) {
    console.error('Session extend error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to extend session',
      code: 'SESSION_EXTEND_ERROR'
    }, { status: 500 });
  }
}

// DELETE: Force logout (invalidate session)
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      }, { status: 401 });
    }

    const body = await req.json();
    const { reason } = body;

    // Force logout
    await sessionService.forceLogout(decoded.userId, reason || 'User requested logout');

    return NextResponse.json({
      success: true,
      message: 'Session invalidated successfully'
    });

  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to logout',
      code: 'SESSION_LOGOUT_ERROR'
    }, { status: 500 });
  }
} 