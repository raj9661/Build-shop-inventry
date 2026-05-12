import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateToken } from '@/app/lib/tokenUtils'
import { canAccessShop } from '@/app/lib/shopAccessUtils'

const prisma = new PrismaClient()

// GET /api/tmt/bars/[id] - Get specific TMT bar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const tmtBar = await prisma.tmtBar.findUnique({
      where: { id: id }
    })

    if (!tmtBar) {
      return NextResponse.json(
        { success: false, message: 'TMT bar not found' },
        { status: 404 }
      )
    }

    // Get shop to verify ownership/access
    const shop = await prisma.shop.findUnique({
      where: { id: BigInt(tmtBar.shopId) }
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, message: 'Shop not found' },
        { status: 404 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the bar's shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (shop.createdBy !== BigInt(decoded.userId)) {
        return NextResponse.json(
          { error: 'You can only view TMT bars from shops you created' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to the bar's shop
      const hasAccess = await canAccessShop(token, Number(tmtBar.shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      data: { tmtBar }
    })
  } catch (error) {
    console.error('Error fetching TMT bar:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch TMT bar' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// PUT /api/tmt/bars/[id] - Update TMT bar
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    
    // Verify user has access to this bar
    const tmtBar = await prisma.tmtBar.findUnique({
      where: { id: id }
    })

    if (!tmtBar) {
      return NextResponse.json(
        { success: false, message: 'TMT bar not found' },
        { status: 404 }
      )
    }

    // Get shop to verify ownership/access
    const shop = await prisma.shop.findUnique({
      where: { id: BigInt(tmtBar.shopId) }
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, message: 'Shop not found' },
        { status: 404 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the bar's shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (shop.createdBy !== BigInt(decoded.userId)) {
        return NextResponse.json(
          { error: 'You can only edit TMT bars from shops you created' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to the bar's shop
      const hasAccess = await canAccessShop(token, Number(tmtBar.shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const {
      companyName,
      sizeMM,
      bundleSize,
      weightPerPiece,
      arrivalTons,
      sellByWeight,
      sellByBundle,
      sellByPiece,
      mixedLoad
    } = body

    // Calculate derived values
    const bundleWeight = bundleSize * weightPerPiece
    const totalKg = arrivalTons * 1000
    const totalBundles = Math.floor(totalKg / bundleWeight)
    const totalPieces = totalBundles * bundleSize

    const updatedBar = await prisma.tmtBar.update({
      where: { id: id },
      data: {
        companyName,
        sizeMM: parseFloat(sizeMM),
        bundleSize: parseInt(bundleSize),
        weightPerPiece: parseFloat(weightPerPiece),
        bundleWeight,
        arrivalTons: parseFloat(arrivalTons),
        totalBundles,
        totalPieces,
        sellByWeight: sellByWeight ?? true,
        sellByBundle: sellByBundle ?? false,
        sellByPiece: sellByPiece ?? false,
        mixedLoad: mixedLoad ?? false
      }
    })
    
    return NextResponse.json({
      success: true,
      data: { tmtBar: updatedBar }
    })
  } catch (error) {
    console.error('Error updating TMT bar:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update TMT bar' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE /api/tmt/bars/[id] - Delete TMT bar
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    
    // Verify user has access to this bar
    const tmtBar = await prisma.tmtBar.findUnique({
      where: { id: id }
    })

    if (!tmtBar) {
      return NextResponse.json(
        { success: false, message: 'TMT bar not found' },
        { status: 404 }
      )
    }

    // Get shop to verify ownership/access
    const shop = await prisma.shop.findUnique({
      where: { id: BigInt(tmtBar.shopId) }
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, message: 'Shop not found' },
        { status: 404 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the bar's shop belongs to this SUPER_DUPER_ADMIN
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (shop.createdBy !== BigInt(decoded.userId)) {
        return NextResponse.json(
          { error: 'You can only delete TMT bars from shops you created' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to the bar's shop
      const hasAccess = await canAccessShop(token, Number(tmtBar.shopId))
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this shop' },
          { status: 403 }
        )
      }
    }

    await prisma.tmtBar.delete({
      where: { id: id }
    })
    
    return NextResponse.json({
      success: true,
      message: 'TMT bar deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting TMT bar:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete TMT bar' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
