
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting TMT Ledger Backfill...');

    // 1. Fetch all COMPLETED TMT sales that have a customerId
    const completedTmtSales = await prisma.tmtSale.findMany({
        where: {
            status: 'COMPLETED',
            customerId: {
                not: null
            }
        },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    console.log(`Found ${completedTmtSales.length} completed TMT sales.`);

    for (const sale of completedTmtSales) {
        if (!sale.customerId) continue;

        // 2. Check if a ledger entry already exists for this sale
        // We check for the specific description pattern used for TMT sales
        const descriptionPattern = `TMT Sale #${sale.id}`;

        const existingEntry = await prisma.customerLedgerEntry.findFirst({
            where: {
                customerId: sale.customerId,
                description: {
                    contains: descriptionPattern
                },
                isActive: true
            }
        });

        if (existingEntry) {
            console.log(`[SKIP] Ledger entry already exists for TMT Sale #${sale.id}`);
            continue;
        }

        console.log(`[CREATE] Creating ledger Purchase entry for TMT Sale #${sale.id} (Customer: ${sale.customerId})`);

        // 3. Create the Purchase Entry (Debit)
        // Matches logic in createPurchaseEntry from ledgerUtils

        // Construct items list for description if needed, or just use generic
        // We don't store items in ledger entry model usually, but sometimes in description?
        // The current ledgerUtils puts items in a separate structure if it existed, but here we just create the entry.
        // The description is the key linker.

        const description = `[COMPLETED] TMT Sale #${sale.id}`;

        await prisma.customerLedgerEntry.create({
            data: {
                customerId: sale.customerId,
                amount: sale.totalAmount,
                type: 'sale_payment', // 'sale_payment' is used for Debits/Purchases in this system
                method: 'CASH', // Default method, or could derive from sale.paymentMethod
                date: sale.saleDate,
                description: description,
                shopId: sale.shopId,
                isActive: true,
                // createdAt and updatedAt are auto-managed
            }
        });

        // 4. Note on Payment Entries
        // TMT POST handler creates payment entries separately. 
        // We assume those were created correctly if paidAmount > 0.
        // If we wanted to be thorough, we'd check for those too, but the user specifically asked for "the completed sale" 
        // which implies the purchase record.
    }

    console.log('Backfill completed successfully.');
}

main()
    .catch((e) => {
        console.error('Error during backfill:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
