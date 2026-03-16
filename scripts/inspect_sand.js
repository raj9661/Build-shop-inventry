const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// BigInt serialization support
BigInt.prototype.toJSON = function() {
  return this.toString();
};

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'sand' } },
        { name: { contains: 'Sand' } },
        { name: { contains: 'chips' } },
        { name: { contains: 'Chips' } }
      ]
    },
    take: 10
  });
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
