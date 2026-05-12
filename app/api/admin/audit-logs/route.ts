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
    if (decoded.role !== 'SUPER_DUPER_ADMIN')
      return NextResponse.json({ success: false, message: 'Forbidden: SUPER_DUPER_ADMIN only' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');
    const tableName = searchParams.get('tableName');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (shopId) where.shopId = BigInt(shopId);
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
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: { logs: safeLogs, total, page, pages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('[Admin Audit Logs GET]', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
