import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateToken } from '@/app/lib/tokenUtils'
import { getShopFilter, canAccessShop } from '@/app/lib/shopAccessUtils'

const prisma = new PrismaClient()

// GET /api/tmt/bars - Get all TMT bars for a shop
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')
    
    if (!shopId) {
      return NextResponse.json(
        { success: false, message: 'Shop ID is required' },
        { status: 400 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the shop belongs to this SUPER_DUPER_ADMIN
    const shopIdNum = parseInt(shopId)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(shopIdNum),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      })
      
      if (!shop) {
        return NextResponse.json({ 
          success: true, 
          data: { tmtBars: [] } 
        })
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, shopIdNum)
      if (!hasAccess) {
        return NextResponse.json({ 
          success: false, 
          message: 'You do not have access to this shop' 
        }, { status: 403 })
      }
    }

    const tmtBars = await prisma.tmtBar.findMany({
      where: { shopId: shopIdNum },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      success: true,
      data: { tmtBars }
    })
  } catch (error) {
    console.error('Error fetching TMT bars:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch TMT bars' },
      { status: 500 }
    )
  }
}

// POST /api/tmt/bars - Create new TMT bar entry
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 })
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
      mixedLoad,
      shopId
    } = body

    // Validate required fields
    if (!companyName || !sizeMM || !bundleSize || !weightPerPiece || !arrivalTons || !shopId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify the shop belongs to this SUPER_DUPER_ADMIN
    const shopIdNum = parseInt(shopId)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(shopIdNum),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      })
      
      if (!shop) {
        return NextResponse.json(
          { success: false, message: 'You can only create TMT bars for shops you created' },
          { status: 403 }
        )
      }
    } else {
      // For other roles, verify they have access to this shop
      const hasAccess = await canAccessShop(token, shopIdNum)
      if (!hasAccess) {
        return NextResponse.json({ 
          success: false, 
          message: 'You do not have access to this shop' 
        }, { status: 403 })
      }
    }

    // Calculate derived values
    const bundleWeight = bundleSize * weightPerPiece
    const totalKg = arrivalTons * 1000
    const totalBundles = Math.floor(totalKg / bundleWeight)
    const totalPieces = totalBundles * bundleSize

    const tmtBar = await prisma.tmtBar.create({
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
        mixedLoad: mixedLoad ?? false,
        shopId: parseInt(shopId)
      }
    })
    
    return NextResponse.json({
      success: true,
      data: { tmtBar }
    })
  } catch (error) {
    console.error('Error creating TMT bar:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to create TMT bar' },
      { status: 500 }
    )
  }
}
