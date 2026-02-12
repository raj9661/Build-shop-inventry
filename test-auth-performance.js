const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  testUser: {
    email: 'superduperadmin@example.com',
    password: 'SuperDuperAdmin@123'
  },
  iterations: 10,
  warmupIterations: 3
};

class AuthPerformanceTester {
  constructor() {
    this.results = {
      oldAuth: [],
      newAuth: [],
      cacheStats: []
    };
  }

  async testOldAuth() {
    console.log('🔍 Testing old authentication system...');
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await axios.post(`${TEST_CONFIG.baseURL}/api/auth`, {
          email: TEST_CONFIG.testUser.email,
          password: TEST_CONFIG.testUser.password
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.results.oldAuth.push({
          iteration: i + 1,
          duration,
          success: response.data.success,
          status: response.status
        });
        
        console.log(`  Old Auth #${i + 1}: ${duration.toFixed(2)}ms`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  Old Auth #${i + 1} failed:`, error.message);
        this.results.oldAuth.push({
          iteration: i + 1,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
  }

  async testNewAuth() {
    console.log('⚡ Testing ultra-fast authentication system...');
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await axios.post(`${TEST_CONFIG.baseURL}/api/auth/ultra-fast`, {
          email: TEST_CONFIG.testUser.email,
          password: TEST_CONFIG.testUser.password
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.results.newAuth.push({
          iteration: i + 1,
          duration,
          success: response.data.success,
          status: response.status,
          performance: response.data.performance
        });
        
        console.log(`  New Auth #${i + 1}: ${duration.toFixed(2)}ms`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  New Auth #${i + 1} failed:`, error.message);
        this.results.newAuth.push({
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
      const response = await axios.get(`${TEST_CONFIG.baseURL}/api/auth/ultra-fast`);
      this.results.cacheStats.push(response.data.data);
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
    console.log('\n📊 Performance Test Results');
    console.log('=' .repeat(50));
    
    const oldStats = this.calculateStats(this.results.oldAuth);
    const newStats = this.calculateStats(this.results.newAuth);
    
    if (oldStats) {
      console.log('\n🔍 Old Authentication System:');
      console.log(`  Average: ${oldStats.average}ms`);
      console.log(`  Min: ${oldStats.min}ms`);
      console.log(`  Max: ${oldStats.max}ms`);
      console.log(`  95th percentile: ${oldStats.p95}ms`);
      console.log(`  99th percentile: ${oldStats.p99}ms`);
    }
    
    if (newStats) {
      console.log('\n⚡ Ultra-Fast Authentication System:');
      console.log(`  Average: ${newStats.average}ms`);
      console.log(`  Min: ${newStats.min}ms`);
      console.log(`  Max: ${newStats.max}ms`);
      console.log(`  95th percentile: ${newStats.p95}ms`);
      console.log(`  99th percentile: ${newStats.p99}ms`);
    }
    
    if (oldStats && newStats) {
      const improvement = ((oldStats.average - newStats.average) / oldStats.average * 100).toFixed(2);
      console.log(`\n🚀 Performance Improvement: ${improvement}% faster!`);
    }
    
    if (this.results.cacheStats.length > 0) {
      console.log('\n📈 Cache Statistics:');
      const stats = this.results.cacheStats[0];
      console.log(`  User Cache Size: ${stats.userCacheSize}`);
      console.log(`  Password Cache Size: ${stats.passwordCacheSize}`);
      console.log('\n  Performance Metrics:');
      Object.entries(stats.performanceStats).forEach(([operation, data]) => {
        console.log(`    ${operation}: ${data.average}ms avg (${data.count} operations)`);
      });
    }
  }

  async runTests() {
    console.log('🚀 Starting Authentication Performance Tests');
    console.log('=' .repeat(50));
    
    // Warmup phase
    console.log('\n🔥 Warming up...');
    for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
      try {
        await axios.post(`${TEST_CONFIG.baseURL}/api/auth/ultra-fast`, {
          email: TEST_CONFIG.testUser.email,
          password: TEST_CONFIG.testUser.password
        });
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Test old authentication
    await this.testOldAuth();
    
    // Test new authentication
    await this.testNewAuth();
    
    // Get cache statistics
    await this.getCacheStats();
    
    // Print results
    this.printResults();
  }
}

// Run the performance test
async function main() {
  const tester = new AuthPerformanceTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AuthPerformanceTester; 