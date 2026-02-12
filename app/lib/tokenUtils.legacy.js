const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to decode base64 JWT secret
const getDecodedJWTSecret = () => {
  let jwtSecret = process.env.JWT_SECRET;
  try {
    if (jwtSecret.match(/^[A-Za-z0-9+/]+=*$/)) {
      jwtSecret = Buffer.from(jwtSecret, 'base64').toString('utf-8');
    }
  } catch (decodeError) {
    // Use as-is if not base64
  }
  return jwtSecret;
};

// Generate JWT token
const generateToken = (payload, expiresIn = '24h') => {
  try {
    const jwtSecret = getDecodedJWTSecret();
    return jwt.sign(payload, jwtSecret, {
      expiresIn,
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users'
    });
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate token');
  }
};

// Validate JWT token
const validateToken = async (token) => {
  try {
    const jwtSecret = getDecodedJWTSecret();
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users'
    });

    // Check if token is blacklisted (for logout functionality)
    const blacklistedToken = await prisma.loginLog.findFirst({
      where: {
        userId: decoded.userId,
        status: 'logged_out',
        logged_out_at: {
          gte: new Date(decoded.iat * 1000) // Token issued after logout
        }
      }
    });

    if (blacklistedToken) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  try {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        expiresIn: '7d',
        issuer: 'building-materials-inventory',
        audience: 'building-materials-users'
      }
    );
  } catch (error) {
    console.error('Refresh token generation error:', error);
    throw new Error('Failed to generate refresh token');
  }
};

// Validate refresh token
const validateRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        issuer: 'building-materials-inventory',
        audience: 'building-materials-users'
      }
    );

    if (decoded.type !== 'refresh') {
      return null;
    }

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, is_active: true }
    });

    if (!user || !user.is_active) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Refresh token validation error:', error);
    return null;
  }
};

// Generate OTP token for device verification
const generateOTPToken = (userId, deviceInfo) => {
  try {
    return jwt.sign(
      { userId, deviceInfo, type: 'otp' },
      process.env.JWT_SECRET,
      {
        expiresIn: '10m', // OTP expires in 10 minutes
        issuer: 'building-materials-inventory',
        audience: 'building-materials-users'
      }
    );
  } catch (error) {
    console.error('OTP token generation error:', error);
    throw new Error('Failed to generate OTP token');
  }
};

// Validate OTP token
const validateOTPToken = (otpToken) => {
  try {
    const decoded = jwt.verify(otpToken, process.env.JWT_SECRET, {
      issuer: 'building-materials-inventory',
      audience: 'building-materials-users'
    });

    if (decoded.type !== 'otp') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('OTP token validation error:', error);
    return null;
  }
};

// Blacklist token (for logout)
const blacklistToken = async (userId, loginId) => {
  try {
    await prisma.loginLog.update({
      where: { id: loginId },
      data: {
        status: 'logged_out',
        logged_out_at: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Token blacklist error:', error);
    return false;
  }
};

// Generate device fingerprint
const generateDeviceFingerprint = (userAgent, ipAddress) => {
  const crypto = require('crypto');
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}-${ipAddress}-${process.env.DEVICE_SECRET || 'default'}`)
    .digest('hex');
  
  return fingerprint;
};

// Extract device info from user agent
const extractDeviceInfo = (userAgent) => {
  const deviceInfo = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Unknown'
  };

  try {
    // Simple device detection (can be enhanced with ua-parser-js)
    if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
    else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
    else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';

    if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
    else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
    else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
    else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
    else if (userAgent.includes('iOS')) deviceInfo.os = 'iOS';

    if (userAgent.includes('Mobile')) deviceInfo.device = 'Mobile';
    else if (userAgent.includes('Tablet')) deviceInfo.device = 'Tablet';
    else deviceInfo.device = 'Desktop';
  } catch (error) {
    console.error('Device info extraction error:', error);
  }

  return deviceInfo;
};

module.exports = {
  generateToken,
  validateToken,
  generateRefreshToken,
  validateRefreshToken,
  generateOTPToken,
  validateOTPToken,
  blacklistToken,
  generateDeviceFingerprint,
  extractDeviceInfo
}; 