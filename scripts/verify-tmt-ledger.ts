
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Verifying TMT Ledger Entries...');

    const tmtEntries = await prisma.customerLedgerEntry.findMany({
        where: {
            description: {
                contains: 'TMT Sale #'
            }
        },
        take: 5,
        orderBy: {
            id: 'desc'
        }
    });

    const count = await prisma.customerLedgerEntry.count({
        where: {
            description: {
                contains: 'TMT Sale #'
            }
        }
    });

    console.log(`Found ${count} TMT ledger entries.`);
    console.log('Sample entries:', tmtEntries);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export {};
