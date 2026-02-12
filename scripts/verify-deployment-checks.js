const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

async function checkRedis() {
    console.log('--- Checking Redis Connection ---');
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.log('⚠️ REDIS_URL not set. Skipping Redis check.');
        return;
    }

    console.log(`Connecting to Redis at ${redisUrl.split('@')[1]}...`);
    const redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        family: 4,
    });

    try {
        await redis.connect();
        console.log('✅ Connected to Redis!');

        await redis.set('verify_test_key', 'it_works');
        const val = await redis.get('verify_test_key');
        console.log(`✅ Set/Get verified. Value: ${val}`);

        await redis.del('verify_test_key');
        await redis.quit();
    } catch (error) {
        console.error('❌ Redis Connection Failed:', error.message);
    }
}

async function checkPrisma() {
    console.log('\n--- Checking Prisma Client ---');
    const prisma = new PrismaClient();

    try {
        if (prisma.tmtSale) {
            console.log('✅ prisma.tmtSale exists!');
            // Optional: Try a simple count if DB is reachable
            // const count = await prisma.tmtSale.count();
            // console.log(`   Count: ${count}`);
        } else {
            console.error('❌ prisma.tmtSale is MISSING from the client!');
            console.log('   Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
        }
    } catch (e) {
        console.error('❌ Prisma check error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    await checkRedis();
    await checkPrisma();
}

main();
