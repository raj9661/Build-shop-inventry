import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { canAccessShop } from '@/app/lib/shopAccessUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import {
  getTmtProduct,
  convertToKg,
  updateTmtInventory,
  type TmtUnitType
} from '@/app/lib/tmtUtils';

const prisma = new PrismaClient();

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
      });

      if (!shop) {
        return NextResponse.json({
          success: true,
          data: { inventory: [], summary: { totalProducts: 0, totalTons: 0 } }
        });
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        );
      }
    }

    // Get inventory data for this shop
    const inventory = await prisma.tmtInventory.findMany({
      where: {
        shopId: BigInt(parseInt(shopId)),
        isActive: true
      },
      include: {
        product: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            },
            size: {
              select: {
                id: true,
                sizeMm: true
              }
            }
          }
        }
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    // Fetch suppliers separately for items that have supplierId
    const supplierIds = inventory
      .map(item => (item as any).supplierId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    const suppliers = supplierIds.length > 0
      ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true }
      })
      : [];

    const supplierMap = new Map(suppliers.map(s => [s.id.toString(), s.name]));

    // Process data
    const processedData = inventory.map((item: any) => {
      const availableQtyKg = Number(item.availableQtyKg);
      const weightPerRodKg = Number(item.product?.weightPerRodKg || 0);
      const weightPerBundleKg = Number(item.product?.weightPerBundleKg || 0);
      const rodsPerBundle = Number(item.product?.rodsPerBundle || 0);
      const supplierId = item.supplierId ? Number(item.supplierId) : null;
      const supplierName = supplierId ? supplierMap.get(supplierId.toString()) || null : null;

      // Calculate bundles from weight
      const availableBundles = weightPerBundleKg > 0 ? Math.floor(availableQtyKg / weightPerBundleKg) : 0;

      // Calculate pieces from weight (more accurate than bundle-based calculation)
      // This handles cases where weightPerBundleKg ≠ rodsPerBundle × weightPerRodKg
      const availablePieces = weightPerRodKg > 0 ? Math.floor(availableQtyKg / weightPerRodKg) : 0;

      return {
        id: Number(item.id),
        productId: Number(item.productId),
        productName: item.product?.productName || '',
        companyName: item.product?.company?.name || '',
        sizeMM: Number(item.product?.size?.sizeMm || 0),
        availableQtyKg,
        availableTons: availableQtyKg / 1000,
        availableBundles,
        availablePieces,
        supplierId,
        supplierName,
        sellingPricePerKg: item.sellingPricePerKg ? Number(item.sellingPricePerKg) : null,
        costPricePerKg: item.costPricePerKg ? Number(item.costPricePerKg) : null,
        sellingPricePerPiece: item.sellingPricePerPiece ? Number(item.sellingPricePerPiece) : null,
        costPricePerPiece: item.costPricePerPiece ? Number(item.costPricePerPiece) : null,
        minStockKg: item.minStockKg ? Number(item.minStockKg) : null,
        maxStockKg: item.maxStockKg ? Number(item.maxStockKg) : null,
        totalAmount: item.totalAmount ? Number(item.totalAmount) : null,
        totalAmountFromKg: item.totalAmountFromKg ? Number(item.totalAmountFromKg) : null,
        totalAmountFromPieces: item.totalAmountFromPieces ? Number(item.totalAmountFromPieces) : null,
        lastUpdated: item.lastUpdated,
      };
    });

    const response = {
      success: true,
      data: {
        inventory: processedData,
        summary: {
          totalProducts: processedData.length,
          totalTons: processedData.reduce((sum, item) => sum + item.availableTons, 0),
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('TMT Inventory API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/tmt/inventory - Add stock to TMT inventory
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
      productId,
      quantity,
      unitType,
      shopId,
      pricePerUnit, // Price per piece
      sellingPrice, // Selling price per piece
      pricePerKg, // Price per kg
      sellingPricePerKg, // Selling price per kg
      rodsPerBundle,
      weightPerRod,
      minStock,
      maxStock,
      sku,
      remarks,
      invoiceNumber,
      supplierId,
      purchaseDate
    } = body;

    // Validate required fields
    if (!productId || quantity === undefined || !unitType || !shopId) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, quantity, unitType, shopId' },
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
      });

      if (!shop) {
        return NextResponse.json(
          { error: 'You can only add stock to shops you created' },
          { status: 403 }
        );
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId));
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        );
      }
    }

    // Get product details
    const product = await getTmtProduct(parseInt(productId));
    if (!product) {
      return NextResponse.json(
        { error: `Product with ID ${productId} not found` },
        { status: 404 }
      );
    }

    // Convert quantity to kg
    const equivalentKg = convertToKg(parseFloat(quantity), unitType as TmtUnitType, product);
    const weightPerRodValue = parseFloat(weightPerRod) || Number(product.weightPerRodKg);

    // Calculate prices: Use provided values directly, calculate only if one is missing
    let finalCostPricePerKg = null;
    let finalSellingPricePerKg = null;
    let finalCostPricePerPiece = null;
    let finalSellingPricePerPiece = null;

    // Cost Price: Use both if provided, otherwise calculate missing one
    if (pricePerKg && pricePerUnit) {
      // Both provided - use both as-is
      finalCostPricePerKg = parseFloat(pricePerKg);
      finalCostPricePerPiece = parseFloat(pricePerUnit);
    } else if (pricePerKg && weightPerRodValue > 0) {
      // Only per kg provided - calculate per piece
      finalCostPricePerKg = parseFloat(pricePerKg);
      finalCostPricePerPiece = finalCostPricePerKg * weightPerRodValue;
    } else if (pricePerUnit && weightPerRodValue > 0) {
      // Only per piece provided - calculate per kg
      finalCostPricePerPiece = parseFloat(pricePerUnit);
      finalCostPricePerKg = finalCostPricePerPiece / weightPerRodValue;
    }

    // Selling Price: Use both if provided, otherwise calculate missing one
    if (sellingPricePerKg && sellingPrice) {
      // Both provided - use both as-is
      finalSellingPricePerKg = parseFloat(sellingPricePerKg);
      finalSellingPricePerPiece = parseFloat(sellingPrice);
    } else if (sellingPricePerKg && weightPerRodValue > 0) {
      // Only per kg provided - calculate per piece
      finalSellingPricePerKg = parseFloat(sellingPricePerKg);
      finalSellingPricePerPiece = finalSellingPricePerKg * weightPerRodValue;
    } else if (sellingPrice && weightPerRodValue > 0) {
      // Only per piece provided - calculate per kg
      finalSellingPricePerPiece = parseFloat(sellingPrice);
      finalSellingPricePerKg = finalSellingPricePerPiece / weightPerRodValue;
    }

    // Calculate total amounts - store both calculations
    let calculatedTotalAmountFromKg = null;
    let calculatedTotalAmountFromPieces = null;
    let calculatedTotalAmount = null;

    // Calculate actual total pieces based on the unit type entered
    let totalPieces = 0;
    const quantityValue = parseFloat(quantity);
    const rodsPerBundleValue = parseInt(rodsPerBundle) || Number(product.rodsPerBundle);

    // Normalize unitType to uppercase to match enum
    const normalizedUnitType = (unitType || 'KG').toUpperCase();

    if (normalizedUnitType === 'BUNDLE') {
      // If entered as bundles: bundles × rods per bundle
      totalPieces = quantityValue * rodsPerBundleValue;
    } else if (normalizedUnitType === 'PIECE') {
      // If entered as pieces: use quantity directly
      totalPieces = quantityValue;
    } else {
      // If entered as kg or ton: calculate from kg
      totalPieces = weightPerRodValue > 0 ? equivalentKg / weightPerRodValue : 0;
    }

    // Calculate from kg: Cost Price per Kg × Quantity in Kg
    if (finalCostPricePerKg !== null && finalCostPricePerKg !== undefined) {
      calculatedTotalAmountFromKg = finalCostPricePerKg * equivalentKg;
      console.log(`Calculated totalAmountFromKg: ${finalCostPricePerKg} × ${equivalentKg} = ${calculatedTotalAmountFromKg}`);
    }

    // Calculate from pieces: Cost Price per Piece × Number of Pieces (actual count from entered quantity)
    if (finalCostPricePerPiece !== null && finalCostPricePerPiece !== undefined && totalPieces > 0) {
      calculatedTotalAmountFromPieces = finalCostPricePerPiece * totalPieces;
      console.log(`Calculated totalAmountFromPieces: ${finalCostPricePerPiece} × ${totalPieces} = ${calculatedTotalAmountFromPieces} (from ${quantityValue} ${unitType} × ${rodsPerBundleValue} rods/bundle)`);
    }

    // Use totalAmountFromPieces as primary, fallback to totalAmountFromKg
    calculatedTotalAmount = calculatedTotalAmountFromPieces || calculatedTotalAmountFromKg;
    console.log(`Final totalAmount: ${calculatedTotalAmount}, fromKg: ${calculatedTotalAmountFromKg}, fromPieces: ${calculatedTotalAmountFromPieces}`);

    // Update inventory with additional data
    const inventoryUpdated = await updateTmtInventory(
      parseInt(productId),
      parseInt(shopId),
      equivalentKg,
      'add',
      {
        supplierId: supplierId ? parseInt(supplierId) : null,
        sellingPricePerKg: finalSellingPricePerKg,
        costPricePerKg: finalCostPricePerKg,
        costPricePerPiece: finalCostPricePerPiece,
        sellingPricePerPiece: finalSellingPricePerPiece,
        minStockKg: minStock ? parseFloat(minStock) : null,
        maxStockKg: maxStock ? parseFloat(maxStock) : null,
        totalAmount: calculatedTotalAmount,
        totalAmountFromKg: calculatedTotalAmountFromKg,
        totalAmountFromPieces: calculatedTotalAmountFromPieces
      }
    );

    if (!inventoryUpdated) {
      return NextResponse.json(
        { error: 'Failed to update inventory' },
        { status: 500 }
      );
    }

    // If invoice details are provided, optionally create a purchase record
    // This is optional - the inventory update is the main operation
    if (invoiceNumber && supplierId) {
      try {
        // Get supplier name if available
        const supplier = await prisma.supplier.findFirst({
          where: { id: BigInt(parseInt(supplierId)) },
          select: { name: true }
        });

        const supplierName = supplier?.name || 'Unknown Supplier';
        const totalWeightTon = equivalentKg / 1000; // Convert kg to tons

        // Create purchase record
        await prisma.tmtPurchase.create({
          data: {
            invoiceNumber: invoiceNumber.toString(),
            supplierName,
            totalWeightTon,
            dateReceived: purchaseDate ? new Date(purchaseDate) : new Date(),
            remarks: remarks || null,
            shopId: BigInt(parseInt(shopId)),
            isActive: true,
            items: {
              create: {
                productId: BigInt(parseInt(productId)),
                quantity: parseFloat(quantity),
                unitType: (unitType.toUpperCase() as 'KG' | 'TON' | 'PIECE' | 'BUNDLE') as any,
                weightPerRodKg: weightPerRod ? parseFloat(weightPerRod) : product.weightPerRodKg,
                rodsPerBundle: rodsPerBundle ? parseInt(rodsPerBundle) : product.rodsPerBundle,
                weightPerBundleKg: weightPerRod && rodsPerBundle
                  ? parseFloat(weightPerRod) * parseInt(rodsPerBundle)
                  : product.weightPerBundleKg,
                totalBundles: equivalentKg / (product.weightPerBundleKg || 1),
                totalPieces: equivalentKg / (product.weightPerRodKg || 1),
                equivalentKg,
                remarks: remarks || null,
                isActive: true
              }
            }
          }
        });
      } catch (purchaseError) {
        // Log error but don't fail the request since inventory was updated
        console.error('Error creating purchase record:', purchaseError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'TMT stock added to inventory successfully',
      data: {
        productId: parseInt(productId),
        quantityAddedKg: equivalentKg,
        unitType
      }
    });

  } catch (error: any) {
    console.error('Error adding TMT stock:', error);
    const errorMessage = error?.message || 'Failed to add TMT stock';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}