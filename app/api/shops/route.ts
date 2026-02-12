import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { canCreateShop } from '@/app/lib/subscriptionUtils';

const prisma = new PrismaClient();

// GET - List all shops
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      console.log('❌ Token validation failed for shops API')
      console.log('❌ Token provided:', token ? `${token.substring(0, 20)}...` : 'No token')
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }
    console.log('✅ Token validated successfully:', { userId: decoded.userId, role: decoded.role })
    // Get shops based on user role and access
    console.log('🔍 Shops API: User role:', decoded.role, 'User ID:', decoded.userId)
    let shops;
    
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN can see all shops they created
      console.log('👑 SUPER_DUPER_ADMIN: Fetching all shops created by user')
      shops = await prisma.shop.findMany({ 
        where: { 
          createdBy: decoded.userId,
          isActive: true
        } 
      });
    } else {
      // Other roles (ADMIN, STAFF, USER) can only see shops they are assigned to
      console.log('👤 Regular user: Fetching shops assigned to user')
      
      // First get shop assignments for this user
      const userAssignments = await prisma.userShopAssignment.findMany({
        where: {
          userId: decoded.userId,
          active: true
        },
        include: {
          shop: true
        }
      });
      
      console.log('📋 User assignments found:', userAssignments.length)
      
      // Extract shops from assignments
      shops = userAssignments
        .filter(assignment => assignment.shop.isActive)
        .map(assignment => assignment.shop);
        
      console.log('🏪 Active assigned shops:', shops.length)
    }
    console.log('📊 Shops API: Found', shops.length, 'shops for user')
    console.log('📊 Shops details:', shops.map(shop => ({ id: shop.id, name: shop.name, createdBy: shop.createdBy })))
    // For each shop, fetch stats
    const shopsWithStats = await Promise.all(shops.map(async (shop) => {
      const [
        totalSales,
        totalProducts,
        totalCustomers,
        totalEmployees,
        assignedUsers,
        recentSales
      ] = await Promise.all([
        prisma.sale.count({ where: { shopId: shop.id } }),
        prisma.product.count({ where: { shopId: shop.id } }),
        prisma.customer.count({ where: { shopId: shop.id } }),
        prisma.employee.count({ where: { shopId: shop.id } }),
        prisma.userShopAssignment.count({ where: { shopId: shop.id, active: true } }),
        prisma.sale.count({ where: { shopId: shop.id, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
      ]);
      return {
        id: Number(shop.id), // Convert BigInt to Number
        name: shop.name,
        location: shop.location,
        phone: shop.phone,
        email: shop.email,
        address: shop.address,
        gstNo: shop.gstNo,
        isActive: shop.isActive,
        createdBy: shop.createdBy ? Number(shop.createdBy) : null,
        updatedBy: shop.updatedBy ? Number(shop.updatedBy) : null,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
        totalSales,
        totalProducts,
        totalCustomers,
        totalEmployees,
        assignedUsers,
        recentSales
      };
    }));
    return NextResponse.json({ success: true, data: { shops: shopsWithStats } });
  } catch (error) {
    console.error('Get shops error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch shops' }, { status: 500 });
  }
}

// POST - Create a new shop
export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const { name, location, address, phone, email, gstNo } = body;
    if (!name || !location) {
      return NextResponse.json({ success: false, message: 'Name and location are required' }, { status: 400 });
    }

    // Convert GST number to uppercase for consistent storage
    const formattedGstNo = gstNo ? gstNo.toString().toUpperCase().trim() : null;
    if (gstNo && formattedGstNo !== gstNo) {
      console.log('🔍 GST number formatted:', { original: gstNo, formatted: formattedGstNo });
    }

    // Check subscription limits before creating shop
    console.log('🔍 Checking shop creation limits for user:', decoded.userId);
    const limitCheck = await canCreateShop(decoded.userId);
    console.log('🔍 Shop creation limit check:', limitCheck);
    
    if (!limitCheck.canCreate) {
      return NextResponse.json({ 
        success: false, 
        message: limitCheck.reason || 'Shop creation limit exceeded',
        data: {
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit
        }
      }, { status: 403 });
    }
    const shop = await prisma.shop.create({ 
      data: { 
        name, 
        location, 
        address, 
        phone, 
        email, 
        gstNo: formattedGstNo, 
        isActive: true,
        createdBy: decoded.userId,  // ✅ Track who created this shop
        updatedBy: decoded.userId   // ✅ Track who last updated this shop
      } 
    });

    // Log activity
    const { getClientIP, getUserAgent } = await import('@/app/lib/ipUtils');
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);
    
    console.log('🔍 [Shop Creation] Logging activity:', { ipAddress, userAgent });
    
    await prisma.activityLog.create({
      data: {
        userId: BigInt(decoded.userId),
        action: 'CREATE_SHOP',
        resource: 'Shop',
        resourceId: Number(shop.id),
        details: `Shop '${shop.name}' created at ${shop.location} by ${decoded.email}`,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedShop = {
      id: Number(shop.id),
      name: shop.name,
      location: shop.location,
      phone: shop.phone,
      email: shop.email,
      address: shop.address,
      gstNo: shop.gstNo,
      isActive: shop.isActive,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt
    };
    
    return NextResponse.json({ success: true, data: { shop: serializedShop } });
  } catch (error) {
    // Handle unique constraint error for shop name
    if (
      typeof error === 'object' && error !== null &&
      'code' in error && error.code === 'P2002' &&
      'meta' in error && error.meta &&
      typeof error.meta === 'object' && error.meta !== null &&
      'target' in error.meta && Array.isArray((error.meta as any).target) &&
      (error.meta as any).target.includes('name')
    ) {
      return NextResponse.json({ success: false, code: 'SHOP_NAME_EXISTS', message: 'A shop with this name already exists' }, { status: 409 });
    }
    console.error('Create shop error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create shop' }, { status: 500 });
  }
} 