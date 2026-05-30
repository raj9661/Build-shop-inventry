import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import emailService from '@/app/lib/emailService';
import redisService from '@/app/lib/redis-service';


export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email is required'
      }, { status: 400 });
    }

    const targetEmail = email.toLowerCase();

    // 24-hour Rate Limiting Check for Forgot Password
    const rateLimitKey = `ratelimit:forgot-password:${targetEmail}`;
    const hasRequested = await redisService.get(rateLimitKey);
    if (hasRequested) {
      return NextResponse.json({
        success: false,
        message: 'You can only request a password reset once per day. Please try again tomorrow.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      // For security, don't reveal if email exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, we\'ve sent a password reset link.'
      });
    }

    // Generate secure JWT reset token (Latest Tech)
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-development';
    const resetToken = jwt.sign(
      {
        userId: Number(user.id),
        email: user.email,
        purpose: 'password_reset'
      },
      jwtSecret,
      { expiresIn: '30m' }
    );

    // Hash the JWT token for database storage to prevent token reuse or compromise
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token with 30 minute expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    // Create the reset url using request origin
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const resetUrl = `${origin}/reset-password?token=${resetToken}`;

    // Send the email
    const emailSent = await emailService.sendPasswordResetLink(user.email, resetUrl, user.name);

    if (!emailSent) {
      // Revert token if email failed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });
      return NextResponse.json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      }, { status: 500 });
    }

    // Record successful rate limit for 24 hours (86400 seconds)
    await redisService.set(rateLimitKey, true, 24 * 60 * 60);

    console.log(`Password reset requested for user: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we\'ve sent a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to process request. Please try again.'
    }, { status: 500 });
  }
}

