import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateToken } from '@/app/lib/tokenUtils';

// GET /api/admin/audit-logs
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded)
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const isSuperAdmin = decoded.role === 'SUPER_DUPER_ADMIN';

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get('shopId');
    const tableName = searchParams.get('tableName');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Shop isolation:
    // - SUPER_DUPER_ADMIN: can filter by any shopId or see all shops
    // - Others: must supply a shopId param and are locked to it
    if (!isSuperAdmin && !shopIdParam) {
      return NextResponse.json({ success: false, message: 'Forbidden: shopId required' }, { status: 403 });
    }

    const where: any = {};
    if (isSuperAdmin) {
      if (shopIdParam) where.shopId = BigInt(shopIdParam);
    } else {
      where.shopId = BigInt(shopIdParam!);
    }

    if (tableName) where.tableName = tableName;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate + 'T23:59:59Z');
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where })
    ]);

    // Fetch shop names for all unique shopIds in this page
    const uniqueShopIds = [...new Set(logs.map(l => l.shopId))];
    const shopMap: Record<string, string> = {};
    if (uniqueShopIds.length > 0) {
      const shops = await prisma.shop.findMany({
        where: { id: { in: uniqueShopIds } },
        select: { id: true, name: true }
      });
      shops.forEach(s => { shopMap[s.id.toString()] = s.name; });
    }

    // Fetch all shops for SUPER_DUPER_ADMIN filter dropdown
    let allShops: { id: number; name: string }[] = [];
    if (isSuperAdmin) {
      const shops = await prisma.shop.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });
      allShops = shops.map(s => ({ id: Number(s.id), name: s.name }));
    }

    // Serialize BigInt
    const safeLogs = logs.map(log => ({
      id: Number(log.id),
      adminId: Number(log.adminId),
      action: log.action,
      tableName: log.tableName,
      recordId: Number(log.recordId),
      beforeData: log.beforeData,
      afterData: log.afterData,
      reason: log.reason,
      shopId: Number(log.shopId),
      shopName: shopMap[log.shopId.toString()] || `Shop #${log.shopId}`,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: { logs: safeLogs, total, page, pages: Math.ceil(total / limit), allShops }
    });

  } catch (error) {
    console.error('[Admin Audit Logs GET]', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
