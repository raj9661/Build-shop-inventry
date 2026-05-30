import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';


// GET - List all expenses
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }
    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    // Build where clause with shop filter
    const whereClause: any = { isActive: true };
    if (Object.keys(shopFilter).length > 0) {
      Object.assign(whereClause, shopFilter);
    }

    const expenses = await prisma.expense.findMany({ where: whereClause });
    // Convert BigInt fields to string
    const safeExpenses = expenses.map(exp => ({
      ...exp,
      id: exp.id.toString(),
      shopId: exp.shopId.toString()
    }));
    return NextResponse.json({ success: true, data: { expenses: safeExpenses } });
  } catch (error) {
    console.error('Get expenses error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json();
    const { type, category, description, amount, date, shopId: requestShopId } = body;
    
    // Use category if provided, otherwise use type (for backward compatibility)
    const expenseType = category || type;

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json({ success: false, message: 'Valid amount is required' }, { status: 400 });
    }

    // Get shop filter based on user's access
    const shopFilter = await getShopFilter(token);
    
    let shopId: number;
    
    if (requestShopId) {
      // Validate that user can access the requested shopId
      let hasAccess = false;
      
      if (Object.keys(shopFilter).length === 0) {
        // SUPER_DUPER_ADMIN with no restrictions
        hasAccess = true;
      } else if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
        hasAccess = (shopFilter as any).shopId.in.includes(parseInt(requestShopId));
      } else if ('createdBy' in shopFilter) {
        // For SUPER_DUPER_ADMIN, check if the shop was created by them
        const shop = await prisma.shop.findUnique({
          where: { id: BigInt(requestShopId) },
          select: { createdBy: true, isActive: true }
        });
        hasAccess = !!(shop && shop.createdBy === BigInt(shopFilter.createdBy) && shop.isActive);
      }
      
      if (!hasAccess) {
        return NextResponse.json({ success: false, message: 'You do not have access to this shop' }, { status: 403 });
      }
      
      shopId = parseInt(requestShopId);
    } else {
      // No shopId provided, use first available shop
      if (Object.keys(shopFilter).length > 0) {
        if ('shopId' in shopFilter && Array.isArray((shopFilter as any).shopId?.in)) {
          const availableShops = (shopFilter as any).shopId.in;
          if (availableShops.length > 0) {
            shopId = availableShops[0];
          } else {
            return NextResponse.json({ success: false, message: 'No accessible shops found' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ success: false, message: 'shopId is required' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ success: false, message: 'shopId is required' }, { status: 400 });
      }
    }

    // Validate and map category to ExpenseCategory enum
    const validCategories = ['RENT', 'ELECTRICITY', 'WATER', 'INTERNET', 'SALARY', 'MAINTENANCE', 'MARKETING', 'TRANSPORTATION', 'OTHER'];
    let expenseCategory = 'OTHER';
    
    if (expenseType && validCategories.includes(expenseType.toUpperCase())) {
      expenseCategory = expenseType.toUpperCase();
    } else if (expenseType) {
      // Map common category names to enum values
      const categoryMap: { [key: string]: string } = {
        'general': 'OTHER',
        'fuel': 'TRANSPORTATION',
        'diesel': 'TRANSPORTATION',
        'petrol': 'TRANSPORTATION',
        'gas': 'TRANSPORTATION',
        'repair': 'MAINTENANCE',
        'maintenance': 'MAINTENANCE',
        'advertising': 'MARKETING',
        'wages': 'SALARY',
        'employee': 'SALARY',
        'utilities': 'ELECTRICITY',
        'phone': 'INTERNET',
        'broadband': 'INTERNET'
      };
      
      const normalizedType = expenseType.toLowerCase().trim();
      expenseCategory = categoryMap[normalizedType] || 'OTHER';
    }

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        description: description || type || 'General Expense',
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        category: expenseCategory,
        shopId: BigInt(shopId),
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Expense added successfully',
      data: {
        id: Number(expense.id),
        description: expense.description,
        amount: Number(expense.amount),
        category: expense.category,
        date: expense.date
      }
    });

  } catch (error) {
    console.error('Add expense error:', error);
    return NextResponse.json({ success: false, message: 'Failed to add expense' }, { status: 500 });
  }
} 