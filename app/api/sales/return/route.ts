import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, assertShopAccess } from '@/lib/authContext';
import { calculateRunningBalance } from '@/app/lib/ledgerUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';
import { invalidateShopDashboard } from '@/lib/authContext';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }

    // Role check: Only SUPER_DUPER_ADMIN or SUPER_ADMIN can restock items via returns
    if (ctx.role !== 'SUPER_DUPER_ADMIN' && ctx.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden: Only admin users can restock returned items' }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, shopId, date, creditAmount, notes, items } = body;

    if (!customerId || !shopId || !date || creditAmount === undefined || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Missing required fields: customerId, shopId, date, creditAmount, items' }, { status: 400 });
    }

    // Enforce tenant scoping check
    const forbiddenResponse = assertShopAccess(ctx, shopId);
    if (forbiddenResponse) return forbiddenResponse;

    const parsedCustomerId = BigInt(customerId);
    const parsedShopId = BigInt(shopId);
    const parsedCreditAmount = new Prisma.Decimal(creditAmount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check customer
      const customer = await tx.customer.findUnique({
        where: { id: parsedCustomerId }
      });
      if (!customer || !customer.isActive) {
        throw new Error('Customer not found or inactive');
      }

      // Track returned items description
      const itemDescriptions: string[] = [];

      // 2. Loop through returned items to restock
      for (const item of items) {
        const { productId, quantity, conversionCft, unitName, isTmt } = item;
        if (!productId || !quantity || quantity <= 0) {
          throw new Error('Invalid product return details: productId and positive quantity are required');
        }

        if (isTmt) {
          // ── TMT Bar return: increment TmtInventory.availableQtyKg ──
          const tmtProduct = await tx.tmtProduct.findUnique({
            where: { id: BigInt(productId) }
          });
          if (!tmtProduct || !tmtProduct.isActive) {
            throw new Error(`TMT product not found or inactive: ID ${productId}`);
          }

          const weightPerRod = Number(tmtProduct.weightPerRodKg || 0);
          const rodsPerBundle = Number(tmtProduct.rodsPerBundle || 0);
          const unit = (unitName || 'piece').toLowerCase();
          let kgToRestock = 0;

          if (unit === 'piece') {
            kgToRestock = Number(quantity) * weightPerRod;
          } else if (unit === 'bundle') {
            kgToRestock = Number(quantity) * rodsPerBundle * weightPerRod;
          } else if (unit === 'ton') {
            kgToRestock = Number(quantity) * 1000;
          } else { // kg
            kgToRestock = Number(quantity);
          }

          // Upsert TMT inventory
          const existingInv = await tx.tmtInventory.findUnique({
            where: { productId_shopId: { productId: BigInt(productId), shopId: parsedShopId } }
          });
          if (existingInv) {
            await tx.tmtInventory.update({
              where: { productId_shopId: { productId: BigInt(productId), shopId: parsedShopId } },
              data: { availableQtyKg: { increment: new Prisma.Decimal(kgToRestock) }, lastUpdated: new Date() }
            });
          } else {
            await tx.tmtInventory.create({
              data: {
                productId: BigInt(productId),
                shopId: parsedShopId,
                availableQtyKg: new Prisma.Decimal(kgToRestock),
                reservedQtyKg: 0,
                lastUpdated: new Date(),
                isActive: true
              }
            });
          }

          itemDescriptions.push(`${tmtProduct.productName} (${quantity} ${unit} = ${kgToRestock.toFixed(2)} kg) [TMT]`);

        } else {
          // ── Regular product return ──
          const product = await tx.product.findUnique({
            where: { id: BigInt(productId) },
            include: { category: true }
          });

          if (!product || !product.isActive) {
            throw new Error(`Product not found or inactive: ID ${productId}`);
          }

          const catName = product.category?.name?.toLowerCase()?.trim() || '';
          const isCement = catName.includes('cement');
          const isLoose = unitName?.toLowerCase() === 'kg' || product.unit?.toLowerCase() === 'kg';
          const isTrueBulkCft = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');
          const itemConvFactor = conversionCft ? parseFloat(conversionCft.toString()) : 1;
          const itemTotalCft = Number(quantity) * itemConvFactor;

          let cftQty = Number(quantity);

          if (isCement && isLoose) {
            await tx.product.update({
              where: { id: product.id },
              data: { damagedQuantity: { increment: Number(quantity) } }
            });
          } else if (isCement) {
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: { increment: Number(quantity) } }
            });
          } else if (isTrueBulkCft) {
            cftQty = itemTotalCft;
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: { increment: itemTotalCft } }
            });
          } else {
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: { increment: Number(quantity) } }
            });
          }

          // Log transaction in StockLedger
          await tx.stockLedger.create({
            data: {
              productId: product.id,
              shopId: parsedShopId,
              transactionType: 'ADJUSTMENT',
              unitName: unitName || product.unit,
              unitQuantity: new Prisma.Decimal(quantity),
              cftQuantity: new Prisma.Decimal(cftQty),
              notes: `Customer Return (Customer ID: ${customerId}) - Restocked`
            }
          });

          itemDescriptions.push(`${product.name} (${quantity} ${unitName || product.unit})`);
        }
      }

      // 3. Create CustomerLedgerEntry of type 'item_return'
      const returnedItemsStr = itemDescriptions.join(', ');
      const descNotes = notes ? `. Reason: ${notes}` : '';
      const finalDescription = `Returned: ${returnedItemsStr}${descNotes}`;

      const returnEntry = await tx.customerLedgerEntry.create({
        data: {
          customerId: parsedCustomerId,
          amount: parsedCreditAmount,
          type: 'item_return',
          method: 'CASH', // default payment method
          date: new Date(date),
          description: finalDescription,
          shopId: parsedShopId,
          isActive: true
        }
      });

      // Recalculate customer running balance (this function updates Customer.currentBalance as well)
      await calculateRunningBalance(tx, Number(parsedCustomerId) as any, [returnEntry as any]);

      return returnEntry;
    });

    // Invalidate Redis dashboard cache safely (non-blocking)
    invalidateShopDashboard(parsedShopId).catch((err) => {
      console.error('Redis dashboard invalidation failed:', err);
    });

    return NextResponse.json(serializeBigInt({
      success: true,
      message: 'Items returned and restocked successfully',
      data: result
    }), { status: 200 });

  } catch (error) {
    console.error('Customer item return error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process item return'
    }, { status: 500 });
  }
}
