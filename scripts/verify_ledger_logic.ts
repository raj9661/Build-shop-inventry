const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock request/response for local testing if needed, but easier to just call the logic or hit the endpoint if running.
// Since we are in dev, we can actually just invoke the logic or better yet, fetch from the running server.
// But we need a token. Let's write a script that generates a token and calls the API.
// Or effectively, since we have direct DB access, we can rely on `check_duplicate_ledger.js` but modified to verify "OUTPUT" structure if we were running the logic.
// actually, let's just make a script that simulates what `route.ts` does to verify our logic changes, OR we can use `fetch` if the app is running.
// The app IS running on localhost:3000. Let's try to fetch.

const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key'; // We might need to guess or view .env. 
// Actually, easier to just use the `check_ledger_logic.js` approach where we copy the critical logic to test it, 
// OR we can just modify `route.ts` and use the existing "check_duplicate_ledger.js" to print raw DB, 
// but we need to see the PROCESSED JSON response.

// Let's create a script that just logs in as a user (if possible) or creates a test token to hit the API.
// "login" might be hard without credentials.
// Let's assume we can generate a valid token if we know the secret.
// Let's look at `.env` to get the secret? No, we shouldn't read .env directly if possible.
// Actually, let's use a script that imports the app logic? No, Next.js app logic is hard to import in standalone scripts.

// FASTEST PATH: Just modify the code and look at the logs? 
// The user has `npm run dev` running. I can see the server logs.
// But I need to trigger the request.
// I can use `curl` if I have a token.
// How about I write a script that just queries the DB and runs the TRANSFORM logic locally?
// That confirms the logic fix works.

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
    const tmtSales = await prisma.tmtSale.findMany({
        where: { customerId: BigInt(customerId) },
        include: {
            items: {
                include: { product: true }
            }
        }
    });

    const salesById = {};
    // Simulate populating salesById for TMT
    tmtSales.forEach(sale => {
        const key = `tmt-${sale.id}`;
        salesById[key] = {
            finalAmount: Number(sale.totalAmount),
            items: sale.items.map(i => ({
                name: i.productName || 'TMT Product',
                quantity: Number(i.quantity),
                unit: i.unitType,
                price: Number(i.unitPrice)
            })),
            paymentType: sale.status === 'COMPLETED' ? 'cash' : 'loan', // Simplified for test
            // ... other fields
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

        // LOGIC TO TEST:
        // Current Logic in route.ts (simplified):
        // if (entry.type === 'sale_payment' && saleId && saleInfo) { ... use saleInfo ... }

        // PROPOSED FIX:
        // if ((entry.type === 'sale_payment' || entry.type === 'debit') && saleId && saleInfo) { ... use saleInfo ... }

        const OLD_LOGIC_RESULT = (entry.type === 'sale_payment' && saleInfo) ? "RICH_DATA" : "MANUAL_DEBIT";
        const NEW_LOGIC_RESULT = ((entry.type === 'sale_payment' || entry.type === 'debit') && saleInfo) ? "RICH_DATA" : "MANUAL_DEBIT";

        return {
            id: entry.id,
            type: entry.type,
            desc: entry.description,
            hasSaleInfo: !!saleInfo,
            oldResult: OLD_LOGIC_RESULT,
            newResult: NEW_LOGIC_RESULT
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

    await prisma.$disconnect();
}

main();
