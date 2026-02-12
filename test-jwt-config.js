const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

async function testJWTConfig() {
  console.log('🔍 Testing JWT Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING');
  console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅ SET' : '❌ MISSING');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING');
  console.log('REDIS_HOST:', process.env.REDIS_HOST ? '✅ SET' : '❌ MISSING');
  
  if (!process.env.JWT_SECRET) {
    console.log('\n❌ JWT_SECRET is missing! This is causing the authentication issues.');
    console.log('💡 Add JWT_SECRET to your .env.local file');
    return;
  }
  
  // Test JWT token generation
  try {
    const testPayload = {
      userId: 1,
      email: 'test@example.com',
      role: 'SUPER_DUPER_ADMIN'
    };
    
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users'
    });
    
    console.log('\n✅ JWT token generated successfully');
    console.log('Token length:', token.length);
    
    // Test JWT token validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users'
    });
    
    console.log('✅ JWT token validated successfully');
    console.log('Decoded payload:', decoded);
    
    // Test refresh token
    const refreshToken = jwt.sign(
      { userId: 1, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        expiresIn: '7d',
        issuer: 'building-materials-inventory',
        audience: 'building-materials-users'
      }
    );
    
    console.log('✅ Refresh token generated successfully');
    
    console.log('\n🎉 JWT configuration is working correctly!');
    console.log('💡 Make sure to restart your Next.js development server after setting environment variables.');
    
  } catch (error) {
    console.error('❌ JWT test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check that JWT_SECRET is set in .env.local');
    console.log('2. Restart your development server');
    console.log('3. Clear browser cache and cookies');
  }
}

testJWTConfig(); 