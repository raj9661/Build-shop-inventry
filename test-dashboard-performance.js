const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  testUser: {
    email: 'rajsourabh959@gmail.com',
    password: 'SuperDuperAdmin@123'
  },
  iterations: 10,
  warmupIterations: 3
};

class DashboardPerformanceTester {
  constructor() {
    this.results = {
      oldDashboard: [],
      newDashboard: [],
      cacheStats: []
    };
    this.authToken = null;
  }

  async authenticate() {
    try {
      console.log('🔐 Authenticating for dashboard tests...');
      const response = await axios.post(`${TEST_CONFIG.baseURL}/api/auth/ultra-fast`, {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password
      });
      
      if (response.data.success) {
        this.authToken = response.data.data.token;
        console.log('✅ Authentication successful');
        return true;
      } else {
        console.error('❌ Authentication failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication error:', error.message);
      return false;
    }
  }

  async testOldDashboard() {
    console.log('🔍 Testing old dashboard system...');
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Test multiple old dashboard endpoints in parallel
        const [analyticsResponse, salesResponse, productsResponse] = await Promise.all([
          axios.get(`${TEST_CONFIG.baseURL}/api/analytics`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
          }),
          axios.get(`${TEST_CONFIG.baseURL}/api/sales`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
          }),
          axios.get(`${TEST_CONFIG.baseURL}/api/products`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
          })
        ]);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.results.oldDashboard.push({
          iteration: i + 1,
          duration,
          success: true,
          status: 'combined'
        });
        
        console.log(`  Old Dashboard #${i + 1}: ${duration.toFixed(2)}ms`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  Old Dashboard #${i + 1} failed:`, error.message);
        this.results.oldDashboard.push({
          iteration: i + 1,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
  }

  async testNewDashboard() {
    console.log('⚡ Testing ultra-fast dashboard system...');
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await axios.get(`${TEST_CONFIG.baseURL}/api/dashboard/ultra-fast`, {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.results.newDashboard.push({
          iteration: i + 1,
          duration,
          success: response.data.success,
          status: response.status,
          performance: response.data.performance
        });
        
        console.log(`  New Dashboard #${i + 1}: ${duration.toFixed(2)}ms`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  New Dashboard #${i + 1} failed:`, error.message);
        this.results.newDashboard.push({
          iteration: i + 1,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
  }

  async getCacheStats() {
    try {
      const response = await axios.post(`${TEST_CONFIG.baseURL}/api/dashboard/ultra-fast`, {
        action: 'getStats'
      }, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      
      if (response.data.success) {
        this.results.cacheStats.push(response.data.data);
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error.message);
    }
  }

  calculateStats(data) {
    const durations = data.map(r => r.duration).filter(d => d > 0);
    if (durations.length === 0) return null;
    
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);
    
    return {
      count: durations.length,
      average: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2)
    };
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  printResults() {
    console.log('\n📊 Dashboard Performance Test Results');
    console.log('=' .repeat(60));
    
    const oldStats = this.calculateStats(this.results.oldDashboard);
    const newStats = this.calculateStats(this.results.newDashboard);
    
    if (oldStats) {
      console.log('\n🔍 Old Dashboard System (Multiple API calls):');
      console.log(`  Average: ${oldStats.average}ms`);
      console.log(`  Min: ${oldStats.min}ms`);
      console.log(`  Max: ${oldStats.max}ms`);
      console.log(`  95th percentile: ${oldStats.p95}ms`);
      console.log(`  99th percentile: ${oldStats.p99}ms`);
    }
    
    if (newStats) {
      console.log('\n⚡ Ultra-Fast Dashboard System (Single API call):');
      console.log(`  Average: ${newStats.average}ms`);
      console.log(`  Min: ${newStats.min}ms`);
      console.log(`  Max: ${newStats.max}ms`);
      console.log(`  95th percentile: ${newStats.p95}ms`);
      console.log(`  99th percentile: ${newStats.p99}ms`);
    }
    
    if (oldStats && newStats) {
      const improvement = ((oldStats.average - newStats.average) / oldStats.average * 100).toFixed(2);
      console.log(`\n🚀 Performance Improvement: ${improvement}% faster!`);
      
      if (parseFloat(improvement) > 50) {
        console.log('🎉 Excellent! The ultra-fast dashboard is significantly faster!');
      } else if (parseFloat(improvement) > 20) {
        console.log('✅ Good improvement in dashboard performance!');
      } else {
        console.log('📈 Moderate improvement in dashboard performance.');
      }
    }
    
    if (this.results.cacheStats.length > 0) {
      console.log('\n📈 Cache Statistics:');
      const stats = this.results.cacheStats[0];
      console.log(`  Memory Cache Size: ${stats.memoryCacheSize}`);
      console.log('\n  Performance Metrics:');
      Object.entries(stats.performanceStats).forEach(([operation, data]) => {
        console.log(`    ${operation}: ${data.average}ms avg (${data.count} operations)`);
      });
    }
    
    console.log('\n💡 Key Benefits of Ultra-Fast Dashboard:');
    console.log('  • Single API call instead of multiple calls');
    console.log('  • Multi-layer caching (Memory + Redis)');
    console.log('  • Parallel database queries');
    console.log('  • Optimized data structure');
    console.log('  • Reduced network overhead');
  }

  async runTests() {
    console.log('🚀 Starting Dashboard Performance Tests');
    console.log('=' .repeat(60));
    
    // Authenticate first
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.log('❌ Cannot proceed without authentication');
      return;
    }
    
    // Warmup phase
    console.log('\n🔥 Warming up dashboard caches...');
    for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
      try {
        await axios.get(`${TEST_CONFIG.baseURL}/api/dashboard/ultra-fast`, {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Test old dashboard (multiple API calls)
    await this.testOldDashboard();
    
    // Test new dashboard (single API call)
    await this.testNewDashboard();
    
    // Get cache statistics
    await this.getCacheStats();
    
    // Print results
    this.printResults();
  }
}

// Run the performance test
async function main() {
  const tester = new DashboardPerformanceTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DashboardPerformanceTester; 