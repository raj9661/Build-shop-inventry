import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';

const prisma = new PrismaClient();

// Utility function to recursively convert BigInt to numbers and handle Date objects
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  
  return obj;
}

// Utility function to serialize BigInt fields for JSON response
function serializeCategory(category: any) {
  return {
    id: Number(category.id),
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    shopId: category.shopId ? Number(category.shopId) : null,
    createdBy: category.createdBy ? Number(category.createdBy) : null,
    productCount: 0, // New/updated categories start with 0 products
    types: [], // New/updated categories start with empty types array
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

function requireSuperAdmin(user: any) {
  return user && (user.role === 'SUPER_DUPER_ADMIN' || user.role === 'SUPER_ADMIN');
}

// GET: Get all categories with their types
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
    
    // Check if user can access this shop (for non-SUPER_DUPER_ADMIN and non-SUPER_ADMIN users)
    // SUPER_DUPER_ADMIN and SUPER_ADMIN can access categories for any shop
    if (decoded.role !== 'SUPER_DUPER_ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      const { canAccessShop } = await import('@/app/lib/shopAccessUtils');
      const canAccess = await canAccessShop(token, shopIdNum);
      if (!canAccess) {
        return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
      }
    }
    
    let categories: any[] = [];

    console.log('🔍 Categories API: User role:', decoded.role, 'shopId:', shopIdNum);

    if (decoded.role === 'SUPER_DUPER_ADMIN' || decoded.role === 'SUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Only show categories from shops they created (complete isolation)
      // First, get all shops created by this SUPER_DUPER_ADMIN
      const userShops = await prisma.shop.findMany({
        where: {
          createdBy: BigInt(decoded.userId),
          isActive: true
        },
        select: { id: true }
      });
      
      const userShopIds = userShops.map(shop => shop.id);
      console.log('🔍 SUPER_DUPER_ADMIN shops:', userShopIds.map(id => Number(id)));
      console.log('🔍 Requested shopId:', shopIdNum);
      
      if (userShopIds.length === 0) {
        // No shops created by this user, return empty array
        categories = [];
      } else {
        // Verify the requested shopId belongs to this SUPER_DUPER_ADMIN
        const requestedShopId = BigInt(shopIdNum);
        // Convert both to strings for reliable comparison
        const userShopIdStrings = userShopIds.map(id => id.toString());
        const requestedShopIdString = requestedShopId.toString();
        const shopBelongsToUser = userShopIdStrings.includes(requestedShopIdString);
        
        console.log('🔍 Shop ownership check:', {
          requestedShopId: requestedShopIdString,
          userShopIds: userShopIdStrings,
          belongsToUser: shopBelongsToUser,
          userId: decoded.userId
        });
        
        if (!shopBelongsToUser) {
          console.log('⚠️ Requested shop does not belong to SUPER_DUPER_ADMIN');
          // Return empty array - user doesn't own this shop
          categories = [];
        } else {
          // Only show categories from shops created by this SUPER_DUPER_ADMIN
          // Show categories for the requested shop (shopId must match) AND global categories created by this SUPER_DUPER_ADMIN
          console.log('✅ Fetching categories for owned shop:', requestedShopIdString);
          const requestedShopCategories = await prisma.productCategory.findMany({
            where: {
              isActive: true,
              OR: [
                { shopId: requestedShopId },  // Shop-specific categories
                { shopId: null, createdBy: BigInt(decoded.userId) }  // Global categories created by this SUPER_DUPER_ADMIN
              ]
            },
            include: {
              types: {
                where: { isActive: true },
                orderBy: { name: 'asc' }
              },
              products: {
                where: { isActive: true },
                select: { id: true }
              }
            },
            orderBy: { name: 'asc' }
          });

          categories = requestedShopCategories;
          console.log('🔍 SUPER_DUPER_ADMIN categories (isolated):', categories.length, 'for shop', shopIdNum);
        }
      }
    } else {
      // For regular users, include shop-specific categories for their assigned shops only
      // Check if user has access to this shop
      const { canAccessShop } = await import('@/app/lib/shopAccessUtils');
      const canAccess = await canAccessShop(token, shopIdNum);
      if (!canAccess) {
        return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
      }
      
      // Get the shop's creator to filter global categories correctly
      const shop = await prisma.shop.findUnique({
        where: { id: BigInt(shopIdNum) },
        select: { createdBy: true }
      });
      
      const shopCategories = await prisma.productCategory.findMany({
        where: {
          isActive: true,
          OR: [
            { shopId: BigInt(shopIdNum) },  // Shop-specific categories
            { shopId: null, createdBy: shop?.createdBy || null }  // Global categories created by shop owner
          ]
        },
        include: {
          types: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          },
          products: {
            where: { isActive: true },
            select: { id: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      categories = shopCategories;
    }
    
    // Convert BigInt ids to numbers for JSON serialization
    console.log('🔍 Raw categories from DB:', categories.length);
    
    // Use the comprehensive BigInt serializer
    const serializedCategories = serializeBigInt(categories);
    
    console.log('🔍 Serialized categories count:', serializedCategories.length);
    console.log('🔍 Sample serialized category:', JSON.stringify(serializedCategories[0], null, 2));
    
    return NextResponse.json({ success: true, data: serializedCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST: Create a new category
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
    const { name, description, shopId } = body;
    if (!name) {
      return NextResponse.json({ success: false, message: 'Category name is required' }, { status: 400 });
    }
    // Check if category already exists globally or in this shop
    // For SUPER_DUPER_ADMIN creating global categories, also check createdBy to prevent duplicates within the same user's global categories
    const duplicateCheckWhere: any = {
      name: { equals: name, mode: 'insensitive' },
      isActive: true
    };
    
    if (shopId) {
      duplicateCheckWhere.shopId = parseInt(shopId);
    } else {
      duplicateCheckWhere.shopId = null;
      // For global categories, also check createdBy to ensure isolation between SUPER_DUPER_ADMINs
      if (decoded.role === 'SUPER_DUPER_ADMIN') {
        duplicateCheckWhere.createdBy = BigInt(decoded.userId);
      }
    }
    
    const existingCategory = await prisma.productCategory.findFirst({
      where: duplicateCheckWhere
    });
    if (existingCategory) {
      const location = shopId ? 'in the selected shop' : 'globally';
      return NextResponse.json({ 
        success: false, 
        message: `A category with the name "${name}" already exists ${location}. Please choose a different name.` 
      }, { status: 409 });
    }
    // Build data object for category creation
    const categoryData: any = {
      name,
      description: description || ''
    };
    
    // SUPER_DUPER_ADMIN: Only allow creating categories for shops they created or global categories
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // Always set createdBy for SUPER_DUPER_ADMIN
      categoryData.createdBy = BigInt(decoded.userId);
      
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
            message: 'You can only create categories for shops you created' 
          }, { status: 403 });
        }
        
        categoryData.shopId = BigInt(parseInt(shopId));
      } else {
        // Global category - allow for SUPER_DUPER_ADMIN (will be visible to all their shops)
        categoryData.shopId = null;
      }
    } else {
      // For other roles, use provided shopId or default
      if (shopId !== undefined) {
        categoryData.shopId = shopId === null ? null : BigInt(parseInt(shopId));
      } else {
        categoryData.shopId = null;
      }
    }
    const category = await prisma.productCategory.create({
      data: categoryData
    });
    
    // Convert all BigInt fields to numbers for JSON serialization
    const serializedCategory = serializeCategory(category);
    
    return NextResponse.json({ success: true, data: serializedCategory });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create category' }, { status: 500 });
  }
}

// PUT: Update a category
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
    const { id, name, description, isActive, shopId } = body;
    
    console.log('🔍 Category update request:', { id, name, shopId, shopIdType: typeof shopId });
    
    if (!id || !name) {
      return NextResponse.json({ success: false, message: 'Category ID and name are required' }, { status: 400 });
    }
    
    // Convert shopId to BigInt safely
    let targetShopId: bigint | null = null;
    if (shopId !== null && shopId !== undefined && shopId !== '') {
      try {
        targetShopId = BigInt(parseInt(shopId.toString()));
      } catch (e) {
        console.error('Invalid shopId format:', shopId);
        return NextResponse.json({ success: false, message: 'Invalid shopId format' }, { status: 400 });
      }
    }

    // SUPER_DUPER_ADMIN: Verify they own the category and the target shop
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const currentCategory = await prisma.productCategory.findUnique({
        where: { id: parseInt(id) },
        include: { shop: true }
      });
      
      if (!currentCategory) {
        return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
      }
      
      // Verify the category's ownership
      const isGlobal = !currentCategory.shopId;
      
      if (isGlobal) {
        // For global categories, verify the creator
        if (currentCategory.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only edit global categories you created' 
          }, { status: 403 });
        }
      } else {
        // For shop-specific categories, verify the shop's creator
        if (currentCategory.shop && currentCategory.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only edit categories from shops you created' 
          }, { status: 403 });
        }
      }
      
      // If updating shopId, verify the new shop if it's not global
      if (targetShopId !== null) {
        const targetShop = await prisma.shop.findFirst({
          where: {
            id: targetShopId,
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        });
        
        if (!targetShop) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only assign categories to shops you created' 
          }, { status: 403 });
        }
      }
      
      // Allow global categories (shopId: null) for SUPER_DUPER_ADMIN
    }
    
    // Check if a category with the same name already exists in the target shop/global scope
    const duplicateCheckWhere: any = {
      name: { equals: name, mode: 'insensitive' },
      shopId: targetShopId,
      id: { not: parseInt(id) },
      isActive: true
    };

    // For global categories, also check createdBy to ensure isolation between SUPER_DUPER_ADMINs
    if (targetShopId === null && decoded.role === 'SUPER_DUPER_ADMIN') {
      duplicateCheckWhere.createdBy = BigInt(decoded.userId);
    }

    const existingCategory = await prisma.productCategory.findFirst({
      where: duplicateCheckWhere
    });

    if (existingCategory) {
      const location = targetShopId ? 'in the selected shop' : 'globally';
      return NextResponse.json({ 
        success: false, 
        message: `A category with the name "${name}" already exists ${location}. Please choose a different name or shop.` 
      }, { status: 400 });
    }

    const category = await prisma.productCategory.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        isActive,
        shopId: targetShopId
      }
    });
    
    // Convert all BigInt fields to numbers for JSON serialization
    const serializedCategory = serializeCategory(category);
    
    return NextResponse.json({ success: true, data: serializedCategory });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE: Delete a category
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
      return NextResponse.json({ success: false, message: 'Category ID and shopId are required' }, { status: 400 });
    }
    
    // SUPER_DUPER_ADMIN: Verify they own this category
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const category = await prisma.productCategory.findUnique({
        where: { id: parseInt(id) },
        include: { shop: true }
      });
      
      if (!category) {
        return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
      }
      
      // Verify the category's shop belongs to this SUPER_DUPER_ADMIN
      if (category.shopId && category.shop) {
        if (category.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only delete categories from shops you created' 
          }, { status: 403 });
        }
      } else if (!category.shopId) {
        // Global category - verify the creator
        if (category.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json({ 
            success: false, 
            message: 'You can only delete global categories you created' 
          }, { status: 403 });
        }
      }
    }
    
    // Check if category is being used by any products in this shop
    const productCount = await prisma.product.count({
      where: { 
        categoryId: BigInt(parseInt(id)), 
        shopId: BigInt(parseInt(shopId)),
        isActive: true // Only count active products
      }
    });
    
    // Also check if category has any product types
    const productTypeCount = await prisma.productType.count({
      where: { 
        categoryId: parseInt(id),
        isActive: true // Only count active product types
      }
    });
    
    if (productCount > 0 || productTypeCount > 0) {
      let message = '';
      if (productCount > 0 && productTypeCount > 0) {
        message = `Cannot delete category as it is being used by ${productCount} product(s) and has ${productTypeCount} product type(s). Please remove or reassign all products and product types from this category before deleting it.`;
      } else if (productCount > 0) {
        message = `Cannot delete category as it is being used by ${productCount} product(s). Please remove or reassign all products from this category before deleting it.`;
      } else if (productTypeCount > 0) {
        message = `Cannot delete category as it has ${productTypeCount} product type(s). Please remove or reassign all product types from this category before deleting it.`;
      }
      
      return NextResponse.json({ 
        success: false, 
        message: message
      }, { status: 400 });
    }
    // Soft delete the category
    await prisma.productCategory.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });
    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete category' }, { status: 500 });
  }
} 