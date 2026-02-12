import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import otpUtils from '@/app/lib/otpUtils';
import { emailService } from '@/app/lib/emailService';

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const shopId = parseInt(id);
    if (isNaN(shopId)) {
      return NextResponse.json({ success: false, message: 'Invalid shop ID' }, { status: 400 });
    }

    // Check if shop exists
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }

    // Get super admin user (assuming the user making the request is super admin)
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin
    if (user.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Only super admin can delete shops' }, { status: 403 });
    }

    // Generate OTP
    const otp = otpUtils.generateOTP();
    
    // Store OTP for shop deletion
    await otpUtils.storeOTP(user.email, otp, user.id, 10, 'SHOP_DELETION'); // 10 minutes expiry

    // Send OTP via email
    const emailSent = await emailService.sendShopDeletionOTP(user.email, otp, user.name, shop.name);
    
    if (!emailSent) {
      return NextResponse.json({ success: false, message: 'Failed to send OTP email' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent to your email for shop deletion verification' 
    });
  } catch (error) {
    console.error('Shop deletion OTP request error:', error);
    return NextResponse.json({ success: false, message: 'Failed to send OTP' }, { status: 500 });
  }
} 