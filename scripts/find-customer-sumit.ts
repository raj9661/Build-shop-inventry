
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const customers = await prisma.customer.findMany({
        where: {
            name: {
                contains: 'Sumit'
            }
        },
        select: { id: true, name: true, phone: true }
    });

    console.log('Customers found:', customers);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
