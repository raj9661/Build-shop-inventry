// Direct debug script for UltraFastDashboard
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// We need to bypass the Next.js environment to test the lib directly
// But the lib uses @/app/... imports. This won't work in plain node.

async function debug() {
    try {
        console.log('🚀 Loading UltraFastDashboard...');
        // Since we can't easily import the TS file with @ aliases in plain node without setup,
        // let's try to just check the file for common pitfalls.

        const shop = await prisma.shop.findFirst({ where: { isActive: true } });
        if (!shop) {
            console.error('❌ No active shop found');
            return;
        }

        console.log(`🔍 Testing for Shop ID: ${shop.id}`);

        // Let's actually try to use the build output if it exists, or just do manual inspection.
        // Given the environment, manual inspection and careful re-write is better.

    } catch (err) {
        console.error('❌ Debug failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
