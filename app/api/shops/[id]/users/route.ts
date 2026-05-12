import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getUserAccessibleShops } from '@/app/lib/dataIsolationUtils';

const prisma = new PrismaClient();

// POST - Assign user to shop
export async function POST(
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
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const shopId = BigInt(id);
    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({
        success: false,
        message: 'User ID and role are required'
      }, { status: 400 });
    }

    console.log('🔍 Assign User API: Shop ID:', shopId, 'User ID:', userId, 'Role:', role);

    // Check if user has access to this shop
    const accessInfo = await getUserAccessibleShops(token);
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    // Check if the shop is accessible to the current user
    if (!accessInfo.accessibleShopIds.includes(Number(shopId))) {
      return NextResponse.json({ 
        success: false, 
        message: 'You do not have access to this shop' 
      }, { status: 403 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, name: true, username: true, role: true }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    // Check if shop exists
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true }
    });

    if (!shop) {
      return NextResponse.json({
        success: false,
        message: 'Shop not found'
      }, { status: 404 });
    }

    // Check if user is already assigned to this shop
    const existingAssignment = await prisma.userShopAssignment.findUnique({
      where: {
        userId_shopId: {
          userId: BigInt(userId),
          shopId: shopId
        }
      }
    });

    if (existingAssignment) {
      if (existingAssignment.active) {
        return NextResponse.json({
          success: false,
          message: 'User is already assigned to this shop'
        }, { status: 409 });
      } else {
        // Reactivate the assignment
        await prisma.userShopAssignment.update({
          where: {
            userId_shopId: {
              userId: BigInt(userId),
              shopId: shopId
            }
          },
          data: {
            role: role as any,
            active: true,
            assignedById: decoded.userId,
            assignedAt: new Date()
          }
        });

        console.log('✅ User assignment reactivated:', { userId, shopId, role });
      }
    } else {
      // Create new assignment
      await prisma.userShopAssignment.create({
        data: {
          userId: BigInt(userId),
          shopId: shopId,
          role: role as any,
          assignedById: decoded.userId,
          active: true
        }
      });

      console.log('✅ User assigned to shop:', { userId, shopId, role });
    }

    return NextResponse.json({
      success: true,
      message: 'User assigned to shop successfully'
    });

  } catch (error) {
    console.error('Assign user to shop error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to assign user to shop',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET - Get users assigned to a shop
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
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const shopId = BigInt(id);

    // Check if user has access to this shop
    let accessInfo;
    try {
      accessInfo = await getUserAccessibleShops(token);
      if (!accessInfo) {
        return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
      }
    } catch (dbError) {
      console.error('❌ Database error getting user access info in shops users API:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        users: []
      }, { status: 503 });
    }

    if (!accessInfo.accessibleShopIds.includes(Number(shopId))) {
      return NextResponse.json({ 
        success: false, 
        message: 'You do not have access to this shop' 
      }, { status: 403 });
    }

    // Get users assigned to this shop
    let assignments;
    try {
      assignments = await prisma.userShopAssignment.findMany({
        where: {
          shopId: shopId,
          active: true
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' }
      });
    } catch (dbError) {
      console.error('❌ Database error in shops users API:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database temporarily unavailable. Please try again later.',
        users: []
      }, { status: 503 });
    }

    const users = assignments.map(assignment => ({
      id: Number(assignment.user.id),
      name: assignment.user.name || assignment.user.username,
      username: assignment.user.username,
      email: assignment.user.email,
      role: assignment.user.role,
      shopRole: assignment.role,
      assignedAt: assignment.assignedAt
    }));

    return NextResponse.json({
      success: true,
      users: users
    });

  } catch (error) {
    console.error('Get shop users error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch shop users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Remove user from shop
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
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const shopId = BigInt(id);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID is required'
      }, { status: 400 });
    }

    // Check if user has access to this shop
    const accessInfo = await getUserAccessibleShops(token);
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    if (!accessInfo.accessibleShopIds.includes(Number(shopId))) {
      return NextResponse.json({ 
        success: false, 
        message: 'You do not have access to this shop' 
      }, { status: 403 });
    }

    // Deactivate the assignment instead of deleting
    await prisma.userShopAssignment.updateMany({
      where: {
        userId: BigInt(userId),
        shopId: shopId,
        active: true
      },
      data: {
        active: false
      }
    });

    console.log('✅ User removed from shop:', { userId, shopId });

    return NextResponse.json({
      success: true,
      message: 'User removed from shop successfully'
    });

  } catch (error) {
    console.error('Remove user from shop error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to remove user from shop',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
