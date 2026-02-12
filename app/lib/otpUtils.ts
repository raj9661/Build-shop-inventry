import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // Store OTP for an email in database
  async storeOTP(email: string, otp: string, userId: number, expiryMinutes: number = 10, type: string = 'PASSWORD_CHANGE'): Promise<void> {
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    // Delete any existing OTP for this email and type
    await prisma.oTP.deleteMany({
      where: { email: email.toLowerCase(), type }
    });

    // Store new OTP
    await prisma.oTP.create({
      data: {
        email: email.toLowerCase(),
        otp,
        expiresAt,
        userId,
        type
      }
    });
  },

  // Get OTP data for an email from database
  async getOTP(email: string, type: string = 'PASSWORD_CHANGE'): Promise<OTPData | null> {
    const otpRecord = await prisma.oTP.findFirst({
      where: { 
        email: email.toLowerCase(),
        type
      }
    });

    if (!otpRecord) return null;

    // Check if expired
    if (new Date() > otpRecord.expiresAt) {
      // Delete expired OTP
      await prisma.oTP.delete({
        where: { id: otpRecord.id }
      });
      return null;
    }

    return {
      otp: otpRecord.otp,
      expiresAt: otpRecord.expiresAt,
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
    await prisma.oTP.deleteMany({
      where: { 
        email: email.toLowerCase(),
        type
      }
    });
    
    return { valid: true, userId: data.userId };
  },

  // Remove OTP (for cleanup)
  async removeOTP(email: string, type: string = 'PASSWORD_CHANGE'): Promise<void> {
    await prisma.oTP.deleteMany({
      where: { 
        email: email.toLowerCase(),
        type
      }
    });
  },

  // Clean up expired OTPs
  async cleanupExpiredOTPs(): Promise<void> {
    await prisma.oTP.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }
};

export default otpUtils; 