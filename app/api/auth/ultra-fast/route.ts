import { NextRequest, NextResponse } from 'next/server';
import { validateInput, loginSchema } from '@/app/lib/validation-schemas';
import ultraFastAuth from '@/app/lib/ultra-fast-auth';
import { performance } from 'perf_hooks';

// Ultra-fast login endpoint
export async function POST(req: NextRequest) {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`⚡ [${requestId}] Ultra-fast login called`);
    
    // Fast request parsing with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
    
    const body = await req.json();
    clearTimeout(timeoutId);
    
    // Quick validation
    const validation = validateInput(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: validation.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Ultra-fast login using optimized service
    const result = await ultraFastAuth.login(email, password);
    
    const totalTime = performance.now() - startTime;
    console.log(`⚡ [${requestId}] Login completed in ${totalTime.toFixed(2)}ms`);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Login successful',
        data: result.data,
        performance: {
          totalTime: totalTime.toFixed(2),
          requestId
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
        code: result.code
      }, { status: 401 });
    }

  } catch (error) {
    console.error('Ultra-fast login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    }, { status: 500 });
  }
}

// Get performance statistics
export async function GET(req: NextRequest) {
  try {
    const stats = ultraFastAuth.getCacheStats();
    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get stats'
    }, { status: 500 });
  }
} 