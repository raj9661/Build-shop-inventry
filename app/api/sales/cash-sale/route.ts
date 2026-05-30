import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentStatus } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import ultraFastDashboard from '@/app/lib/ultra-fast-dashboard';


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
      items, payment_type, paid_amount, transportFare, vehicleNumber, driverName
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

    const hasItems = items && Array.isArray(items) && items.length > 0;
    const hasTransport = Number(transportFare || 0) > 0;

    if (!hasItems && !hasTransport) {
      return NextResponse.json({ success: false, message: 'Missing items or transport fare' }, { status: 400 });
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

    const result = await prisma.$transaction(async (tx) => {
      // Calculate payment amounts based on payment type
      let paidAmount = 0;
      if (payment_type === 'cash' || payment_type === 'online') {
        paidAmount = finalAmount;
      } else if (payment_type === 'partial') {
        paidAmount = paid_amount || 0;
      } // loan/credit remains 0
      let dueAmount = finalAmount - paidAmount;

      // Always create cash sales as PENDING (Active Sales) so they appear on dashboard.
      // The user will explicitly mark them as Complete from the Active Sales tab.
      // This is consistent with how /api/sales works for regular sales.
      let salePaymentStatus: PaymentStatus = PaymentStatus.PENDING;

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
      // Always start as PENDING so the sale shows in Active Sales on dashboard
      const saleStatus = 'PENDING';
      const createdSale = await tx.sale.create({
        data: {
          customerId: finalCustomerId,
          shopId: parseInt(shopId),
          saleDate: new Date(saleDate),
          totalAmount: totalAmount,
          finalAmount: finalAmount,
          discount: discount || 0,
          transportFare: Number(transportFare || 0),
          vehicleNumber: vehicleNumber || null,
          driverName: driverName || null,
          paymentStatus: salePaymentStatus,
          status: saleStatus as any,
          paymentMethod: mapPaymentMethodToPrisma(payment_type) as any,
          // [CASH_SALE] tag marks sales created from the Cash Sale section
          // This lets us reliably filter them apart from regular Add Sale records
          notes: notes ? `[CASH_SALE] ${notes}` : '[CASH_SALE]',
          isActive: true
        }
      });
      console.log('Created sale with ID:', createdSale.id);

      // 3. Create sale items and handle stock updates if items exist
      console.log('Processing sale items...');
      if (hasItems) {
        console.log(`Processing ${items.length} sale items sequentially...`);
        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          console.log(`Processing item ${index + 1}:`, item);

          if (!item.productId) {
            throw new Error(`Missing productId for item ${index + 1}`);
          }

          const productId = parseInt(item.productId);
          if (isNaN(productId)) {
            throw new Error(`Invalid productId for item ${index + 1}: ${item.productId}`);
          }

          // Get product to check stock (include category for cement detection)
          const product = await tx.product.findUnique({
            where: { id: productId },
            include: { category: { select: { name: true } } }
          });

          if (!product) {
            throw new Error(`Product with ID ${productId} not found`);
          }

          const currentStock = Number(product.stockQuantity);
          const currentDamaged = Number((product as any).damagedQuantity || 0);
          
          const categoryName = product.category?.name?.toLowerCase()?.trim() || '';
          const productName = product.name?.toLowerCase() || '';
          // Robust cement detection: check category or product name
          const isCement = categoryName.includes('cement') || productName.includes('cement');
          // Bricks, chips, sand, and aggregates are always sold regardless of stock level
          const isBulkMaterial =
            categoryName.includes('sand') ||
            categoryName.includes('chips') ||
            categoryName.includes('brick') ||
            categoryName.includes('aggregate') ||
            categoryName.includes('ring') ||
            productName.includes('sand') ||
            productName.includes('chips') ||
            productName.includes('brick') ||
            productName.includes('ring');

          console.log(`Product found: ${product.name}, Category: ${categoryName}, isCement: ${isCement}, isBulkMaterial: ${isBulkMaterial}, Stock: ${currentStock}, Damaged: ${currentDamaged}`);

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

          // Important: use conversionCft from frontend if available, else default to 1
          const itemConvFactor = item.conversionCft ? parseFloat(item.conversionCft) : 1;
          const itemTotalCft = requestedQuantity * itemConvFactor;

          // Bulk materials (bricks/chips/sand) are sold even if not in stock — skip check
          if (!isCement && !isBulkMaterial && availableStock < itemTotalCft) {
            throw new Error(`Insufficient ${stockType} stock for product ${product.name}. Available: ${availableStock}, Requested Total: ${itemTotalCft}`);
          }

          // Create sale item
          console.log(`Creating sale item for product ${product.name} (Unit: ${item.unit}, Conversion: ${itemConvFactor})`);
          await tx.saleItem.create({
            data: {
              saleId: createdSale.id,
              productId: productId,
              quantity: requestedQuantity,
              unit: item.unit, 
              unitName: item.unitName || item.unit || null,
              conversionCft: itemConvFactor,
              unitPrice: parseFloat(item.price_per_unit || item.price || 0),
              totalPrice: requestedQuantity * parseFloat(item.price_per_unit || item.price || 0),
              isActive: true
            }
          });

          if (isCement) {
            if (stockType === 'damaged') {
              // Deduct from damagedQuantity (in kg)
              if (currentDamaged < requestedQuantity) {
                 throw new Error(`Insufficient damaged stock for ${product.name}. Available: ${currentDamaged}kg, Requested: ${requestedQuantity}kg`);
              }
              const newDamaged = Math.max(0, currentDamaged - requestedQuantity);
              console.log(`Deducting ${requestedQuantity}kg loose cement from damaged stock: ${currentDamaged}kg -> ${newDamaged}kg`);
              await tx.product.update({
                where: { id: product.id },
                data: { damagedQuantity: newDamaged } as any
              });
            } else {
              // Deduct from main bag stock (each bag = 50kg)
              let bagsToDeduct = requestedQuantity;
              if (item.unit === 'kg' || item.unitName?.toLowerCase() === 'kg') {
                bagsToDeduct = requestedQuantity / 50;
              } else if (['bag', 'bags', 'piece', 'pc', 'pcs'].includes(item.unit?.toLowerCase()) || ['bag', 'bags', 'piece', 'pc', 'pcs'].includes(item.unitName?.toLowerCase())) {
                bagsToDeduct = requestedQuantity;
              } else {
                // If unknown unit for cement, assume bag if quantity is small, else assume kg
                bagsToDeduct = requestedQuantity > 50 ? requestedQuantity / 50 : requestedQuantity;
              }

              if (currentStock < bagsToDeduct) {
                 throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock} bags, Requested: ${bagsToDeduct} bags`);
              }
              const newStock = Math.max(0, currentStock - bagsToDeduct);
              console.log(`Deducting ${bagsToDeduct} bags from main stock: ${currentStock} -> ${newStock}`);
              await tx.product.update({
                where: { id: product.id },
                data: { stockQuantity: newStock }
              });
            }
          } else if (isBulkMaterial) {
            // Bricks / chips / sand — do NOT block sale if out of stock, but MUST deduct stock
            const isTrueBulkCft = 
              categoryName.includes('sand') || 
              categoryName.includes('chips') || 
              categoryName.includes('aggregate') || 
              productName.includes('sand') || 
              productName.includes('chips');
              
            const deductionAmount = isTrueBulkCft ? itemTotalCft : requestedQuantity;
            const newStockQuantity = currentStock - deductionAmount;
            
            console.log(`Updating stock for bulk material ${product.name}: ${currentStock} -> ${newStockQuantity} (Deducted ${deductionAmount})`);
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: newStockQuantity }
            });
          } else {
            // Update stock immediately for other non-cement products
            if (stockType === 'normal') {
              const newStockQuantity = Math.max(0, currentStock - itemTotalCft);
              console.log(`Updating normal stock for ${product.name}: ${currentStock} -> ${newStockQuantity} (Deducted ${itemTotalCft})`);
              await tx.product.update({
                where: { id: product.id },
                data: { stockQuantity: newStockQuantity }
              });
            } else if (stockType === 'damaged') {
              const newDamagedQuantity = Math.max(0, currentDamaged - itemTotalCft);
              console.log(`Updating damaged stock for ${product.name}: ${currentDamaged} -> ${newDamagedQuantity} (Deducted ${itemTotalCft})`);
              await tx.product.update({
                where: { id: product.id },
                data: { damagedQuantity: newDamagedQuantity } as any
              });
            }
          }
        }
      }

      // 4. Payment information is already stored in the Sale record
      // No separate Payment record needed

      // Return the created sale along with customer/payment context so we
      // can create ledger entries OUTSIDE the transaction (avoids the Prisma
      // "Transaction not found" error caused by running calculateRunningBalance
      // — which does extra queries — inside an already-open interactive transaction).
      return { createdSale, finalCustomerId, paidAmount };
    });

    const { createdSale: sale, finalCustomerId, paidAmount } = result;

    console.log('Cash sale created successfully with ID:', sale.id);

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