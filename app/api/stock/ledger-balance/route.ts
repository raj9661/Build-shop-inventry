import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';
import { serializeBigInt } from '@/app/lib/serializationUtils';


// GET - Calculate stock balance from ledger vs product stockQuantity
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const shopFilter = await getShopFilter(token);

    const whereClause: any = { isActive: true };
    if (productId) whereClause.id = BigInt(productId);
    Object.assign(whereClause, shopFilter);

    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        unit: true
      }
    });

    const reconciliation = await Promise.all(products.map(async (product) => {
      const ledgerSum = await prisma.stockLedger.aggregate({
        where: {
          productId: product.id,
          shopId: { in: (shopFilter as any).shopId?.in || [(shopFilter as any).shopId] }
        },
        _sum: {
          cftQuantity: true
        }
      });

      // transactionType logic: PURCHASE, ADJUSTMENT (positive) vs SALE, LOSS (negative)
      // Actually cftQuantity should be stored as positive/negative in future or handled here.
      // In my implementation:
      // PURCHASE -> created as positive totalCft in StockEntry loop
      // SALE -> created as positive totalCft in Sale loop? Wait, let's check.
      
      const transactions = await prisma.stockLedger.findMany({
        where: {
          productId: product.id,
          shopId: { in: (shopFilter as any).shopId?.in || [(shopFilter as any).shopId] }
        }
      });

      let calculatedBalance = 0;
      transactions.forEach(t => {
        if (['PURCHASE', 'ADJUSTMENT'].includes(t.transactionType)) {
          calculatedBalance += Number(t.cftQuantity);
        } else if (['SALE', 'LOSS'].includes(t.transactionType)) {
          calculatedBalance -= Number(t.cftQuantity);
        }
      });

      return {
        productId: product.id.toString(),
        productName: product.name,
        currentStock: Number(product.stockQuantity),
        ledgerBalance: calculatedBalance,
        difference: Number(product.stockQuantity) - calculatedBalance,
        status: (Number(product.stockQuantity) === calculatedBalance) ? 'MATCH' : 'MISMATCH'
      };
    }));

    return NextResponse.json({ success: true, data: reconciliation });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json({ success: false, message: 'Failed to reconcile stock' }, { status: 500 });
  }
}
