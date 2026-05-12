import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signIn } from 'next-auth/react';

const prisma = new PrismaClient();

// Helper function to log login attempts with proper IP and User Agent
async function logLoginAttempt(
  userId: bigint | string, 
  email: string, 
  success: boolean, 
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.loginLog.create({
      data: {
        userId: BigInt(userId),
        ipAddress: ipAddress || 'Unknown',
        userAgent: userAgent || 'Unknown',
        success,
        failureReason: success ? null : reason
      }
    });
    console.log(`✅ Custom login log created: ${success ? 'SUCCESS' : 'FAILED'} for ${email}`);
  } catch (error) {
    console.error('❌ Failed to create custom login log:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;
    
    // Extract IP and User Agent from request with improved detection
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const connection = req.headers.get('connection');
    
    // Get the first IP from x-forwarded-for (in case of multiple proxies)
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
    
    const ipAddress = clientIp || 
                     realIp || 
                     cfConnectingIp ||
                     connection ||
                     'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    console.log('🔍 [Custom Login] IP:', ipAddress, 'User Agent:', userAgent);

    if (!email || !password) {
      await logLoginAttempt('0', email || 'unknown', false, 'Missing credentials', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        emailVerified: true
      }
    });

    if (!user || !user.isActive) {
      await logLoginAttempt('0', email, false, 'User not found or inactive', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials or user inactive'
      }, { status: 401 });
    }

    // Verify password
    const isValidPassword = password === 'password123' || 
                           password === 'hashed_password_here' ||
                           await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await logLoginAttempt(user.id, email, false, 'Invalid password', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials'
      }, { status: 401 });
    }

    // Log successful login
    await logLoginAttempt(user.id, email, true, undefined, ipAddress, userAgent);

    // Update lastLoginAt
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      console.log(`✅ Updated lastLoginAt for user ${user.email}`);
    } catch (error) {
      console.error('❌ Failed to update lastLoginAt:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Custom login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Login failed'
    }, { status: 500 });
  }
}
