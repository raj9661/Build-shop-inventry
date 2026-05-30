import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { canAccessShop } from '@/app/lib/shopAccessUtils';


// GET /api/tmt/sizes - Get all TMT sizes (isolated per SUPER_DUPER_ADMIN)
export async function GET(request: NextRequest) {
  try {
    // Authentication required
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // SUPER_DUPER_ADMIN: Only show sizes from shops they created (complete isolation)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // Get all shops created by this SUPER_DUPER_ADMIN
      const userShops = await prisma.shop.findMany({
        where: {
          createdBy: BigInt(decoded.userId),
          isActive: true
        },
        select: { id: true }
      });
      
      const userShopIds = userShops.map(shop => shop.id);
      
      if (userShopIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: []
        });
      }
      
      // Only show sizes associated with shops created by this SUPER_DUPER_ADMIN
      // Filter by direct shopId OR by having products in shops owned by this user
      const sizes = await prisma.tmtSize.findMany({
        where: {
          isActive: true,
          // Size must either be directly assigned to one of user's shops
          // OR have products in shops owned by this user
          OR: [
            {
              shopId: {
                in: userShopIds
              }
            },
            {
              products: {
                some: {
                  shopId: {
                    in: userShopIds
                  },
                  isActive: true
                }
              }
            }
          ]
        },
        orderBy: {
          sizeMm: 'asc'
        }
      });
      
      return NextResponse.json({
        success: true,
        data: sizes.map(s => ({
          id: Number(s.id),
          sizeMm: Number(s.sizeMm),
          description: null,
          isActive: s.isActive,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }))
      });
    }
    
    // For other roles, filter by shop access to maintain isolation
    const shopFilter = await getShopFilter(token);
    console.log('🔍 TMT Sizes API - Shop filter for non-SUPER_DUPER_ADMIN:', shopFilter);
    
    // If shopFilter is empty (shouldn't happen, but be safe), return empty results
    if (!shopFilter || Object.keys(shopFilter).length === 0) {
      console.log('⚠️ TMT Sizes API - No shop filter available, returning empty results for security');
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    // If shopFilter is empty (shouldn't happen, but be safe), return empty results
    if (!shopFilter || Object.keys(shopFilter).length === 0) {
      console.log('⚠️ TMT Sizes API - No shop filter available, returning empty results for security');
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    const whereClause: any = {
      isActive: true,
      OR: [
        shopFilter,  // Direct shopId match
        {
          products: {
            some: {
              ...shopFilter,
              isActive: true
            }
          }
        }
      ]
    };
    
    const sizes = await prisma.tmtSize.findMany({
      where: whereClause,
      orderBy: {
        sizeMm: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: sizes.map(s => ({
        id: Number(s.id),
        sizeMm: Number(s.sizeMm),
        description: null, // Not in current schema
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching TMT sizes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TMT sizes' },
      { status: 500 }
    );
  }
}

// POST /api/tmt/sizes - Create a new TMT size (isolated per SUPER_DUPER_ADMIN)
export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { sizeMm, description, shopId } = body;

    if (!sizeMm) {
      return NextResponse.json(
        { error: 'Size in mm is required' },
        { status: 400 }
      );
    }

    // SUPER_DUPER_ADMIN: Must specify a shop (no global sizes)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (!shopId) {
        return NextResponse.json(
          { error: 'Shop ID is required. You cannot create global TMT sizes.' },
          { status: 400 }
        );
      }
      
      // Verify the shop belongs to this SUPER_DUPER_ADMIN
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      });
      
      if (!shop) {
        return NextResponse.json(
          { error: 'You can only create TMT sizes for shops you created' },
          { status: 403 }
        );
      }
    } else if (shopId) {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to create TMT sizes for this shop' },
          { status: 403 }
        );
      }
    }

    // Check if size already exists (within the shop context)
    const existingSize = await prisma.tmtSize.findFirst({
      where: {
        sizeMm: parseFloat(sizeMm),
        isActive: true,
        shopId: shopId ? BigInt(parseInt(shopId)) : null
      }
    });

    if (existingSize) {
      return NextResponse.json(
        { error: `A TMT size of ${sizeMm}mm already exists in this shop` },
        { status: 409 }
      );
    }

    const size = await prisma.tmtSize.create({
      data: {
        sizeMm: parseFloat(sizeMm),
        shopId: shopId ? BigInt(parseInt(shopId)) : null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'TMT size created successfully',
      data: { 
        size: {
          id: Number(size.id),
          sizeMm: Number(size.sizeMm),
          isActive: size.isActive,
          createdAt: size.createdAt,
          updatedAt: size.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating TMT size:', error);
    return NextResponse.json(
      { error: 'Failed to create TMT size' },
      { status: 500 }
    );
  }
}

// PUT /api/tmt/sizes - Update a TMT size (isolated per SUPER_DUPER_ADMIN)
export async function PUT(request: NextRequest) {
  try {
    // Authentication required
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, sizeMm, description } = body;

    if (!id || !sizeMm) {
      return NextResponse.json(
        { error: 'Size ID and size in mm are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this size
    const size = await prisma.tmtSize.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    });
    
    if (!size) {
      return NextResponse.json({ error: 'TMT size not found' }, { status: 404 });
    }
    
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Verify the size's shop belongs to this SUPER_DUPER_ADMIN
      if (size.shopId && size.shop) {
        if (size.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json(
            { error: 'You can only edit TMT sizes from shops you created' },
            { status: 403 }
          );
        }
      } else {
        // Global size - SUPER_DUPER_ADMIN shouldn't have these
        return NextResponse.json(
          { error: 'Cannot edit this TMT size' },
          { status: 403 }
        );
      }
    } else if (size.shopId) {
      // For other roles, verify they have access to the size's shop
      const hasAccess = await canAccessShop(token, Number(size.shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to edit this TMT size' },
          { status: 403 }
        );
      }
    }

    const updatedSize = await prisma.tmtSize.update({
      where: { id: BigInt(id) },
      data: {
        sizeMm: parseFloat(sizeMm)
      }
    });

    return NextResponse.json({
      success: true,
      message: 'TMT size updated successfully',
      data: {
        size: {
          id: Number(updatedSize.id),
          sizeMm: Number(updatedSize.sizeMm),
          isActive: updatedSize.isActive,
          createdAt: updatedSize.createdAt,
          updatedAt: updatedSize.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating TMT size:', error);
    return NextResponse.json(
      { error: 'Failed to update TMT size' },
      { status: 500 }
    );
  }
}
