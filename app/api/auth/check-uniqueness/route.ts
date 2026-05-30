import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(req: NextRequest) {
  try {
    const { email, phone } = await req.json();

    if (!email && !phone) {
      return NextResponse.json({
        success: false,
        message: 'Email or phone number is required'
      }, { status: 400 });
    }

    const checks = {
      email: null as any,
      phone: null as any
    };

    // Check email uniqueness
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true }
      });
      checks.email = existingEmail ? { exists: true, message: 'An account with this email address already exists' } : { exists: false };
    }

    // Check phone uniqueness
    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
        select: { id: true, phone: true }
      });
      checks.phone = existingPhone ? { exists: true, message: 'An account with this phone number already exists' } : { exists: false };
    }

    return NextResponse.json({
      success: true,
      checks
    });

  } catch (error) {
    console.error('Uniqueness check error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check uniqueness. Please try again.'
    }, { status: 500 });
  }
}
