import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// Resolve violation
export async function PUT(req: NextRequest) {
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
    const { violationId, status, resolution, actionTaken, suspendAccount = false } = body;

    // Update violation
    const violation = await prisma.violation.update({
      where: { id: BigInt(violationId) },
      data: {
        status,
        resolution,
        actionTaken,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
        assignedTo: BigInt(session.user.id)
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true
          }
        }
      }
    });

    // If account should be suspended
    if (suspendAccount && violation.customer.isActive) {
      await prisma.user.update({
        where: { id: violation.customerId },
        data: { isActive: false }
      });

      // Suspend all subscriptions
      await prisma.subscription.updateMany({
        where: { customerId: violation.customerId },
        data: { status: 'SUSPENDED' }
      });

      // Send suspension notification
      await prisma.notification.create({
        data: {
          recipientId: violation.customerId,
          recipientType: 'user',
          type: 'ACCOUNT_SUSPENDED',
          title: 'Account Suspended',
          message: `Your account has been suspended due to: ${actionTaken}`,
          createdBy: BigInt(session.user.id)
        }
      });
    }

    // Send resolution notification
    await prisma.notification.create({
      data: {
        recipientId: violation.customerId,
        recipientType: 'user',
        type: 'GENERAL',
        title: 'Violation Resolution Update',
        message: `Your violation case has been ${status.toLowerCase()}: ${resolution}`,
        createdBy: BigInt(session.user.id)
      }
    });

    return NextResponse.json({ violation });

  } catch (error) {
    console.error('Resolve violation error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve violation' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Get violation details
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
    const violationId = searchParams.get('id');

    if (!violationId) {
      return NextResponse.json({ error: 'Violation ID required' }, { status: 400 });
    }

    const violation = await prisma.violation.findUnique({
      where: { id: BigInt(violationId) },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            customerSubscription: {
              select: {
                plan: true,
                status: true,
                endDate: true
              }
            }
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
      }
    });

    if (!violation) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
    }

    return NextResponse.json({ violation });

  } catch (error) {
    console.error('Get violation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
