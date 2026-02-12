const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function generateSecureSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function setupEnvironment() {
  console.log('🔧 Setting up environment configuration...\n');
  
  const envPath = '.env.local';
  const envExists = fs.existsSync(envPath);
  
  if (envExists) {
    console.log('📁 .env.local already exists');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check for required variables
    const hasJWTSecret = envContent.includes('JWT_SECRET=');
    const hasDatabaseURL = envContent.includes('DATABASE_URL=');
    
    console.log('JWT_SECRET:', hasJWTSecret ? '✅ SET' : '❌ MISSING');
    console.log('DATABASE_URL:', hasDatabaseURL ? '✅ SET' : '❌ MISSING');
    
    if (!hasJWTSecret) {
      console.log('\n⚠️  JWT_SECRET is missing! This is causing your authentication issues.');
      console.log('💡 Add the following to your .env.local file:');
      console.log(`JWT_SECRET="${generateSecureSecret()}"`);
      console.log(`JWT_REFRESH_SECRET="${generateSecureSecret()}"`);
    }
    
    if (!hasDatabaseURL) {
      console.log('\n⚠️  DATABASE_URL is missing!');
      console.log('💡 Add the following to your .env.local file:');
      console.log('DATABASE_URL="postgresql://inventory_user:inventory_password@localhost:5432/inventory_db"');
    }
    
  } else {
    console.log('📁 Creating .env.local file...');
    
    const envContent = `# Database Configuration
DATABASE_URL="postgresql://inventory_user:inventory_password@localhost:5432/inventory_db"

# JWT Configuration (CRITICAL for authentication)
JWT_SECRET="${generateSecureSecret()}"
JWT_REFRESH_SECRET="${generateSecureSecret()}"

# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"

# Email Configuration (for notifications and 2FA)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"

# Application Configuration
NODE_ENV="development"
NEXTAUTH_SECRET="${generateSecureSecret()}"
NEXTAUTH_URL="http://localhost:3000"

# Security Configuration
DEVICE_SECRET="${generateSecureSecret()}"

# Backup Configuration
BACKUP_DIR="./backups"
BACKUP_RETENTION_DAYS="30"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local created successfully!');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Start Docker services: docker-compose up -d');
  console.log('2. Run database tests: node test-postgres.js');
  console.log('3. Run Redis tests: node test-redis.js');
  console.log('4. Run JWT tests: node test-jwt-config.js');
  console.log('5. Restart development server: npm run dev');
  console.log('\n🔍 If you still have issues, check:');
  console.log('- Docker containers are running');
  console.log('- Database is accessible');
  console.log('- Redis is accessible');
  console.log('- Environment variables are loaded');
}

setupEnvironment(); 