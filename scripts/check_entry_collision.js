const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- CHECK ENTRY COLLISION START ---');

    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            description: { contains: 'Sale #' }
        },
        select: {
            id: true,
            description: true,
            type: true
        }
    });

    const saleMap = {};

    for (const entry of entries) {
        let saleId = null;
        let isTmt = false;

        const tmtMatch = entry.description.match(/TMT Sale #(\d+)/i);
        if (tmtMatch) {
            saleId = 'tmt-' + tmtMatch[1];
            isTmt = true;
        } else {
            const match = entry.description.match(/Sale #(\d+)/i);
            if (match) {
                saleId = 'reg-' + match[1];
            }
        }

        if (saleId) {
            if (!saleMap[saleId]) {
                saleMap[saleId] = { types: new Set(), entries: [] };
            }
            saleMap[saleId].types.add(entry.type);
            saleMap[saleId].entries.push({ id: entry.id, type: entry.type, desc: entry.description });
        }
    }

    const collisions = Object.entries(saleMap).filter(([id, data]) => {
        return data.types.has('sale_payment') && data.types.has('debit');
    });

    console.log(`Found ${collisions.length} sales with BOTH 'sale_payment' and 'debit' entries.`);

    collisions.forEach(([id, data]) => {
        console.log(`\nSale ${id}:`);
        data.entries.forEach(e => console.log(`  - [${e.type}] ${e.desc} (ID: ${e.id})`));
    });

    const debitOnly = Object.entries(saleMap).filter(([id, data]) => {
        return !data.types.has('sale_payment') && data.types.has('debit') && id.startsWith('tmt-');
    });

    console.log(`\nFound ${debitOnly.length} TMT sales with ONLY 'debit' entries (no sale_payment).`);
    // Sample a few
    debitOnly.slice(0, 5).forEach(([id, data]) => {
        console.log(`\nSale ${id}:`);
        data.entries.forEach(e => console.log(`  - [${e.type}] ${e.desc} (ID: ${e.id})`));
    });

    await prisma.$disconnect();
}

main();
