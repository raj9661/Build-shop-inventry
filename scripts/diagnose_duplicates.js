const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNOSE DUPLICATES ---');

    // Fetch entries for today (approx) or just the last few
    const entries = await prisma.customerLedgerEntry.findMany({
        where: {
            customerId: 1, // Sumit Kumar
            // Filter slightly broadly to catch relevant items
        },
        orderBy: { id: 'desc' },
        take: 20
    });

    console.log(`Found ${entries.length} recent entries.`);

    entries.forEach(e => {
        let saleInfo = "N/A";
        const tmtMatch = e.description ? e.description.match(/TMT Sale #(\d+)/i) : null;
        if (tmtMatch) saleInfo = `TMT-${tmtMatch[1]}`;

        console.log(`ID: ${e.id} | Date: ${e.date.toISOString().split('T')[0]} ${e.date.toLocaleTimeString()} | Amt: ${e.amount} | Type: ${e.type} | Desc: ${e.description} | Linked: ${saleInfo}`);
    });

    await prisma.$disconnect();
}

main();
