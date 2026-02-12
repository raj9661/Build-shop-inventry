import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { canCreateUser, canCreateRole } from '@/app/lib/subscriptionUtils';
import { getUserAccessibleShops, getUserFilter } from '@/app/lib/dataIsolationUtils';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// GET - List users (with proper isolation)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    console.log('🔍 Users API: Auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Users API: No valid authorization header');
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    console.log('🔍 Users API: Extracted token:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
      tokenEnd: '...' + token.substring(token.length - 20),
      tokenType: typeof token
    });
    
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    console.log('🔍 Users API: User role:', decoded.role, 'User ID:', decoded.userId);

    // Get user's access information
    let accessInfo;
    try {
      accessInfo = await getUserAccessibleShops(token);
      console.log('🔍 Users API: Access info result:', accessInfo);
      if (!accessInfo) {
        console.log('❌ Users API: No access info, returning 403');
        return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
      }
    } catch (dbError) {
      console.error('❌ Database error getting user access info:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        users: []
      }, { status: 503 });
    }

    // Get user filter based on access level
    let userFilter;
    try {
      userFilter = await getUserFilter(token);
    } catch (dbError) {
      console.error('❌ Database error getting user filter:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        users: []
      }, { status: 503 });
    }
    console.log('🔍 Users API: User filter:', userFilter);
    console.log('🔍 Users API: Access info:', accessInfo);

    let users: any[];
    
    try {
      if (accessInfo.isSuperDuperAdmin) {
        // SUPER_DUPER_ADMIN can only see users they created (complete isolation)
        console.log('👑 SUPER_DUPER_ADMIN: Fetching users created by this SUPER_DUPER_ADMIN');
        users = await prisma.user.findMany({
          where: userFilter,
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        // Other roles can only see users in their shops
        console.log('👤 Regular user: Fetching users in assigned shops');
        users = await prisma.user.findMany({
          where: userFilter,
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    } catch (dbError) {
      console.error('❌ Database error in users API:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        users: []
      }, { status: 503 });
    }

    console.log('🔍 Users API: Found', users.length, 'users');

    // Convert BigInt fields to numbers for JSON serialization
    const serializedUsers = users.map(user => ({
      ...user,
      id: Number(user.id)
    }));

    return NextResponse.json({
      success: true,
      users: serializedUsers
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { name, username, email, password, role, phone, shopIds } = body;

    // Validate required fields
    if (!name || !username || !email || !password || !role) {
      return NextResponse.json({
        success: false,
        message: 'Name, username, email, password, and role are required'
      }, { status: 400 });
    }

    console.log('🔍 Creating user:', { name, username, email, role, creatorRole: decoded.role });

    // Check if creator can create this role
    const roleCheck = canCreateRole(decoded.role, role);
    if (!roleCheck.canCreate) {
      return NextResponse.json({
        success: false,
        message: roleCheck.reason || 'Insufficient permissions to create this role'
      }, { status: 403 });
    }

    // Check subscription limits
    console.log('🔍 Checking user creation limits for creator:', decoded.userId);
    const limitCheck = await canCreateUser(BigInt(decoded.userId), role);
    console.log('🔍 User creation limit check:', limitCheck);
    
    if (!limitCheck.canCreate) {
      return NextResponse.json({
        success: false,
        message: limitCheck.reason || 'User creation limit exceeded',
        data: {
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit
        }
      }, { status: 403 });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: existingUser.username === username ? 'Username already exists' : 'Email already exists'
      }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role: role as any,
        phone: phone || null,
        isActive: true,
        createdBy: BigInt(decoded.userId),
        updatedBy: BigInt(decoded.userId)
      }
    });

    // Assign user to shops if shopIds provided
    if (shopIds && shopIds.length > 0) {
      const assignments = shopIds.map((shopId: number) => ({
        userId: user.id,
        shopId: BigInt(shopId),
        role: role as any,
        assignedById: decoded.userId,
        active: true
      }));

      await prisma.userShopAssignment.createMany({
        data: assignments
      });
    }

    console.log('✅ User created successfully:', user.id);

    // Log activity
    const { getClientIP, getUserAgent } = await import('@/app/lib/ipUtils');
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);
    
    console.log('🔍 [User Creation] Logging activity:', { ipAddress, userAgent });
    
    await prisma.activityLog.create({
      data: {
        userId: BigInt(decoded.userId),
        action: 'CREATE_USER',
        resource: 'User',
        resourceId: Number(user.id),
        details: `User '${user.name || user.username}' (${user.email}) created by ${decoded.email}`,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });

    // Return user data (without password)
    const serializedUser = {
      id: Number(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    return NextResponse.json({
      success: true,
      data: { user: serializedUser }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}