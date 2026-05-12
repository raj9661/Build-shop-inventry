import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateToken } from '@/app/lib/tokenUtils'
import { getUserShopAccess } from '@/app/lib/shopAccessUtils'

const prisma = new PrismaClient()

interface Transaction {
  id: string
  type: 'expense' | 'supplier_payment' | 'employee_payment'
  date: string
  time: string
  amount: number
  category?: string
  description?: string
  shopId: number
  shopName: string
  recipientName?: string
  paymentMethod?: string
  notes?: string
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 })
    }

    // Get shop access info
    const accessInfo = await getUserShopAccess(token)
    if (!accessInfo) {
      return NextResponse.json({ success: false, message: 'Failed to get shop access' }, { status: 403 })
    }

    // Build shop filter based on user role
    let shopFilter: any = {}
    if (accessInfo.isSuperDuperAdmin) {
      // SUPER_DUPER_ADMIN: get all shops they created
      const userShops = await prisma.shop.findMany({
        where: {
          createdBy: BigInt(accessInfo.userId),
          isActive: true
        },
        select: { id: true }
      })
      if (userShops.length > 0) {
        shopFilter.shopId = { in: userShops.map(s => s.id) }
      } else {
        // No shops, return empty
        return NextResponse.json({ success: true, data: [] })
      }
    } else {
      // Other roles: get assigned shops
      if (accessInfo.assignedShopIds.length > 0) {
        shopFilter.shopId = { in: accessInfo.assignedShopIds.map(id => BigInt(id)) }
      } else {
        return NextResponse.json({ success: true, data: [] })
      }
    }

    // Get date range from query params
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    const shopIdParam = searchParams.get('shopId')
    
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // If specific shop is requested, filter to that shop
    if (shopIdParam) {
      const shopId = parseInt(shopIdParam)
      if (!isNaN(shopId)) {
        // Verify access to this shop
        const hasAccess = accessInfo.isSuperDuperAdmin 
          ? await prisma.shop.findFirst({
              where: {
                id: BigInt(shopId),
                createdBy: BigInt(accessInfo.userId),
                isActive: true
              }
            })
          : accessInfo.assignedShopIds.includes(shopId)
        
        if (hasAccess) {
          shopFilter.shopId = BigInt(shopId)
        } else {
          return NextResponse.json({ success: false, message: 'Access denied to this shop' }, { status: 403 })
        }
      }
    }

    // Get shops for name lookup
    const shopWhereClause: any = { isActive: true }
    if (shopFilter.shopId) {
      if (typeof shopFilter.shopId === 'bigint' || typeof shopFilter.shopId === 'number') {
        shopWhereClause.id = shopFilter.shopId
      } else if (shopFilter.shopId.in) {
        shopWhereClause.id = { in: shopFilter.shopId.in }
      }
    }
    const shops = await prisma.shop.findMany({
      where: shopWhereClause,
      select: { id: true, name: true }
    })
    const shopMap = new Map(shops.map(s => [Number(s.id), s.name]))

    // Fetch expenses
    const expenseWhereClause: any = {
      date: {
        gte: startDate,
        lte: endDate
      },
      isActive: true
    }
    if (shopFilter.shopId) {
      if (typeof shopFilter.shopId === 'bigint' || typeof shopFilter.shopId === 'number') {
        expenseWhereClause.shopId = shopFilter.shopId
      } else if (shopFilter.shopId.in) {
        expenseWhereClause.shopId = { in: shopFilter.shopId.in }
      }
    }
    const expenses = await prisma.expense.findMany({
      where: expenseWhereClause,
      include: {
        shop: {
          select: { name: true }
        }
      },
      orderBy: { date: 'desc' }
    })

    // Fetch supplier payments
    const supplierWhereClause: any = {
      paymentDate: {
        gte: startDate,
        lte: endDate
      },
      isActive: true
    }
    if (shopFilter.shopId) {
      if (typeof shopFilter.shopId === 'bigint' || typeof shopFilter.shopId === 'number') {
        supplierWhereClause.shopId = shopFilter.shopId
      } else if (shopFilter.shopId.in) {
        supplierWhereClause.shopId = { in: shopFilter.shopId.in }
      }
    }
    const supplierPayments = await prisma.supplierPayment.findMany({
      where: supplierWhereClause,
      include: {
        shop: {
          select: { name: true }
        },
        supplier: {
          select: { name: true }
        }
      },
      orderBy: { paymentDate: 'desc' }
    })

    // Fetch employee payments
    const employeeWhereClause: any = {
      paymentDate: {
        gte: startDate,
        lte: endDate
      },
      isActive: true
    }
    if (shopFilter.shopId) {
      if (typeof shopFilter.shopId === 'bigint' || typeof shopFilter.shopId === 'number') {
        employeeWhereClause.shopId = shopFilter.shopId
      } else if (shopFilter.shopId.in) {
        employeeWhereClause.shopId = { in: shopFilter.shopId.in }
      }
    }
    const employeePayments = await prisma.employeePayment.findMany({
      where: employeeWhereClause,
      include: {
        shop: {
          select: { name: true }
        },
        employee: {
          select: { name: true }
        }
      },
      orderBy: { paymentDate: 'desc' }
    })

    // Combine and format transactions
    const transactions: Transaction[] = []

    // Helper function to format time from a Date object
    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    }

    // Add expenses
    expenses.forEach(exp => {
      // Use createdAt for accurate time, fallback to date if createdAt is not available
      const timeSource = exp.createdAt || exp.date
      transactions.push({
        id: `expense-${exp.id}`,
        type: 'expense',
        date: exp.date.toISOString().split('T')[0],
        time: formatTime(timeSource),
        amount: Number(exp.amount),
        category: exp.category,
        description: exp.description || undefined,
        shopId: Number(exp.shopId),
        shopName: exp.shop.name,
        paymentMethod: undefined,
        notes: undefined
      })
    })

    // Add supplier payments
    supplierPayments.forEach(pay => {
      // Use createdAt for accurate time, fallback to paymentDate if createdAt is not available
      const timeSource = pay.createdAt || pay.paymentDate
      transactions.push({
        id: `supplier-${pay.id}`,
        type: 'supplier_payment',
        date: pay.paymentDate.toISOString().split('T')[0],
        time: formatTime(timeSource),
        amount: Number(pay.amount),
        shopId: Number(pay.shopId),
        shopName: pay.shop.name,
        recipientName: pay.supplier.name,
        paymentMethod: pay.paymentMethod,
        notes: pay.notes || undefined
      })
    })

    // Add employee payments
    employeePayments.forEach(pay => {
      // Use createdAt for accurate time, fallback to paymentDate if createdAt is not available
      const timeSource = pay.createdAt || pay.paymentDate
      transactions.push({
        id: `employee-${pay.id}`,
        type: 'employee_payment',
        date: pay.paymentDate.toISOString().split('T')[0],
        time: formatTime(timeSource),
        amount: Number(pay.amount),
        shopId: Number(pay.shopId),
        shopName: pay.shop.name,
        recipientName: pay.employee.name,
        paymentMethod: pay.paymentMethod,
        notes: pay.notes || undefined
      })
    })

    // Sort by date and time (most recent first)
    transactions.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return b.time.localeCompare(a.time)
    })

    return NextResponse.json({
      success: true,
      data: transactions
    })

  } catch (error) {
    console.error('Error fetching all transactions:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch transactions' 
    }, { status: 500 })
  }
}

