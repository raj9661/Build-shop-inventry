import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { 
  getTmtProduct, 
  convertToKg, 
  updateTmtInventory, 
  validateInventoryAvailability,
  getTmtInventory,
  type TmtUnitType 
} from '@/app/lib/tmtUtils';
import { validateToken } from '@/app/lib/tokenUtils';
import { canAccessShop } from '@/app/lib/shopAccessUtils';


// GET /api/tmt/purchases - Get all TMT purchases for a shop (isolated per SUPER_DUPER_ADMIN)
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

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    
    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    // SUPER_DUPER_ADMIN: Verify the shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      })
      
      if (!shop) {
        return NextResponse.json({ 
          success: true, 
          data: [] 
        })
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }

    const purchases = await prisma.$queryRaw`
      SELECT 
        tp.id,
        tp."invoiceNumber",
        tp."supplierName",
        tp."totalWeightTon",
        tp."dateReceived",
        tp."remarks",
        tp."createdAt",
        COUNT(tpi.id) as "itemCount"
      FROM tmt_purchases tp
      LEFT JOIN tmt_purchase_items tpi ON tp.id = tpi."purchaseId"
      WHERE tp."shopId" = ${parseInt(shopId)}
      AND tp."isActive" = true
      GROUP BY tp.id
      ORDER BY tp."dateReceived" DESC
    ` as any[];

    return NextResponse.json({
      success: true,
      data: purchases.map(p => ({
        id: Number(p.id),
        invoiceNumber: p.invoiceNumber,
        supplierName: p.supplierName,
        totalWeightTon: Number(p.totalWeightTon),
        dateReceived: p.dateReceived,
        remarks: p.remarks,
        createdAt: p.createdAt,
        itemCount: Number(p.itemCount)
      }))
    });

  } catch (error) {
    console.error('Error fetching TMT purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TMT purchases' },
      { status: 500 }
    );
  }
}

// POST /api/tmt/purchases - Create a new TMT purchase (isolated per SUPER_DUPER_ADMIN)
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

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON format.' },
        { status: 400 }
      );
    }
    const { 
      invoiceNumber, 
      supplierName, 
      totalWeightTon, 
      dateReceived, 
      remarks, 
      shopId,
      items 
    } = body;

    // Validate required fields
    if (!invoiceNumber || !supplierName || !totalWeightTon || !dateReceived || !shopId || !items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SUPER_DUPER_ADMIN: Verify the shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      })
      
      if (!shop) {
        return NextResponse.json(
          { error: 'You can only create TMT purchases for shops you created' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }

    // Create purchase transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the purchase using Prisma's native create method
      const purchase = await tx.tmtPurchase.create({
        data: {
          invoiceNumber,
          supplierName,
          totalWeightTon: parseFloat(totalWeightTon),
          dateReceived: new Date(dateReceived),
          remarks: remarks || null,
          shopId: BigInt(parseInt(shopId)),
          isActive: true
        }
      });

      const purchaseId = purchase.id;

      // Create purchase items and update inventory
      for (const item of items) {
        const {
          productId,
          quantity,
          unitType,
          weightPerRodKg,
          rodsPerBundle,
          remarks: itemRemarks
        } = item;

        // Get product details
        const product = await getTmtProduct(productId);
        if (!product) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        // Calculate conversions
        const equivalentKg = convertToKg(quantity, unitType as TmtUnitType, product);
        const weightPerBundleKg = weightPerRodKg * rodsPerBundle;
        const totalBundles = equivalentKg / weightPerBundleKg;
        const totalPieces = equivalentKg / weightPerRodKg;

        // Create purchase item using Prisma's native create method
        await tx.tmtPurchaseItem.create({
          data: {
            purchaseId: purchaseId,
            productId: BigInt(productId),
            quantity: parseFloat(quantity),
            unitType: unitType as TmtUnitType,
            weightPerRodKg: parseFloat(weightPerRodKg),
            rodsPerBundle: parseInt(rodsPerBundle),
            weightPerBundleKg: parseFloat(weightPerBundleKg),
            totalBundles: parseFloat(totalBundles),
            totalPieces: parseFloat(totalPieces),
            equivalentKg: parseFloat(equivalentKg),
            remarks: itemRemarks || null,
            isActive: true
          }
        });

        // Update inventory
        await updateTmtInventory(productId, parseInt(shopId), equivalentKg, 'add');
      }

      return Number(purchaseId);
    });

    return NextResponse.json({
      success: true,
      message: 'TMT purchase created successfully',
      data: { purchaseId: result }
    });

  } catch (error: any) {
    console.error('Error creating TMT purchase:', error);
    const errorMessage = error?.message || 'Failed to create TMT purchase';
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
