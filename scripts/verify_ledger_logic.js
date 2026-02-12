const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- VERIFY LEDGER LOGIC ---');

    // 1. Fetch relevant data (Simulate API fetching)
    const customerId = 1; // Sumit Kumar

    // Get entries
    const entries = await prisma.customerLedgerEntry.findMany({
        where: { customerId: customerId, isActive: true },
        orderBy: [{ date: 'desc' }, { id: 'desc' }]
    });

    // Get TMT Sales
    // Note: customerId is BigInt in TMT table? Let's check schema or just try Int. 
    // Actually schema usually has BigInt for IDs in TMT.
    // Let's safe cast.

    let tmtSales = [];
    try {
        tmtSales = await prisma.tmtSale.findMany({
            where: { customerId: BigInt(customerId) },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
    } catch (e) {
        console.log("Error fetching TMT sales with BigInt customerId, trying Int...");
        tmtSales = await prisma.tmtSale.findMany({
            where: { customerId: customerId },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
    }

    const salesById = {};
    // Simulate populating salesById for TMT
    tmtSales.forEach(sale => {
        const key = `tmt-${sale.id}`;
        // Create a mock sale object similar to what route.ts produces
        salesById[key] = {
            finalAmount: Number(sale.totalAmount),
            items: sale.items.map(i => ({
                name: i.productName || 'TMT Product',
                quantity: Number(i.quantity),
                unit: i.unitType,
                price: Number(i.unitPrice)
            })),
            paymentType: sale.status === 'COMPLETED' ? 'cash' : 'loan', // Simplified for test
        };
    });

    console.log(`Loaded ${entries.length} entries and ${tmtSales.length} TMT sales.`);

    // 2. Run the LOGIC we want to test (The fix)

    const results = entries.map(entry => {
        let isTmt = false;
        let saleId = null;

        if (entry.description) {
            const match = entry.description.match(/TMT Sale #(\d+)/i);
            if (match) {
                saleId = match[1];
                isTmt = true;
            }
        }

        const saleKey = isTmt ? `tmt-${saleId}` : `reg-${saleId}`;
        const saleInfo = salesById[saleKey];

        const OLD_LOGIC_RESULT = (entry.type === 'sale_payment' && saleInfo) ? "RICH_DATA" : "MANUAL_DEBIT";
        const NEW_LOGIC_RESULT = ((entry.type === 'sale_payment' || entry.type === 'debit') && saleInfo) ? "RICH_DATA" : "MANUAL_DEBIT";

        return {
            id: entry.id,
            type: entry.type,
            desc: entry.description,
            hasSaleInfo: !!saleInfo,
            oldResult: OLD_LOGIC_RESULT,
            newResult: NEW_LOGIC_RESULT,
            saleId: saleId
        };
    });

    // Filter for interesting ones
    const interesting = results.filter(r => r.type === 'debit' && r.hasSaleInfo);

    if (interesting.length > 0) {
        console.log(`\nFound ${interesting.length} 'debit' entries that SHOULD be rich but are currently manual:`);
        interesting.forEach(r => {
            console.log(`- ID ${r.id}: ${r.desc} -> Current: ${r.oldResult} | Fixed: ${r.newResult}`);
        });
    } else {
        console.log("No relevant 'debit' entries found to verify fix against.");
    }

    // Also check for entries that are 'sale_payment' AND have sale info (should be RICH in both)
    const correctlyRich = results.filter(r => r.type === 'sale_payment' && r.hasSaleInfo);
    console.log(`\nFound ${correctlyRich.length} 'sale_payment' entries that are continuously RICH (baseline check).`);

    await prisma.$disconnect();
}

main();
