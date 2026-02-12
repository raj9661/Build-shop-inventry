// Test script to verify database connection in Next.js environment
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNextJSConnection() {
  try {
    console.log('🔍 Testing Next.js database connection...');
    console.log('📁 Environment file: .env.local');
    console.log('🔑 DATABASE_URL found:', process.env.DATABASE_URL ? '✅ YES' : '❌ NO');
    console.log('🔑 JWT_SECRET found:', process.env.JWT_SECRET ? '✅ YES' : '❌ NO');
    
    if (!process.env.DATABASE_URL) {
      console.log('❌ DATABASE_URL not found in environment variables');
      console.log('💡 Try copying from .env to .env.local or check file format');
      return;
    }
    
    // Test database connection
    const userCount = await prisma.user.count();
    console.log('✅ Database connection successful!');
    console.log(`📊 Total users in database: ${userCount}`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true }
      });
      console.log('👥 Users in database:');
      users.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
      });
    }
    
    console.log('\n🎉 Next.js database connection test passed!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure .env.local exists in project root');
    console.log('2. Check DATABASE_URL format in .env.local');
    console.log('3. Restart your Next.js development server');
    console.log('4. Try running: npm run dev');
  } finally {
    await prisma.$disconnect();
  }
}

testNextJSConnection(); 