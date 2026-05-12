import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { emailService } from '@/app/lib/email-service';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, company, phone, subscribeNewsletter } = await req.json();

    // Validate required fields
    if (!name || !email || !password || !company || !phone) {
      return NextResponse.json({
        success: false,
        message: 'All required fields must be provided'
      }, { status: 400 });
    }

    // Check if user already exists by email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUserByEmail) {
      return NextResponse.json({
        success: false,
        message: 'An account with this email address already exists. Please use a different email or try signing in.'
      }, { status: 409 });
    }

    // Check if user already exists by phone
    const existingUserByPhone = await prisma.user.findFirst({
      where: { phone }
    });

    if (existingUserByPhone) {
      return NextResponse.json({
        success: false,
        message: 'An account with this phone number already exists. Please use a different phone number or try signing in.'
      }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate username from email (before @ symbol)
    let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Ensure username is not empty and add fallback
    if (!username) {
      username = 'user' + Date.now();
    }

    // Check if username already exists and add suffix if needed
    let finalUsername = username;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
      finalUsername = `${username}${counter}`;
      counter++;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username: finalUsername,
        email,
        password: hashedPassword,
        phone,
        role: 'SUPER_DUPER_ADMIN', // Customer becomes admin of their business instance
        isActive: true,
        emailVerified: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true
      }
    });

    // Create default shop for the user
    const defaultShop = await prisma.shop.create({
      data: {
        name: company,
        location: 'Main Location',
        createdBy: user.id
      }
    });

    // Send verification email
    try {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store verification code in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationCode
        }
      });

      await emailService.sendVerificationCode({
        name: user.name,
        email: user.email,
        code: verificationCode,
        expiresIn: 10
      });
      console.log(`✅ Verification email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't fail registration if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Please check your email for verification code.',
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      },
      shop: {
        id: Number(defaultShop.id),
        name: defaultShop.name,
        location: defaultShop.location
      },
      requiresVerification: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create account. Please try again.'
    }, { status: 500 });
  }
}
