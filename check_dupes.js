
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkDuplicates() {
    try {
        const phone = '9999999999';
        let output = `Checking for customers with phone: ${phone}\n`;

        const customers = await prisma.customer.findMany({
            where: {
                phone: phone
            },
            include: {
                _count: {
                    select: {
                        sales: true,
                        tmtSales: true,
                        ledgerEntries: true
                    }
                }
            }
        });

        output += `Found ${customers.length} customers.\n`;
        customers.forEach(c => {
            output += `ID: ${c.id}, Name: ${c.name}, Shop: ${c.shopId}, CreatedAt: ${c.createdAt}\n`;
            output += `  Sales: ${c._count.sales}, TMT Sales: ${c._count.tmtSales}, Ledger Entries: ${c._count.ledgerEntries}\n`;
        });

        if (customers.length > 0) {
            output += '\nChecking Ledger Entries for first customer:\n';
            const entries = await prisma.customerLedgerEntry.findMany({
                where: { customerId: customers[0].id }
            });
            output += JSON.stringify(entries, (key, value) =>
                typeof value === 'bigint' ? value.toString() + 'n' : value
                , 2);
        }

        fs.writeFileSync('dupes_out.txt', output);
        console.log('Output written to dupes_out.txt');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDuplicates();
