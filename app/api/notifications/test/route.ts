import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { emailService } from '@/app/lib/emailService';

export async function POST(req: NextRequest) {
  try {
    // Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    // Check if user is SUPER_DUPER_ADMIN
    if (decoded.role !== 'SUPER_DUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Insufficient permissions' }, { status: 403 });
    }

    const { email, shopName } = await req.json();

    if (!email || !shopName) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email and shop name are required' 
      }, { status: 400 });
    }

    // Send test notification
    const success = await emailService.sendTestNotification(email, shopName);

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test notification sent successfully' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to send test notification' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
} 