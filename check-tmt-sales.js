const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkTmtSales() {
    const output = [];

    try {
        output.push('=== TMT SALES DATABASE CHECK ===\n');

        const allTmtSales = await prisma.tmtSale.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        output.push(`Total TMT Sales: ${allTmtSales.length}\n`);

        const byStatus = {
            PAID: 0,
            PARTIAL: 0,
            UNPAID: 0,
            PENDING: 0,
            CANCELLED: 0
        };

        allTmtSales.forEach(sale => {
            if (byStatus[sale.paymentStatus] !== undefined) {
                byStatus[sale.paymentStatus]++;
            }
        });

        output.push('\n=== COUNTS BY STATUS ===');
        output.push(`PAID: ${byStatus.PAID}`);
        output.push(`PARTIAL: ${byStatus.PARTIAL}`);
        output.push(`UNPAID: ${byStatus.UNPAID}`);
        output.push(`PENDING: ${byStatus.PENDING}`);
        output.push(`CANCELLED: ${byStatus.CANCELLED}`);

        const cancelled = allTmtSales.filter(s => s.paymentStatus === 'CANCELLED');

        if (cancelled.length > 0) {
            output.push('\n=== CANCELLED TMT SALES ===');
            cancelled.forEach(sale => {
                output.push(`\nID: ${sale.id}`);
                output.push(`Customer: ${sale.customerName || 'Unknown'}`);
                output.push(`Amount: ${sale.totalAmount}`);
                output.push(`Paid: ${sale.paidAmount || 0}`);
                output.push(`Due: ${sale.dueAmount || 0}`);
                output.push(`Status: ${sale.paymentStatus}`);
                output.push(`Date: ${sale.saleDate}`);
                output.push(`Notes: ${sale.notes || 'N/A'}`);
            });
        } else {
            output.push('\n=== NO CANCELLED SALES FOUND ===');
        }

        const active = allTmtSales.filter(s => s.paymentStatus !== 'CANCELLED');
        output.push(`\n=== ACTIVE TMT SALES (${active.length}) ===`);
        active.forEach(sale => {
            output.push(`ID: ${sale.id} | Status: ${sale.paymentStatus} | Customer: ${sale.customerName || 'Unknown'} | Amount: ${sale.totalAmount}`);
        });

        const result = output.join('\n');
        console.log(result);
        fs.writeFileSync('tmt-sales-status.txt', result);
        console.log('\n\nResults saved to tmt-sales-status.txt');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTmtSales();
