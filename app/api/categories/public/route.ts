import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';


// GET: Get all active categories with their types (public access)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    // Get categories with proper isolation based on user role
    // SUPER_DUPER_ADMIN: show only their categories and global categories they created
    // Other users: show shop-specific categories and global categories from their shop's owner
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');
    const shopIdNum = shopId ? parseInt(shopId) : null;

    let whereClause: any = { isActive: true };

    if (decoded.role === 'SUPER_DUPER_ADMIN' || decoded.role === 'SUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Only show categories from shops they created AND global categories they created
      if (shopIdNum) {
        // Verify the shop belongs to this SUPER_DUPER_ADMIN
        const shop = await prisma.shop.findFirst({
          where: {
            id: BigInt(shopIdNum),
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        });
        
        if (!shop) {
          // Shop doesn't belong to this SUPER_DUPER_ADMIN or doesn't exist
          return NextResponse.json({ success: true, data: [] });
        }
        
        whereClause.OR = [
          { shopId: BigInt(shopIdNum) },
          { shopId: null, createdBy: BigInt(decoded.userId) }
        ];
      } else {
        // No shopId provided, show only global categories created by this SUPER_DUPER_ADMIN
        whereClause.shopId = null;
        whereClause.createdBy = BigInt(decoded.userId);
      }
    } else if (shopIdNum) {
      // For regular users, include shop-specific categories AND global categories from their shop's owner
      const shop = await prisma.shop.findUnique({
        where: { id: BigInt(shopIdNum) },
        select: { createdBy: true }
      });
      
      whereClause.OR = [
        { shopId: BigInt(shopIdNum) },
        { shopId: null, createdBy: shop?.createdBy || null }
      ];
    }

    const categories = await prisma.productCategory.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    // Get types for each category
    const categoriesWithTypes = await Promise.all(
      categories.map(async (category) => {
        const types = await prisma.productType.findMany({
          where: { 
            categoryId: category.id,
            isActive: true 
          },
          orderBy: { name: 'asc' }
        });
        return {
          ...category,
          types
        };
      })
    );

    // Serialize BigInt fields to numbers for JSON response
    const serializedCategories = categoriesWithTypes.map(category => ({
      id: Number(category.id),
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      shopId: category.shopId ? Number(category.shopId) : null,
      createdBy: category.createdBy ? Number(category.createdBy) : null,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
      types: category.types.map((type: any) => ({
        id: Number(type.id),
        name: type.name,
        description: type.description,
        categoryId: type.categoryId ? Number(type.categoryId) : null,
        shopId: type.shopId ? Number(type.shopId) : null,
        createdBy: type.createdBy ? Number(type.createdBy) : null,
        bundleSize: type.bundleSize,
        isActive: type.isActive,
        createdAt: type.createdAt.toISOString(),
        updatedAt: type.updatedAt.toISOString()
      }))
    }));

    return NextResponse.json({ success: true, data: serializedCategories });
  } catch (error) {
    console.error('Get public categories error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch categories' }, { status: 500 });
  }
} 