import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';

// Lightweight GET endpoint — any authenticated user can check if stock bypass is enabled for their shop
// GET /api/settings/stock-bypass?shopId=123
// Response: { enabled: true/false }
export async function GET(req: NextRequest) {
  try {
    // Authenticate (support both NextAuth session and Bearer token)
    let decoded: any = null;

    const cookies = req.headers.get('cookie');
    if (cookies && cookies.includes('next-auth.session-token')) {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ enabled: false }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { email: session.user?.email || '' },
        select: { id: true, role: true }
      });

      if (!user) {
        return NextResponse.json({ enabled: false }, { status: 404 });
      }

      decoded = { userId: user.id, role: user.role };
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ enabled: false }, { status: 401 });
      }
      const token = authHeader.substring(7);
      decoded = await validateToken(token);
      if (!decoded) {
        return NextResponse.json({ enabled: false }, { status: 401 });
      }
    }

    // Get shopId from query
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ enabled: false });
    }

    const shopIdNum = parseInt(shopId);

    // Find ALL system_settings records (they are stored per super-duper-admin user)
    // and check if any of them have stockBypass enabled for this shop
    const allSettings = await prisma.websiteSetting.findMany({
      where: {
        type: 'SEO_META_TAGS',
        key: 'system_settings'
      },
      select: { value: true }
    });

    for (const setting of allSettings) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed?.stockBypass?.shopIds && Array.isArray(parsed.stockBypass.shopIds)) {
          if (parsed.stockBypass.shopIds.includes(shopIdNum)) {
            return NextResponse.json({ enabled: true });
          }
        }
      } catch {
        // Skip malformed JSON
        continue;
      }
    }

    return NextResponse.json({ enabled: false });
  } catch (error) {
    console.error('Failed to check stock bypass setting:', error);
    return NextResponse.json({ enabled: false });
  }
}
