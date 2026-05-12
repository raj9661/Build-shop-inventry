import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import otpUtils from '@/app/lib/otpUtils';

const prisma = new PrismaClient();

// Utility to extract the first IP if x-forwarded-for is a list
function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }
    
    // Convert BigInt to Number for JSON serialization
    const serializedShop = {
      ...shop,
      id: Number(shop.id),
      createdBy: shop.createdBy ? Number(shop.createdBy) : null,
      updatedBy: shop.updatedBy ? Number(shop.updatedBy) : null
    };
    
    // Ensure gstNo is included in the response
    return NextResponse.json({ success: true, data: { shop: serializedShop } });
  } catch (error) {
    console.error('Get shop by id error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch shop' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const { name, location, phone, email, address, gstNo, isActive } = body;

    // Check if shop exists
    const existingShop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!existingShop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }

    // Convert GST number to uppercase for consistent storage
    const formattedGstNo = gstNo !== undefined ? (gstNo ? gstNo.toString().toUpperCase().trim() : null) : undefined;
    if (gstNo && formattedGstNo !== gstNo) {
      console.log('🔍 GST number formatted in update:', { original: gstNo, formatted: formattedGstNo });
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (formattedGstNo !== undefined) updateData.gstNo = formattedGstNo;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Always update the updatedBy field
    updateData.updatedBy = decoded.userId;

    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: updateData,
      select: {
        id: true,
        name: true,
        location: true,
        phone: true,
        email: true,
        address: true,
        gstNo: true,
        isActive: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Log activity
    const { getClientIP, getUserAgent } = await import('@/app/lib/ipUtils');
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);
    
    console.log('🔍 [Shop Update] Logging activity:', { ipAddress, userAgent });
    
    await prisma.activityLog.create({
      data: {
        userId: BigInt(decoded.userId),
        action: 'UPDATE_SHOP',
        resource: 'Shop',
        resourceId: shopId,
        details: `Shop '${existingShop.name}' updated by ${decoded.email}`,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });

    // Convert BigInt fields to numbers for JSON serialization
    const serializedShop = {
      ...updatedShop,
      id: Number(updatedShop.id),
      createdBy: updatedShop.createdBy ? Number(updatedShop.createdBy) : null,
      updatedBy: updatedShop.updatedBy ? Number(updatedShop.updatedBy) : null
    };

    return NextResponse.json({ success: true, data: { shop: serializedShop } });
  } catch (error) {
    console.error('Update shop error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update shop' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get request body for OTP
    const body = await req.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json({ success: false, message: 'OTP is required for shop deletion' }, { status: 400 });
    }

    // Get user to verify OTP
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Check if user is super admin
    if (user.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Only super admin can delete shops' }, { status: 403 });
    }

    // Verify OTP
    const otpVerification = await otpUtils.verifyOTP(user.email, otp, 'SHOP_DELETION');
    if (!otpVerification.valid) {
      return NextResponse.json({ success: false, message: otpVerification.message || 'Invalid OTP' }, { status: 400 });
    }

    // Check if shop exists
    const existingShop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!existingShop) {
      return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });
    }

    // Delete all user assignments for this shop
    await prisma.userShopAssignment.deleteMany({
      where: { shopId }
    });

    // Delete the shop
    await prisma.shop.delete({
      where: { id: shopId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'DELETE_SHOP',
        resource: 'Shop',
        resourceId: shopId,
        details: `Shop '${existingShop.name}' deleted by ${user.name} (${user.email})`,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent') || null
      }
    });

    return NextResponse.json({ success: true, message: 'Shop deleted successfully' });
  } catch (error) {
    console.error('Delete shop error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete shop' }, { status: 500 });
  }
} 