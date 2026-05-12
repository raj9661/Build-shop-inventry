const fetch = require('node-fetch');

// Performance test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testUsers: [
    { email: 'admin@example.com', password: 'admin123', role: 'ADMIN' },
    { email: 'super@admin.com', password: 'super123', role: 'SUPER_ADMIN' },
    { email: 'user@example.com', password: 'user123', role: 'USER' }
  ],
  iterations: 5,
  timeout: 30000
};

// Performance metrics
const metrics = {
  totalTests: 0,
  successfulTests: 0,
  failedTests: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  times: []
};

async function measureLoginTime(email, password, role) {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_CONFIG.timeout);

    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.ok) {
      const data = await response.json();
      
      if (data.code === '2FA_REQUIRED') {
        console.log(`✅ ${role} login (2FA required): ${duration}ms`);
        return { success: true, duration, requires2FA: true };
      } else if (data.success) {
        console.log(`✅ ${role} login successful: ${duration}ms`);
        return { success: true, duration, requires2FA: false };
      } else {
        console.log(`❌ ${role} login failed: ${data.message}`);
        return { success: false, duration, error: data.message };
      }
    } else {
      const errorData = await response.json();
      console.log(`❌ ${role} login failed (${response.status}): ${errorData.message}`);
      return { success: false, duration, error: errorData.message };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (error.name === 'AbortError') {
      console.log(`⏰ ${role} login timed out after ${duration}ms`);
      return { success: false, duration, error: 'Timeout' };
    } else {
      console.log(`❌ ${role} login error: ${error.message}`);
      return { success: false, duration, error: error.message };
    }
  }
}

async function runPerformanceTest() {
  console.log('🚀 Starting login performance test...\n');
  console.log(`📊 Configuration:`);
  console.log(`   - Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`   - Test users: ${TEST_CONFIG.testUsers.length}`);
  console.log(`   - Iterations per user: ${TEST_CONFIG.iterations}`);
  console.log(`   - Timeout: ${TEST_CONFIG.timeout}ms\n`);

  const results = [];

  for (const user of TEST_CONFIG.testUsers) {
    console.log(`👤 Testing ${user.role} login...`);
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const result = await measureLoginTime(user.email, user.password, user.role);
      
      results.push({
        user: user.role,
        iteration: i + 1,
        ...result
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('');
  }

  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  if (successfulResults.length > 0) {
    const times = successfulResults.map(r => r.duration);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('📈 Performance Results:');
    console.log(`   Total tests: ${results.length}`);
    console.log(`   Successful: ${successfulResults.length}`);
    console.log(`   Failed: ${failedResults.length}`);
    console.log(`   Success rate: ${((successfulResults.length / results.length) * 100).toFixed(1)}%`);
    console.log('');
    console.log('⏱️  Timing Statistics (successful logins):');
    console.log(`   Average: ${avgTime.toFixed(0)}ms`);
    console.log(`   Minimum: ${minTime}ms`);
    console.log(`   Maximum: ${maxTime}ms`);
    console.log('');
    
    // Group by user role
    const roleStats = {};
    TEST_CONFIG.testUsers.forEach(user => {
      const userResults = successfulResults.filter(r => r.user === user.role);
      if (userResults.length > 0) {
        const userTimes = userResults.map(r => r.duration);
        const userAvg = userTimes.reduce((a, b) => a + b, 0) / userTimes.length;
        roleStats[user.role] = {
          count: userResults.length,
          average: userAvg.toFixed(0),
          min: Math.min(...userTimes),
          max: Math.max(...userTimes)
        };
      }
    });
    
    console.log('👥 Performance by User Role:');
    Object.entries(roleStats).forEach(([role, stats]) => {
      console.log(`   ${role}:`);
      console.log(`     Count: ${stats.count}`);
      console.log(`     Average: ${stats.average}ms`);
      console.log(`     Range: ${stats.min}ms - ${stats.max}ms`);
    });
  }

  if (failedResults.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedResults.forEach(result => {
      console.log(`   ${result.user} (iteration ${result.iteration}): ${result.error}`);
    });
  }

  console.log('\n✨ Performance test completed!');
}

// Run the test
if (require.main === module) {
  runPerformanceTest().catch(console.error);
}

module.exports = { runPerformanceTest, measureLoginTime }; 