import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { getAuthContext, assertShopAccess, getShopWhereClause, invalidateShopDashboard } from '@/lib/authContext';
import { createPurchaseEntry, createPaymentEntry } from '@/app/lib/ledgerUtils';
import { updateTmtInventory, convertToKg } from '@/app/lib/tmtUtils';
import ultraFastDashboard from '@/app/lib/ultra-fast-dashboard';

// Global BigInt patch — ensures JSON.stringify handles BigInt without per-response wrappers
import '@/lib/bigint-patch';

export async function GET(req: NextRequest) {
  try {
    // Auth + RBAC: Redis cache → 0 extra DB calls on hit
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Build tenant-safe where clause from cached shopIds
    const shopClause = getShopWhereClause(ctx);

    const sales = await prisma.sale.findMany({
      where: { ...shopClause, isActive: true },
      select: {
        id: true,
        shopId: true,
        saleDate: true,
        totalAmount: true,
        finalAmount: true,
        discount: true,
        transportFare: true,
        vehicleNumber: true,
        driverName: true,
        paymentMethod: true,
        paymentStatus: true,
        notes: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        shop: { select: { name: true, location: true } },
        items: {
          where: { isActive: true },
          select: {
            id: true,
            quantity: true,
            unitName: true,
            unit: true,
            conversionCft: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    // Map Prisma payment method to frontend format
    const mapPaymentMethodToFrontend = (method: string) => {
      switch (method) {
        case 'CASH':
          return 'cash';
        case 'CARD':
          return 'online';
        case 'UPI':
          return 'upi';
        case 'BANK_TRANSFER':
          return 'bank_transfer'; // <-- Fixed mapping
        case 'CHEQUE':
          return 'cheque';
        default:
          return 'cash';
      }
    };

    // Helper function to convert Decimal to number
    const parseDecimal = (value: any): number => {
      if (value === null || value === undefined) return 0
      if (typeof value === 'object' && value.toString) {
        return parseFloat(value.toString())
      }
      return Number(value) || 0
    }

    // Map fields for frontend compatibility
    const mappedSales = sales.map(sale => {
      // Debug: Log the raw sale data from API
      console.log('API sale data:', {
        id: sale.id,
        paymentStatus: sale.paymentStatus,
        updatedAt: sale.updatedAt,
        updatedAtType: typeof sale.updatedAt,
        updatedAtString: sale.updatedAt ? sale.updatedAt.toString() : 'null'
      });

      // Calculate payment amounts based on payment status and method
      let paidAmount = 0;
      let dueAmount = 0;
      let paymentType = 'cash';

      // For both PENDING and COMPLETED sales, use the same logic to preserve payment info
      // This ensures completed sales show the exact same info as when they were active
      if (sale.paymentStatus === 'PENDING' || sale.paymentStatus === 'COMPLETED') {
        // Check notes FIRST for payment info (most reliable for partial payments)
        const partialPaymentMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
        const loanMatch = sale.notes?.match(/Loan\/Credit Sale: Full amount due \(₹(\d+(?:\.\d+)?)\)/);
        const hasLoanNote = sale.notes?.includes('Loan/Credit Sale');

        console.log('🔍 [Sales API] Payment parsing (PENDING/COMPLETED):', {
          saleId: sale.id,
          paymentStatus: sale.paymentStatus,
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          partialMatch: partialPaymentMatch,
          loanMatch: loanMatch,
          hasLoanNote: hasLoanNote
        });

        if (partialPaymentMatch) {
          // This is a partial payment - amounts are in notes (same for both PENDING and COMPLETED)
          paidAmount = parseFloat(partialPaymentMatch[1]);
          dueAmount = parseFloat(partialPaymentMatch[3]);
          paymentType = 'partial';
          console.log('🔍 [Sales API] Parsed partial payment:', {
            saleId: sale.id,
            paidAmount,
            dueAmount,
            paymentType,
            paymentStatus: sale.paymentStatus
          });
        } else if (loanMatch || hasLoanNote) {
          // Loan/credit sale - detected from notes (same for both PENDING and COMPLETED)
          paidAmount = 0;
          dueAmount = parseDecimal(sale.finalAmount);
          paymentType = 'loan';
          console.log('🔍 [Sales API] Detected loan/credit sale from notes:', {
            saleId: sale.id,
            paidAmount,
            dueAmount,
            paymentType,
            paymentStatus: sale.paymentStatus,
            finalAmount: parseDecimal(sale.finalAmount)
          });
        } else if (sale.paymentMethod === 'CASH' || sale.paymentMethod === 'CARD' ||
          sale.paymentMethod === 'UPI' || sale.paymentMethod === 'BANK_TRANSFER' ||
          sale.paymentMethod === 'CHEQUE') {
          // Cash/Online payment (fully paid) - same for both PENDING and COMPLETED
          paidAmount = parseDecimal(sale.finalAmount);
          dueAmount = 0;
          paymentType = sale.paymentMethod ? mapPaymentMethodToFrontend(sale.paymentMethod) : 'cash';
          console.log('🔍 [Sales API] Detected cash/online payment:', {
            saleId: sale.id,
            paymentMethod: sale.paymentMethod,
            paidAmount,
            dueAmount,
            paymentType,
            paymentStatus: sale.paymentStatus,
            finalAmount: parseDecimal(sale.finalAmount)
          });
        } else {
          // No notes and no payment method = Loan/credit sale
          paidAmount = 0;
          dueAmount = parseDecimal(sale.finalAmount);
          paymentType = 'loan';
          console.log('🔍 [Sales API] Defaulting to loan/credit (no payment method or notes):', {
            saleId: sale.id,
            paymentMethod: sale.paymentMethod,
            notes: sale.notes,
            paidAmount,
            dueAmount,
            paymentType,
            paymentStatus: sale.paymentStatus,
            finalAmount: parseDecimal(sale.finalAmount)
          });
        }
      }

      const mappedSale = {
        ...sale,
        date: sale.saleDate ? sale.saleDate.toISOString().slice(0, 10) : null,
        time: sale.saleDate ? sale.saleDate.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : null,
        total_amount: parseDecimal(sale.totalAmount),
        final_amount: parseDecimal(sale.finalAmount),
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_type: paymentType,
        partial_payment_method: paymentType === 'partial' ? (() => {
          // Extract payment method from notes for partial payments (same as dashboard)
          const partialMatch = sale.notes?.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/);
          if (partialMatch && partialMatch[2]) {
            const methodLower = partialMatch[2].toLowerCase();
            if (methodLower === 'online' || methodLower === 'card') {
              return 'online';
            }
            return methodLower; // upi, cash, etc.
          }
          // Fallback to paymentMethod if not in notes
          return sale.paymentMethod ? mapPaymentMethodToFrontend(sale.paymentMethod) : null;
        })() : null,
        paymentStatus: sale.paymentStatus,
        isCompleted: sale.paymentStatus === 'COMPLETED',
        isCancelled: sale.paymentStatus === 'CANCELLED',
        customerName: sale.customer?.name || '',
        customerPhone: sale.customer?.phone || '',
        shopName: sale.shop?.name || '',
        shopLocation: sale.shop?.location || '',
        updatedAt: sale.updatedAt ? sale.updatedAt.toISOString() : null,
        items: sale.items.map(item => {
          return {
            ...item,
            name: item.product?.name || '',
            sku: item.product?.sku || '',
            quantity: Number(item.quantity),
            unit: (item as any).unit || (item as any).unitName || '',
            price_per_unit: parseDecimal(item.unitPrice),
            total_price: parseDecimal(item.totalPrice)
          }
        })
      }
      return mappedSale
    });

    return NextResponse.json({ success: true, data: { sales: mappedSales } });
  } catch (error) {
    console.error('Get sales error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch sales' }, { status: 500 });
  }
}

// POST - Create a new sale
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const body = await req.json();
    const {
      customerId, customerInfo, shopId, saleDate, totalAmount, finalAmount, discount, taxAmount, paymentStatus, notes,
      items, payment_type, paid_amount, partial_payment_method, isDirectSale, supplierId, supplierInfo,
      transportFare, vehicleNumber, driverName
    } = body;
    
    const hasItems = items && Array.isArray(items) && items.length > 0;
    const hasTransport = Number(transportFare || 0) > 0;

    if ((!customerId && !customerInfo) || !shopId || !saleDate || !totalAmount || !finalAmount || (!hasItems && !hasTransport)) {
      return NextResponse.json({ success: false, message: 'Missing required fields or invalid sale content' }, { status: 400 });
    }

    if (isDirectSale && !supplierId && !supplierInfo) {
      return NextResponse.json({ success: false, message: 'Supplier information is required for direct sale' }, { status: 400 });
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Calculate payment amounts based on payment type
      let paidAmount = 0;
      if (payment_type === 'cash' || payment_type === 'online') {
        paidAmount = finalAmount;
      } else if (payment_type === 'partial') {
        paidAmount = paid_amount;
      } // loan/credit remains 0
      let dueAmount = finalAmount - paidAmount;

      // All new sales start as PENDING (Active Sales) regardless of payment type
      // They will be moved to COMPLETED only when explicitly marked as complete
      // Force string literal 'PENDING' to ensure no enum mismatch
      let salePaymentStatus: any = 'PENDING';

      // 1. Create or get customer
      let finalCustomerId = customerId;
      if (customerInfo && !customerId) {
        // Create new customer
        console.log('Creating new customer with info:', customerInfo);
        const newCustomer = await tx.customer.create({
          data: {
            name: customerInfo.name,
            phone: customerInfo.phone,
            address: customerInfo.address || '',
            shopId,
            isActive: true
          }
        });
        finalCustomerId = Number(newCustomer.id);
        console.log('New customer created with ID:', finalCustomerId);
      }

      // 1b. Create or get supplier (for direct sale)
      let finalSupplierId = supplierId;
      if (isDirectSale && supplierInfo && !supplierId) {
        const newSupplier = await tx.supplier.create({
          data: {
            name: supplierInfo.name,
            phone: supplierInfo.phone,
            shopId,
            isActive: true
          }
        });
        finalSupplierId = Number(newSupplier.id);
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

      // For partial payments, use the partial_payment_method instead of payment_type
      // For loan, don't set paymentMethod (it's not a payment method, it's a credit sale)
      let actualPaymentMethod = payment_type;
      let paymentMethodToStore: any = null;

      if (payment_type === 'partial' && partial_payment_method) {
        actualPaymentMethod = partial_payment_method;
        paymentMethodToStore = mapPaymentMethodToPrisma(actualPaymentMethod);
      } else if (payment_type === 'loan') {
        // For loan, don't set a payment method (it's a credit sale with no payment)
        // We'll use CASH as a placeholder, but the payment_type will indicate it's a loan
        paymentMethodToStore = 'CASH'; // Placeholder - the payment_type field indicates loan
      } else if (payment_type === 'cash' || payment_type === 'online') {
        paymentMethodToStore = mapPaymentMethodToPrisma(actualPaymentMethod);
      }

      console.log('🔍 [Sales API] Payment method mapping:', {
        payment_type,
        partial_payment_method,
        actualPaymentMethod,
        paymentMethodToStore,
        paidAmount,
        dueAmount
      });

      // Prepare notes with payment information
      let saleNotes = notes || '';
      if (payment_type === 'partial') {
        const partialInfo = `Partial Payment: ₹${paidAmount} via ${partial_payment_method || 'UPI'}, Due: ₹${dueAmount}`;
        saleNotes = saleNotes ? `${saleNotes}\n${partialInfo}` : partialInfo;
      } else if (payment_type === 'loan') {
        // Add loan/credit information to notes
        const loanInfo = `Loan/Credit Sale: Full amount due (₹${finalAmount})`;
        saleNotes = saleNotes ? `${saleNotes}\n${loanInfo}` : loanInfo;
      }

      // 2. Create the sale
      const createdSale = await tx.sale.create({
        data: {
          customerId: finalCustomerId,
          shopId,
          saleDate: new Date(saleDate),
          totalAmount,
          finalAmount,
          discount,
          transportFare: Number(transportFare || 0),
          vehicleNumber: vehicleNumber || null,
          driverName: driverName || null,
          paymentStatus: salePaymentStatus,
          paymentMethod: paymentMethodToStore as any,
          notes: (isDirectSale || (hasItems && items.some((i: any) => i.isDirectSale))) ? `${saleNotes}\n(Includes Direct Truck Sale)` : saleNotes,
          isActive: true,
        }
      });

      // 2. Create sale items if any exist
      console.log('🔍 [Sales API] Processing items:', items?.length || 0);
      if (hasItems) {
        await Promise.all(items.map(async (item: any, index: number) => {
        let finalProductId = item.productId;
        const itemIsDirectSale = item.isDirectSale ?? isDirectSale;
        if (itemIsDirectSale && (!finalProductId || finalProductId === 0) && item.name && item.categoryId && item.typeId) {
          let product = await tx.product.findFirst({
            where: {
              name: { equals: item.name, mode: 'insensitive' },
              categoryId: Number(item.categoryId),
              typeId: Number(item.typeId),
              shopId: shopId
            }
          });
          if (!product) {
            product = await tx.product.create({
              data: {
                name: item.name,
                categoryId: Number(item.categoryId),
                typeId: Number(item.typeId),
                shopId: shopId,
                stockQuantity: 0,
                unit: item.unitName || item.unit || 'units',
                price: Number(item.price_per_unit || item.unitPrice || 0),
                costPrice: Number(item.purchasePrice || item.price_per_unit || item.unitPrice || 0),
                isActive: true
              }
            });
          }
          finalProductId = product.id;
        }

        if (!finalProductId) {
          throw new Error('Missing productId for sale item');
        }

        
        const itemConvFactor = item.conversionCft ? parseFloat(item.conversionCft) : 1;
        const itemTotalCft = Number(item.quantity) * itemConvFactor;

        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: finalProductId,
            quantity: Number(item.quantity),
            unitName: item.unitName || item.unit || null,
            unit: item.unitName || item.unit || null,
            conversionCft: item.conversionCft ? parseFloat(item.conversionCft) : null,
            unitPrice: Number(item.price_per_unit || item.unitPrice),
            totalPrice: Number(item.quantity) * Number(item.price_per_unit || item.unitPrice),
            isActive: true
          }
        });

        // If direct sale, create a StockEntry for the purchase side
        let itemSupplierId = item.supplierId || finalSupplierId;
        if (itemIsDirectSale && item.supplierInfo && !itemSupplierId) {
          const newSupplier = await tx.supplier.create({
            data: { name: item.supplierInfo.name, phone: item.supplierInfo.phone, shopId, isActive: true }
          });
          itemSupplierId = Number(newSupplier.id);
        }

        if (itemIsDirectSale && itemSupplierId) {
          const purchasePrice = Number(item.purchasePrice || item.price_per_unit || item.unitPrice);
          const totalPurchaseAmount = purchasePrice * Number(item.quantity);

          await tx.stockEntry.create({
            data: {
              productId: finalProductId,
              supplierId: BigInt(itemSupplierId),
              shopId: shopId,
              quantity: Number(item.quantity),
              unitName: item.unitName || item.unit || null,
              conversionCft: item.conversionCft ? parseFloat(item.conversionCft) : null,
              unitPrice: purchasePrice,
              totalAmount: totalPurchaseAmount,
              entryDate: new Date(saleDate),
              notes: `Auto-created from Direct Sale #${createdSale.id}`,
              paymentStatus: 'PENDING',
              isActive: true
            }
          });

          // Update supplier outstanding payment
          await tx.supplier.update({
            where: { id: BigInt(itemSupplierId) },
            data: {
              outstandingPayment: {
                increment: totalPurchaseAmount
              }
            }
          });
        }

        // 3. Update product inventory and ledger
        const productInfo = await tx.product.findUnique({
          where: { id: BigInt(finalProductId) },
          include: { category: { select: { name: true } } }
        });

        const categoryName = (productInfo as any)?.category?.name?.toLowerCase()?.trim() || '';
        const isCement = categoryName.includes('cement');
        const isLoose = item.unit === 'kg' || item.unitName === 'kg' || item.stockType === 'damaged';
        // Only Sand and Chips (true bulk CFT materials) use CFT-based stock.
        // Bricks, TMT, and all other piece-count products use raw quantity.
        const isTrueBulkCft = categoryName.includes('sand') || categoryName.includes('chips') || categoryName.includes('aggregate');

        // Update product inventory - ONLY IF NOT DIRECT SALE
        if (!itemIsDirectSale && productInfo) {
          if (isCement && isLoose) {
              // Loose cement sold in kg → deduct from damagedQuantity
              await tx.product.update({
                where: { id: finalProductId },
                data: {
                  damagedQuantity: {
                    decrement: Number(item.quantity)
                  }
                }
              });
            } else if (isCement) {
              // Cement sold in bags → deduct raw bag quantity (NOT CFT)
              // stockQuantity stores number of bags; conversionCft does NOT apply here
              await tx.product.update({
                where: { id: finalProductId },
                data: {
                  stockQuantity: {
                    decrement: Number(item.quantity)
                  }
                }
              });
            } else if (isTrueBulkCft) {
              // Sand / Chips / Aggregates — stock stored in CFT, deduct CFT volume
              await tx.product.update({
                where: { id: finalProductId },
                data: {
                  stockQuantity: {
                    decrement: itemTotalCft
                  }
                }
              });
            } else {
              // Bricks, TMT (via regular sale), and all other piece-count products
              // — stock stored as piece count, deduct raw quantity only
              await tx.product.update({
                where: { id: finalProductId },
                data: {
                  stockQuantity: {
                    decrement: Number(item.quantity)
                  }
                }
              });
            }
          }

        // Create Stock Ledger entry
        // cftQuantity: cement → bag count; true bulk (sand/chips) → CFT volume; others → raw quantity
        const ledgerCftQty = (isCement && !isLoose)
          ? Number(item.quantity)
          : isTrueBulkCft
            ? itemTotalCft
            : Number(item.quantity);
        await tx.stockLedger.create({
          data: {
            productId: finalProductId,
            shopId: shopId,
            transactionType: 'SALE',
            unitName: item.unitName || item.unit || 'unit',
            unitQuantity: Number(item.quantity),
            cftQuantity: ledgerCftQty,
            referenceId: createdSale.id,
            notes: notes || `Sale to ${customerInfo?.name || customerId || 'Customer'}`,
          }
        });
      }));
    }

      // 3. Inventory update is now handled inside the items map above

      // 4. Payment information is stored in the Sale model itself
      // The paymentMethod and paymentStatus fields in Sale handle payment tracking

      // Always create a debit ledger entry for the full bill, and store paid/due in the sale record only
      const itemsWithUnit = items.map((item: any) => ({
        name: item.name || (item.product?.name ?? ''),
        quantity: item.quantity,
        price_per_unit: item.price_per_unit ?? item.unitPrice ?? item.price ?? 0,
        unit: item.unit || 'units'
      }));
      console.log('🔍 [Sales API] Creating ledger entry:', {
        customerId: finalCustomerId,
        amount: finalAmount,
        dueAmount: dueAmount,
        description: notes || `Sale #${createdSale.id}`,
        itemsCount: itemsWithUnit.length,
        shopId: shopId
      });
      console.log('Ledger items to be created:', itemsWithUnit); // DEBUG LOG
      await createPurchaseEntry(tx, {
        customerId: finalCustomerId,
        amount: finalAmount, // Add full sale amount to ledger
        date: new Date(saleDate),
        description: notes ? `${notes} (Sale #${createdSale.id})` : `Sale #${createdSale.id}`,
        items: itemsWithUnit, // pass items with unit
        shopId: shopId // explicitly pass the shopId to ensure consistency
      });
      console.log('🔍 [Sales API] Ledger debit entry created successfully');

      // For immediately-paid sales (cash/online/partial), create a payment entry
      // to offset the debit so the customer's currentBalance stays accurate.
      // Loan/credit sales intentionally have no payment entry (full amount stays as balance).
      if (paidAmount > 0) {
        await createPaymentEntry(tx, {
          customerId: finalCustomerId,
          amount: -paidAmount, // Negative amount = credit (payment received)
          date: new Date(saleDate),
          description: `Payment for Sale #${createdSale.id}`,
          shopId: shopId
        });
        console.log('🔍 [Sales API] Ledger payment entry created (paidAmount:', paidAmount, ')');
      }

      return createdSale;
    });

    // Invalidate dashboard cache for this shop (non-blocking)
    invalidateShopDashboard(BigInt(shopId)).catch(() => {});
    try {
      await ultraFastDashboard.clearAllShopDashboardCaches(shopId);
    } catch (e) {
      console.error('Failed to clear all shop dashboard caches after sale creation:', e);
    }

    return NextResponse.json({ success: true, data: { sale } });
  } catch (error) {
    console.error('Create sale error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create sale' }, { status: 500 });
  }
}

// PATCH - Update sale status (completion/cancellation)
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }

    const body = await req.json();
    const { saleId, action, reason, isTmtSale } = body;

    if (!saleId || !action) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    let paymentStatus: 'COMPLETED' | 'CANCELLED' | 'PENDING';
    let notes = '';

    switch (action) {
      case 'complete':
        paymentStatus = 'COMPLETED';
        console.log('🔍 [Sales API] Completing sale:', saleId, 'Setting paymentStatus to:', paymentStatus);
        break;
      case 'cancel':
        paymentStatus = 'CANCELLED';
        notes = reason ? `Cancelled: ${reason}` : 'Order cancelled by customer';
        break;
      case 'reactivate':
        paymentStatus = 'PENDING';
        break;
      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    // Track TMT inventory restorations to execute after transaction
    const tmtInventoryRestorations: Array<{
      productId: number;
      shopId: number;
      quantityKg: number;
    }> = [];

    // Update the sale status and handle stock changes
    const updatedSale = await prisma.$transaction(async (tx) => {
      let currentSale = null;
      let currentTmtSale = null;
      let isTmtSaleFlag = false;
      let resultSale: any;


      // If explicitly marked as TMT sale, check TmtSale table first
      if (isTmtSale) {
        console.log('🔍 [Sales API] isTmtSale flag is true, checking TmtSale table first...');
        currentTmtSale = await tx.tmtSale.findUnique({
          where: { id: BigInt(saleId) },
          include: {
            customer: true, // Fetch customer relation
            items: {
              include: {
                product: true
              }
            }
          }
        });

        if (currentTmtSale) {
          isTmtSaleFlag = true;
          console.log('🔍 [Sales API] Found TMT sale:', currentTmtSale.id);
        }
      }

      // If not found in TMT or not flagged as TMT, check regular Sales table
      if (!currentTmtSale) {
        console.log('🔍 [Sales API] Checking Sale table...');
        currentSale = await tx.sale.findUnique({
          where: { id: BigInt(saleId) },
          include: {
            items: {
              include: {
                product: { include: { category: { select: { name: true } } } }
              }
            }
          }
        });
      }

      if (!currentSale && !currentTmtSale) {
        throw new Error('Sale not found');
      }

      // Update the sale status
      // Preserve existing notes if no new notes provided (important for partial payments)
      const updateData: any = {
        paymentStatus,
        isActive: action === 'cancel' ? false : true,
        updatedAt: new Date(),
      };
      // Only update notes if provided (for cancel action), otherwise preserve existing notes
      if (notes) {
        updateData.notes = notes;
      }
      // If action is 'complete' and no notes provided, keep existing notes (don't overwrite)

      // Handle TMT sales differently
      if (isTmtSaleFlag && currentTmtSale) {
        console.log('🔍 [Sales API] Updating TMT sale:', currentTmtSale.id, 'action:', action);

        // Map action to TMT payment status
        let tmtPaymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'PENDING' | 'CANCELLED';
        if (action === 'cancel') {
          tmtPaymentStatus = 'CANCELLED';
        } else if (action === 'complete') {
          // Only mark as PAID if fully paid, otherwise keep existing status (PARTIAL/UNPAID/PENDING)
          // If dueAmount is 0 or less, it's PAID.
          // If dueAmount > 0, keep current status.
          if (Number(currentTmtSale.dueAmount) <= 0) {
            tmtPaymentStatus = 'PAID';
          } else {
            tmtPaymentStatus = currentTmtSale.paymentStatus;
          }
        } else {
          tmtPaymentStatus = currentTmtSale.paymentStatus; // Keep existing status
        }

        resultSale = await tx.tmtSale.update({
          where: { id: BigInt(saleId) },
          data: {
            paymentStatus: tmtPaymentStatus,
            // Update status based on action
            status: action === 'complete' ? 'COMPLETED' : (action === 'cancel' ? 'CANCELLED' : currentTmtSale.status),
            isActive: action === 'cancel' ? false : true,
            updatedAt: new Date(),
            notes: notes || currentTmtSale.notes
          },
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });

        // TMT Ledger Integration: Purchase entry is now created at the time of sale (in POST)
        // so we don't recreate it here. If the sale is marked as completed, the user should 
        // ideally add a payment entry or it can be handled by a dedicated payment flow.

        // Add dummy fields to match Sale interface for response
        resultSale.customer = null;
        resultSale.shop = { id: resultSale.shopId };
        resultSale.isTmtSale = true;

        console.log('🔍 [Sales API] TMT sale updated:', resultSale.id, 'status:', resultSale.paymentStatus);
      } else {
        resultSale = await tx.sale.update({
          where: { id: BigInt(saleId) },
          data: updateData,
          include: {
            customer: true,
            shop: true,
            items: {
              include: {
                product: { include: { category: { select: { name: true } } } }
              }
            }
          }
        });
      }
      console.log('🔍 [Sales API] Sale updated successfully:', {
        id: resultSale.id,
        paymentStatus: resultSale.paymentStatus,
        isCompleted: resultSale.paymentStatus === 'COMPLETED'
      });

      // Handle stock updates based on action
      // NOTE: Stock is already deducted when sale is created (POST), so we should NOT deduct again on completion
      // Only restore stock when cancelling/reactivating
      if (action === 'complete' && (currentSale?.paymentStatus !== 'COMPLETED' || currentTmtSale)) {
        // Sale is being completed - stock was already deducted on creation, so don't deduct again
        // Just update the payment status - no stock changes needed
        console.log('🔍 [Sales API] Marking sale as complete - stock was already deducted on creation, skipping stock update');
      } else if (action === 'reactivate' && currentSale && currentSale.paymentStatus === 'COMPLETED') {
        // Sale is being reactivated from completed - restore stock
        for (const item of currentSale.items) {
          const product = item.product;
          if (product) {
            const itemConvFactor = (item as any).conversionCft ? parseFloat((item as any).conversionCft.toString()) : 1;
            const itemTotalCft = Number(item.quantity) * itemConvFactor;
            const catName = (product as any).category?.name?.toLowerCase()?.trim() || '';
            const isCement = catName.includes('cement');
            const isLoose = (item as any).unit === 'kg' || (item as any).unitName === 'kg' || (item as any).stockType === 'damaged';
            // Only Sand/Chips/Aggregates are true CFT-based bulk; Bricks restore by piece count
            const isTrueBulkCft = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');
            if (isCement && isLoose) {
              // Restore loose cement kg → damagedQuantity
              const newDamagedQuantity = Number(product.damagedQuantity || 0) + Number(item.quantity);
              await tx.product.update({
                where: { id: product.id },
                data: { damagedQuantity: newDamagedQuantity, updatedAt: new Date() }
              });
            } else if (isCement) {
              // Restore cement bags → raw bag count (NOT CFT)
              await tx.product.update({
                where: { id: product.id },
                data: { stockQuantity: { increment: Number(item.quantity) }, updatedAt: new Date() }
              });
            } else if (isTrueBulkCft) {
              // Sand / Chips / Aggregates — restore CFT volume
              await tx.product.update({
                where: { id: product.id },
                data: { stockQuantity: { increment: itemTotalCft }, updatedAt: new Date() }
              });
            } else {
              // Bricks and all other piece-count products — restore raw quantity
              await tx.product.update({
                where: { id: product.id },
                data: { stockQuantity: { increment: Number(item.quantity) }, updatedAt: new Date() }
              });
            }
          }
        }

        // REACIVATE REGULAR SALE: Recreate the ledger entry (since it was deleted on cancel)
        // Only for regular sales (TMT sales get entry on completion)
        if (currentSale && currentSale.customerId) {
          console.log('🔍 [Sales API] Reactivating regular sale - recreating ledger entry for sale:', currentSale.id);

          // Calculate amounts based on the sale's payment method/status
          // Use logic similar to POST
          const finalAmount = Number(currentSale.finalAmount);

          const itemsWithUnit = currentSale.items.map((item: any) => ({
            name: item.product?.name || item.name || '',
            quantity: Number(item.quantity),
            price_per_unit: Number(item.unitPrice),
            unit: (item as any).unit || 'units'
          }));

          await createPurchaseEntry(tx, {
            customerId: Number(currentSale.customerId),
            amount: finalAmount,
            date: new Date(), // Use current date of reactivation
            description: currentSale.notes ? `${currentSale.notes} (Sale #${currentSale.id})` : `Sale #${currentSale.id} (Reactivated)`,
            items: itemsWithUnit,
            shopId: currentSale.shopId,
            method: currentSale.paymentMethod // Pass original payment method
          });
        }
      } else if (action === 'cancel') {
        // Sale is being cancelled - restore stock for both regular and TMT sales

        if (isTmtSaleFlag && currentTmtSale) {
          console.log('🔍 [Sales API] TMT sale cancelled - restoring inventory:', currentTmtSale.id);
          for (const item of currentTmtSale.items) {
            const product = item.product;
            if (product) {
              // TMT sales: Restore inventory using TmtInventory.availableQtyKg
              console.log('🔍 [Sales API] TMT sale cancelled - restoring inventory for item:', item.productId);

              // Get the sale item's unit information
              const unitType = item.unitType || 'KG';
              const quantity = Number(item.quantity);

              // Fetch the full product details to ensure we have correct weights
              const fullProduct = await tx.tmtProduct.findUnique({
                where: { id: item.productId }
              });

              if (fullProduct) {
                // Map Decimal fields to numbers for the utility function
                const productForConversion = {
                  ...fullProduct,
                  weightPerRodKg: Number(fullProduct.weightPerRodKg),
                  rodsPerBundle: Number(fullProduct.rodsPerBundle),
                  weightPerBundleKg: Number(fullProduct.weightPerBundleKg),
                  defaultUnit: fullProduct.defaultUnit as any
                };

                // Convert quantity to KG based on unit type
                // IMPORTANT: Database stores unit types as UPPERCASE but convertToKg expects lowercase
                const equivalentKg = convertToKg(
                  quantity,
                  unitType.toLowerCase() as any,
                  productForConversion as any
                );

                console.log('🔍 [Sales API] Restoring TMT inventory:', {
                  productId: item.productId,
                  quantity,
                  unitType,
                  equivalentKg,
                  shopId: currentTmtSale.shopId,
                  productWeight: productForConversion.weightPerRodKg
                });

                if (currentTmtSale.shopId) {
                  tmtInventoryRestorations.push({
                    productId: Number(item.productId),
                    shopId: Number(currentTmtSale.shopId),
                    quantityKg: equivalentKg
                  });
                  console.log('🔍 [Sales API] Queued TMT inventory restoration for execution after transaction');
                }
              } else {
                console.error('❌ [Sales API] Could not find product for restoration:', item.productId);
              }
            }
          }
        } else if (currentSale) {
          console.log('🔍 [Sales API] Regular sale cancelled - restoring inventory:', currentSale.id);
          for (const item of currentSale.items) {
            const product = item.product;
            if (product) {
              const itemConvFactor = (item as any).conversionCft ? parseFloat((item as any).conversionCft.toString()) : 1;
              const itemTotalCft = Number(item.quantity) * itemConvFactor;

              const catName = (product as any).category?.name?.toLowerCase()?.trim() || '';
              const isCement = catName.includes('cement');
              const isLoose = (item as any).unit === 'kg' || (item as any).unitName === 'kg' || (item as any).stockType === 'damaged';
              // Only Sand/Chips/Aggregates are true CFT-based bulk; Bricks restore by piece count
              const isTrueBulkCft = catName.includes('sand') || catName.includes('chips') || catName.includes('aggregate');

              console.log('🔍 [Sales API] Restoring stock for item:', {
                productId: product.id,
                productName: product.name,
                category: catName,
                unitQuantity: item.quantity,
                conversionCft: itemConvFactor,
                totalCft: itemTotalCft,
                isCement,
                isTrueBulkCft,
                currentStock: product.stockQuantity
              });

              if (isCement && isLoose) {
                // Restore damagedQuantity for loose cement (kg)
                const newDamagedQuantity = Number(product.damagedQuantity || 0) + Number(item.quantity);
                await tx.product.update({
                  where: { id: product.id },
                  data: { damagedQuantity: newDamagedQuantity, updatedAt: new Date() }
                });
              } else if (isCement) {
                // Restore cement bags → raw bag count (NOT CFT)
                await tx.product.update({
                  where: { id: product.id },
                  data: {
                    stockQuantity: { increment: Number(item.quantity) },
                    updatedAt: new Date(),
                  }
                });
                await tx.stockLedger.create({
                  data: {
                    productId: product.id,
                    shopId: resultSale.shopId,
                    transactionType: 'ADJUSTMENT',
                    unitName: (item as any).unitName || (item as any).unit || 'bag',
                    unitQuantity: Number(item.quantity),
                    cftQuantity: Number(item.quantity), // 1 bag = 1 unit for cement
                    referenceId: resultSale.id,
                    notes: `Sale #${resultSale.id} Cancellation - Cement Bags Restored`,
                  }
                });
              } else if (isTrueBulkCft) {
                // Sand / Chips / Aggregates — restore CFT volume
                await tx.product.update({
                  where: { id: product.id },
                  data: {
                    stockQuantity: { increment: itemTotalCft },
                    updatedAt: new Date(),
                  }
                });
                await tx.stockLedger.create({
                  data: {
                    productId: product.id,
                    shopId: resultSale.shopId,
                    transactionType: 'ADJUSTMENT',
                    unitName: (item as any).unitName || (item as any).unit || 'unit',
                    unitQuantity: Number(item.quantity),
                    cftQuantity: itemTotalCft,
                    referenceId: resultSale.id,
                    notes: `Sale #${resultSale.id} Cancellation - Bulk CFT Stock Restored`,
                  }
                });
              } else {
                // Bricks and all other piece-count products — restore raw quantity
                await tx.product.update({
                  where: { id: product.id },
                  data: {
                    stockQuantity: { increment: Number(item.quantity) },
                    updatedAt: new Date(),
                  }
                });
                await tx.stockLedger.create({
                  data: {
                    productId: product.id,
                    shopId: resultSale.shopId,
                    transactionType: 'ADJUSTMENT',
                    unitName: (item as any).unitName || (item as any).unit || 'unit',
                    unitQuantity: Number(item.quantity),
                    cftQuantity: Number(item.quantity), // piece-count products: cftQty = unitQty
                    referenceId: resultSale.id,
                    notes: `Sale #${resultSale.id} Cancellation - Stock Restored`,
                  }
                });
              }
            }
          }
        }
      }

      return resultSale;
    });

    // Execute TMT inventory restorations after transaction completes
    // (updateTmtInventory uses its own Prisma client and doesn't support transactions)
    if (tmtInventoryRestorations.length > 0) {
      console.log(`🔍 [Sales API] Executing ${tmtInventoryRestorations.length} TMT inventory restorations...`);
      for (const restoration of tmtInventoryRestorations) {
        await updateTmtInventory(
          restoration.productId,
          restoration.shopId,
          restoration.quantityKg,
          'add'
        );
        console.log(`🔍 [Sales API] Restored ${restoration.quantityKg}kg to product ${restoration.productId}`);
      }
      console.log('✅ [Sales API] All TMT inventory restorations completed');
    }

    // After updating the sale status, if cancelled, clean up related ledger entries
    if (action === 'cancel') {
      // Find all related ledger entries
      const ledgerEntries = await prisma.customerLedgerEntry.findMany({
        where: {
          description: { contains: `Sale #${saleId}` }
        },
        select: { id: true }
      });
      const ledgerEntryIds = ledgerEntries.map(e => e.id);
      if (ledgerEntryIds.length > 0) {
        // Note: CustomerLedgerItem model doesn't exist in current schema
        // Delete the ledger entries directly
        await prisma.customerLedgerEntry.deleteMany({
          where: { id: { in: ledgerEntryIds } }
        });
      }
    }

    // Automatically clear dashboard cache for all users of this shop
    try {
      // For TMT sales, shopId is directly on the sale object. For regular sales, it's on shop.id
      const shopIdToUse = updatedSale.shopId || updatedSale.shop?.id;
      if (shopIdToUse) {
        await ultraFastDashboard.clearAllShopDashboardCaches(Number(shopIdToUse));
        console.log('🔍 [Sales API] Dashboard cache cleared for shop:', shopIdToUse);
      }
    } catch (e) {
      console.error('Failed to clear all shop dashboard caches after sale update:', e);
    }

    // Fix BigInt serialization
    function replacer(key: string, value: any) {
      return typeof value === 'bigint' ? value.toString() : value;
    }

    return new NextResponse(
      JSON.stringify({ success: true, data: { sale: updatedSale } }, replacer),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update sale error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update sale' }, { status: 500 });
  }
} 