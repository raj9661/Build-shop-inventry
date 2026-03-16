import { PrismaClient } from '@prisma/client';
import { calculateInventoryAnalytics } from '../server/jobs/calculateMetrics';

const prisma = new PrismaClient();

async function run() {
  await prisma.inventoryAnalytics.deleteMany({});
  console.log('Deleted old analytics');
  await calculateInventoryAnalytics(BigInt(3));
  console.log('Re-ran analytics');
}

run().catch(console.error).finally(() => prisma.$disconnect());
