const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration for all roles
const TEST_USERS = [
  {
    email: 'rajsourabh959@gmail.com',
    password: 'SuperDuperAdmin@123',
    role: 'SUPER_DUPER_ADMIN',
    name: 'Super Duper Admin'
  },
  {
    email: 'superadmin@example.com',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN',
    name: 'Super Admin'
  },
  {
    email: 'admin@example.com',
    password: 'Admin@123',
    role: 'ADMIN',
    name: 'Admin User'
  },
  {
    email: 'staff@example.com',
    password: 'Staff@123',
    role: 'STAFF',
    name: 'Staff User'
  }
];

const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  iterations: 5,
  warmupIterations: 2
};

class AllRolesDashboardTester {
  constructor() {
    this.results = {};
    this.authTokens = {};
  }

  async authenticateUser(user) {
    try {
      console.log(`🔐 Authenticating ${user.name} (${user.role})...`);
      const response = await axios.post(`${TEST_CONFIG.baseURL}/api/auth/ultra-fast`, {
        email: user.email,
        password: user.password
      });
      
      if (response.data.success) {
        this.authTokens[user.role] = response.data.data.token;
        console.log(`✅ ${user.name} authenticated successfully`);
        return true;
      } else {
        console.error(`❌ ${user.name} authentication failed:`, response.data.message);
        return false;
      }
    } catch (error) {
      console.error(`❌ ${user.name} authentication error:`, error.message);
      return false;
    }
  }

  async testDashboardForRole(user) {
    console.log(`\n⚡ Testing ultra-fast dashboard for ${user.name} (${user.role})...`);
    
    const results = {
      role: user.role,
      name: user.name,
      iterations: [],
      average: 0,
      min: 0,
      max: 0
    };
    
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await axios.get(`${TEST_CONFIG.baseURL}/api/dashboard/ultra-fast`, {
          headers: { 'Authorization': `Bearer ${this.authTokens[user.role]}` }
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        results.iterations.push({
          iteration: i + 1,
          duration,
          success: response.data.success,
          status: response.status
        });
        
        console.log(`  ${user.role} #${i + 1}: ${duration.toFixed(2)}ms`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ${user.role} #${i + 1} failed:`, error.message);
        results.iterations.push({
          iteration: i + 1,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
    
    // Calculate statistics
    const durations = results.iterations.map(r => r.duration).filter(d => d > 0);
    if (durations.length > 0) {
      results.average = durations.reduce((a, b) => a + b, 0) / durations.length;
      results.min = Math.min(...durations);
      results.max = Math.max(...durations);
    }
    
    this.results[user.role] = results;
  }

  async warmupCache() {
    console.log('\n🔥 Warming up dashboard caches for all roles...');
    
    for (const user of TEST_USERS) {
      if (this.authTokens[user.role]) {
        for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
          try {
            await axios.get(`${TEST_CONFIG.baseURL}/api/dashboard/ultra-fast`, {
              headers: { 'Authorization': `Bearer ${this.authTokens[user.role]}` }
            });
          } catch (error) {
            // Ignore warmup errors
          }
        }
      }
    }
  }

  printResults() {
    console.log('\n📊 Ultra-Fast Dashboard Performance Test Results');
    console.log('=' .repeat(70));
    
    const roleOrder = ['SUPER_DUPER_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'STAFF'];
    
    roleOrder.forEach(role => {
      const result = this.results[role];
      if (result && result.average > 0) {
        console.log(`\n👤 ${result.name} (${role}):`);
        console.log(`  Average: ${result.average.toFixed(2)}ms`);
        console.log(`  Min: ${result.min.toFixed(2)}ms`);
        console.log(`  Max: ${result.max.toFixed(2)}ms`);
        console.log(`  Success Rate: ${(result.iterations.filter(r => r.success).length / result.iterations.length * 100).toFixed(1)}%`);
      }
    });
    
    // Compare performance across roles
    const validResults = roleOrder
      .map(role => this.results[role])
      .filter(result => result && result.average > 0);
    
    if (validResults.length > 1) {
      console.log('\n📈 Performance Comparison:');
      const fastest = validResults.reduce((a, b) => a.average < b.average ? a : b);
      const slowest = validResults.reduce((a, b) => a.average > b.average ? a : b);
      
      console.log(`  Fastest: ${fastest.name} (${fastest.average.toFixed(2)}ms)`);
      console.log(`  Slowest: ${slowest.name} (${slowest.average.toFixed(2)}ms)`);
      
      const difference = slowest.average - fastest.average;
      const percentageDiff = (difference / slowest.average * 100).toFixed(1);
      console.log(`  Difference: ${difference.toFixed(2)}ms (${percentageDiff}%)`);
    }
    
    console.log('\n💡 Ultra-Fast Dashboard Benefits for All Roles:');
    console.log('  • Multi-layer caching (Memory + Redis)');
    console.log('  • Parallel database queries');
    console.log('  • Role-based access control');
    console.log('  • Optimized data structure');
    console.log('  • Reduced network overhead');
    console.log('  • Consistent performance across all admin levels');
  }

  async runTests() {
    console.log('🚀 Starting Ultra-Fast Dashboard Tests for All Admin Roles');
    console.log('=' .repeat(70));
    
    // Authenticate all users
    console.log('\n🔐 Authenticating all users...');
    for (const user of TEST_USERS) {
      await this.authenticateUser(user);
    }
    
    // Warmup phase
    await this.warmupCache();
    
    // Test dashboard for each role
    for (const user of TEST_USERS) {
      if (this.authTokens[user.role]) {
        await this.testDashboardForRole(user);
      }
    }
    
    // Print results
    this.printResults();
  }
}

// Run the performance test
async function main() {
  const tester = new AllRolesDashboardTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AllRolesDashboardTester; 