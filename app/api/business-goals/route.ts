import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getUserShopAccess, getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Fetch business goals
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

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    const goals = await prisma.businessGoal.findMany({
      where: {
        ...shopFilter
      },
      include: {
        shop: {
          select: { name: true, location: true }
        }
      },
      orderBy: { 
        achieved: 'asc',
        createdAt: 'desc' 
      }
    });

    const serializedGoals = goals.map(goal => ({
      id: Number(goal.id),
      metricName: goal.metricName,
      targetValue: Number(goal.targetValue),
      period: goal.period,
      achieved: goal.achieved,
      achievedAt: goal.achievedAt,
      shopId: Number(goal.shopId),
      shop: goal.shop
    }));

    return NextResponse.json({ success: true, data: serializedGoals });
  } catch (error) {
    console.error('Error fetching business goals:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch business goals' }, { status: 500 });
  }
}

// POST - Create a new business goal
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
    const { metricName, targetValue, period, shopId } = body;

    if (!metricName || !targetValue || !period) {
      return NextResponse.json({ success: false, message: 'Metric name, target value, and period are required' }, { status: 400 });
    }

    if (!shopId) {
      return NextResponse.json({ success: false, message: 'Shop ID is required' }, { status: 400 });
    }

    // Validate that user has access to this shop
    const accessInfo = await getUserShopAccess(token);
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    // Check if user can access this shop
    if (!accessInfo.isSuperDuperAdmin && !accessInfo.assignedShopIds.includes(parseInt(shopId))) {
      return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 });
    }

    // Create the business goal
    const goal = await prisma.businessGoal.create({
      data: {
        metricName,
        targetValue: targetValue,
        period,
        shopId: BigInt(shopId),
        achieved: false
      },
      include: {
        shop: {
          select: { name: true, location: true }
        }
      }
    });

    const serializedGoal = {
      id: Number(goal.id),
      metricName: goal.metricName,
      targetValue: Number(goal.targetValue),
      period: goal.period,
      achieved: goal.achieved,
      achievedAt: goal.achievedAt,
      shopId: Number(goal.shopId),
      shop: goal.shop
    };

    return NextResponse.json({ success: true, data: serializedGoal }, { status: 201 });
  } catch (error) {
    console.error('Error creating business goal:', error);
    return NextResponse.json({ success: false, message: 'Failed to create business goal' }, { status: 500 });
  }
}

// PUT - Update a business goal
export async function PUT(req: NextRequest) {
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
    const { id, metricName, targetValue, period, achieved } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Goal ID is required' }, { status: 400 });
    }

    // Validate that user has access to this goal's shop
    const goal = await prisma.businessGoal.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    });

    if (!goal) {
      return NextResponse.json({ success: false, message: 'Goal not found' }, { status: 404 });
    }

    const accessInfo = await getUserShopAccess(token);
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    // Check if user can access this goal's shop
    if (!accessInfo.isSuperDuperAdmin && !accessInfo.assignedShopIds.includes(Number(goal.shopId))) {
      return NextResponse.json({ success: false, message: 'Access denied to this goal' }, { status: 403 });
    }

    // Update the goal
    const updatedGoal = await prisma.businessGoal.update({
      where: { id: BigInt(id) },
      data: {
        ...(metricName !== undefined && { metricName }),
        ...(targetValue !== undefined && { targetValue }),
        ...(period !== undefined && { period }),
        ...(achieved !== undefined && { achieved, achievedAt: achieved ? new Date() : null })
      },
      include: {
        shop: {
          select: { name: true, location: true }
        }
      }
    });

    const serializedGoal = {
      id: Number(updatedGoal.id),
      metricName: updatedGoal.metricName,
      targetValue: Number(updatedGoal.targetValue),
      period: updatedGoal.period,
      achieved: updatedGoal.achieved,
      achievedAt: updatedGoal.achievedAt,
      shopId: Number(updatedGoal.shopId),
      shop: updatedGoal.shop
    };

    return NextResponse.json({ success: true, data: serializedGoal });
  } catch (error) {
    console.error('Error updating business goal:', error);
    return NextResponse.json({ success: false, message: 'Failed to update business goal' }, { status: 500 });
  }
}

// DELETE - Delete a business goal
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Goal ID is required' }, { status: 400 });
    }

    // Validate that user has access to this goal's shop
    const goal = await prisma.businessGoal.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    });

    if (!goal) {
      return NextResponse.json({ success: false, message: 'Goal not found' }, { status: 404 });
    }

    const accessInfo = await getUserShopAccess(token);
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    // Check if user can access this goal's shop
    if (!accessInfo.isSuperDuperAdmin && !accessInfo.assignedShopIds.includes(Number(goal.shopId))) {
      return NextResponse.json({ success: false, message: 'Access denied to this goal' }, { status: 403 });
    }

    // Delete the goal
    await prisma.businessGoal.delete({
      where: { id: BigInt(id) }
    });

    return NextResponse.json({ success: true, message: 'Business goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting business goal:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete business goal' }, { status: 500 });
  }
}

