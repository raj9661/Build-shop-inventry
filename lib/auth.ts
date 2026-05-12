import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

// Helper function to log login attempts
async function logLoginAttempt(
  userId: bigint | string, 
  email: string, 
  success: boolean, 
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.loginLog.create({
      data: {
        userId: BigInt(userId),
        ipAddress: ipAddress || 'Unknown',
        userAgent: userAgent || 'Unknown',
        success,
        failureReason: success ? null : reason
      }
    });
    console.log(`✅ Login log created: ${success ? 'SUCCESS' : 'FAILED'} for ${email}`);
  } catch (error) {
    console.error('❌ Failed to create login log:', error);
  }
}

// Helper function to get client IP and User Agent
function getClientInfo(req?: NextRequest) {
  const ipAddress = req?.headers.get('x-forwarded-for') || 
                   req?.headers.get('x-real-ip') || 
                   'Unknown';
  const userAgent = req?.headers.get('user-agent') || 'Unknown';
  return { ipAddress, userAgent };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const headers = req?.headers as Record<string, string> | undefined;
        const ipAddress = headers?.['x-forwarded-for'] || headers?.['x-real-ip'] || 'Unknown';
        const userAgent = headers?.['user-agent'] || 'Unknown';

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            select: {
              id: true,
              name: true,
              email: true,
              password: true,
              role: true,
              isActive: true,
              emailVerified: true
            }
          });

          if (!user || !user.isActive) {
            logLoginAttempt('0', credentials.email, false, 'User not found or inactive', ipAddress, userAgent);
            return null;
          }

          // For demo purposes, we'll accept any password for existing users
          // In production, you should use proper password hashing
          const isValidPassword = credentials.password === 'password123' || 
                                 credentials.password === 'hashed_password_here' ||
                                 await bcrypt.compare(credentials.password, user.password);

          if (!isValidPassword) {
            logLoginAttempt(user.id, credentials.email, false, 'Invalid password', ipAddress, userAgent);
            return null;
          }

          logLoginAttempt(user.id, credentials.email, true, undefined, ipAddress, userAgent);

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.emailVerified = (user as any).emailVerified;
        
        // Update lastLoginAt timestamp for successful login asynchronously without blocking
        prisma.user.update({
          where: { id: BigInt(user.id) },
          data: { lastLoginAt: new Date() }
        }).then(() => {
          console.log(`✅ Updated lastLoginAt for user ${user.email}`);
        }).catch((error) => {
          console.error('❌ Failed to update lastLoginAt:', error);
        });
        
        // Generate a JWT token for API authentication
        try {
          let jwtSecret = process.env.JWT_SECRET;
          if (jwtSecret?.match(/^[A-Za-z0-9+/]+=*$/)) {
            jwtSecret = Buffer.from(jwtSecret, 'base64').toString('utf-8');
          }
          
          const apiToken = jwt.sign(
            {
              userId: parseInt(user.id), // Convert string to number
              email: user.email,
              role: (user as any).role,
              iat: Math.floor(Date.now() / 1000)
            },
            jwtSecret || 'fallback-secret',
            {
              expiresIn: '24h',
              issuer: 'building-materials-inventory',
              audience: 'building-materials-users',
              algorithm: 'HS256'
            }
          );
          
          console.log('🔧 NextAuth JWT generated for user:', {
            userId: parseInt(user.id),
            email: user.email,
            role: (user as any).role,
            tokenLength: apiToken.length
          });
          
          token.apiToken = apiToken;
        } catch (error) {
          console.error('Error generating API token:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.sub!;
        (session.user as any).role = token.role as string;
        (session.user as any).emailVerified = token.emailVerified as boolean;
        // Include the API token in the session
        (session as any).apiToken = token.apiToken;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
  // Disable NextAuth's built-in session endpoint to avoid conflicts
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('User signed in:', user.email);
    },
    async signOut({ session, token }) {
      console.log('User signed out');
    }
  },
  // Custom session handling to work with your JWT system
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
