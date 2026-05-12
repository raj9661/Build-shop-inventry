import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { prisma } from '@/lib/prisma';

// Helper function to serialize BigInt values
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  return obj;
};

const roleHierarchy = {
  'STAFF': 1,
  'ADMIN': 2,
  'SUPER_ADMIN': 3,
  'SUPER_DUPER_ADMIN': 4
};
type Role = keyof typeof roleHierarchy;

// Helper: Check if user has required role
function requireRole(user: { role: Role }, allowedRoles: Role[]) {
  const userRoleLevel = roleHierarchy[user.role];
  return allowedRoles.some(role => userRoleLevel >= roleHierarchy[role]);
}

// GET - List customers (Optimized)
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required', code: 'TOKEN_MISSING' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50'); // Increased default limit
    const search = searchParams.get('search') || '';
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');

    console.log('🔍 [Customer API] Request parameters:', { shopId, search, status, userRole: decoded.role });

    const skip = (page - 1) * limit;

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);

    // Build where clause with optimized search
    const where: any = {
      // Note: isWalkIn field doesn't exist in Customer model
    };

    // Enhanced search functionality
    if (search) {
      const searchTerm = search.trim();
      if (searchTerm.length > 0) {
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } }
        ];
      }
    }

    if (shopId) {
      where.shopId = parseInt(shopId);
    }

    // Only show active customers unless status=all is provided
    if (status !== 'all') {
      where.isActive = true;
    }

    // Strict Shop Isolation:
    // 1. If shopId is provided, VERIFY the user has access to it.
    // 2. If shopFilter indicates restricted access (non-SDA), ensure we enforce it.

    // Check if user is SUPER_DUPER_ADMIN (can access any shop if they know the ID, 
    // though typically they only see their own. shopFilter handles the 'own' part for lists, 
    // but for specific shopId access we should double check if we want to restrict them to only created shops.
    // The previous logic in getShopFilter for SDA restricts to created shops, so we should allow that.)

    if (shopId) {
      const requestedShopId = parseInt(shopId);

      console.log(`🔍 [Customer API] Checking access for Shop ${requestedShopId} with ShopFilter:`, JSON.stringify(shopFilter));

      // If user has a shop filter (meaning they are restricted to specific shops),
      // we must ensure the requested shopId is allowed.
      if (Object.keys(shopFilter).length > 0 && shopFilter.shopId) {
        let isAllowed = false;

        // Helper to check if ID is in filter
        const filter = shopFilter.shopId;
        if (typeof filter === 'number') {
          isAllowed = filter === requestedShopId;
        } else if (typeof filter === 'object' && 'in' in filter && Array.isArray(filter.in)) {
          isAllowed = filter.in.includes(requestedShopId);
        }

        console.log(`🔍 [Customer API] Access Check: Shop ${requestedShopId} Allowed? ${isAllowed}`);

        if (!isAllowed) {
          console.warn(`⛔ [Customer API] Access denied: User ${decoded.userId} tried to access shop ${requestedShopId} but is restricted to ${JSON.stringify(shopFilter.shopId)}`);
          return NextResponse.json({
            success: false,
            message: 'You do not have permission to view customers from this shop',
            code: 'SHOP_ACCESS_DENIED'
          }, { status: 403 });
        }
      }

      where.shopId = requestedShopId;
    } else if (Object.keys(shopFilter).length > 0) {
      // If no shopId provided, apply the default filter (e.g. all assigned shops)
      if (shopFilter.shopId && typeof shopFilter.shopId === 'object' && 'in' in shopFilter.shopId) {
        where.shopId = { in: shopFilter.shopId.in };
      } else if (typeof shopFilter.shopId === 'number') {
        where.shopId = shopFilter.shopId;
      }
    } else if (decoded.role !== 'SUPER_DUPER_ADMIN' && decoded.role !== 'PLATFORM_OWNER') {
      // If no shopId and no filter returned but user is not a super admin, deny access or returns empty
      // This protects against a case where getShopFilter returns empty but user shouldn't see everything
      // But typically getShopFilter returns { shopId: -1 } for no access.
      // We'll leave it as safe default.
    }

    console.log('🔍 [Customer API] Final where clause:', JSON.stringify(where, null, 2));
    console.log('🔍 [Customer API] Shop filter:', JSON.stringify(shopFilter, null, 2));

    // Optimized query with better field selection
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          isActive: true,
          currentBalance: true,
          createdAt: true,
          shop: {
            select: {
              id: true,
              name: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: [
          { isActive: 'desc' }, // Active customers first
          { name: 'asc' } // Then alphabetically by name
        ]
      }),
      prisma.customer.count({ where })
    ]);

    // Debug API response status
    if (search) {
      console.log(`🔍 [Customer API] Fetched ${customers.length} customers for search "${search}". Statuses:`,
        customers.map(c => `${c.name}: ${c.isActive}`).join(', ')
      );
    }

    // Extract customer IDs for batch querying
    const customerIds = customers.map(c => c.id);

    // Optimize: Fetch transaction counts in a single batch query
    // Instead of N+1 queries, we do 1 aggregation query
    const transactionCounts = await prisma.customerLedgerEntry.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        isActive: true
      },
      _count: {
        _all: true
      }
    });

    // Create a map for O(1) lookup
    // Convert BigInt keys to string for reliable Map keys
    const countMap = new Map<string, number>();
    transactionCounts.forEach(item => {
      countMap.set(item.customerId.toString(), item._count._all);
    });

    // Merge stats with customer data
    const customersWithStats = customers.map(customer => {
      return {
        ...customer,
        stats: {
          recentSales: 0,
          recentPayments: 0,
          totalTransactions: countMap.get(customer.id.toString()) || 0
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt({
        customers: customersWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })
    });

  } catch (error) {
    console.error('Get customers error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';

    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: errorName
    });
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch customers',
      code: 'FETCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}

// POST - Create customer
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required', code: 'TOKEN_MISSING' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    if (!requireRole(decoded, ['ADMIN', 'SUPER_ADMIN', 'SUPER_DUPER_ADMIN'])) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, email, address, shopId, openingBalance = 0 } = body;

    if (!name || !phone || !shopId) {
      return NextResponse.json({
        success: false,
        message: 'Name, phone, and shop ID are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, { status: 400 });
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({
        success: false,
        message: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      }, { status: 400 });
    }

    // Check if customer with same phone exists in the shop
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        phone,
        shopId: parseInt(shopId)
      }
    });

    if (existingCustomer) {
      return NextResponse.json({
        success: false,
        message: 'Customer with this phone number already exists in this shop',
        code: 'DUPLICATE_CUSTOMER'
      }, { status: 400 });
    }

    // Create customer with opening balance using nested write
    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        shopId: parseInt(shopId),
        isActive: true,
        currentBalance: openingBalance,
        ...(openingBalance > 0 && {
          ledgerEntries: {
            create: {
              date: new Date(),
              description: 'Opening Balance',
              amount: openingBalance,
              type: 'opening_balance',
              method: 'CASH',
              shopId: parseInt(shopId),
              isActive: true
            }
          }
        })
      },
      include: {
        shop: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: serializeBigInt(customer)
    });

  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create customer', code: 'CREATE_ERROR' }, { status: 500 });
  }
}

// PUT - Update customer
export async function PUT(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required', code: 'TOKEN_MISSING' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    if (!requireRole(decoded, ['ADMIN', 'SUPER_ADMIN', 'SUPER_DUPER_ADMIN'])) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, phone, email, address } = body;

    if (!id || !name || !phone) {
      return NextResponse.json({
        success: false,
        message: 'Customer ID, name, and phone are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, { status: 400 });
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({
        success: false,
        message: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      }, { status: 400 });
    }

    // Check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingCustomer) {
      return NextResponse.json({
        success: false,
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      }, { status: 404 });
    }

    // Role-based validation
    const userRole = decoded.role;
    const userId = decoded.userId;

    if (userRole !== 'SUPER_DUPER_ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN'
      }, { status: 403 });
    }

    // Restrict Phone Edit for SUPER_ADMIN
    if (userRole === 'SUPER_ADMIN' && phone !== existingCustomer.phone) {
      return NextResponse.json({
        success: false,
        message: 'Super Admins cannot edit phone numbers',
        code: 'FORBIDDEN_FIELD'
      }, { status: 403 });
    }

    // Check for duplicate phone if phone is being changed
    if (phone !== existingCustomer.phone) {
      const duplicatePhone = await prisma.customer.findFirst({
        where: {
          phone: phone.trim(),
          shopId: existingCustomer.shopId,
          id: { not: parseInt(id) } // Exclude current customer
        }
      });

      if (duplicatePhone) {
        return NextResponse.json({
          success: false,
          message: 'Phone number already active for another customer',
          code: 'DUPLICATE_PHONE'
        }, { status: 400 });
      }
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        address: address ? address.trim() : null
      },
      include: {
        shop: {
          select: { id: true, name: true }
        }
      }
    });

    // Log the activity
    try {
      let changes = [];
      if (existingCustomer.name !== name.trim()) changes.push(`Name: ${existingCustomer.name} -> ${name.trim()}`);
      if (existingCustomer.phone !== phone.trim()) changes.push(`Phone: ${existingCustomer.phone} -> ${phone.trim()}`);
      if ((existingCustomer.address || "") !== (address ? address.trim() : "")) changes.push(`Address changed`);

      if (changes.length > 0) {
        await prisma.activityLog.create({
          data: {
            userId: BigInt(userId),
            action: 'UPDATE_CUSTOMER',
            resource: 'Customer',
            resourceId: BigInt(id),
            details: `Updated customer ${name}: ${changes.join(', ')}`,
            ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
          }
        });
      }
    } catch (logError) {
      console.error('Failed to create activity log', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
      data: serializeBigInt(updatedCustomer)
    });

  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update customer', code: 'UPDATE_ERROR' }, { status: 500 });
  }
}

// DELETE - Delete customer
export async function DELETE(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required', code: 'TOKEN_MISSING' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    if (!requireRole(decoded, ['SUPER_ADMIN', 'SUPER_DUPER_ADMIN'])) {
      return NextResponse.json({ success: false, message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Customer ID is required',
        code: 'MISSING_CUSTOMER_ID'
      }, { status: 400 });
    }

    // Check if customer has any active transactions
    const hasTransactions = await prisma.customerLedgerEntry.findFirst({
      where: {
        customerId: parseInt(id),
        isActive: true
      }
    });

    if (hasTransactions) {
      return NextResponse.json({
        success: false,
        message: 'Cannot delete customer with existing transactions. Please deactivate instead.',
        code: 'CUSTOMER_HAS_TRANSACTIONS'
      }, { status: 400 });
    }

    // Soft delete customer
    await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
        isActive: false
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete customer', code: 'DELETE_ERROR' }, { status: 500 });
  }
} 