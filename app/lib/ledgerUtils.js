/**
 * Utility functions for customer ledger operations
 */

const { PrismaClient, Prisma } = require('@prisma/client');

/**
 * Calculate and update running balances for customer ledger entries
 * @param {Object} tx - Prisma transaction object
 * @param {number} customerId - Customer ID
 * @param {Array} newEntries - Array of new ledger entries to process
 */
async function calculateRunningBalance(tx, customerId, newEntries) {
  try {
    const allEntries = await tx.customerLedgerEntry.findMany({
      where: { customerId, isActive: true },
      orderBy: [{ date: 'asc' }, { id: 'asc' }]
    });

    let runningBalance = new Prisma.Decimal(0);

    // Correct formula:
    // - sale_payment with positive amount = debit (customer owes)
    // - sale_payment with negative amount = auto credit (from sales route)
    // - loan_clearing with positive amount = manual payment via ledger UI (SUBTRACT)
    for (const entry of allEntries) {
      const amount = entry.amount ? new Prisma.Decimal(entry.amount) : new Prisma.Decimal(0);
      if (entry.type === 'loan_clearing' || entry.type === 'item_return') {
        runningBalance = runningBalance.minus(amount);
      } else {
        // sale_payment: positive adds, negative subtracts naturally
        runningBalance = runningBalance.plus(amount);
      }
    }

    // Clamp to 0 minimum
    if (runningBalance.lt(0)) runningBalance = new Prisma.Decimal(0);

    try {
      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance: runningBalance }
      });
    } catch (updateError) {
      console.log('Note: currentBalance field may not exist in Customer model');
    }

    console.log(`Calculated running balance for customer ${customerId}: ${runningBalance}`);
  } catch (error) {
    console.error('Error calculating running balance:', error);
    console.log('Continuing without balance calculation...');
  }
}

/**
 * Get customer ledger entries with pagination and filters
 * @param {Object} tx - Prisma transaction object
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options
 * @returns {Object} Ledger entries and pagination info
 */
async function getCustomerLedger(tx, customerId, options = {}) {
  const {
    page = 1,
    limit = 20,
    from_date,
    to_date,
    type,
    method,
    purpose
  } = options;

  const skip = (page - 1) * limit;

  // Build where clause
  const where = { customerId };
  if (from_date || to_date) {
    where.date = {};
    if (from_date) where.date.gte = new Date(from_date);
    if (to_date) where.date.lte = new Date(to_date);
  }
  if (type) where.type = type;
  if (method) where.method = method;
  if (purpose) where.purpose = purpose;

  // Get ledger entries
  const entries = await tx.customerLedgerEntry.findMany({
    where,
    include: {
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          price: true,
          unit: true
        }
      }
    },
    orderBy: [
      { date: 'desc' },
      { time: 'desc' },
      { id: 'desc' }
    ],
    skip,
    take: parseInt(limit)
  });

  // Get total count
  const total = await tx.customerLedgerEntry.count({ where });

  return {
    entries,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Create a ledger entry for customer payment
 * @param {Object} tx - Prisma transaction object
 * @param {Object} paymentData - Payment data
 * @returns {Object} Created ledger entry
 */
async function createPaymentEntry(tx, paymentData) {
  const {
    customerId,
    amount,
    date,
    description,
    saleId = null,
    shopId = null
  } = paymentData;

  // Get customer to fetch shopId if not provided
  let finalShopId = shopId;
  if (!finalShopId) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    finalShopId = customer.shopId;
  }

  console.log('Creating credit entry with shopId:', finalShopId);
  // Create credit entry for payment
  const creditEntry = await tx.customerLedgerEntry.create({
    data: {
      customerId,
      amount: new Prisma.Decimal(amount),
      type: 'sale_payment',
      method: 'CASH', // Default to CASH, can be updated if needed
      date,
      description: description || `Payment received`,
      shopId: finalShopId,
      isActive: true,
    }
  });
  console.log('Created credit entry:', creditEntry.id);

  // Calculate running balance
  await calculateRunningBalance(tx, customerId, [creditEntry]);

  return creditEntry;
}

/**
 * Create a ledger entry for customer purchase/loan
 * @param {Object} tx - Prisma transaction object
 * @param {Object} purchaseData - Purchase data
 * @param {Object} [sale] - Optional sale object to enforce status
 * @returns {Object} Created ledger entry
 */
async function createPurchaseEntry(tx, purchaseData, sale) {
  const {
    customerId,
    amount,
    date,
    description,
    items = [],
    shopId = null
  } = purchaseData;

  // Enforce sale status if sale object is provided
  if (sale) {
    if (sale.paymentStatus !== 'COMPLETED' || sale.isActive !== true) {
      throw new Error('Sale must be completed and active to add to ledger.');
    }
  }

  // Get customer to fetch shopId if not provided
  let finalShopId = shopId;
  if (!finalShopId) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    finalShopId = customer.shopId;
  }

  console.log('Creating debit entry with shopId:', finalShopId);
  // Create debit entry for purchase
  const debitEntry = await tx.customerLedgerEntry.create({
    data: {
      customerId,
      amount: new Prisma.Decimal(amount),
      type: 'sale_payment',
      method: purchaseData.method || 'CASH', // Use provided method or default to CASH
      date,
      description: description || `Purchase`,
      shopId: finalShopId,
      isActive: true,
    }
  });
  console.log('Created debit entry:', debitEntry.id);

  // Note: CustomerLedgerItem model doesn't exist in current schema
  // Ledger entries are simplified to just track amounts and descriptions
  console.log('Ledger entry created successfully');

  // Calculate running balance
  await calculateRunningBalance(tx, customerId, [debitEntry]);

  return debitEntry;
}

/**
 * Get customer ledger summary
 * @param {Object} tx - Prisma transaction object
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options
 * @returns {Object} Ledger summary
 */
async function getCustomerLedgerSummary(tx, customerId, options = {}) {
  const { from_date, to_date } = options;

  // Build where clause
  const where = { customerId };
  if (from_date || to_date) {
    where.date = {};
    if (from_date) where.date.gte = new Date(from_date);
    if (to_date) where.date.lte = new Date(to_date);
  }

  // Get customer info
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      current_balance: true
    }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get ledger statistics
  const [totalDebits, totalCredits, entryCount] = await Promise.all([
    tx.customerLedgerEntry.aggregate({
      where: { ...where, type: 'debit' },
      _sum: { amount: true }
    }),
    tx.customerLedgerEntry.aggregate({
      where: { ...where, type: 'credit' },
      _sum: { amount: true }
    }),
    tx.customerLedgerEntry.count({ where })
  ]);

  return {
    customer,
    summary: {
      totalDebits: totalDebits._sum.amount || 0,
      totalCredits: totalCredits._sum.amount || 0,
      currentBalance: customer.current_balance,
      entryCount
    }
  };
}

/**
 * Validate ledger entry data
 * @param {Object} entryData - Entry data to validate
 * @returns {Object} Validation result
 */
function validateLedgerEntry(entryData) {
  const errors = [];

  if (!entryData.customerId) {
    errors.push('Customer ID is required');
  }

  if (!entryData.amount || entryData.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!entryData.type || !['debit', 'credit'].includes(entryData.type)) {
    errors.push('Type must be either debit or credit');
  }

  if (!entryData.method) {
    errors.push('Method is required');
  }

  if (!entryData.purpose) {
    errors.push('Purpose is required');
  }

  if (!entryData.date) {
    errors.push('Date is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  calculateRunningBalance,
  getCustomerLedger,
  createPaymentEntry,
  createPurchaseEntry,
  getCustomerLedgerSummary,
  validateLedgerEntry
}; 