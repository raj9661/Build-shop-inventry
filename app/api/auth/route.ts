import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateToken, generateTokenPair, blacklistToken } from '@/app/lib/tokenUtils';
import emailService from '@/app/lib/emailService';
import redisService from '@/app/lib/redis-service';
import { redis } from '@/lib/redis';
import rateLimiter from '@/app/lib/rate-limiter';
import { loginSchema, login2FASchema, passwordChangeSchema, passwordChange2FASchema, validateInput } from '@/app/lib/validation-schemas';
import { deviceFingerprintService } from '@/app/lib/device-fingerprint-service';
import { emailService as newEmailService } from '@/app/lib/email-service';
import { invalidateUserContext } from '@/lib/authContext';

// Generate OTP with crypto-secure random
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Mask email for display (shows last 3 characters before @ and full domain)
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) return email;
  
  const maskedLocalPart = '*'.repeat(localPart.length - 3) + localPart.slice(-3);
  return `${maskedLocalPart}@${domain}`;
}

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expiresAt: number; userId: number }>();

// Helper function to log failed login attempts
async function logFailedLogin(email: string, ipAddress: string, userAgent: string, reason: string) {
  try {
    // Try to find the user by email to get userId
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true }
    });
    
    if (user) {
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
          failureReason: reason
        }
      });
      console.log(`🔍 [Auth] Logged failed login attempt for user ${user.id}: ${reason}`);
    } else {
      // Log failed attempt even if user not found (for security monitoring)
      console.log(`🔍 [Auth] Failed login attempt for unknown user ${email}: ${reason}`);
    }
  } catch (error) {
    console.error('Failed to log failed login attempt:', error);
  }
}

// Ultra-optimized login endpoint with all advanced features
export async function POST(req: NextRequest) {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🚀 [${requestId}] Auth API called - Ultra Optimized`);
    
    // Parse request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const body = await req.json();
    clearTimeout(timeoutId);
    
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    console.log(`🔍 [${requestId}] Request from IP: ${ipAddress}`);

    // Rate limiting with Redis
    const rateLimitResult = await rateLimiter.checkRateLimit('login', ipAddress, userAgent);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(rateLimitResult.blockTimeRemaining / 1000)
      }, { status: 429 });
    }

    // Zod validation with detailed error messages
    const validation = validateInput(loginSchema, body);
    if (!validation.success) {
      await rateLimiter.recordAttempt('login', ipAddress, false);
      await logFailedLogin(body.email || 'unknown', ipAddress, userAgent, 'Invalid input data');
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: validation.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { email, password, otp, deviceInfo } = validation.data;

    // Single DB query — no duplicate parallel fetch
    const userCacheKey = `user:auth:${email.toLowerCase()}`;
    let cachedMeta = await redisService.get<any>(userCacheKey);
    
    // Always fetch password from DB (never cache it)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      await rateLimiter.recordAttempt('login', ipAddress, false);
      await logFailedLogin(email, ipAddress, userAgent, 'User not found or inactive');
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials or user inactive',
        code: 'INVALID_CREDENTIALS'
      }, { status: 401 });
    }

    // Verify password with optimized bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await rateLimiter.recordAttempt('login', ipAddress, false);
      await logFailedLogin(email, ipAddress, userAgent, 'Invalid password');
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }, { status: 401 });
    }

    // For SUPER_DUPER_ADMIN, require 2FA
    if (user.role === 'SUPER_DUPER_ADMIN') {
      if (!otp) {
        // Generate and send OTP for 2FA
        const loginOTP = generateOTP();
        const otpKey = `otp:${user.email.toLowerCase()}`;
        
        // Store OTP in Redis for better performance
        await redisService.set(otpKey, {
          otp: loginOTP,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
          userId: Number(user.id) // Convert BigInt to Number
        }, 600);

        // Send OTP via email asynchronously (don't wait for it)
        newEmailService.sendVerificationCode({
          name: user.name,
          email: user.email,
          code: loginOTP,
          expiresIn: 10
        }).catch((error: any) => {
          console.error(`❌ [${requestId}] Failed to send 2FA email:`, error);
        });

        return NextResponse.json({
          success: false,
          message: '2FA required for SUPER_DUPER_ADMIN',
          code: '2FA_REQUIRED',
          data: {
            requires2FA: true,
            email: user.email,
            maskedEmail: maskEmail(user.email)
          }
        }, { status: 200 });
      } else {
        // Validate 2FA input
        const otpValidation = validateInput(login2FASchema, { email, password, otp });
        if (!otpValidation.success) {
          await rateLimiter.recordAttempt('login', ipAddress, false);
          await logFailedLogin(email, ipAddress, userAgent, 'Invalid 2FA data');
          return NextResponse.json({
            success: false,
            message: 'Invalid 2FA data',
            errors: otpValidation.errors,
            code: '2FA_VALIDATION_ERROR'
          }, { status: 400 });
        }

        // Verify OTP from Redis
        const otpKey = `otp:${user.email.toLowerCase()}`;
        const storedOTPData = await redisService.get<any>(otpKey);
        
        if (!storedOTPData || storedOTPData.otp !== otp || Date.now() > storedOTPData.expiresAt) {
          await rateLimiter.recordAttempt('login', ipAddress, false);
          await logFailedLogin(email, ipAddress, userAgent, 'Invalid or expired 2FA code');
          return NextResponse.json({
            success: false,
            message: 'Invalid or expired 2FA code',
            code: 'INVALID_OTP'
          }, { status: 401 });
        }

        // Clear OTP after successful verification
        await redisService.del(otpKey);

        // Handle trusted device if requested
        if (deviceInfo && deviceInfo.rememberDevice) {
          try {
            console.log('🔍 Processing trusted device request:', {
              rememberDevice: deviceInfo.rememberDevice,
              deviceName: deviceInfo.deviceName,
              userAgent: deviceInfo.userAgent
            });
            
            const deviceFingerprint = deviceFingerprintService.generateFingerprintFromClient(deviceInfo);
            await deviceFingerprintService.addTrustedDevice({
              userId: Number(user.id),
              deviceFingerprint,
              rememberDevice: true
            });
            console.log(`✅ Device added as trusted for user ${user.id}`);
          } catch (error) {
            console.error('Error adding trusted device:', error);
            // Don't fail login if trusted device addition fails
          }
        } else {
          console.log('🔍 No trusted device request:', {
            hasDeviceInfo: !!deviceInfo,
            rememberDevice: deviceInfo?.rememberDevice
          });
        }
      }
    }

    // Generate short-lived access token (15 min) + long refresh token (7d)
    // Tokens include jti for O(1) Redis blacklisting on logout
    const { accessToken: token, refreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.role,
    );

    // Log login + fetch assigned shops in parallel (fire-and-forget log)
    const [loginLog, assignedShops] = await Promise.all([
      prisma.loginLog.create({
        data: { userId: user.id, ipAddress, userAgent, success: true },
      }),
      (async () => {
        const cacheKey = `shop_assignments:${user.id}`;
        const cached = await redis.get<any[]>(cacheKey);
        if (cached) return cached;

        const shops = user.role === 'SUPER_DUPER_ADMIN'
          ? await prisma.shop.findMany({
              where: { createdBy: user.id, isActive: true },
              select: { id: true, name: true, location: true },
            })
          : await prisma.userShopAssignment.findMany({
              where: { userId: user.id, active: true },
              select: { shop: { select: { id: true, name: true, location: true } } },
            }).then((a) => a.map((x) => x.shop));

        await redis.set(cacheKey, shops, 600);
        return shops;
      })(),
    ]);

    // Update lastLogin timestamp asynchronously (don't wait for it)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(error => {
      console.error(`❌ [${requestId}] Failed to update lastLoginAt:`, error);
    });

    // Record successful login
    await rateLimiter.recordAttempt('login', ipAddress, true);

    const totalTime = performance.now() - startTime;

    console.log(`✅ [${requestId}] Login successful in ${totalTime.toFixed(2)}ms`);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        },
        token,
        refreshToken,
        assignedShops: assignedShops?.map(shop => ({
          ...shop,
          id: shop.id.toString()
        })) || [],
        loginId: loginLog.id.toString()
      },
      performance: {
        totalTime: totalTime.toFixed(2),
        cacheHit: !!user,
        requestId
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Login error:`, error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Login failed',
      code: 'LOGIN_ERROR'
    }, { status: 500 });
  }
}

// Optimized logout endpoint
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Blacklist the token in Redis (O(1), no DB write)
    await blacklistToken(token);

    const decoded = await validateToken(token);
    const userId = decoded?.userId;

    // Clear user caches in parallel (best-effort)
    await Promise.all([
      userId ? redis.del(`user:ctx:${userId}`, `shop_assignments:${userId}`) : Promise.resolve(),
      decoded?.email ? redis.del(`user:auth:${decoded.email.toLowerCase()}`) : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Logout failed',
      code: 'LOGOUT_ERROR'
    }, { status: 500 });
  }
}

// Ultra-optimized refresh token endpoint
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_MISSING'
      }, { status: 400 });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string,
      {
        issuer: 'building-materials-inventory',
        audience: 'building-materials-users'
      }
    ) as any;

    if (decoded.type !== 'refresh') {
      return NextResponse.json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      }, { status: 401 });
    }

    // Check Redis cache for user data
    const userCacheKey = `user:${decoded.userId}`;
    let user = await redisService.get<any>(userCacheKey);

    if (!user) {
      // Get user data
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true
        }
      });

      if (user) {
        // Cache user data for 5 minutes
        const userForCache = { 
          ...user,
          id: Number(user.id) // Convert BigInt to Number for caching
        };
        await redisService.set(userCacheKey, userForCache, 300);
      }
    }

    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        message: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      }, { status: 401 });
    }

    // Generate new token pair using shared helper (15m access + 7d refresh)
    const { accessToken: newToken, refreshToken: newRefreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.role,
    );

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Token refresh failed',
      code: 'REFRESH_ERROR'
    }, { status: 500 });
  }
}

// Ultra-optimized password change endpoint
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    
    if (!decoded) {
      return NextResponse.json({
        success: false,
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      }, { status: 401 });
    }

    const body = await req.json();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown';

    // Rate limiting for password change
    const rateLimitResult = await rateLimiter.checkRateLimit('passwordChange', decoded.email, ipAddress);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Too many password change attempts. Please try again later.',
        code: 'PASSWORD_CHANGE_RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Validate input
    const validation = validateInput(passwordChangeSchema, body);
    if (!validation.success) {
      await rateLimiter.recordAttempt('passwordChange', decoded.email, false);
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: validation.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { currentPassword, newPassword, otp } = validation.data;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      await rateLimiter.recordAttempt('passwordChange', user.email, false);
      return NextResponse.json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      }, { status: 401 });
    }

    // For SUPER_DUPER_ADMIN, require OTP
    if (user.role === 'SUPER_DUPER_ADMIN') {
      if (!otp) {
        // Generate and send OTP
        const changePasswordOTP = generateOTP();
        const otpKey = `change_password_otp:${user.email.toLowerCase()}`;
        
        await redisService.set(otpKey, {
          otp: changePasswordOTP,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
          userId: Number(user.id) // Convert BigInt to Number
        }, 600);

        // Send OTP via email asynchronously
        emailService.sendPasswordChangeOTP(user.email, changePasswordOTP, user.name).catch(error => {
          console.error('Failed to send password change OTP:', error);
        });

        return NextResponse.json({
          success: false,
          message: 'OTP required for password change',
          code: 'OTP_REQUIRED',
          data: {
            requiresOTP: true,
            email: user.email,
            maskedEmail: maskEmail(user.email)
          }
        }, { status: 200 });
      } else {
        // Validate 2FA input
        const otpValidation = validateInput(passwordChange2FASchema, { currentPassword, newPassword, otp });
        if (!otpValidation.success) {
          await rateLimiter.recordAttempt('passwordChange', user.email, false);
          return NextResponse.json({
            success: false,
            message: 'Invalid 2FA data',
            errors: otpValidation.errors,
            code: '2FA_VALIDATION_ERROR'
          }, { status: 400 });
        }

        // Verify OTP from Redis
        const otpKey = `change_password_otp:${user.email.toLowerCase()}`;
        const storedOTPData = await redisService.get<any>(otpKey);
        
        if (!storedOTPData || storedOTPData.otp !== otp || Date.now() > storedOTPData.expiresAt) {
          await rateLimiter.recordAttempt('passwordChange', user.email, false);
          return NextResponse.json({
            success: false,
            message: 'Invalid or expired OTP',
            code: 'INVALID_OTP'
          }, { status: 401 });
        }

        // Clear OTP after successful verification
        await redisService.del(otpKey);
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear cache in parallel
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }),
      redisService.del(`user:${user.email}`)
    ]);

    // Record successful password change
    await rateLimiter.recordAttempt('passwordChange', user.email, true);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    }, { status: 500 });
  }
} 