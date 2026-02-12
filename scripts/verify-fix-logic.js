const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const customerName = 'Sumit Kumar';
    console.log(`Searching for customer: ${customerName}`);

    const customer = await prisma.customer.findFirst({
        where: { name: { contains: customerName } }
    });

    if (!customer) {
        console.log('Customer not found!');
        return;
    }

    console.log(`Found customer: ${customer.name} (ID: ${customer.id})`);

    // 1. Get raw ledger entries
    const entries = await prisma.customerLedgerEntry.findMany({
        where: { customerId: customer.id, isActive: true },
        orderBy: { date: 'desc' }
    });

    console.log(`Total Raw Ledger Entries: ${entries.length}`);

    const results = {
        customerName: customer.name,
        customerId: customer.id,
        totalEntries: entries.length,
        expectedVisible: 0,
        filteredOut: 0,
        details: []
    };

    console.log('\n--- Analyzing Entries with NEW LOGIC ---');

    // Simulate API Logic
    for (const entry of entries) {
        let status = 'UNKNOWN';
        let keep = false;

        // Logic from API
        if (entry.type === 'loan_clearing') {
            status = 'KEPT (Payment)';
            keep = true;
        } else if (entry.type === 'credit') {
            status = 'KEPT (Manual Payment)';
            keep = true;
        } else if (entry.type === 'debit') {
            status = 'KEPT (Manual Debit)';
            keep = true;
        } else if (entry.type === 'sale_payment') {
            if (entry.description) {
                const tmtMatch = entry.description.match(/TMT Sale #(\d+)/i);
                const saleMatch = entry.description.match(/Sale #(\d+)/i);

                if (tmtMatch) {
                    const linkedId = tmtMatch[1];
                    const tmtSale = await prisma.tmtSale.findUnique({
                        where: { id: BigInt(linkedId) }
                    });
                    if (tmtSale && tmtSale.status === 'COMPLETED') {
                        status = 'KEPT (TMT Completed)';
                        keep = true;
                    } else {
                        status = `FILTERED (TMT Status: ${tmtSale ? tmtSale.status : 'Not Found'})`;
                    }
                } else if (saleMatch) {
                    const linkedId = saleMatch[1];
                    const sale = await prisma.sale.findUnique({
                        where: { id: parseInt(linkedId) }
                    });
                    if (sale && sale.paymentStatus === 'COMPLETED') {
                        status = 'KEPT (Sale Completed)';
                        keep = true;
                    } else {
                        status = `FILTERED (Sale Status: ${sale ? sale.paymentStatus : 'Not Found'})`;
                    }
                } else {
                    status = 'FILTERED (No Sale/TMT ID match)';
                }
            } else {
                status = 'FILTERED (No description)';
            }
        } else {
            status = `FILTERED (Type: ${entry.type})`;
        }

        if (keep) results.expectedVisible++;
        else results.filteredOut++;

        results.details.push({
            id: Number(entry.id),
            date: entry.date.toISOString().split('T')[0],
            amount: Number(entry.amount),
            description: entry.description,
            status,
            type: entry.type
        });

        console.log(`ID: ${entry.id} | Type: ${entry.type} | Desc: ${entry.description} -> ${status}`);
    }

    console.log('\n--- Summary ---');
    console.log(`Total Entries in DB: ${entries.length}`);
    console.log(`Expected Visible Entries: ${results.expectedVisible}`);
    console.log(`Filtered Out Entries: ${results.filteredOut}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
