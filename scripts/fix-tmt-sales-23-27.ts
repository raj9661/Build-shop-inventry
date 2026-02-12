
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fixing TMT Sales #23 and #27...');

    const salesToFix = [23, 27];
    const customerId = 1; // Sumit Kumar

    for (const id of salesToFix) {
        const saleId = BigInt(id);

        // 1. Fetch current sale
        const sale = await prisma.tmtSale.findUnique({
            where: { id: saleId }
        });

        if (!sale) {
            console.log(`Sale #${id} not found.`);
            continue;
        }

        console.log(`Processing Sale #${id}...`);

        // 2. Prepare update data
        const updateData: any = {
            customerId: BigInt(customerId), // Link to Sumit
            customerName: "Sumit Kumar"
        };

        // Fix amounts for Sale #27
        if (id === 27) {
            updateData.paidAmount = sale.totalAmount;
            updateData.dueAmount = 0;
            console.log('   -> Fixing amounts for Sale #27');
        }

        // 3. Update Sale
        await prisma.tmtSale.update({
            where: { id: saleId },
            data: updateData
        });
        console.log('   -> Sale updated with Customer ID and Amounts.');

        // 4. Create Ledger Entries
        // Check if Purchase Entry exists
        const purchaseEntry = await prisma.customerLedgerEntry.findFirst({
            where: {
                description: { contains: `TMT Sale #${id}` },
                type: 'sale_payment', // Just checking generically? No, Purchase is 'sale' usually but TMT uses description
                amount: { gt: 0 } // Debit (Purchase) is positive in some contexts, but let's check my logic
            }
        });

        // In my route logic: 
        // Purchase Entry: amount = totalAmount (Positive? No, Debit is positive in UI usually, but let's check utils)
        // Payment Entry: amount = -paidAmount (Negative)

        // Let's rely on creating them if they don't exist
        // I will check by description text which is unique enough: "TMT Sale #ID"

        const existingEntries = await prisma.customerLedgerEntry.findMany({
            where: {
                description: { contains: `TMT Sale #${id}` }
            }
        });

        // We expect 2 entries: Purchase (Debit) and Payment (Credit)

        const hasPurchase = existingEntries.some(e => e.amount > 0);
        const hasPayment = existingEntries.some(e => e.amount < 0);

        if (!hasPurchase) {
            console.log('   -> Creating Purchase Ledger Entry (Debit)');
            await prisma.customerLedgerEntry.create({
                data: {
                    customerId: BigInt(customerId),
                    amount: sale.totalAmount, // Positive for Debit/Purchase
                    type: 'debit', // or 'sale' depending on schema? Wait, schema has String type.
                    // In page.tsx: type: 'debit' | 'credit'. 
                    // In ledgerUtils.ts: createPurchaseEntry uses type='debit' usually? 
                    // Let's use 'debit' and 'credit' as per page.tsx usage, 
                    // BUT verify-tmt-ledger used 'sale_payment'??
                    // Let's check `app/api/ledger/route.ts`... it processes `type`.
                    // Actually `createPurchaseEntry` implementation in `ledgerUtils.js` sets `type: 'debit'`.
                    // And `createPaymentEntry` sets `type: 'credit'`.
                    type: 'debit',
                    method: 'CASH',
                    date: sale.saleDate,
                    description: `TMT Sale #${id} - Purchase`,
                    shopId: sale.shopId,
                    isActive: true
                }
            });
        } else {
            console.log('   -> Purchase Entry already exists.');
        }

        if (!hasPayment) {
            console.log('   -> Creating Payment Ledger Entry (Credit)');
            await prisma.customerLedgerEntry.create({
                data: {
                    customerId: BigInt(customerId),
                    amount: -Number(sale.totalAmount), // Negative for Credit/Payment
                    type: 'credit',
                    method: 'CASH',
                    date: sale.saleDate,
                    description: `Matches TMT Sale #${id} - Payment`,
                    shopId: sale.shopId,
                    isActive: true
                }
            });
        } else {
            console.log('   -> Payment Entry already exists.');
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
