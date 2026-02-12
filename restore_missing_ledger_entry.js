
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreMissingLedgerEntry() {
    const saleId = 40; // The ID of the missing sale (Found via diagnose_ledger.js)
    console.log(` Attempting to restore ledger entry for Sale #${saleId}...`);

    try {
        // 1. Fetch the sale
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!sale) {
            console.error(` Sale #${saleId} not found!`);
            return;
        }

        console.log(` Found Sale #${saleId}:`, {
            customerId: sale.customerId,
            amount: sale.finalAmount,
            date: sale.saleDate,
            shopId: sale.shopId,
        });

        // 2. Double check if ledger entry exists
        const existingEntry = await prisma.customerLedgerEntry.findFirst({
            where: {
                customerId: sale.customerId,
                description: { contains: `Sale #${saleId}` }
            }
        });

        if (existingEntry) {
            console.log(` Ledger entry already exists: ID ${existingEntry.id}`);
            return;
        }

        // 3. Create the ledger entry
        // Construct description carefully
        const description = sale.notes
            ? `${sale.notes} (Sale #${saleId})`
            : `Sale #${saleId}`;

        // Construct items for ledger description/metadata if needed, but primarily description links it
        const itemsWithUnit = sale.items.map((item) => ({
            name: item.product?.name || '',
            quantity: Number(item.quantity),
            price_per_unit: Number(item.unitPrice),
            unit: item.unit || 'units'
        }));

        console.log(` Creating new ledger entry...`);

        // Using prisma.$transaction to ensure consistency if we were doing more, but single create is fine
        const newEntry = await prisma.customerLedgerEntry.create({
            data: {
                customerId: sale.customerId,
                amount: new Prisma.Decimal(sale.finalAmount),
                type: 'sale_payment',
                method: 'CASH', // Defaulting to CASH as per schema or sale method
                date: sale.saleDate,
                description: description,
                shopId: sale.shopId,
                isActive: true
                // items: ... (CustomerLedgerEntry doesn't have items relation in schema shown, it's a separate json/relation?)
                // Schema says: model CustomerLedgerEntry { ... } no items field. 
                // Wait, app/lib/ledgerUtils.js creates entry with items? 
                // Let's check schema again. 
                // schema.prisma: model CustomerLedgerEntry { ... } 
                // It does NOT have 'items' field or relation. 
                // But app/api/ledger/route.ts returns items? 
                // Ah, `app/lib/ledgerUtils.js` usually handles this. 
                // Let's look at `createPurchaseEntry` in `app/lib/ledgerUtils.js` again.
                // It takes `items` but... 
                // "Note: CustomerLedgerItem model doesn't exist in current schema"
                // "Ledger entries are simplified to just track amounts and descriptions"
                // So we just create the entry with description.
            }
        });

        console.log(` Successfully created Ledger Entry #${newEntry.id}`);
        console.log(` Description: ${newEntry.description}`);
        console.log(` Amount: ${newEntry.amount}`);

    } catch (error) {
        console.error(' Error restoring ledger entry:', error);
    } finally {
        await prisma.$disconnect();
    }
}

restoreMissingLedgerEntry();
