import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

function requireSuperAdminOrAdmin(user: any) {
  return user && (user.role === 'SUPER_DUPER_ADMIN' || user.role === 'SUPER_ADMIN');
}

// GET: Get a specific user by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdminOrAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT: Update a specific user by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('PUT /api/users/[id] - params:', resolvedParams);
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdminOrAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const id = parseInt(resolvedParams.id);
    console.log('PUT /api/users/[id] - params.id:', resolvedParams.id, 'parsed id:', id);
    
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json();
    console.log('PUT /api/users/[id] - body:', body);
    
    const { name, username, email, phone, password, role, isActive } = body;

    // Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!existingUser) {
      console.log('PUT /api/users/[id] - user not found with id:', id);
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Prevent SUPER_DUPER_ADMIN password change via this endpoint
    if (password && existingUser.role === 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        message: 'SUPER_DUPER_ADMIN password can only be changed from the dashboard quick links.'
      }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = { name, username, email, phone, role, isActive };
    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Remove undefined and empty fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === '') {
        delete updateData[key];
      }
    });

    console.log('PUT /api/users/[id] - updateData:', updateData);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('PUT /api/users/[id] - updated user:', user);

    // Log activity
    const { getClientIP, getUserAgent } = await import('@/app/lib/ipUtils');
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);
    
    console.log('🔍 [User Update] Logging activity:', { ipAddress, userAgent });
    
    await prisma.activityLog.create({
      data: {
        userId: BigInt(decoded.userId),
        action: 'UPDATE_USER',
        resource: 'User',
        resourceId: id,
        details: `User '${existingUser.name || existingUser.username}' (${existingUser.email}) updated by ${decoded.email}`,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });

    // Convert BigInt fields to numbers for JSON serialization
    const serializedUser = {
      ...user,
      id: Number(user.id),
      createdBy: user.createdBy ? Number(user.createdBy) : null,
      updatedBy: user.updatedBy ? Number(user.updatedBy) : null
    };

    return NextResponse.json({ success: true, user: serializedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE: Delete a specific user by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdminOrAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete user' }, { status: 500 });
  }
} 