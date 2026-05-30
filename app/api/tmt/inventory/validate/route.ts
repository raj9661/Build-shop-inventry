import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/app/lib/tokenUtils'
import { canAccessShop } from '@/app/lib/shopAccessUtils'


export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { productId, shopId, requiredKg } = await request.json()
    
    if (!productId || !shopId || requiredKg === undefined) {
      return NextResponse.json(
        { success: false, message: 'productId, shopId, and requiredKg are required' },
        { status: 400 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      })
      
      if (!shop) {
        return NextResponse.json(
          { success: false, message: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, parseInt(shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, message: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }

    const inventory = await prisma.tmtInventory.findFirst({
      where: {
        productId: BigInt(productId),
        shopId: BigInt(parseInt(shopId))
      },
      select: {
        availableQtyKg: true
      }
    })

    const availableKg = inventory ? Number(inventory.availableQtyKg) : 0
    const available = availableKg >= requiredKg

    return NextResponse.json({
      success: true,
      data: { available, availableKg }
    })
  } catch (error) {
    console.error('Error validating inventory:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to validate inventory' },
      { status: 500 }
    )
  } finally {
  }
}
