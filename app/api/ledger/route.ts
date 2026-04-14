import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { prisma } from '@/lib/prisma';

// GET - Fetch customer ledger entries (Optimized)
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
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100'); // Increased default limit
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Customer ID is required', code: 'MISSING_CUSTOMER_ID' }, { status: 400 });
    }

    const skip = (page - 1) * limit;

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);

    // First, check if the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) },
      select: { id: true, name: true, customerType: true, isActive: true }
    });

    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' }, { status: 404 });
    }

    // Prevent access to walk-in customer ledgers (if customerType is WALKIN)
    const customerType = (customer as any).customerType;
    if (customerType === 'WALKIN') {
      return NextResponse.json({
        success: false,
        message: 'Walk-in customer ledgers are not accessible',
        code: 'WALKIN_CUSTOMER_NOT_ALLOWED'
      }, { status: 403 });
    }

    // Build where clause for ledger entries
    const where: any = {
      customerId: parseInt(customerId),
      isActive: true
    };

    // Apply date filters if provided
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    // Apply shop filter - convert createdBy to shopId filter
    if (Object.keys(shopFilter).length > 0) {
      if ('createdBy' in shopFilter) {
        // For SUPER_DUPER_ADMIN, get shops they created and filter by shopId
        const shops = await prisma.shop.findMany({
          where: { createdBy: BigInt(shopFilter.createdBy) },
          select: { id: true }
        });
        where.shopId = { in: shops.map(shop => shop.id) };
      } else if ('shopId' in shopFilter) {
        // For regular users, use the shopId filter directly
        Object.assign(where, shopFilter);
      }
    }

    console.log('🔍 [Ledger API] Fetching entries with where clause:', where);

    // Optimized query: Get ledger entries
    const [entries, total] = await Promise.all([
      prisma.customerLedgerEntry.findMany({
        where,
        orderBy: [
          { date: 'desc' },
          { id: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.customerLedgerEntry.count({ where })
    ]);

    console.log('🔍 [Ledger API] Found entries:', {
      count: entries.length,
      total,
      entries: entries.map(e => ({
        id: Number(e.id),
        customerId: Number(e.customerId),
        amount: Number(e.amount),
        type: e.type,
        description: e.description
      }))
    });

    // Use the balance field from the database for each entry
    // First, extract saleId from description for each entry
    const entriesWithSaleId = entries.map(entry => {
      let saleId = undefined;
      let isTmt = false;
      if (entry.description) {
        // Check for TMT Sale first (more specific)
        const tmtMatch = entry.description.match(/TMT Sale #(\d+)/i);
        if (tmtMatch) {
          saleId = tmtMatch[1];
          isTmt = true;
        } else {
          // Regular Sale
          const saleIdMatch = entry.description.match(/Sale #(\d+)/);
          if (saleIdMatch) {
            saleId = saleIdMatch[1];
          }
        }
      }
      return { ...entry, saleId, isTmt };
    });

    // Separate identifiers for Regular and TMT sales
    // Filter to only include entries linked to completed sales
    const regularSaleIds = entriesWithSaleId
      .filter(entry => entry.saleId && entry.type === 'sale_payment' && !entry.isTmt)
      .map(entry => Number(entry.saleId));

    // For TMT sales, we need to include IDs from both 'sale_payment' entries AND 'debit' entries that reference TMT sales
    const tmtSaleIds = entriesWithSaleId
      .filter(entry => {
        // Include normal sale_payment entries
        if (entry.saleId && entry.type === 'sale_payment' && entry.isTmt) return true;
        // Include debit entries that look like TMT sales
        if (entry.saleId && entry.type === 'debit' && entry.isTmt) return true;
        return false;
      })
      .map(entry => Number(entry.saleId));

    // Remove duplicates
    const uniqueTmtSaleIds = [...new Set(tmtSaleIds)];

    // Helper to map payment method enum to frontend format
    function mapPaymentMethodToFrontend(method: string): string {
      if (!method) return 'cash';
      switch (method.toUpperCase()) {
        case 'CASH': return 'cash';
        case 'CARD': return 'online';
        case 'UPI': return 'upi';
        case 'BANK_TRANSFER': return 'bank_transfer';
        case 'CHEQUE': return 'cheque';
        default: return method.toLowerCase();
      }
    }

    // Map to store homogenized sale data
    let salesById: { [key: string]: { finalAmount: number; paymentMethod?: string; paidAmount?: number; dueAmount?: number; paymentType?: string; partialPaymentMethod?: string; items?: Array<{ name: string; quantity: number; unit: string; price_per_unit?: number; unitPrice?: number }> } } = {};

    // 1. Fetch Regular Sales
    if (regularSaleIds.length > 0) {
      // Only fetch completed sales - this ensures only completed sales appear in ledger
      const sales = await prisma.sale.findMany({
        where: {
          id: { in: regularSaleIds },
          paymentStatus: { in: ['COMPLETED', 'PENDING'] } // Include both completed and active sales
        },
        select: {
          id: true,
          finalAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          notes: true,
          items: {
            include: {
              product: {
                select: { name: true, unit: true }
              }
            }
          }
        }
      });

      const regularSalesMap = Object.fromEntries(
        sales.map((sale: any) => {
          // Use 'regular-' prefix for keys to handle mapping cleanly
          const finalAmount = Number(sale.finalAmount);
          let paidAmount = 0;
          let dueAmount = 0;
          let paymentType = 'cash';
          let partialPaymentMethod = null;

          // Try to get paidAmount and dueAmount from Sale model fields first
          if ((sale as any).paidAmount !== undefined) {
            paidAmount = Number((sale as any).paidAmount);
            dueAmount = Number((sale as any).dueAmount ?? 0);
            if (paidAmount > 0 && paidAmount < finalAmount) {
              paymentType = 'partial';
              partialPaymentMethod = sale.paymentMethod ? mapPaymentMethodToFrontend(sale.paymentMethod) : 'UPI';
            } else if (paidAmount === finalAmount) {
              paymentType = sale.paymentMethod ? mapPaymentMethodToFrontend(sale.paymentMethod) : 'cash';
            } else {
              paymentType = 'loan';
            }
          }
          // Parse payment information from notes if available
          // CRITICAL: Notes parsing must happen first and must be preserved for partial payments
          if (sale.notes) {
            console.log('🔍 [Ledger] Checking notes for payment info:', {
              saleId: sale.id,
              notes: sale.notes,
              notesLength: sale.notes?.length
            });

            // Try multiple patterns to extract payment info
            // Format: "Partial Payment: ₹4000 via UPI, Due: ₹500"
            // Try exact format first (with Rupee symbol) - match the exact format from POST route
            // The format is: "Partial Payment: ₹{amount} via {method}, Due: ₹{due}"
            const loanMatch = sale.notes.match(/Loan\/Credit Sale: Full amount due \(₹(\d+(?:\.\d+)?)\)/i);
            const partialMatch = sale.notes.match(/Partial Payment:\s*₹(\d+(?:\.\d+)?)\s+via\s+(\w+),?\s+Due:\s*₹(\d+(?:\.\d+)?)/i) ||
              sale.notes.match(/Partial Payment: ₹(\d+(?:\.\d+)?) via (\w+), Due: ₹(\d+(?:\.\d+)?)/i);

            if (loanMatch && loanMatch[1]) {
              paidAmount = 0;
              dueAmount = Number(loanMatch[1]);
              paymentType = 'loan';
              console.log('🔍 [Ledger] ✅ Detected loan/credit sale from notes:', {
                saleId: sale.id,
                paidAmount,
                dueAmount,
                paymentType,
                notes: sale.notes
              });
            } else if (partialMatch && partialMatch[1] && partialMatch[3]) {
              paidAmount = Number(partialMatch[1]);
              dueAmount = Number(partialMatch[3]);
              paymentType = 'partial';
              // Store the partial payment method as-is (will be converted when displaying)
              // Convert to uppercase and map correctly (e.g., 'online' -> 'CARD', 'upi' -> 'UPI')
              const methodLower = (partialMatch[2] || '').toLowerCase();
              if (methodLower === 'online' || methodLower === 'card') {
                partialPaymentMethod = 'online'; // Frontend format
              } else {
                partialPaymentMethod = methodLower; // Keep as-is (upi, cash, etc.)
              }
              console.log('🔍 [Ledger] ✅ Parsed partial payment from notes (exact format):', {
                saleId: sale.id,
                paidAmount,
                dueAmount,
                partialPaymentMethod,
                originalMethod: partialMatch[2],
                notes: sale.notes
              });
            } else {
              // Try alternative format without strict spacing
              const altMatch = sale.notes.match(/Partial Payment.*?₹(\d+(?:\.\d+)?).*?via\s+(\w+).*?Due.*?₹(\d+(?:\.\d+)?)/i);
              if (altMatch && altMatch[1] && altMatch[3]) {
                paidAmount = Number(altMatch[1]);
                dueAmount = Number(altMatch[3]);
                paymentType = 'partial';
                // Store the partial payment method as-is (will be converted when displaying)
                const methodLower = (altMatch[2] || '').toLowerCase();
                if (methodLower === 'online' || methodLower === 'card') {
                  partialPaymentMethod = 'online'; // Frontend format
                } else {
                  partialPaymentMethod = methodLower; // Keep as-is (upi, cash, etc.)
                }
                console.log('🔍 [Ledger] ✅ Parsed partial payment from notes (alt format):', {
                  saleId: sale.id,
                  paidAmount,
                  dueAmount,
                  partialPaymentMethod,
                  originalMethod: altMatch[2],
                  notes: sale.notes
                });
              } else {
                // Try even more flexible pattern - just look for "Partial Payment" and amounts
                const flexibleMatch = sale.notes.match(/Partial Payment.*?(\d+(?:\.\d+)?).*?via.*?(\w+).*?Due.*?(\d+(?:\.\d+)?)/i);
                if (flexibleMatch && flexibleMatch[1] && flexibleMatch[3]) {
                  paidAmount = Number(flexibleMatch[1]);
                  dueAmount = Number(flexibleMatch[3]);
                  paymentType = 'partial';
                  const methodLower = (flexibleMatch[2] || '').toLowerCase();
                  if (methodLower === 'online' || methodLower === 'card') {
                    partialPaymentMethod = 'online';
                  } else {
                    partialPaymentMethod = methodLower;
                  }
                  console.log('🔍 [Ledger] ✅ Parsed partial payment from notes (flexible format):', {
                    saleId: sale.id,
                    paidAmount,
                    dueAmount,
                    partialPaymentMethod,
                    originalMethod: flexibleMatch[2],
                    notes: sale.notes
                  });
                } else {
                  console.log('🔍 [Ledger] ⚠️ No partial payment pattern matched in notes:', {
                    saleId: sale.id,
                    notes: sale.notes,
                    notesIncludesPartial: sale.notes.includes('Partial Payment'),
                    notesIncludesPartialCase: sale.notes.toLowerCase().includes('partial payment')
                  });
                }
              }
            }
          }

          // For COMPLETED or PENDING sales, check notes FIRST to detect partial payments or loans
          // This is critical - notes contain the actual payment information
          // Only if notes don't indicate partial payment or loan, then check paymentMethod
          if (sale.paymentStatus === 'COMPLETED' || sale.paymentStatus === 'PENDING') {
            // If we already parsed partial payment or loan from notes, keep it
            // Otherwise, check if amounts indicate partial payment
            if (paidAmount === 0 && dueAmount === 0) {
              if (paymentType === 'loan') {
                // Keep loan status if already detected from notes
                dueAmount = finalAmount;
              } else {
                // No amounts or loan parsed yet - determine from paymentMethod
                paidAmount = finalAmount;
                dueAmount = 0;
                // Use paymentMethod to determine payment type (same as active sales dashboard)
                if (sale.paymentMethod === 'CASH') {
                  paymentType = 'cash';
                } else if (sale.paymentMethod === 'CARD') {
                  paymentType = 'online';
                } else if (sale.paymentMethod === 'UPI' || sale.paymentMethod === 'BANK_TRANSFER' || sale.paymentMethod === 'CHEQUE') {
                  paymentType = 'online'; // Treat as online payment
                } else {
                  paymentType = 'cash'; // Default
                }
              }
            } else if (paidAmount > 0 && paidAmount < finalAmount) {
              // Amounts indicate partial payment - ensure paymentType is set correctly
              if (paymentType !== 'partial') {
                paymentType = 'partial';
                // Ensure partialPaymentMethod is set
                if (!partialPaymentMethod) {
                  partialPaymentMethod = sale.paymentMethod ? mapPaymentMethodToFrontend(sale.paymentMethod) : 'UPI';
                }
              }
            } else if (paidAmount === finalAmount) {
              // Fully paid - use actual payment method from sale (same logic as active sales)
              if (sale.paymentMethod === 'CASH') {
                paymentType = 'cash';
              } else if (sale.paymentMethod === 'CARD') {
                paymentType = 'online';
              } else if (sale.paymentMethod === 'UPI' || sale.paymentMethod === 'BANK_TRANSFER' || sale.paymentMethod === 'CHEQUE') {
                paymentType = 'online'; // Treat as online payment
              } else {
                paymentType = 'cash'; // Default
              }
            }
          }

          // If we parsed partial payment but amounts don't match finalAmount, adjust
          if (paymentType === 'partial' && paidAmount > 0 && dueAmount > 0) {
            const calculatedDue = finalAmount - paidAmount;
            if (Math.abs(dueAmount - calculatedDue) > 0.01) {
              console.log('🔍 [Ledger] Adjusting due amount to match:', {
                saleId: sale.id,
                originalDue: dueAmount,
                calculatedDue,
                finalAmount,
                paidAmount
              });
              dueAmount = calculatedDue;
            }
          }

          console.log('🔍 [Ledger] Sale payment info:', {
            saleId: sale.id,
            finalAmount,
            paidAmount,
            dueAmount,
            paymentType,
            partialPaymentMethod,
            paymentMethod: sale.paymentMethod,
            paymentStatus: sale.paymentStatus,
            hasNotes: !!sale.notes
          });

          return [`regular-${sale.id}`, {
            finalAmount,
            paymentMethod: sale.paymentMethod,
            paidAmount,
            dueAmount,
            paymentType,
            partialPaymentMethod,
            items: sale.items?.map((item: any) => ({
              name: item.product?.name || item.productName || 'Unknown',
              quantity: Number(item.quantity || 0),
              unit: (item as any).unit || (item as any).unitName || item.product?.unit || 'units',
              price_per_unit: Number(item.unitPrice || item.price_per_unit || 0)
            })) || []
          }];
        })
      );
      Object.assign(salesById, regularSalesMap);
    }

    // 2. Fetch TMT Sales
    // This now includes IDs from both sale_payment and debit entries
    if (uniqueTmtSaleIds.length > 0) {
      const tmtSales = await prisma.tmtSale.findMany({
        where: {
          id: { in: uniqueTmtSaleIds.map(id => BigInt(id)) },
          // Remove strict 'COMPLETED' verification here to allow fetching data for debit entries
          // We will handle filtering later
        },
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true, // ADDED
          dueAmount: true, // ADDED
          paymentStatus: true,
          status: true, // Also fetch status
          notes: true,
          paymentMethod: true,
          items: {
            include: {
              product: {
                select: { productName: true }
              }
            }
          }
        }
      });

      const tmtSalesMap = Object.fromEntries(
        tmtSales.map((sale: any) => {
          // Map TMT fields to the common structure
          const finalAmount = Number(sale.totalAmount) || 0;

          // Use actual DB values for paid/due if available
          let paidAmount = sale.paidAmount ? Number(sale.paidAmount) : 0;
          let dueAmount = sale.dueAmount ? Number(sale.dueAmount) : 0;

          // Fallback/Validation logic
          // If dueAmount is 0 and paidAmount is 0 but status is PAID, assume full payment
          const status = sale.paymentStatus || sale.status;

          if (status === 'PAID' || status === 'COMPLETED') {
            if (paidAmount === 0 && dueAmount === 0) {
              paidAmount = finalAmount;
            }
          }

          // Ensure dueAmount is consistent
          if (dueAmount === 0 && paidAmount < finalAmount && status !== 'PAID' && status !== 'COMPLETED') {
            dueAmount = finalAmount - paidAmount;
          }

          let paymentType = 'cash';
          let partialPaymentMethod = null;

          if (paidAmount > 0 && paidAmount < finalAmount) {
            paymentType = 'partial';
            // Try to map method
            if (sale.paymentMethod) {
              // clean up method string
              const methodStr = String(sale.paymentMethod).toLowerCase();
              if (methodStr.includes('upi')) partialPaymentMethod = 'upi';
              else if (methodStr.includes('card')) partialPaymentMethod = 'card';
              else if (methodStr.includes('cash')) partialPaymentMethod = 'cash';
              else partialPaymentMethod = methodStr;
            }
          } else if (paidAmount === 0) {
            paymentType = 'loan'; // Credit / Unpaid
          } else {
            paymentType = 'cash'; // Fully paid
          }

          // Debug check for manual overrides in notes
          // Try to parse notes for TMT as well (reuse similar logic or simple extraction)
          if (sale.notes) {
            const partialMatch = sale.notes.match(/Partial Payment.*?₹(\d+(?:\.\d+)?).*?via\s+(\w+).*?Due.*?₹(\d+(?:\.\d+)?)/i);
            if (partialMatch) {
              paidAmount = Number(partialMatch[1]);
              dueAmount = Number(partialMatch[3]);
              paymentType = 'partial';
              partialPaymentMethod = partialMatch[2].toLowerCase();
            }
          }

          return [`tmt-${sale.id}`, {
            finalAmount,
            paymentMethod: sale.paymentMethod || 'CASH', // Use actual TMT paymentMethod if available
            paidAmount,
            dueAmount,
            paymentType,
            partialPaymentMethod,
            items: (sale.items && sale.items.length > 0) ? sale.items.map((item: any) => ({
              name: item.product?.productName || item.productName || 'TMT Product',
              quantity: Number(item.quantity || 0),
              unit: item.unitType || 'units',
              price_per_unit: Number(item.unitPrice || 0)
            })) : [{
              // Fallback if no items found in DB relation
              name: 'TMT Material', // Generic name to avoid "TMT Sale #"
              quantity: 1,
              unit: 'lot',
              price_per_unit: finalAmount
            }]
          }];
        })
      );

      Object.assign(salesById, tmtSalesMap);
    }

    // Helper to map payment method enum to label
    function mapPaymentMethodLabel(method: string) {
      if (!method) return '';
      switch (method) {
        case 'CASH': return 'Cash';
        case 'CARD': return 'Online/Card'; // Match active sales dashboard display
        case 'UPI': return 'UPI';
        case 'BANK_TRANSFER': return 'Bank Transfer';
        case 'CHEQUE': return 'Cheque';
        case 'OTHER': return 'Loan';
        default: return method;
      }
    }

    // Filter entries to only include those linked to completed sales
    // Only completed sales are in salesById (keys are strings now)
    const completedSaleKeys = new Set(Object.keys(salesById));

    // Log for debugging
    const allSaleIdsFromEntries = new Set(
      entriesWithSaleId
        .filter(e => e.saleId)
        .map(e => e.isTmt ? `tmt-${e.saleId}` : `regular-${e.saleId}`)
    );
    const activeSaleIds = Array.from(allSaleIdsFromEntries).filter(key => !completedSaleKeys.has(key));
    if (activeSaleIds.length > 0) {
      console.log('🔍 [Ledger] Filtering out active sales from ledger:', activeSaleIds);
    }

    // Track which sales we have already included as a "Purchase" entry to prevent duplicates
    const seenSaleIds = new Set<string>();

    const entriesForCompletedSales = entriesWithSaleId.filter(entry => {
      // Include loan_clearing entries (payments)
      if (entry.type === 'loan_clearing') return true;

      const amount = Number(entry.amount) || 0;
      const isNegative = amount < 0;

      // Handle Manual Credit Entries (Payments)
      // Check if this credit corresponds to a TMT sale we are already showing
      if (entry.type === 'credit') {
        if (entry.description) {
          const match = entry.description.match(/Matches TMT Sale #(\d+)/i);
          if (match) {
            const tmtKey = `tmt-${match[1]}`;
            // If we have the sale in our map, we are displaying it as a "Sale" row with Paid/Due info.
            // We must hide this separate credit entry to avoid double counting/visual clutter.
            if (salesById[tmtKey]) {
              console.log(`🔍 [Ledger] Consolidating credit entry ${entry.id} into TMT Sale ${tmtKey}`);
              return false; // HIDE this entry, it's merged into the sale row
            }
          }
        }
        return true; // Keep other credit entries
      }

      // For sale_payment entries, only include if linked to a completed sale
      // ADDED: Deduplication logic
      if (entry.type === 'sale_payment') {
        if (!entry.saleId) {
          // Entry without saleId - keep it if it's a manual purchase (positive amount)
          // or a manual payment (negative amount).
          return true;
        }
        const saleKey = entry.isTmt ? `tmt-${entry.saleId}` : `regular-${entry.saleId}`;
        const isCompleted = completedSaleKeys.has(saleKey);

        if (isCompleted) {
          // If it's a payment (credit), we want to consolidate it into the main sale row
          // So we strip this entry, as the main sale row will show the total paid amount
          if (isNegative) {
            console.log(`🔍 [Ledger] Consolidating payment entry ${entry.id} into sale row (${saleKey})`);
            return false;
          }

          // If it's a positive amount (Purchase), check if we've already seen this sale
          if (!isNegative) {
            if (seenSaleIds.has(saleKey)) {
              console.log(`🔍 [Ledger] Skipping duplicate purchase entry ${entry.id} for ${saleKey}`);
              return false;
            }
            seenSaleIds.add(saleKey);
          }
          return true;
        }
        // Only include if the sale is in our completed sales map
        return isCompleted;
      }

      // Include manually added debit entries (TMT sales) if we found the sale data
      if (entry.type === 'debit') {
        if (entry.isTmt && entry.saleId) {
          const saleKey = `tmt-${entry.saleId}`;
          if (completedSaleKeys.has(saleKey)) {
            if (seenSaleIds.has(saleKey)) {
              console.log(`🔍 [Ledger] Skipping duplicate debit entry ${entry.id} for ${saleKey}`);
              return false;
            }
            seenSaleIds.add(saleKey);
            return true;
          }
        }
        return true; // Keep other manual debits
      }

      // Exclude all other types
      return false;
    });

    console.log('🔍 [Ledger] Filtered entries:', {
      totalEntries: entriesWithSaleId.length,
      completedEntries: entriesForCompletedSales.length,
      completedSales: completedSaleKeys.size,
      activeSalesFiltered: activeSaleIds.length
    });

    // Now process entries for frontend
    let processedEntries = entriesForCompletedSales.map(entry => {
      const amount = Number(entry.amount) || 0;

      // Determine if Debit or Credit based on type AND amount
      // sale_payment can be negative (Credit/Payment) or positive (Debit/Purchase)
      let isDebit = entry.type === 'debit';
      let isCredit = entry.type === 'loan_clearing' || entry.type === 'credit';

      if (entry.type === 'sale_payment') {
        if (amount < 0) {
          isCredit = true;
          isDebit = false;
        } else {
          isDebit = true;
          isCredit = false;
        }
      }

      let total = Math.abs(amount);
      let paid = 0;
      let due = 0;
      let paymentMode = '-';
      let isPartial = false;
      let items: Array<{ name: string; quantity: number; price: number; unit: string }> = [];

      if (isDebit) {
        // For sale_payment entries (should only be for completed sales now)
        const saleKey = entry.isTmt ? `tmt-${entry.saleId}` : `regular-${entry.saleId}`;

        // If it's a sale_payment and we have the sale info, use it
        // UPDATE: Also include 'debit' entries if they are linked to a TMT sale we have info for
        if ((entry.type === 'sale_payment' || entry.type === 'debit') && entry.saleId && salesById[saleKey]) {
          const saleInfo = salesById[saleKey];
          total = saleInfo.finalAmount;
          // Determine paid/due and whether partial by comparing amounts
          // For TMT sales, paidAmount might be 0 if it's a debit entry (representing the purchase)
          // So we should rely on the Sale object's data, which is correct.
          paid = typeof saleInfo.paidAmount === 'number' ? saleInfo.paidAmount : 0;
          due = typeof saleInfo.dueAmount === 'number' ? saleInfo.dueAmount : Math.max(total - paid, 0);
          isPartial = paid > 0 && paid < total;

          // Format payment mode correctly (same format as active sales dashboard)
          // Use paymentType from saleInfo (which matches active sales dashboard logic)
          // Also check if amounts indicate partial payment even if paymentType wasn't set correctly
          let paymentTypeFromSale = saleInfo.paymentType || 'cash';

          // If amounts indicate partial payment but paymentType is not set to 'partial', fix it
          // Also ensure partialPaymentMethod is set correctly
          if (isPartial && paymentTypeFromSale !== 'partial') {
            paymentTypeFromSale = 'partial';
            // If partialPaymentMethod is not set, derive it from paymentMethod
            if (!saleInfo.partialPaymentMethod && saleInfo.paymentMethod) {
              // Convert paymentMethod enum to frontend format for partialPaymentMethod
              const paymentMethodEnum = saleInfo.paymentMethod as string;
              if (paymentMethodEnum === 'CASH') {
                saleInfo.partialPaymentMethod = 'cash';
              } else if (paymentMethodEnum === 'CARD') {
                saleInfo.partialPaymentMethod = 'online';
              } else if (paymentMethodEnum === 'UPI') {
                saleInfo.partialPaymentMethod = 'upi';
              } else if (paymentMethodEnum === 'BANK_TRANSFER') {
                saleInfo.partialPaymentMethod = 'bank_transfer';
              } else if (paymentMethodEnum === 'CHEQUE') {
                saleInfo.partialPaymentMethod = 'cheque';
              } else {
                saleInfo.partialPaymentMethod = 'cash'; // Default
              }
            }
            console.log('🔍 [Ledger] Detected partial payment from amounts, updating paymentType:', {
              saleId: entry.saleId,
              paid,
              due,
              total,
              originalPaymentType: saleInfo.paymentType,
              updatedPaymentType: paymentTypeFromSale,
              partialPaymentMethod: saleInfo.partialPaymentMethod,
              paymentMethod: saleInfo.paymentMethod
            });
          }

          if (paymentTypeFromSale === 'partial') {
            // Partial payment - show partial with the correct payment method
            // Use partialPaymentMethod if available (from notes or sale), otherwise use paymentMethod from sale
            let methodToMap = saleInfo.partialPaymentMethod;
            let methodEnum: string;

            if (!methodToMap) {
              // If partialPaymentMethod not set, use paymentMethod from sale
              // paymentMethod is stored as enum (e.g., 'CARD', 'CASH', 'UPI')
              methodEnum = (saleInfo.paymentMethod || 'CASH') as string;
            } else {
              // partialPaymentMethod might be in lowercase frontend format (e.g., 'upi', 'cash', 'online')
              // Convert it to enum format for proper mapping
              let methodUpper = methodToMap.toUpperCase();
              // Handle frontend format mappings
              if (methodUpper === 'ONLINE' || methodUpper === 'CARD') {
                methodEnum = 'CARD';
              } else if (methodUpper === 'CASH') {
                methodEnum = 'CASH';
              } else if (methodUpper === 'UPI') {
                methodEnum = 'UPI';
              } else if (methodUpper === 'BANK_TRANSFER') {
                methodEnum = 'BANK_TRANSFER';
              } else if (methodUpper === 'CHEQUE') {
                methodEnum = 'CHEQUE';
              } else {
                // If it's not a standard enum value, try to use paymentMethod from sale
                methodEnum = (saleInfo.paymentMethod || 'CASH') as string;
              }
            }

            const methodLabel = mapPaymentMethodLabel(methodEnum);
            paymentMode = methodLabel ? `Partial ${methodLabel}` : 'Partial Payment';
            console.log('🔍 [Ledger] Setting partial payment mode:', {
              saleId: entry.saleId,
              paymentType: paymentTypeFromSale,
              partialPaymentMethod: saleInfo.partialPaymentMethod,
              paymentMethod: saleInfo.paymentMethod,
              methodEnum,
              methodLabel,
              paymentMode,
              paid,
              due,
              total
            });
          } else if (paymentTypeFromSale === 'loan') {
            // Loan/credit sale
            paymentMode = 'Loan/Credit';
            console.log('🔍 [Ledger] Setting loan payment mode:', {
              saleId: entry.saleId,
              paymentType: paymentTypeFromSale,
              paymentMode,
              paid,
              due,
              total
            });
          } else if (paymentTypeFromSale === 'online') {
            // Online/Card payment - use same label as active sales dashboard
            paymentMode = 'Online/Card';
            console.log('🔍 [Ledger] Setting online payment mode:', {
              saleId: entry.saleId,
              paymentType: paymentTypeFromSale,
              paymentMethod: saleInfo.paymentMethod,
              paymentMode,
              paid,
              due,
              total
            });
          } else {
            // Cash payment (default)
            paymentMode = 'Cash';
            console.log('🔍 [Ledger] Setting cash payment mode:', {
              saleId: entry.saleId,
              paymentType: paymentTypeFromSale,
              paymentMethod: saleInfo.paymentMethod,
              paymentMode,
              paid,
              due,
              total
            });
          }

          // Use actual sale items if available
          if (saleInfo.items && saleInfo.items.length > 0) {
            items = saleInfo.items.map((item: any) => ({
              name: item.product?.name || item.name || 'Unknown',
              quantity: Number(item.quantity || 0),
              price: Number(item.unitPrice || item.price_per_unit || 0),
              unit: (item as any).unit || item.product?.unit || 'units'
            }));
          } else {
            // Fallback to description if no items
            items = [{
              name: entry.description || 'Item',
              quantity: 1,
              price: amount,
              unit: 'units'
            }];
          }
        } else {
          // Fallback for manual 'debit' entries or sale_payment without sale info
          total = amount;

          // Determine if it was paid upfront based on the method
          // The database stores "OTHER" for loans, but the description has "[LOAN]" prepended usually.
          const isLoan = entry.method === 'OTHER' && entry.description?.includes('[LOAN]');

          if (isLoan) {
            paid = 0;
            due = Math.abs(amount);
            paymentMode = 'Loan';
          } else {
            // If it's CASH, UPI, CARD, etc., it means they paid for the purchase immediately
            paid = Math.abs(amount);
            due = 0;
            paymentMode = mapPaymentMethodLabel(entry.method) || entry.method;
          }

          // Try to parse description for item info if it looks like "Product Name (QTY unit)"
          // But usually manual entries might just be a description string
          let cleanDescription = entry.description || 'manual debit';
          if (cleanDescription.startsWith('[LOAN] ')) {
            cleanDescription = cleanDescription.substring(7); // Remove the [LOAN] prefix for the item name
          }

          items = [{
            name: cleanDescription,
            quantity: 1,
            price: amount,
            unit: 'units'
          }];
        }
      } else if (isCredit) {
        // For loan_clearing or Manual 'credit' entries
        paid = amount;
        due = 0;
        paymentMode = mapPaymentMethodLabel(entry.method) || 'Payment';
        items = [{
          name: entry.description || 'Payment',
          quantity: 1,
          price: amount,
          unit: 'units'
        }];
      }

      const qty = items.reduce((sum, item) => sum + item.quantity, 0);
      const price = items.length > 0 ? items[0].price : 0;

      const result = {
        id: Number(entry.id),
        saleId: entry.saleId || `entry-${Number(entry.id)}`,
        date: entry.date.toISOString().split('T')[0],
        time: entry.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        items,
        qty,
        price,
        total,
        paymentMode,
        isPartial,
        paid: Number(paid || 0), // Ensure it's a number
        due: Number(due || 0), // Ensure it's a number
        debitAmount: isDebit ? amount : 0, // for balance calculation
        creditAmount: isCredit ? amount : 0, // for balance calculation
        type: isDebit ? 'debit' : 'credit',
        description: items.length > 0 ? items.map(i => i.name).join(', ') : entry.description,
        isManual: entry.type === 'debit' || entry.type === 'credit' // Flag for UI if needed
      };

      // Debug log for entries with partial payments
      if (isDebit && paid > 0 && due > 0) {
        console.log('🔍 [Ledger] Returning entry with partial payment:', {
          id: result.id,
          paymentMode: result.paymentMode,
          paid: result.paid,
          due: result.due,
          total: result.total,
          isPartial: result.isPartial
        });
      }

      return result;
    });

    // Sort entries in ascending order for running balance calculation
    processedEntries.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id - b.id;
    });

    // Recalculate running balance in-memory
    // For debits: add the due amount (not full debit) to balance
    // For credits: subtract the credit amount from balance
    let runningBalance = 0;
    processedEntries = processedEntries.map(entry => {
      if (entry.type === 'debit') {
        // For sales: only add the due amount to balance (what customer owes)
        runningBalance += entry.due || 0;
      } else if (entry.type === 'credit') {
        // For payments: subtract from balance (customer paid)
        runningBalance -= entry.creditAmount || 0;
      }
      return { ...entry, runningBalance };
    });

    // Sort processed entries descending for display
    const processedEntriesSorted = [...processedEntries].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.id - a.id;
    });

    // Recalculate total count based on filtered entries (only completed sales + manual entries)
    // Count all ledger entries linked to completed sales OR manual entries
    const allLedgerEntries = await prisma.customerLedgerEntry.findMany({
      where,
      select: {
        id: true,
        type: true,
        description: true
      }
    });

    // Get completed sale IDs
    const completedSaleIdsSet = new Set<string>();

    if (regularSaleIds.length > 0) {
      const completedRegular = await prisma.sale.findMany({
        where: {
          id: { in: regularSaleIds },
          paymentStatus: 'COMPLETED'
        },
        select: { id: true }
      });
      completedRegular.forEach(s => completedSaleIdsSet.add(`regular-${s.id}`));
    }

    // Add TMT Sale IDs to the set
    if (tmtSaleIds.length > 0) {
      const completedTmt = await prisma.tmtSale.findMany({
        where: {
          id: { in: tmtSaleIds.map(id => BigInt(id)) },
          status: 'COMPLETED'
        },
        select: { id: true }
      });
      completedTmt.forEach(s => completedSaleIdsSet.add(`tmt-${s.id}`));
    }

    // Include PENDING (Active) sales in the set too, so they are not filtered out of the ledger
    const activeRegular = await prisma.sale.findMany({
      where: {
        id: { in: regularSaleIds },
        paymentStatus: 'PENDING'
      },
      select: { id: true }
    });
    activeRegular.forEach(s => completedSaleIdsSet.add(`regular-${s.id}`));

    const activeTmt = await prisma.tmtSale.findMany({
      where: {
        id: { in: tmtSaleIds.map(id => BigInt(id)) },
        status: { not: 'COMPLETED' } // Simplified for TMT
      },
      select: { id: true }
    });
    activeTmt.forEach(s => completedSaleIdsSet.add(`tmt-${s.id}`));

    // Count entries linked to completed sales plus all loan_clearing entries
    const filteredTotal = allLedgerEntries.filter(entry => {
      if (entry.type === 'loan_clearing') return true;

      // Check for Manual Credit Entries to be excluded
      if (entry.type === 'credit') {
        if (entry.description) {
          const match = entry.description.match(/Matches TMT Sale #(\d+)/i);
          if (match) {
            const tmtKey = `tmt-${match[1]}`;
            if (salesById[tmtKey]) {
              return false; // Exclude from count as it is merged
            }
          }
        }
        return true;
      }

      if (entry.type === 'debit') {
        // Include TMT debit entries if we have the sale data
        if (entry.description) {
          const match = entry.description.match(/TMT Sale #(\d+)/i);
          if (match) {
            const tmtKey = `tmt-${match[1]}`;
            return salesById.hasOwnProperty(tmtKey);
          }
        }
        return true; // Keep other debits
      }

      if (entry.type === 'sale_payment') {
        // If it lacks a saleId, it's a manual entry from POST /api/ledger, so count it!
        // We look at the description as a safeguard, but standard manual entries
        // don't have saleIds and should always be counted.
        // Let's check if it matches a sale from description for TMT or Regular sales
        // that we explicitly ignore unless completed.
        if (entry.description) {
          const tmtMatch = entry.description.match(/TMT Sale #(\d+)/i);
          if (tmtMatch) {
            return completedSaleIdsSet.has(`tmt-${tmtMatch[1]}`);
          }
          const saleIdMatch = entry.description.match(/Sale #(\d+)/);
          if (saleIdMatch) {
            return completedSaleIdsSet.has(`regular-${saleIdMatch[1]}`);
          }
        }

        // If it didn't match the specific "Sale #X" generated format,
        // it's a manual entry (e.g. "Purchase - CASH"), so count it.
        return true;
      }
      return false;
    }).length;

    // Helper function to serialize BigInt values
    const serializeBigInt = (obj: any): any => {
      return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    };

    const responseData = serializeBigInt({
      entries: processedEntriesSorted,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
      },
      customer: {
        id: customer.id,
        name: customer.name,
        isActive: customer.isActive
      }
    });

    // Debug: Log first entry with partial payment
    if (responseData.entries && responseData.entries.length > 0) {
      const firstEntry = responseData.entries[0];
      if (firstEntry.isPartial || firstEntry.paid || firstEntry.due) {
        console.log('🔍 [Ledger] Final API response entry:', {
          id: firstEntry.id,
          paymentMode: firstEntry.paymentMode,
          paid: firstEntry.paid,
          due: firstEntry.due,
          total: firstEntry.total,
          isPartial: firstEntry.isPartial,
          runningBalance: firstEntry.runningBalance
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Get ledger entries error:', error);
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
      message: 'Failed to fetch ledger entries',
      code: 'FETCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}

// POST - Add ledger entry
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

    const body = await req.json();
    // Accept both paymentMethod and method for backward compatibility
    let { customerId, date, amount, type, paymentMethod, method, purpose, description, items } = body;
    if (!paymentMethod && method) paymentMethod = method;

    // Convert payment method to uppercase to match the enum
    if (paymentMethod) {
      paymentMethod = paymentMethod.toUpperCase();
    }

    // Handle LOAN which is not a valid enum value in prisma schema
    let dbPaymentMethod = paymentMethod;
    let finalDescription = description || `${type === 'debit' ? 'Purchase' : 'Payment'} - ${paymentMethod || ''}`;

    if (paymentMethod === 'LOAN') {
      dbPaymentMethod = 'OTHER';
      finalDescription = '[LOAN] ' + finalDescription;
    }

    // Since there's no CustomerLedgerItem model in the given schema block,
    // we'll append the item details to the description so it displays correctly.
    if (items && items.length > 0) {
      const itemsStr = items.map((item: any) => `${item.name} (${item.quantity} ${item.unit || 'units'} @ ₹${item.price})`).join(', ');
      finalDescription = `${itemsStr} | ${finalDescription}`;
    }

    if (!customerId || !date || !amount || !type) {
      return NextResponse.json({
        success: false,
        message: 'Customer ID, date, amount, and type are required',
        code: 'MISSING_REQUIRED_FIELDS'
      }, { status: 400 });
    }

    // Get shop filter to determine shopId
    const shopFilter = await getShopFilter(token);
    let shopId = 1; // Default shop ID

    if (Object.keys(shopFilter).length > 0 && shopFilter.shopId) {
      if (Array.isArray(shopFilter.shopId.in) && shopFilter.shopId.in.length > 0) {
        shopId = shopFilter.shopId.in[0];
      } else if (typeof shopFilter.shopId === 'number') {
        shopId = shopFilter.shopId;
      }
    }

    // Determine if it's a debit or credit to calculate running balance
    const isDebit = type === 'debit';
    const amountVal = parseFloat(amount);
    
    // We update the Customer's balance atomically while creating the ledger entry
    // A nested update means we only do 1 round trip instead of downloading all entries
    const customerUpdate = await prisma.customer.update({
      where: { id: parseInt(customerId) },
      data: {
        currentBalance: {
          [isDebit ? 'increment' : 'decrement']: amountVal
        },
        ledgerEntries: {
          create: {
            amount: amountVal,
            type: isDebit ? 'sale_payment' : 'loan_clearing',
            method: dbPaymentMethod || 'CASH',
            date: new Date(date),
            description: finalDescription,
            shopId,
            isActive: true
          }
        }
      },
      include: {
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const ledgerEntry = customerUpdate.ledgerEntries[0];

    // Convert BigInt values to numbers for JSON serialization
    const serializedEntry = {
      id: Number(ledgerEntry.id),
      customerId: Number(ledgerEntry.customerId),
      amount: Number(ledgerEntry.amount),
      type: ledgerEntry.type,
      method: ledgerEntry.method,
      date: ledgerEntry.date,
      description: ledgerEntry.description,
      shopId: Number(ledgerEntry.shopId),
      isActive: ledgerEntry.isActive,
      createdAt: ledgerEntry.createdAt,
      updatedAt: ledgerEntry.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: 'Ledger entry added successfully',
      data: { entry: serializedEntry }
    });

  } catch (error) {
    console.error('Add ledger entry error:', error);
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
      message: 'Failed to add ledger entry',
      code: 'CREATE_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
} 