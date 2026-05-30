import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { canAccessShop } from '@/app/lib/shopAccessUtils';


// GET /api/tmt/companies - Get all TMT companies (isolated per SUPER_DUPER_ADMIN)
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
    
    // SUPER_DUPER_ADMIN: Only show companies from shops they created (complete isolation)
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
      
      // Only show companies associated with shops created by this SUPER_DUPER_ADMIN
      // Filter by direct shopId OR by having products in shops owned by this user
      const companies = await prisma.tmtCompany.findMany({
        where: {
          isActive: true,
          // Company must either be directly assigned to one of user's shops
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
          name: 'asc'
        }
      });
      
      return NextResponse.json({
        success: true,
        data: companies.map(c => ({
          id: Number(c.id),
          name: c.name,
          location: null,
          contactInfo: null,
          isActive: c.isActive,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      });
    }
    
    // For other roles, filter by shop access to maintain isolation
    const shopFilter = await getShopFilter(token);
    console.log('🔍 TMT Companies API - Shop filter for non-SUPER_DUPER_ADMIN:', shopFilter);
    
    // If shopFilter is empty (shouldn't happen, but be safe), return empty results
    if (!shopFilter || Object.keys(shopFilter).length === 0) {
      console.log('⚠️ TMT Companies API - No shop filter available, returning empty results for security');
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    const whereClause: any = {
      isActive: true,
      ...shopFilter  // Apply shop filter (will be { shopId: { in: [...] } } or { shopId: -1 })
    };
    
    const companies = await prisma.tmtCompany.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: companies.map(c => ({
        id: Number(c.id),
        name: c.name,
        location: null, // Not in current schema
        contactInfo: null, // Not in current schema
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching TMT companies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TMT companies' },
      { status: 500 }
    );
  }
}

// POST /api/tmt/companies - Create a new TMT company (isolated per SUPER_DUPER_ADMIN)
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
    const { name, location, contactInfo, shopId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // SUPER_DUPER_ADMIN: Must specify a shop (no global companies)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (!shopId) {
        return NextResponse.json(
          { error: 'Shop ID is required. You cannot create global TMT companies.' },
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
          { error: 'You can only create TMT companies for shops you created' },
          { status: 403 }
        );
      }
    } else if (shopId) {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to create TMT companies for this shop' },
          { status: 403 }
        );
      }
    }

    // Check if company already exists
    // For SUPER_DUPER_ADMIN and other roles with shopId: check within the specific shop only (allows same name in different shops)
    // For other roles without shopId: check globally (not recommended)
    let existingCompany;
    if (shopId) {
      existingCompany = await prisma.tmtCompany.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          isActive: true,
          shopId: BigInt(parseInt(shopId))
        }
      });
    } else {
      existingCompany = await prisma.tmtCompany.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          isActive: true
        }
      });
    }

    if (existingCompany) {
      return NextResponse.json(
        { error: `A TMT company with the name "${name}" already exists` },
        { status: 409 }
      );
    }

    const company = await prisma.tmtCompany.create({
      data: {
        name,
        shopId: shopId ? BigInt(parseInt(shopId)) : null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'TMT company created successfully',
      data: { 
        company: {
          id: Number(company.id),
          name: company.name,
          location: null,
          contactInfo: null,
          isActive: company.isActive,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating TMT company:', error);
    return NextResponse.json(
      { error: 'Failed to create TMT company' },
      { status: 500 }
    );
  }
}

// PUT /api/tmt/companies - Update a TMT company (isolated per SUPER_DUPER_ADMIN)
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
    const { id, name, location, contactInfo } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Company ID and name are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company (via shop ownership or assignment)
    const company = await prisma.tmtCompany.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    });
    
    if (!company) {
      return NextResponse.json({ error: 'TMT company not found' }, { status: 404 });
    }
    
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Verify the company's shop belongs to this SUPER_DUPER_ADMIN
      if (company.shopId && company.shop) {
        if (company.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json(
            { error: 'You can only edit TMT companies from shops you created' },
            { status: 403 }
          );
        }
      } else {
        // Global company - SUPER_DUPER_ADMIN shouldn't have these
        return NextResponse.json(
          { error: 'Cannot edit this TMT company' },
          { status: 403 }
        );
      }
    } else if (company.shopId) {
      // For other roles, verify they have access to the company's shop
      const hasAccess = await canAccessShop(token, Number(company.shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to edit this TMT company' },
          { status: 403 }
        );
      }
    }

    const updatedCompany = await prisma.tmtCompany.update({
      where: { id: BigInt(id) },
      data: {
        name
      }
    });

    return NextResponse.json({
      success: true,
      message: 'TMT company updated successfully',
      data: {
        company: {
          id: Number(updatedCompany.id),
          name: updatedCompany.name,
          location: null,
          contactInfo: null,
          isActive: updatedCompany.isActive,
          createdAt: updatedCompany.createdAt,
          updatedAt: updatedCompany.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating TMT company:', error);
    return NextResponse.json(
      { error: 'Failed to update TMT company' },
      { status: 500 }
    );
  }
}
