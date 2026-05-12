import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// Helper function to safely serialize data with BigInt values
function safeSerialize(data: any): any {
  if (typeof data === 'bigint') {
    return data.toString();
  }
  if (Array.isArray(data)) {
    return data.map(safeSerialize);
  }
  if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = safeSerialize(value);
    }
    return result;
  }
  return data;
}

// Helper function to deeply convert Decimal.js objects to numbers
function deepConvertDecimal(obj: any): any {
  if (typeof obj === 'bigint') {
    // Convert BigInt to string for safe JSON serialization
    return obj.toString();
  }
  if (obj && typeof obj === 'object') {
    // Detect Decimal.js object
    if (obj.s !== undefined && obj.e !== undefined && obj.d !== undefined && Object.keys(obj).length <= 4) {
      try {
        return Number(obj.toString());
      } catch {
        return 0;
      }
    }
    for (const key in obj) {
      obj[key] = deepConvertDecimal(obj[key]);
    }
    return obj;
  }
  return obj;
}

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
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }
    // Stats
    const [
      totalSales,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalExpenses,
      recentSales
    ] = await Promise.all([
      prisma.sale.count({ where: { shopId } }),
      prisma.product.count({ where: { shopId } }),
      prisma.customer.count({ where: { shopId } }),
      prisma.employee.count({ where: { shopId } }),
      prisma.expense.aggregate({ where: { shopId }, _sum: { amount: true } }),
      prisma.sale.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 5 })
    ]);
    
    const responseData = {
      success: true,
      data: {
        stats: {
          totalSales,
          productCount: totalProducts,
          totalCustomers,
          totalEmployees,
          totalExpenses: totalExpenses._sum.amount ? Number(totalExpenses._sum.amount) : 0
        },
        recentSales
      }
    };
    
    return NextResponse.json(deepConvertDecimal(responseData));
  } catch (error) {
    console.error('Get shop stats error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch shop stats' }, { status: 500 });
  }
} 