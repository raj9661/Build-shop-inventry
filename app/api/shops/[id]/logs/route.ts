import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const shopId = parseInt(id);
    if (isNaN(shopId)) {
      return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
    }

    // Check if shop exists
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }

    // Get shop-specific activity logs
    const activityLogs = await prisma.activityLog.findMany({
        where: {
          OR: [
            { resource: 'Shop', resourceId: shopId },
            { 
              resource: { in: ['Product', 'Sale', 'Customer', 'Supplier', 'Employee', 'Expense', 'Stock', 'User'] },
              details: { contains: shop.name }
            }
          ]
        },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Get shop-specific login logs (for users assigned to this shop)
    const shopUserIds = await prisma.userShopAssignment.findMany({
      where: { shopId: shopId, active: true },
      select: { userId: true }
    });

    const userIds = shopUserIds.map(assignment => assignment.userId);
    
    const loginLogs = await prisma.loginLog.findMany({
      where: {
        userId: { in: userIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Convert BigInt values to Numbers for JSON serialization
    function convertBigInts(obj: any): any {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (obj instanceof Date) return obj.toISOString(); // Preserve Date objects as ISO strings
      if (Array.isArray(obj)) return obj.map(convertBigInts);
      if (typeof obj === 'object') {
        const converted: any = {};
        for (const key in obj) {
          converted[key] = convertBigInts(obj[key]);
        }
        return converted;
      }
      return obj;
    }

    const safeActivityLogs = convertBigInts(activityLogs);
    const safeLoginLogs = convertBigInts(loginLogs);

    return NextResponse.json({
      success: true,
      data: {
        activityLog: safeActivityLogs,
        loginLog: safeLoginLogs,
        shop: {
          id: Number(shop.id),
          name: shop.name,
          location: shop.location
        }
      }
    });
  } catch (error) {
    console.error('Shop logs error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch shop logs' }, { status: 500 });
  }
} 