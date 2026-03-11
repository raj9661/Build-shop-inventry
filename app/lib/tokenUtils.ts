import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function validateToken(token: string): Promise<any | null> {
  try {
    // Check if token is valid before processing
    if (!token || token === 'undefined' || token === 'null' || token.length < 10) {
      console.error('❌ Invalid token provided:', { token, tokenLength: token?.length });
      return null;
    }

    // Check if JWT_SECRET is available
    let jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('❌ JWT_SECRET environment variable is not set!');
      console.error('💡 Add JWT_SECRET to your .env.local file:');
      console.error('JWT_SECRET="your-super-secret-jwt-key-for-building-materials-inventory"');
      return null;
    }
    
    // Decode base64 JWT_SECRET if it's encoded
    try {
      // Check if it's base64 encoded (starts with base64 chars and ends with =)
      if (jwtSecret.match(/^[A-Za-z0-9+/]+=*$/)) {
        jwtSecret = Buffer.from(jwtSecret, 'base64').toString('utf-8');
        console.log('🔍 [TokenUtils] Decoded base64 JWT_SECRET');
      }
    } catch (decodeError) {
      console.log('🔍 [TokenUtils] JWT_SECRET is not base64 encoded, using as-is');
    }
    
    console.log('🔍 [TokenUtils] Validating token:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
      tokenEnd: '...' + token.substring(token.length - 20),
      jwtSecretLength: jwtSecret.length,
      jwtSecretStart: jwtSecret.substring(0, 10) + '...'
    });
    
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users',
    }) as any;

    console.log('🔍 Token decoded successfully:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      userIdType: typeof decoded.userId
    });

    // Check if token is blacklisted (for logout functionality)
    const blacklistedToken = await prisma.loginLog.findFirst({
      where: {
        userId: decoded.userId,
        success: false,
        failureReason: 'logged_out',
        createdAt: {
          gte: new Date(decoded.iat * 1000), // Token issued after logout
        },
      },
    });
    if (blacklistedToken) {
      console.log('❌ Token is blacklisted');
      return null;
    }
    
    console.log('✅ Token validation successful');
    return decoded;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
} 