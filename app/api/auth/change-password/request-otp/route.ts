import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import otpUtils from '@/app/lib/otpUtils';
import emailService from '@/app/lib/emailService';
import redisService from '@/app/lib/redis-service';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
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
        const { email } = body;

        if (!email) {
            return NextResponse.json({
                success: false,
                message: 'Email is required',
                code: 'EMAIL_MISSING'
            }, { status: 400 });
        }

        // Load the logged-in user to check permissions
        const requestingUser = await prisma.user.findUnique({
            where: { id: BigInt(decoded.userId) },
            select: { id: true, email: true, role: true, name: true }
        });

        if (!requestingUser) {
            return NextResponse.json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            }, { status: 404 });
        }

        const targetEmail = email.toLowerCase();

        // 24-hour Rate Limiting Check for Change Password OTP
        const rateLimitKey = `ratelimit:change-password:${targetEmail}`;
        const hasRequested = await redisService.get(rateLimitKey);
        if (hasRequested) {
            return NextResponse.json({
                success: false,
                message: 'You can only request to change a password once per day. Please try again tomorrow.',
                code: 'RATE_LIMIT_EXCEEDED'
            }, { status: 429 });
        }

        // Check if user is requesting OTP for their own email
        const isSelf = targetEmail === requestingUser.email.toLowerCase();

        let targetUser = null;

        if (isSelf) {
            // User changing their own password
            targetUser = await prisma.user.findUnique({
                where: { email: targetEmail },
                select: { id: true, name: true, email: true }
            });
        } else {
            // User trying to change someone else's password
            // Only SUPER_DUPER_ADMIN allowed to change passwords for their users
            if (requestingUser.role !== 'SUPER_DUPER_ADMIN') {
                return NextResponse.json({
                    success: false,
                    message: 'You are only authorized to change your own password.',
                    code: 'UNAUTHORIZED_SCOPED'
                }, { status: 403 });
            }

            // Check if the target user actually exists in the DB
            targetUser = await prisma.user.findUnique({
                where: { email: targetEmail },
                select: { id: true, name: true, email: true }
            });

            if (!targetUser) {
                return NextResponse.json({
                    success: false,
                    message: `No user assigned to your account was found with the email ${targetEmail}.`,
                    code: 'TARGET_USER_NOT_FOUND'
                }, { status: 404 });
            }

            // NOTE: We could verify if the user belongs to their shop via UserShopAssignment, 
            // but SUPER_DUPER_ADMIN generally has global access to all shops.
        }

        if (!targetUser) {
            return NextResponse.json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            }, { status: 404 });
        }

        // Generate and store OTP
        const otp = otpUtils.generateOTP();
        await otpUtils.storeOTP(targetUser.email, otp, Number(targetUser.id), 10, 'PASSWORD_CHANGE');

        // Email delivery - send to the admin if they are changing someone else's password
        const deliveryEmail = isSelf ? targetUser.email : requestingUser.email;
        const deliveryName = isSelf ? targetUser.name : requestingUser.name;

        const emailSent = await emailService.sendPasswordChangeOTP(deliveryEmail, otp, deliveryName);

        if (!emailSent) {
            return NextResponse.json({
                success: false,
                message: 'Failed to send OTP email',
                code: 'EMAIL_SEND_FAILED'
            }, { status: 500 });
        }

        // Record successful rate limit for 24 hours (86400 seconds)
        await redisService.set(rateLimitKey, true, 24 * 60 * 60);

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully to the provided email.'
        });

    } catch (error) {
        console.error('Request OTP error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to request OTP',
            code: 'REQUEST_OTP_ERROR'
        }, { status: 500 });
    }
}
