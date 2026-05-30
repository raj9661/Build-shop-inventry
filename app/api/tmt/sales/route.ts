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
import { createPurchaseEntry, createPaymentEntry } from '@/app/lib/ledgerUtils';




// GET /api/tmt/sales - Get all TMT sales for a shop (isolated per SUPER_DUPER_ADMIN)
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

    const sales = await prisma.tmtSale.findMany({
      where: {
        shopId: BigInt(shopId),
        isActive: true
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                company: true,
                size: true
              }
            }
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: sales.map(s => {
        // Find the first item to fall back for legacy fields if frontend expects flat structure
        const firstItem = s.items?.[0] || null;

        return {
          id: Number(s.id),
          // Provide flat fields from the first item to avoid breaking older UI, 
          // but also provide the items array for the updated UI
          productId: firstItem ? Number(firstItem.productId) : null,
          productName: firstItem?.product?.productName || null,
          companyName: firstItem?.product?.company?.name || null,
          sizeMm: firstItem?.product?.size?.sizeMm ? Number(firstItem.product.size.sizeMm) : null,
          soldQuantity: firstItem ? Number(firstItem.quantity) : 0,
          unitType: firstItem?.unitType || '',
          equivalentKg: 0,
          pricePerUnit: firstItem ? Number(firstItem.unitPrice) : 0,

          totalAmount: Number(s.totalAmount),
          saleDate: s.saleDate,
          customerName: s.customerName,
          createdAt: s.createdAt,
          items: s.items.map(item => ({
            id: Number(item.id),
            productId: Number(item.productId),
            productName: item.product?.productName || null,
            companyName: item.product?.company?.name || null,
            sizeMm: item.product?.size?.sizeMm ? Number(item.product.size.sizeMm) : null,
            quantity: Number(item.quantity),
            unitType: item.unitType,
            equivalentKg: 0,
            pricePerUnit: Number(item.unitPrice),
            totalAmount: Number(item.totalPrice)
          }))
        };
      })
    });

  } catch (error) {
    console.error('Error fetching TMT sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TMT sales' },
      { status: 500 }
    );
  }
}

// POST /api/tmt/sales - Create a new TMT sale (isolated per SUPER_DUPER_ADMIN)
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
    const {
      shopId,
      saleDate,
      customerName,
      customerId,
      notes,
      paymentMethod: bodyPaymentMethod,
      paidAmount: bodyPaidAmount,
      partialPaymentMethod: bodyPartialPaymentMethod
    } = body;

    // Normalize items: Support both single item (legacy) and multi-item (new) payloads
    let items: any[] = [];
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      items = body.items;
    } else if (body.productId) {
      // Legacy single item format
      items = [{
        productId: body.productId,
        soldQuantity: body.soldQuantity,
        unitType: body.unitType,
        pricePerUnit: body.pricePerUnit
      }];
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    if (!shopId || !saleDate) {
      return NextResponse.json(
        { error: 'Missing required fields: shopId, saleDate' },
        { status: 400 }
      );
    }


    // Auto-link or Create customer for Walk-in (Fix for missing ledger/address)
    let finalCustomerId = customerId;

    if (!finalCustomerId) {
      // 1. Try finding by Phone first (Most accurate)
      if (body.customerPhone) {
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            phone: body.customerPhone,
            shopId: BigInt(parseInt(shopId)),
            isActive: true
          }
        });
        if (existingCustomer) {
          console.log(`🔍 [TMT Sale] Found customer by phone: ${existingCustomer.name} (${existingCustomer.id})`);
          finalCustomerId = existingCustomer.id.toString();
        } else {
          // Create new customer with phone & address
          console.log(`🆕 [TMT Sale] Creating new customer for phone: ${body.customerPhone}`);
          const newCustomer = await prisma.customer.create({
            data: {
              name: customerName || `Customer ${body.customerPhone}`,
              phone: body.customerPhone,
              address: body.customerAddress || '',
              shopId: BigInt(parseInt(shopId)),
              isActive: true,
              customerType: 'REGULAR'
            }
          });
          finalCustomerId = newCustomer.id.toString();
        }
      }
      // 2. Fallback: Try finding by Name (Legacy/No-phone)
      else if (customerName) {
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            name: { equals: customerName, mode: 'insensitive' },
            shopId: BigInt(parseInt(shopId)),
            isActive: true
          }
        });
        if (existingCustomer) {
          console.log(`🔍 [TMT Sale] Found customer by name: ${existingCustomer.name} (${existingCustomer.id})`);
          finalCustomerId = existingCustomer.id.toString();
        }
      }
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
          { error: 'You can only create TMT sales for shops you created' },
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

    // Process all items: validate, calculate totals, and prepare for DB
    const processedItems: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const { productId, soldQuantity, unitType, pricePerUnit } = item;

      if (!productId || !soldQuantity || !unitType || pricePerUnit === undefined) {
        return NextResponse.json(
          { error: 'Missing required item fields' },
          { status: 400 }
        );
      }

      // Get product details
      const product = await getTmtProduct(productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${productId}` },
          { status: 404 }
        );
      }

      // Calculate conversions
      const normalizedUnitType = (unitType?.toLowerCase() || 'kg') as TmtUnitType;
      const equivalentKg = convertToKg(soldQuantity, normalizedUnitType, product);

      const itemTotal = soldQuantity * pricePerUnit;
      totalAmount += itemTotal;

      // Validate inventory availability
      const inventoryCheck = await validateInventoryAvailability(
        productId,
        parseInt(shopId),
        equivalentKg
      );

      if (!inventoryCheck.available) {
        return NextResponse.json(
          {
            error: `Insufficient inventory for product ${product.productName || productId}`,
            available: inventoryCheck.availableKg,
            required: equivalentKg
          },
          { status: 400 }
        );
      }

      processedItems.push({
        productId,
        soldQuantity,
        unitType: normalizedUnitType,
        pricePerUnit,
        totalPrice: itemTotal,
        equivalentKg,
        product // Store full product for later use
      });
    }

    // Handle payment
    const frontendPaymentMethod = (bodyPaymentMethod || 'CASH').toUpperCase();
    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'PENDING' = 'PAID';
    let paidAmount = totalAmount;
    let dueAmount = 0;
    let actualPaymentMethod = frontendPaymentMethod;

    if (frontendPaymentMethod === 'PARTIAL') {
      paymentStatus = 'PARTIAL';
      const partialAmount = bodyPaidAmount || body.partialAmount || body.amountPaid;
      const partialMethod = bodyPartialPaymentMethod || body.actualPaymentMethod || body.paymentMethodUsed;

      if (!partialAmount || partialAmount === '' || partialAmount === null) {
        return NextResponse.json(
          { error: 'Partial payment requires paidAmount field' },
          { status: 400 }
        );
      }
      paidAmount = parseFloat(partialAmount);
      if (isNaN(paidAmount)) paidAmount = 0;

      dueAmount = totalAmount - paidAmount;
      actualPaymentMethod = partialMethod ? partialMethod.toUpperCase() : 'CASH';

    } else if (frontendPaymentMethod === 'LOAN' || frontendPaymentMethod === 'CREDIT') {
      paymentStatus = 'UNPAID';
      paidAmount = 0;
      dueAmount = totalAmount;
      actualPaymentMethod = 'OTHER';
    } else {
      paymentStatus = 'PAID';
      paidAmount = totalAmount;
      dueAmount = 0;
      actualPaymentMethod = frontendPaymentMethod;
    }

    // Validate payment method enum
    const validPaymentMethods = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER', 'STRIPE', 'RAZORPAY', 'PAYPAL'];
    if (actualPaymentMethod === 'ONLINE') actualPaymentMethod = 'CARD';
    if (!validPaymentMethods.includes(actualPaymentMethod)) actualPaymentMethod = 'CASH';

    const result = await prisma.$transaction(async (tx) => {
      // Create the sale header
      const sale = await tx.tmtSale.create({
        data: {
          customerName: customerName || null,
          customerId: finalCustomerId ? BigInt(finalCustomerId) : null,
          totalAmount: totalAmount,
          paidAmount: paidAmount,
          dueAmount: dueAmount,
          paymentStatus: paymentStatus,
          status: 'PENDING',
          paymentMethod: actualPaymentMethod as any,
          saleDate: new Date(saleDate),
          notes: notes || null,
          shopId: BigInt(parseInt(shopId)),
          isActive: true,
          items: {
            create: processedItems.map(item => ({
              productId: BigInt(item.productId),
              quantity: item.soldQuantity,
              unitType: item.unitType.toUpperCase(),
              unitPrice: item.pricePerUnit,
              totalPrice: item.totalPrice,
              weightPerRodKg: item.product.weightPerRodKg,
              rodsPerBundle: item.product.rodsPerBundle,
              weightPerBundleKg: item.product.weightPerBundleKg,
              isActive: true
            }))
          }
        },
        include: {
          items: true
        }
      });

      // LEDGER ENTRIES
      if (finalCustomerId) {
        console.log(`Creating ledger entries for TMT Sale #${sale.id}`);
        // Purchase Entry
        // Always create a debit ledger entry for the full bill, and store paid/due in the sale record only (matching regular sales)
        await createPurchaseEntry(tx, {
          customerId: BigInt(finalCustomerId),
          amount: totalAmount,
          date: new Date(saleDate),
          description: `TMT Sale #${sale.id}`,
          saleId: sale.id,
          shopId: BigInt(parseInt(shopId))
        });

        // Payment Entry
        if (paidAmount > 0) {
          await createPaymentEntry(tx, {
            customerId: BigInt(finalCustomerId),
            amount: -paidAmount,
            date: new Date(saleDate),
            description: `Payment for TMT Sale #${sale.id}`,
            saleId: sale.id,
            shopId: BigInt(parseInt(shopId))
          });
        }
      }

      return sale.id;
    });

    // Update inventory for all items
    console.log(`Updating inventory for ${processedItems.length} items`);
    for (const item of processedItems) {
      await updateTmtInventory(item.productId, parseInt(shopId), item.equivalentKg, 'subtract');
    }

    return NextResponse.json({
      success: true,
      message: 'TMT sale created successfully',
      data: {
        saleId: Number(result),
        totalAmount,
        paymentStatus,
        paidAmount,
        dueAmount
      }
    });

  } catch (error) {
    console.error('Error creating TMT sale:', error);
    return NextResponse.json(
      { error: 'Failed to create TMT sale' },
      { status: 500 }
    );
  }
}
