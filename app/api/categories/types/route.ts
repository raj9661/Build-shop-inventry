import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

function requireSuperAdmin(user: any) {
  return user && (user.role === 'SUPER_DUPER_ADMIN' || user.role === 'SUPER_ADMIN');
}

// GET: Get all product types
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
    
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');
    
    if (!shopId) {
      return NextResponse.json({ success: false, message: 'shopId is required' }, { status: 400 });
    }

    const shopIdNum = parseInt(shopId);

    // For SUPER_DUPER_ADMIN, allow access to all shops
    // For other users, only allow access to their assigned shops
    let whereClause: any;

    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Only show types from shops they created (complete isolation)
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
      
      // Only show types from shops created by this SUPER_DUPER_ADMIN AND global types created by this SUPER_DUPER_ADMIN
      whereClause = { 
        isActive: true,
        OR: [
          { shopId: BigInt(shopIdNum) },  // Shop-specific types
          { shopId: null, createdBy: BigInt(decoded.userId) }  // Global types created by this SUPER_DUPER_ADMIN
        ]
      };
    } else {
      // For regular users, include shop-specific types AND global types created by their shop's owner
      // Get the shop's creator to filter global types correctly
      const shop = await prisma.shop.findUnique({
        where: { id: BigInt(shopIdNum) },
        select: { createdBy: true }
      });
      
      whereClause = {
        isActive: true,
        OR: [
          { shopId: BigInt(shopIdNum) },  // Shop-specific types
          { shopId: null, createdBy: shop?.createdBy || null }  // Global types created by shop owner
        ]
      };
    }

    const types = await prisma.productType.findMany({
      where: whereClause,
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedTypes = types.map(type => ({
      id: Number(type.id),
      name: type.name,
      description: type.description,
      isActive: type.isActive,
      categoryId: type.categoryId ? Number(type.categoryId) : null,
      shopId: type.shopId ? Number(type.shopId) : null,
      createdBy: type.createdBy ? Number(type.createdBy) : null,
      bundleSize: type.bundleSize,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString()
    }));
    
    return NextResponse.json({ success: true, data: serializedTypes });
  } catch (error) {
    console.error('Get product types error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch product types' }, { status: 500 });
  }
}

// POST: Create a new product type
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }
    const body = await req.json();
    const { name, description, categoryId, shopId } = body;
    if (!name || !categoryId) {
      return NextResponse.json({ success: false, message: 'Type name and category are required' }, { status: 400 });
    }

    // SUPER_DUPER_ADMIN: Only allow creating types for shops they created or global types
    let targetShopId = shopId ? BigInt(parseInt(shopId)) : null;
    
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (shopId) {
        // Verify the shop belongs to this SUPER_DUPER_ADMIN
        const shop = await prisma.shop.findFirst({
          where: {
            id: BigInt(parseInt(shopId)),
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        });
        
        if (!shop) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only create product types for shops you created' 
          }, { status: 403 });
        }
      }
      // If shopId is null, it's a global type - allow for SUPER_DUPER_ADMIN
    }
    
    // Check if product type already exists in the target shop
    // For SUPER_DUPER_ADMIN creating global types, also check createdBy to prevent duplicates within the same user's global types
    const duplicateCheckWhere: any = {
      name: { equals: name, mode: 'insensitive' },
      shopId: targetShopId,
      isActive: true
    };
    
    // For global types (shopId: null), also check createdBy to ensure isolation between SUPER_DUPER_ADMINs
    if (!targetShopId && decoded.role === 'SUPER_DUPER_ADMIN') {
      duplicateCheckWhere.createdBy = BigInt(decoded.userId);
    }
    
    const existingType = await prisma.productType.findFirst({
      where: duplicateCheckWhere
    });
    if (existingType) {
      const location = targetShopId ? 'in the selected shop' : 'globally';
      return NextResponse.json({ 
        success: false, 
        message: `A product type with the name "${name}" already exists ${location}. Please choose a different name.` 
      }, { status: 409 });
    }

    const productTypeData: any = {
      name,
      description: description || '',
      categoryId: BigInt(parseInt(categoryId)),
      shopId: targetShopId
    };
    
    // Set createdBy for SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      productTypeData.createdBy = BigInt(decoded.userId);
    }
    
    const productType = await prisma.productType.create({
      data: productTypeData
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedProductType = {
      id: Number(productType.id),
      name: productType.name,
      description: productType.description,
      isActive: productType.isActive,
      categoryId: productType.categoryId ? Number(productType.categoryId) : null,
      shopId: productType.shopId ? Number(productType.shopId) : null,
      createdBy: productType.createdBy ? Number(productType.createdBy) : null,
      bundleSize: productType.bundleSize,
      createdAt: productType.createdAt.toISOString(),
      updatedAt: productType.updatedAt.toISOString()
    };
    
    return NextResponse.json({ success: true, data: serializedProductType });
  } catch (error) {
    console.error('Create product type error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create product type' }, { status: 500 });
  }
}

// PUT: Update a product type
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }
    const body = await req.json();
    const { id, name, description, isActive, categoryId, shopId } = body;
    if (!id || !name || !categoryId) {
      return NextResponse.json({ success: false, message: 'Type ID, name, and category are required' }, { status: 400 });
    }

    // SUPER_DUPER_ADMIN: Verify they own the type and the target shop
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const currentType = await prisma.productType.findUnique({
        where: { id: parseInt(id) },
        include: { shop: true }
      });
      
      if (!currentType) {
        return NextResponse.json({ success: false, message: 'Product type not found' }, { status: 404 });
      }
      
      // Verify the type's current shop belongs to this SUPER_DUPER_ADMIN
      if (currentType.shopId && currentType.shop) {
        if (currentType.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only edit product types from shops you created' 
          }, { status: 403 });
        }
      }
      
      // If updating shopId, verify the new shop belongs to this SUPER_DUPER_ADMIN
      if (shopId !== null && shopId !== undefined) {
        const targetShop = await prisma.shop.findFirst({
          where: {
            id: BigInt(parseInt(shopId)),
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        });
        
        if (!targetShop) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only assign product types to shops you created' 
          }, { status: 403 });
        }
      }
      
      // No global types (shopId must not be null)
      if (shopId === null) {
        return NextResponse.json({ 
          success: false, 
          message: 'Shop ID is required. You cannot create or update global product types.' 
        }, { status: 400 });
      }
    }
    
    // Determine the target shopId
    let targetShopId = shopId ? BigInt(parseInt(shopId)) : null;
    
    // Check if a product type with the same name already exists in the target shop
    const existingType = await prisma.productType.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        shopId: targetShopId,
        id: { not: parseInt(id) } // Exclude the current type being updated
      }
    });

    if (existingType) {
      const location = targetShopId ? 'in the selected shop' : 'globally';
      return NextResponse.json({ 
        success: false, 
        message: `A product type with the name "${name}" already exists ${location}. Please choose a different name or shop.` 
      }, { status: 400 });
    }

    const updateData: any = {
      name,
      description,
      isActive,
      categoryId: BigInt(parseInt(categoryId)),
      shopId: targetShopId
    };
    
    const productType = await prisma.productType.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    // Convert BigInt fields to numbers for JSON serialization
    const serializedProductType = {
      id: Number(productType.id),
      name: productType.name,
      description: productType.description,
      isActive: productType.isActive,
      categoryId: productType.categoryId ? Number(productType.categoryId) : null,
      shopId: productType.shopId ? Number(productType.shopId) : null,
      createdBy: productType.createdBy ? Number(productType.createdBy) : null,
      bundleSize: productType.bundleSize,
      createdAt: productType.createdAt.toISOString(),
      updatedAt: productType.updatedAt.toISOString()
    };
    
    return NextResponse.json({ success: true, data: serializedProductType });
  } catch (error) {
    console.error('Update product type error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update product type' }, { status: 500 });
  }
}

// DELETE: Delete a product type
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!requireSuperAdmin(decoded)) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const shopId = searchParams.get('shopId');
    if (!id || !shopId) {
      return NextResponse.json({ success: false, message: 'Product type ID and shopId are required' }, { status: 400 });
    }
    
    // SUPER_DUPER_ADMIN: Verify they own this product type
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const productType = await prisma.productType.findUnique({
        where: { id: parseInt(id) },
        include: { shop: true }
      });
      
      if (!productType) {
        return NextResponse.json({ success: false, message: 'Product type not found' }, { status: 404 });
      }
      
      // Verify the type's shop belongs to this SUPER_DUPER_ADMIN
      if (productType.shopId && productType.shop) {
        if (productType.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only delete product types from shops you created' 
          }, { status: 403 });
        }
      } else {
        // Global type - SUPER_DUPER_ADMIN shouldn't have these, but check anyway
        return NextResponse.json({ 
          success: false, 
          message: 'Cannot delete this product type' 
        }, { status: 403 });
      }
    }
    
    // Check if product type is being used by any products in this shop
    const productCount = await prisma.product.count({
      where: { 
        typeId: BigInt(parseInt(id)), 
        shopId: BigInt(parseInt(shopId)),
        isActive: true // Only count active products
      }
    });
    
    if (productCount > 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Cannot delete product type as it is being used by ${productCount} product(s). Please remove or reassign all products from this product type before deleting it.` 
      }, { status: 400 });
    }
    // Soft delete the product type
    await prisma.productType.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });
    return NextResponse.json({ success: true, message: 'Product type deleted successfully' });
  } catch (error) {
    console.error('Delete product type error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete product type' }, { status: 500 });
  }
} 