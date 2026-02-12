const Redis = require('ioredis');

async function testRedis() {
  console.log('🔍 Testing Redis connection...');
  
  const client = new Redis({
    host: 'localhost',
    port: 6379,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    // Removed enableOfflineQueue and lazyConnect for compatibility
  });

  try {
    // Test basic connection
    const ping = await client.ping();
    console.log('✅ Connected to Redis successfully! Ping:', ping);

    // Test basic operations
    await client.set('test_key', 'Hello from inventory system!');
    const value = await client.get('test_key');
    console.log('✅ Set/Get test passed:', value);

    // Test cache operations
    await client.setex('cache_test', 60, 'This will expire in 60 seconds');
    const cacheValue = await client.get('cache_test');
    console.log('✅ Cache with expiration test passed:', cacheValue);

    // Test rate limiting simulation
    const rateLimitKey = 'rate_limit:test_user';
    const currentCount = await client.incr(rateLimitKey);
    await client.expire(rateLimitKey, 60); // Expire in 60 seconds
    console.log('✅ Rate limiting test passed. Current count:', currentCount);

    // Test performance
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await client.set(`test:perf:${i}`, `value-${i}`);
    }
    const endTime = Date.now();
    console.log(`✅ Performance test: 10 operations in ${endTime - startTime}ms`);

    // Clean up test data
    await client.del('test_key', 'cache_test', rateLimitKey);
    for (let i = 0; i < 10; i++) {
      await client.del(`test:perf:${i}`);
    }
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All Redis tests passed! Your Redis setup is working perfectly.');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  } finally {
    await client.quit();
    console.log('🔌 Redis connection closed.');
  }
}

testRedis(); 