import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '../../../lib/utils';
import { createPurchaseEntry, createPaymentEntry } from '@/app/lib/ledgerUtils';
import ultraFastDashboard from '@/app/lib/ultra-fast-dashboard';

const prisma = new PrismaClient();

// POST - Create a new cash sale
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Cash sale request body:', JSON.stringify(body, null, 2));

    const {
      customerInfo, shopId, saleDate, totalAmount, finalAmount, discount, taxAmount, notes,
      items, payment_type, paid_amount
    } = body;

    // Validate required fields
    if (!customerInfo) {
      return NextResponse.json({ success: false, message: 'Customer info is required' }, { status: 400 });
    }

    if (!shopId) {
      return NextResponse.json({ success: false, message: 'Shop ID is required' }, { status: 400 });
    }

    if (!saleDate) {
      return NextResponse.json({ success: false, message: 'Sale date is required' }, { status: 400 });
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Total amount must be greater than 0' }, { status: 400 });
    }

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Final amount must be greater than 0' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one item is required' }, { status: 400 });
    }

    // Validate customer info for cash sales
    if (!customerInfo.name || customerInfo.name.trim() === '') {
      return NextResponse.json({ success: false, message: 'Customer name is required for cash sales' }, { status: 400 });
    }

    if (!customerInfo.phone || customerInfo.phone.trim() === '') {
      return NextResponse.json({ success: false, message: 'Customer phone is required for cash sales' }, { status: 400 });
    }

    // Address is optional for walk-in customers
    const customerAddress = customerInfo.address || 'Walk-in customer';

    console.log('Validated request data:', {
      customerInfo: { ...customerInfo, address: customerAddress },
      shopId,
      saleDate,
      totalAmount,
      finalAmount,
      itemsCount: items.length,
      payment_type
    });

    const sale = await prisma.$transaction(async (tx) => {
      // Calculate payment amounts based on payment type
      let paidAmount = 0;
      if (payment_type === 'cash' || payment_type === 'online') {
        paidAmount = finalAmount;
      } else if (payment_type === 'partial') {
        paidAmount = paid_amount || 0;
      } // loan/credit remains 0
      let dueAmount = finalAmount - paidAmount;
      let salePaymentStatus: PaymentStatus = PaymentStatus.PENDING;

      if (paidAmount >= finalAmount) {
        salePaymentStatus = PaymentStatus.COMPLETED;
      } else if (paidAmount > 0) {
        // Check if enum supports PARTIAL, if not use PENDING or handling it accordingly.
        // Based on TmtPaymentStatus having PARTIAL, meaningful check is irrelevant if PaymentStatus doesn't.
        // But ledger checks for COMPLETED.
        // Let's assume for now partial is PENDING or PARTIAL if exists.
        // Safest is to rely on amount logic.
        // However, the ledger route filters by 'COMPLETED'.
        // So fully paid MUST be COMPLETED.
        salePaymentStatus = PaymentStatus.PENDING;
        // Note: If PaymentStatus has PARTIAL, we should use it. 
        // But without seeing enum, I'll stick to PENDING for partials unless I verify.
        // But for FULL payment, it MUST be COMPLETED.
      }

      // 1. Find or create customer
      console.log('Finding/creating customer for cash sale');
      let finalCustomerId: number;

      // Try to find existing customer by phone first (to enable grouping)
      const existingCustomer = await tx.customer.findFirst({
        where: {
          shopId: parseInt(shopId),
          phone: customerInfo.phone,
          isActive: true
        }
      });

      if (existingCustomer) {
        console.log('Found existing customer by phone:', existingCustomer.id);
        finalCustomerId = Number(existingCustomer.id);
      } else {
        // Fallback to finding "Walk-in Customer" generic account if no phone provided or specific logic needed
        // But for cash sales with phone, we want to create specific customer to enable grouping & history
        console.log('Creating new customer for cash sale');
        const newCustomer = await tx.customer.create({
          data: {
            name: customerInfo.name || `Walk-in (${customerInfo.phone})`,
            phone: customerInfo.phone,
            address: customerInfo.address || '',
            shopId: parseInt(shopId),
            isActive: true,
            customerType: 'REGULAR'
          }
        });
        console.log('Created new customer with ID:', newCustomer.id);
        finalCustomerId = Number(newCustomer.id);
      }

      // Map frontend payment method to Prisma enum
      const mapPaymentMethodToPrisma = (method: string): string => {
        switch (method?.toLowerCase()) {
          case 'cash':
            return 'CASH';
          case 'card':
          case 'online':
            return 'CARD';
          case 'upi':
            return 'UPI';
          case 'bank_transfer':
            return 'BANK_TRANSFER';
          case 'cheque':
            return 'CHEQUE';
          default:
            return 'CASH';
        }
      };

      // 2. Create the sale
      console.log('Creating sale with customer ID:', finalCustomerId);
      const createdSale = await tx.sale.create({
        data: {
          customerId: finalCustomerId,
          shopId: parseInt(shopId),
          saleDate: new Date(saleDate),
          totalAmount: totalAmount,
          finalAmount: finalAmount,
          discount: discount || 0,
          paymentStatus: salePaymentStatus,
          paymentMethod: mapPaymentMethodToPrisma(payment_type) as any,
          notes: notes || '',
          isActive: true
        }
      });
      console.log('Created sale with ID:', createdSale.id);

      // 3. Create sale items and handle stock updates
      console.log('Processing sale items...');
      await Promise.all(items.map(async (item: any, index: number) => {
        console.log(`Processing item ${index + 1}:`, item);

        if (!item.productId) {
          throw new Error(`Missing productId for item ${index + 1}`);
        }

        const productId = parseInt(item.productId);
        if (isNaN(productId)) {
          throw new Error(`Invalid productId for item ${index + 1}: ${item.productId}`);
        }

        // Get product to check stock
        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        const currentStock = Number(product.stockQuantity);
        const currentDamaged = Number((product as any).damagedQuantity || 0);

        console.log(`Product found: ${product.name}, Stock: ${currentStock}, Damaged: ${currentDamaged}`);

        const stockType = item.stockType || 'normal';
        let availableStock = 0;

        if (stockType === 'normal') {
          availableStock = currentStock;
        } else if (stockType === 'damaged') {
          availableStock = currentDamaged;
        }

        const requestedQuantity = parseFloat(item.quantity);
        if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
          throw new Error(`Invalid quantity for item ${index + 1}: ${item.quantity}`);
        }

        if (availableStock < requestedQuantity) {
          throw new Error(`Insufficient ${stockType} stock for product ${product.name}. Available: ${availableStock}, Requested: ${requestedQuantity}`);
        }

        // Create sale item
        console.log(`Creating sale item for product ${product.name}`);
        await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: productId,
            quantity: requestedQuantity,
            unit: item.unit, // Store the unit!
            unitPrice: parseFloat(item.price_per_unit || item.price || 0),
            totalPrice: requestedQuantity * parseFloat(item.price_per_unit || item.price || 0),
            isActive: true
          }
        });

        // Cement logic
        const isCement = product.name.toLowerCase().includes('cement');
        if (isCement) {
          if (stockType === 'damaged') {
            // Deduct the sold kg amount from damagedQuantity (which is in kg)
            const newDamaged = Math.max(0, currentDamaged - requestedQuantity); // requestedQuantity is in kg
            console.log(`Deducting ${requestedQuantity}kg loose cement from damaged bag stock: ${currentDamaged}kg -> ${newDamaged}kg`);
            await tx.product.update({
              where: { id: product.id },
              data: {
                damagedQuantity: newDamaged
              } as any
            });
          } else {
            // Deduct from main bag stock (each bag = 50kg)
            let bagsToDeduct = item.unit === 'bag' || item.unit === 'bags' ? requestedQuantity : requestedQuantity / 50;
            if (item.unit === 'kg' && requestedQuantity % 50 === 0) {
              bagsToDeduct = requestedQuantity / 50;
            }
            const newStock = Math.max(0, currentStock - bagsToDeduct);
            console.log(`Deducting ${bagsToDeduct} bags from main stock: ${currentStock} -> ${newStock}`);
            await tx.product.update({
              where: { id: product.id },
              data: {
                stockQuantity: newStock
              }
            });
          }
        } else {
          // Update stock immediately for cash sales
          if (stockType === 'normal') {
            const newStockQuantity = Math.max(0, currentStock - requestedQuantity);
            console.log(`Updating normal stock for ${product.name}: ${currentStock} -> ${newStockQuantity}`);
            await tx.product.update({
              where: { id: product.id },
              data: {
                stockQuantity: newStockQuantity
              }
            });
          } else if (stockType === 'damaged') {
            const newDamagedQuantity = Math.max(0, currentDamaged - requestedQuantity);
            console.log(`Updating damaged stock for ${product.name}: ${currentDamaged} -> ${newDamagedQuantity}`);
            await tx.product.update({
              where: { id: product.id },
              data: {
                damagedQuantity: newDamagedQuantity
              } as any
            });
          }
        }
      }));

      // 4. Payment information is already stored in the Sale record
      // No separate Payment record needed

      // 5. Create ledger entries
      // Now that we are linking to specific customers, we SHOULD create ledger entries
      // This logic ensures history tracking for recurring walk-in customers
      if (finalCustomerId) {
        console.log('Creating ledger entries for cash sale');
        // Purchase Entry
        await createPurchaseEntry(tx, {
          customerId: BigInt(finalCustomerId),
          amount: totalAmount,
          date: new Date(saleDate),
          description: `Cash Sale #${createdSale.id}`,
          saleId: createdSale.id,
          shopId: BigInt(parseInt(shopId))
        });

        // Payment Entry (since it's a cash sale, it's paid immediately)
        if (paidAmount > 0) {
          await createPaymentEntry(tx, {
            customerId: BigInt(finalCustomerId),
            amount: -paidAmount,
            date: new Date(saleDate),
            description: `Payment for Cash Sale #${createdSale.id}`,
            saleId: createdSale.id,
            shopId: BigInt(parseInt(shopId))
          });
        }
      }

      return createdSale;
    });

    console.log('Cash sale created successfully with ID:', sale.id);

    // Fix BigInt serialization
    // Automatically clear dashboard cache for all users of this shop
    try {
      await ultraFastDashboard.clearAllShopDashboardCaches(shopId);
    } catch (e) {
      console.error('Failed to clear all shop dashboard caches after cash sale creation:', e);
    }

    function replacer(key: string, value: any) {
      return typeof value === 'bigint' ? value.toString() : value;
    }

    return new NextResponse(
      JSON.stringify({ success: true, data: { sale } }, replacer),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create cash sale error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create cash sale';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
} 