import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// DELETE - Remove a user from a shop (set assignment to inactive)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
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

    // Only SUPER_DUPER_ADMIN can remove users from shops
    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const { id, userId: userIdParam } = await params;
    const shopId = parseInt(id);
    const userId = parseInt(userIdParam);
    
    if (isNaN(shopId) || isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'Invalid shop ID or user ID' }, { status: 400 });
    }

    // Check if shop exists
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Find the active assignment
    const assignment = await prisma.userShopAssignment.findFirst({
      where: { 
        shopId: shopId,
        userId: userId,
        active: true 
      }
    });

    if (!assignment) {
      return NextResponse.json({ success: false, message: 'User is not assigned to this shop' }, { status: 404 });
    }

    // Set the assignment to inactive
    await prisma.userShopAssignment.update({
      where: { id: assignment.id },
      data: { active: false }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'User removed from shop successfully' 
    });
  } catch (error) {
    console.error('Remove user from shop error:', error);
    return NextResponse.json({ success: false, message: 'Failed to remove user from shop' }, { status: 500 });
  }
} 