import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


// Get all violations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { role: true }
    });

    if (!user || !['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (severity) where.severity = parseInt(severity);

    const [violations, total] = await Promise.all([
      prisma.violation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.violation.count({ where })
    ]);

    return NextResponse.json({
      violations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Violations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
  }
}

// Create new violation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { role: true }
    });

    if (!user || !['PLATFORM_OWNER', 'MODERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, type, title, description, evidence, severity = 1 } = body;

    const violation = await prisma.violation.create({
      data: {
        customerId: BigInt(customerId),
        type,
        title,
        description,
        evidence: evidence ? JSON.stringify(evidence) : null,
        reportedBy: BigInt(session.user.id),
        severity,
        status: 'REPORTED'
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Send notification to customer
    await prisma.notification.create({
      data: {
        recipientId: BigInt(customerId),
        recipientType: 'user',
        type: 'VIOLATION_REPORTED',
        title: 'Violation Reported',
        message: `A violation has been reported against your account: ${title}`,
        createdBy: BigInt(session.user.id)
      }
    });

    return NextResponse.json({ violation });

  } catch (error) {
    console.error('Create violation error:', error);
    return NextResponse.json(
      { error: 'Failed to create violation' },
      { status: 500 }
    );
  } finally {
  }
}
