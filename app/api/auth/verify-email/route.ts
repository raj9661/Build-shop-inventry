import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/app/lib/email-service';


// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email is required'
      }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, emailVerified: true }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: false,
        message: 'Email is already verified'
      }, { status: 400 });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store verification code in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationCode,
        // We'll add a field for expiration time in the schema
      }
    });

    // Send verification email
    const emailSent = await emailService.sendVerificationCode({
      name: user.name,
      email: user.email,
      code: verificationCode,
      expiresIn: 10
    });

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    }, { status: 500 });
  }
}

// Verify the code
export async function PUT(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({
        success: false,
        message: 'Email and verification code are required'
      }, { status: 400 });
    }

    // Find user and check verification code
    const user = await prisma.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        emailVerified: true, 
        emailVerificationToken: true 
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: false,
        message: 'Email is already verified'
      }, { status: 400 });
    }

    if (!user.emailVerificationToken || user.emailVerificationToken !== code) {
      return NextResponse.json({
        success: false,
        message: 'Invalid verification code'
      }, { status: 400 });
    }

    // Mark email as verified and clear verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to verify email. Please try again.'
    }, { status: 500 });
  }
}
