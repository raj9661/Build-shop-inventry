import redisService from '@/app/lib/redis-service';

// OTP storage and management utility
interface OTPData {
  otp: string;
  expiresAt: Date;
  userId: number;
}

const otpUtils = {
  // Generate a 6-digit OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Store OTP for an email in Redis
  async storeOTP(email: string, otp: string, userId: number, expiryMinutes: number = 10, type: string = 'PASSWORD_CHANGE'): Promise<void> {
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const key = `otp:${type}:${email.toLowerCase()}`;

    const data: OTPData = {
      otp,
      expiresAt,
      userId
    };

    // Store in Redis with TTL in seconds
    await redisService.set(key, data, expiryMinutes * 60);
  },

  // Get OTP data for an email from Redis
  async getOTP(email: string, type: string = 'PASSWORD_CHANGE'): Promise<OTPData | null> {
    const key = `otp:${type}:${email.toLowerCase()}`;
    const otpRecord = await redisService.get<OTPData>(key);

    if (!otpRecord) return null;

    // Convert string date back to Date object if needed
    const expiresAt = new Date(otpRecord.expiresAt);

    // Check if expired
    if (new Date() > expiresAt) {
      // Delete expired OTP
      await redisService.del(key);
      return null;
    }

    return {
      otp: otpRecord.otp,
      expiresAt: expiresAt,
      userId: otpRecord.userId
    };
  },

  // Verify OTP
  async verifyOTP(email: string, otp: string, type: string = 'PASSWORD_CHANGE'): Promise<{ valid: boolean; userId?: number; message?: string }> {
    const data = await this.getOTP(email, type);

    if (!data) {
      return { valid: false, message: 'OTP not found or expired' };
    }

    if (data.otp !== otp) {
      return { valid: false, message: 'Invalid OTP' };
    }

    // Remove OTP after successful verification
    await this.removeOTP(email, type);

    return { valid: true, userId: data.userId };
  },

  // Remove OTP (for cleanup)
  async removeOTP(email: string, type: string = 'PASSWORD_CHANGE'): Promise<void> {
    const key = `otp:${type}:${email.toLowerCase()}`;
    await redisService.del(key);
  },

  // Clean up expired OTPs (handled automatically by Redis TTL)
  async cleanupExpiredOTPs(): Promise<void> {
    // Redis handles expiration automatically via TTL, so this is just a no-op for compatibility
    console.log('Redis automatically handles OTP cleanup via TTL.');
  }
};

export default otpUtils; 