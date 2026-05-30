import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { securityService } from '@/app/lib/security-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const email = session.user.email || 'User';

    // Check if user already has 2FA enabled
    const existing = await prisma.user2FASetting.findUnique({
      where: { userId: BigInt(userId) }
    });

    if (existing?.isEnabled) {
      return NextResponse.json({ success: false, message: 'MFA is already enabled' }, { status: 400 });
    }

    let secret = existing?.secret;
    let otpauthUrl;

    if (!secret) {
      // Generate new secret
      const generated = securityService.generateMfaSecret(email);
      secret = generated.secret;
      otpauthUrl = generated.otpauthUrl;

      // Save secret to database temporarily
      await prisma.user2FASetting.upsert({
        where: { userId: BigInt(userId) },
        update: { secret, otp_method: 'authenticator', isEnabled: false },
        create: { 
          userId: BigInt(userId), 
          secret, 
          otp_method: 'authenticator', 
          isEnabled: false 
        }
      });
    } else {
      // Re-generate the URL for the existing secret
      const speakeasy = require('speakeasy');
      otpauthUrl = speakeasy.otpauthURL({ 
        secret: secret, 
        label: `InventryPro (${email})`, 
        encoding: 'base32' 
      });
    }

    // We use a free, privacy-friendly QR code generator API
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(otpauthUrl!)}&size=200`;

    return NextResponse.json({
      success: true,
      qrCodeUrl,
      secret
    });
  } catch (error) {
    console.error('Error generating MFA:', error);
    return NextResponse.json({ success: false, message: 'Failed to generate MFA' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token || token.length !== 6) {
      return NextResponse.json({ success: false, message: 'Invalid token format' }, { status: 400 });
    }

    const userId = parseInt((session.user as any).id);

    const user2FA = await prisma.user2FASetting.findUnique({
      where: { userId: BigInt(userId) }
    });

    if (!user2FA || !user2FA.secret) {
      return NextResponse.json({ success: false, message: 'MFA setup not found' }, { status: 404 });
    }

    // Verify token
    const isValid = securityService.verifyMfaToken(user2FA.secret, token);

    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid authentication code' }, { status: 400 });
    }

    // If valid, enable it
    await prisma.user2FASetting.update({
      where: { userId: BigInt(userId) },
      data: { isEnabled: true }
    });

    return NextResponse.json({ success: true, message: 'MFA verified successfully' });
  } catch (error) {
    console.error('Error verifying MFA:', error);
    return NextResponse.json({ success: false, message: 'Failed to verify MFA token' }, { status: 500 });
  }
}
