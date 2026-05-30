import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import otpUtils from '@/app/lib/otpUtils';
import { securityService } from '@/app/lib/security-service';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return NextResponse.json({
        success: false,
        message: 'Email, OTP, and new password are required',
        code: 'MISSING_FIELDS'
      }, { status: 400 });
    }

    // Validate password against security policy
    const passwordValidation = await securityService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json({
        success: false,
        message: passwordValidation.errors.join(', '),
        code: 'WEAK_PASSWORD'
      }, { status: 400 });
    }

    // Verify OTP
    const otpResult = await otpUtils.verifyOTP(email, otp);
    if (!otpResult.valid) {
      return NextResponse.json({
        success: false,
        message: otpResult.message || 'Invalid OTP',
        code: 'INVALID_OTP'
      }, { status: 400 });
    }

    // Hash new password using security service
    const hashedPassword = await securityService.hashPassword(newPassword);

    // Update password in database
    const updatedUser = await prisma.user.update({
      where: { id: BigInt(otpResult.userId!) },
      data: { password: hashedPassword },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    // Log security event
    await securityService.logSecurityEvent(
      Number(otpResult.userId!),
      'password_changed',
      'Password changed successfully via OTP',
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown',
      req.headers.get('user-agent') || 'Unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      data: {
        user: {
          id: String(updatedUser.id),
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        }
      }
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    }, { status: 500 });
  }
} 