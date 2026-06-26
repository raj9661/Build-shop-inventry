import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { canAccessShop } from '@/app/lib/shopAccessUtils';

/**
 * POST /api/tmt/inventory/restock
 *
 * Recalculates the TMT inventory for a shop (or a specific product) by
 * replaying all purchase items and sale items stored in the database.
 *
 * Uses STORED values from purchase records (totalPieces, totalBundles, equivalentKg)
 * so even old purchases entered in bundles are handled correctly.
 *
 * Body: { shopId: string, productId?: string }
 */
export async function POST(request: NextRequest) {
  try {
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
    const { shopId, productId } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    // Verify shop access
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true,
        },
      });
      if (!shop) {
        return NextResponse.json({ error: 'Shop not found or access denied' }, { status: 403 });
      }
    } else {
      const hasAccess = await canAccessShop(token, parseInt(shopId));
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    }

    const shopIdBig = BigInt(parseInt(shopId));

    // Fetch all active inventory records for this shop (optionally filtered by product)
    const inventoryWhere: any = { shopId: shopIdBig, isActive: true };
    if (productId) inventoryWhere.productId = BigInt(parseInt(productId));

    const inventoryRecords = await prisma.tmtInventory.findMany({
      where: inventoryWhere,
      include: {
        product: {
          select: {
            weightPerRodKg: true,
            rodsPerBundle: true,
            weightPerBundleKg: true,
          },
        },
      },
    });

    const results: any[] = [];

    for (const inv of inventoryRecords) {
      const prodId = inv.productId;
      const weightPerRod    = Number(inv.product?.weightPerRodKg    || 0);
      const rodsPerBundle   = Number(inv.product?.rodsPerBundle      || 0);
      const weightPerBundle = Number(inv.product?.weightPerBundleKg  || 0) || (weightPerRod * rodsPerBundle);

      // ── PURCHASES ──────────────────────────────────────────────────────────
      // TmtPurchaseItem already stores totalPieces, totalBundles, equivalentKg
      // so we use those directly — no need to re-derive from unitType.
      const purchaseItems = await prisma.tmtPurchaseItem.findMany({
        where: {
          productId: prodId,
          isActive: true,
          purchase: { shopId: shopIdBig, isActive: true },
        },
      });

      let totalPurchasedKg      = 0;
      let totalPurchasedPieces  = 0;
      let totalPurchasedBundles = 0;

      for (const pi of purchaseItems) {
        // Use stored exact values — these were calculated at time of purchase entry
        totalPurchasedKg      += Number(pi.equivalentKg);
        totalPurchasedPieces  += Number(pi.totalPieces);
        totalPurchasedBundles += Number(pi.totalBundles);
      }

      // ── SALES ──────────────────────────────────────────────────────────────
      // TmtSaleItem stores: quantity, unitType, weightPerRodKg, rodsPerBundle
      // No equivalentKg stored — we calculate from the snapshot values on the item.
      const saleItems = await prisma.tmtSaleItem.findMany({
        where: {
          productId: prodId,
          isActive: true,
          sale: { shopId: shopIdBig, isActive: true },
        },
      });

      let totalSoldKg      = 0;
      let totalSoldPieces  = 0;
      let totalSoldBundles = 0;

      for (const si of saleItems) {
        const qty  = Number(si.quantity);
        const unit = (si.unitType || 'KG').toUpperCase();
        // Use snapshot weight from the sale item itself (most accurate)
        const wpr  = Number(si.weightPerRodKg  || weightPerRod);
        const rpb  = Number(si.rodsPerBundle   || rodsPerBundle);

        switch (unit) {
          case 'PIECE':
            totalSoldPieces  += qty;
            totalSoldBundles += rpb > 0 ? qty / rpb : 0;
            totalSoldKg      += qty * wpr;
            break;
          case 'BUNDLE':
            totalSoldBundles += qty;
            totalSoldPieces  += qty * rpb;
            totalSoldKg      += qty * rpb * wpr;
            break;
          case 'TON':
            totalSoldKg      += qty * 1000;
            totalSoldPieces  += wpr > 0 ? (qty * 1000) / wpr : 0;
            totalSoldBundles += weightPerBundle > 0 ? (qty * 1000) / weightPerBundle : 0;
            break;
          default: // KG
            totalSoldKg      += qty;
            totalSoldPieces  += wpr > 0 ? qty / wpr : 0;
            totalSoldBundles += weightPerBundle > 0 ? qty / weightPerBundle : 0;
            break;
        }
      }

      // ── COMPUTE CORRECTED AVAILABLE VALUES ─────────────────────────────────
      const newAvailableKg      = Math.max(0, Math.round((totalPurchasedKg      - totalSoldKg)      * 1000) / 1000);
      const newAvailablePieces  = Math.max(0, Math.round((totalPurchasedPieces  - totalSoldPieces)  * 1000) / 1000);
      const newAvailableBundles = Math.max(0, Math.round((totalPurchasedBundles - totalSoldBundles) * 1000) / 1000);

      // ── UPDATE DB ──────────────────────────────────────────────────────────
      await prisma.tmtInventory.update({
        where: {
          productId_shopId: { productId: prodId, shopId: shopIdBig },
        },
        data: {
          availableQtyKg:    newAvailableKg,
          availablePieces:   newAvailablePieces,
          availableBundles:  newAvailableBundles,
          lastUpdated:       new Date(),
        },
      });

      results.push({
        productId: Number(prodId),
        before: {
          availableQtyKg:    Number(inv.availableQtyKg),
          availablePieces:   inv.availablePieces  != null ? Number(inv.availablePieces)  : null,
          availableBundles:  inv.availableBundles != null ? Number(inv.availableBundles) : null,
        },
        after: {
          availableQtyKg:    newAvailableKg,
          availablePieces:   newAvailablePieces,
          availableBundles:  newAvailableBundles,
        },
        summary: {
          purchases: {
            totalKg:      Math.round(totalPurchasedKg      * 1000) / 1000,
            totalPieces:  Math.round(totalPurchasedPieces  * 1000) / 1000,
            totalBundles: Math.round(totalPurchasedBundles * 1000) / 1000,
            itemCount:    purchaseItems.length,
          },
          sales: {
            totalKg:      Math.round(totalSoldKg      * 1000) / 1000,
            totalPieces:  Math.round(totalSoldPieces  * 1000) / 1000,
            totalBundles: Math.round(totalSoldBundles * 1000) / 1000,
            itemCount:    saleItems.length,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Restocked ${results.length} inventory record(s) successfully`,
      data: results,
    });

  } catch (error: any) {
    console.error('[TMT Restock] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to restock TMT inventory' },
      { status: 500 }
    );
  }
}
