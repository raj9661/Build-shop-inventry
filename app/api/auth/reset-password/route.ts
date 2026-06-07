import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { securityService } from '@/app/lib/security-service';


export async function POST(req: NextRequest) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || !newPassword) {
            return NextResponse.json({
                success: false,
                message: 'Token and new password are required',
                code: 'MISSING_FIELDS'
            }, { status: 400 });
        }

        // Verify JWT token signature and expiry (Latest Tech)
        // Token is URL-encoded in the email link — decode it first
        let decodedToken;
        try {
            const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-development';
            const rawToken = decodeURIComponent(token);
            decodedToken = jwt.verify(rawToken, jwtSecret) as { userId: number, email: string, purpose: string };

            if (decodedToken.purpose !== 'password_reset') {
                throw new Error('Invalid token purpose');
            }
            // Re-assign token to decoded form for hashing below
            Object.assign(req, { _decodedRawToken: rawToken });
        } catch (error) {
            return NextResponse.json({
                success: false,
                message: 'Invalid or expired password reset token',
                code: 'INVALID_TOKEN'
            }, { status: 400 });
        }

        // Hash the incoming token to match what's stored in the database.
        // Must decode first since the token was URL-encoded in the email link.
        const rawToken = decodeURIComponent(token);
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Find the user with this token and ensure it has not expired in DB
        const user = await prisma.user.findFirst({
            where: {
                id: BigInt(decodedToken.userId),
                passwordResetToken: hashedToken,
                passwordResetExpires: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return NextResponse.json({
                success: false,
                message: 'Password reset token has already been used or revoked',
                code: 'TOKEN_USED'
            }, { status: 400 });
        }

        // Validate password against security policy
        const passwordValidation = await securityService.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return NextResponse.json({
                success: false,
                message: passwordValidation.errors.join(', '),
                code: 'WEAK_PASSWORD'
            }, { status: 400 });
        }

        // Hash new password using security service
        const hashedPassword = await securityService.hashPassword(newPassword);

        // Update the user's password and clear the reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                updatedAt: new Date()
            }
        });

        // Log the event if tracking IP
        await securityService.logSecurityEvent(
            Number(user.id),
            'password_reset',
            'Password successfully reset using recovery email link',
            req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown',
            req.headers.get('user-agent') || 'Unknown'
        );

        console.log(`Password successfully reset for user: ${user.email}`);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to reset password',
            code: 'RESET_PASSWORD_ERROR'
        }, { status: 500 });
    }
}
