import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  userAgent: string;
  ipAddress?: string;
  canvasFingerprint?: string;
  webglFingerprint?: string;
  audioFingerprint?: string;
  fonts: string[];
  plugins: string[];
  hardwareConcurrency: number;
  deviceMemory?: number;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  doNotTrack: string;
  adBlockDetected: boolean;
}

export interface TrustedDeviceData {
  userId: number;
  deviceFingerprint: DeviceFingerprint;
  rememberDevice: boolean;
}

class DeviceFingerprintService {
  
  /**
   * Generate a unique device ID from multiple device characteristics
   */
  generateDeviceId(fingerprint: Partial<DeviceFingerprint>): string {
    const components = [
      fingerprint.browser,
      fingerprint.os,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.platform,
      fingerprint.hardwareConcurrency,
      fingerprint.deviceMemory,
      fingerprint.maxTouchPoints,
      fingerprint.canvasFingerprint,
      fingerprint.webglFingerprint,
      fingerprint.audioFingerprint
    ].filter(Boolean);
    
    // Create a hash-like string from components
    const combined = components.join('|');
    return this.simpleHash(combined);
  }

  /**
   * Simple hash function for device ID generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if device is trusted for user
   */
  async isDeviceTrusted(userId: number, deviceId: string): Promise<boolean> {
    try {
      const trustedDevice = await prisma.trustedDevice.findUnique({
        where: {
          userId_deviceId: {
            userId: BigInt(userId),
            deviceId: deviceId
          }
        }
      });
      
      return !!trustedDevice;
    } catch (error) {
      console.error('Error checking trusted device:', error);
      return false;
    }
  }

  /**
   * Add device as trusted
   */
  async addTrustedDevice(data: TrustedDeviceData): Promise<boolean> {
    try {
      const { userId, deviceFingerprint, rememberDevice } = data;
      
      if (!rememberDevice) {
        return false; // Don't add if user didn't choose to remember
      }

      const deviceId = this.generateDeviceId(deviceFingerprint);
      
      // Check if device already exists
      const existingDevice = await prisma.trustedDevice.findUnique({
        where: {
          userId_deviceId: {
            userId: BigInt(userId),
            deviceId: deviceId
          }
        }
      });

      if (existingDevice) {
        // Update last used time
        await prisma.trustedDevice.update({
          where: { id: existingDevice.id },
          data: { lastUsedAt: new Date() }
        });
        return true;
      }

      // Create new trusted device using raw SQL to bypass TypeScript issues
      await prisma.$executeRaw`
        INSERT INTO "TrustedDevice" (
          "userId", "deviceId", "deviceName", "ipAddress", "userAgent", 
          "deviceFingerprint", "lastUsedAt", "createdAt"
        ) VALUES (
          ${BigInt(userId)}, ${deviceId}, ${deviceFingerprint.deviceName}, 
          ${deviceFingerprint.ipAddress}, ${deviceFingerprint.userAgent},
          ${JSON.stringify(deviceFingerprint)}, NOW(), NOW()
        )
      `;

      console.log(`✅ Device added as trusted for user ${userId}: ${deviceFingerprint.deviceName}`);
      return true;
    } catch (error) {
      console.error('Error adding trusted device:', error);
      return false;
    }
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: number, deviceId: string): Promise<boolean> {
    try {
      await prisma.trustedDevice.delete({
        where: {
          userId_deviceId: {
            userId: BigInt(userId),
            deviceId: deviceId
          }
        }
      });
      
      console.log(`✅ Trusted device removed for user ${userId}: ${deviceId}`);
      return true;
    } catch (error) {
      console.error('Error removing trusted device:', error);
      return false;
    }
  }

  /**
   * Get all trusted devices for user
   */
  async getUserTrustedDevices(userId: number): Promise<any[]> {
    try {
      const devices = await prisma.trustedDevice.findMany({
        where: { userId: BigInt(userId) },
        orderBy: { lastUsedAt: 'desc' }
      });

      return devices.map(device => ({
        id: Number(device.id),
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        lastUsedAt: device.lastUsedAt,
        createdAt: device.createdAt
      }));
    } catch (error) {
      console.error('Error fetching trusted devices:', error);
      return [];
    }
  }

  /**
   * Generate device fingerprint from client-side data
   */
  generateFingerprintFromClient(clientData: any): DeviceFingerprint {
    return {
      deviceId: '', // Will be generated
      deviceName: clientData.deviceName || 'Unknown Device',
      browser: clientData.browser || 'Unknown Browser',
      os: clientData.os || 'Unknown OS',
      screenResolution: clientData.screenResolution || 'Unknown',
      timezone: clientData.timezone || 'Unknown',
      language: clientData.language || 'Unknown',
      platform: clientData.platform || 'Unknown',
      userAgent: clientData.userAgent || 'Unknown',
      ipAddress: clientData.ipAddress,
      canvasFingerprint: clientData.canvasFingerprint,
      webglFingerprint: clientData.webglFingerprint,
      audioFingerprint: clientData.audioFingerprint,
      fonts: clientData.fonts || [],
      plugins: clientData.plugins || [],
      hardwareConcurrency: clientData.hardwareConcurrency || 0,
      deviceMemory: clientData.deviceMemory,
      maxTouchPoints: clientData.maxTouchPoints || 0,
      cookieEnabled: clientData.cookieEnabled || false,
      doNotTrack: clientData.doNotTrack || 'Unknown',
      adBlockDetected: clientData.adBlockDetected || false
    };
  }

  /**
   * Check if 2FA should be skipped for trusted device
   */
  async shouldSkip2FA(userId: number, deviceId: string): Promise<boolean> {
    try {
      const isTrusted = await this.isDeviceTrusted(userId, deviceId);
      
      if (!isTrusted) {
        return false;
      }

      // Check if device was used recently (within last 30 days)
      const trustedDevice = await prisma.trustedDevice.findUnique({
        where: {
          userId_deviceId: {
            userId: BigInt(userId),
            deviceId: deviceId
          }
        }
      });

      if (!trustedDevice) {
        return false;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return trustedDevice.lastUsedAt > thirtyDaysAgo;
    } catch (error) {
      console.error('Error checking 2FA skip:', error);
      return false;
    }
  }

  /**
   * Update device last used time
   */
  async updateDeviceLastUsed(userId: number, deviceId: string): Promise<void> {
    try {
      await prisma.trustedDevice.updateMany({
        where: {
          userId: BigInt(userId),
          deviceId: deviceId
        },
        data: {
          lastUsedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating device last used:', error);
    }
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
export default deviceFingerprintService;
