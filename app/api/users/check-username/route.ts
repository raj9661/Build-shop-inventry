import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateToken } from '@/app/lib/tokenUtils'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const { username, excludeUserId } = await req.json()

    // Check if this is an authenticated request (for user management)
    const authHeader = req.headers.get('authorization')
    let decoded = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        decoded = await validateToken(token)
        if (decoded) {
          console.log('✅ Username check with valid authentication')
        } else {
          console.log('⚠️ JWT verification failed, proceeding without authentication for username check')
        }
      } catch (error) {
        console.error('JWT verification error:', error)
        // For now, allow username checking without authentication to avoid blocking users
        console.log('⚠️ JWT verification failed, proceeding without authentication for username check')
        decoded = null
      }
    } else {
      // For signup page (no authentication required)
      console.log('Username check without authentication (signup page)')
    }

    if (!username || username.trim().length === 0) {
      return NextResponse.json({ 
        available: false, 
        message: 'Username is required' 
      })
    }

    // Check if username exists
    const existingUser = await prisma.user.findFirst({
      where: {
        username: username.trim(),
        ...(excludeUserId && { id: { not: BigInt(excludeUserId) } })
      },
      select: { id: true, username: true }
    })

    if (existingUser) {
      return NextResponse.json({ 
        available: false, 
        message: 'Username is already taken' 
      })
    }

    return NextResponse.json({ 
      available: true, 
      message: 'Username is available' 
    })

  } catch (error) {
    console.error('Username check error:', error)
    return NextResponse.json({ 
      error: 'Failed to check username availability' 
    }, { status: 500 })
  }
}
