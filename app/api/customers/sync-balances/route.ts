import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/customers/sync-balances
 * Recalculates currentBalance for all customers based on ledger entries.
 * Uses sum of all ledger amounts (positive = debit, negative = credit).
 * This fixes stale currentBalance values caused by the old sales route
 * not creating payment entries for cash/online sales.
 */
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

    const shopFilter = await getShopFilter(token);

    // Fetch all active customers, optionally filtered by shop
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ...(shopFilter as any)
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        ledgerEntries: {
          where: { isActive: true },
          select: { amount: true }
        }
      }
    });

    let updated = 0;
    let skipped = 0;

    for (const customer of customers) {
      // Sum all ledger amounts: positive = debit (owes), negative = credit (paid)
      const realBalance = customer.ledgerEntries.reduce((sum, entry) => {
        return sum + Number(entry.amount);
      }, 0);

      const correctedBalance = Math.max(0, realBalance);
      const storedBalance = Number(customer.currentBalance);

      // Only update if there's a meaningful difference (> 1 rupee to avoid float noise)
      if (Math.abs(correctedBalance - storedBalance) > 1) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { currentBalance: correctedBalance }
        });
        console.log(`✅ Fixed customer ${customer.name} (${customer.id}): ${storedBalance} → ${correctedBalance}`);
        updated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete. Updated ${updated} customers, ${skipped} were already correct.`,
      data: { updated, skipped, total: customers.length }
    });

  } catch (error) {
    console.error('Sync customer balances error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to sync customer balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
