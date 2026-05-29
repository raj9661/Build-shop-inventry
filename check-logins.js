const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentLogins() {
  console.log('🔍 Checking recent logins:');
  const recentLogins = await prisma.loginLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ipAddress: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          role: true
        }
      }
    }
  });
  console.log(JSON.stringify(recentLogins, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('\n🔍 Checking recent activity logs:');
  const recentActivities = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      resource: true,
      details: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          role: true
        }
      }
    }
  });
  console.log(JSON.stringify(recentActivities, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

checkRecentLogins().catch(console.error).finally(() => prisma.$disconnect());
